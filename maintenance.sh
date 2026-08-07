#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# REEBOW TECH PLATFORM — MAINTENANCE DAEMON
# Version: 2.0.0 | Runs as systemd timer or cron | Logs to journald/syslog
# ════════════════════════════════════════════════════════════════════════

set -euo pipefail
IFS=$'\n\t'

# ────────────────────────────────────────────────────────────────────────
# CONFIGURATION (Override via environment or /etc/reebow/maintenance.conf)
# ────────────────────────────────────────────────────────────────────────
MAINTENANCE_DIR="${MAINTENANCE_DIR:-/opt/reebow-maintenance}"
LOG_DIR="${LOG_DIR:-/var/log/reebow}"
DB_NAME="${DB_NAME:-reebow-platform}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"
RETENTION_DAYS_LOGS="${RETENTION_DAYS_LOGS:-90}"
RETENTION_DAYS_MESSAGES="${RETENTION_DAYS_MESSAGES:-365}"
RETENTION_DAYS_CALLS="${RETENTION_DAYS_CALLS:-90}"
MAX_TEMP_AGE_HOURS="${MAX_TEMP_AGE_HOURS:-6}"
MEMORY_THRESHOLD_MB="${MEMORY_THRESHOLD_MB:-512}"
PM2_APP_NAME="${PM2_APP_NAME:-reebow}"
SSL_DOMAINS="${SSL_DOMAINS:-}"
ENABLE_BACKUP="${ENABLE_BACKUP:-true}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/reebow}"
NOTIFY_WEBHOOK="${NOTIFY_WEBHOOK:-}"

# Load external config if exists
[[ -f /etc/reebow/maintenance.conf ]] && source /etc/reebow/maintenance.conf

# ────────────────────────────────────────────────────────────────────────
# LOGGING SETUP
# ────────────────────────────────────────────────────────────────────────
exec 1> >(logger -t reebow-maintenance -s 2>/dev/stdout) 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
log_info() { log "ℹ️ INFO: $*"; }
log_warn() { log "⚠️ WARN: $*"; }
log_error() { log "❌ ERROR: $*"; }
log_success() { log "✅ SUCCESS: $*"; }

notify() {
    local level="$1" message="$2"
    if [[ -n "$NOTIFY_WEBHOOK" ]]; then
        curl -fsS -X POST "$NOTIFY_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"[REEBOW $level] $message\",\"username\":\"Maintenance\"}" >/dev/null 2>&1 || true
    fi
}

# ────────────────────────────────────────────────────────────────────────
# UTILITY FUNCTIONS
# ────────────────────────────────────────────────────────────────────────
check_mongo() {
    mongosh "$MONGO_URI/$DB_NAME" --quiet --eval 'db.runCommand("ping").ok' >/dev/null 2>&1
}

mongo_exec() {
    mongosh "$MONGO_URI/$DB_NAME" --quiet --eval "$1"
}

get_disk_usage() {
    df -h / | awk 'NR==2 {print $5}' | sed 's/%//'
}

get_memory_usage_mb() {
    free -m | awk 'NR==2 {print $3}'
}

get_pm2_memory_mb() {
    pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="'$PM2_APP_NAME'") | .monit.memory' 2>/dev/null || echo 0
}

# ────────────────────────────────────────────────────────────────────────
# MAINTENANCE TASKS
# ────────────────────────────────────────────────────────────────────────

# 1. Log Rotation & Compression
rotate_logs() {
    log_info "Rotating application logs..."
    
    # Application logs
    find "$LOG_DIR" -name "*.log" -type f -mtime +1 -exec gzip -f {} \; 2>/dev/null || true
    find "$LOG_DIR" -name "*.log.gz" -type f -mtime +"$RETENTION_DAYS_LOGS" -delete 2>/dev/null || true
    
    # Nginx logs (if present)
    if [[ -d /var/log/nginx ]]; then
        find /var/log/nginx -name "*.log" -type f -mtime +1 -exec gzip -f {} \; 2>/dev/null || true
        find /var/log/nginx -name "*.log.gz" -type f -mtime +"$RETENTION_DAYS_LOGS" -delete 2>/dev/null || true
    fi
    
    # PM2 logs
    if command -v pm2 >/dev/null; then
        pm2 flush "$PM2_APP_NAME" >/dev/null 2>&1 || true
    fi
    
    log_success "Log rotation complete"
}

# 2. MongoDB Cleanup
cleanup_mongodb() {
    log_info "Running MongoDB maintenance..."
    
    if ! check_mongo; then
        log_error "MongoDB not accessible, skipping cleanup"
        notify "ERROR" "MongoDB inaccessible during maintenance"
        return 1
    fi
    
    # Prune old messages
    local msg_cutoff=$(date -d "-$RETENTION_DAYS_MESSAGES days" --iso-8601=seconds 2>/dev/null || date -v-"$RETENTION_DAYS_MESSAGES"d --iso-8601=seconds)
    local msg_result=$(mongo_exec "
        db.visitors.updateMany(
            {},
            { \\\$pull: { messages: { timestamp: { \\\$lt: new Date('$msg_cutoff') } } } }
        ).modifiedCount
    ")
    log_info "Pruned messages older than $RETENTION_DAYS_MESSAGES days: $msg_result modified"
    
    # Prune old call logs
    local call_cutoff=$(date -d "-$RETENTION_DAYS_CALLS days" --iso-8601=seconds 2>/dev/null || date -v-"$RETENTION_DAYS_CALLS"d --iso-8601=seconds)
    local call_result=$(mongo_exec "
        db.visitors.updateMany(
            {},
            { \\\$pull: { callLogs: { timestamp: { \\\$lt: new Date('$call_cutoff') } } } }
        ).modifiedCount
    ")
    log_info "Pruned call logs older than $RETENTION_DAYS_CALLS days: $call_result modified"
    
    # Mark stale visitors offline (no heartbeat > 10 min)
    local stale_cutoff=$(date -d "-10 minutes" --iso-8601=seconds 2>/dev/null || date -v-10M --iso-8601=seconds)
    local stale_result=$(mongo_exec "
        db.visitors.updateMany(
            { isOnline: true, lastSeen: { \\\$lt: new Date('$stale_cutoff') } },
            { \\\$set: { isOnline: false } }
        ).modifiedCount
    ")
    log_info "Marked stale visitors offline: $stale_result modified"
    
    # Compact collections (if using WiredTiger)
    mongo_exec 'db.visitors.compact()' >/dev/null 2>&1 || true
    
    log_success "MongoDB cleanup complete"
}

# 3. Temp File Cleanup
cleanup_temp() {
    log_info "Cleaning temporary files older than $MAX_TEMP_AGE_HOURS hours..."
    
    # System temp
    find /tmp -name "reebow-*" -type f -mmin +"$((MAX_TEMP_AGE_HOURS * 60))" -delete 2>/dev/null || true
    find /tmp -name "reebow-*" -type d -empty -delete 2>/dev/null || true
    
    # App temp (if in container)
    [[ -d /app/public/temp ]] && find /app/public/temp -type f -mmin +"$((MAX_TEMP_AGE_HOURS * 60))" -delete 2>/dev/null || true
    
    log_success "Temp cleanup complete"
}

# 4. Memory Watchdog
check_memory() {
    log_info "Checking memory usage..."
    
    local sys_mem=$(get_memory_usage_mb)
    local pm2_mem=$(get_pm2_memory_mb)
    
    log_info "System memory used: ${sys_mem}MB | PM2 app memory: ${pm2_mem}MB"
    
    if [[ $pm2_mem -gt $MEMORY_THRESHOLD_MB ]]; then
        log_warn "PM2 app memory (${pm2_mem}MB) exceeds threshold (${MEMORY_THRESHOLD_MB}MB)"
        notify "WARN" "High memory usage: ${pm2_mem}MB (threshold: ${MEMORY_THRESHOLD_MB}MB)"
        
        if command -v pm2 >/dev/null; then
            log_info "Restarting $PM2_APP_NAME via PM2..."
            pm2 restart "$PM2_APP_NAME" --update-env
            notify "INFO" "PM2 app restarted due to high memory"
        fi
    fi
    
    if [[ $sys_mem -gt 90 ]]; then
        log_warn "System memory usage critical: ${sys_mem}%"
        notify "WARN" "System memory critical: ${sys_mem}%"
    fi
}

# 5. Disk Space Check
check_disk() {
    log_info "Checking disk space..."
    
    local usage=$(get_disk_usage)
    log_info "Disk usage: ${usage}%"
    
    if [[ $usage -gt 85 ]]; then
        log_warn "Disk usage high: ${usage}%"
        notify "WARN" "Disk usage high: ${usage}%"
    fi
    
    if [[ $usage -gt 95 ]]; then
        log_error "Disk usage critical: ${usage}%"
        notify "ERROR" "Disk usage critical: ${usage}%"
        # Emergency cleanup
        find "$LOG_DIR" -name "*.log.gz" -mtime +7 -delete 2>/dev/null || true
        docker system prune -f >/dev/null 2>&1 || true
    fi
}

# 6. Database Backup
backup_database() {
    [[ "$ENABLE_BACKUP" != "true" ]] && return 0
    
    log_info "Creating MongoDB backup..."
    
    mkdir -p "$BACKUP_DIR"
    local backup_file="$BACKUP_DIR/reebow-$DB_NAME-$(date '+%Y%m%d-%H%M%S').archive.gz"
    
    if mongodump --uri="$MONGO_URI" --db="$DB_NAME" --archive="$backup_file" --gzip 2>/dev/null; then
        log_success "Backup created: $backup_file"
        notify "INFO" "Backup created: $(basename "$backup_file")"
        
        # Keep only last 7 backups
        find "$BACKUP_DIR" -name "reebow-$DB_NAME-*.archive.gz" -type f -mtime +7 -delete 2>/dev/null || true
    else
        log_error "Backup failed"
        notify "ERROR" "MongoDB backup failed"
    fi
}

# 7. SSL Certificate Renewal (Let's Encrypt)
renew_ssl() {
    [[ -z "$SSL_DOMAINS" ]] && return 0
    
    log_info "Checking SSL certificates for: $SSL_DOMAINS"
    
    if command -v certbot >/dev/null; then
        certbot renew --quiet --no-self-upgrade --deploy-hook "systemctl reload nginx" 2>/dev/null || {
            log_warn "Certbot renewal had issues"
        }
        
        for domain in $SSL_DOMAINS; do
            local cert_file="/etc/letsencrypt/live/$domain/fullchain.pem"
            if [[ -f "$cert_file" ]]; then
                local expiry=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
                local expiry_epoch=$(date -d "$expiry" +%s)
                local now_epoch=$(date +%s)
                local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
                
                log_info "Certificate for $domain expires in $days_left days ($expiry)"
                
                if [[ $days_left -lt 14 ]]; then
                    log_warn "Certificate for $domain expiring soon ($days_left days)"
                    notify "WARN" "SSL cert for $domain expires in $days_left days"
                fi
            fi
        done
    else
        log_warn "Certbot not installed, skipping SSL check"
    fi
}

# 8. Health Check Endpoint Test
test_health_endpoint() {
    local port="${PORT:-10000}"
    local url="http://localhost:$port/health"
    
    log_info "Testing health endpoint: $url"
    
    if curl -fsS --max-time 10 "$url" | grep -q '"status":"ok"'; then
        log_success "Health endpoint responding OK"
    else
        log_error "Health endpoint check failed"
        notify "ERROR" "Health endpoint not responding"
        
        if command -v pm2 >/dev/null; then
            log_info "Attempting PM2 restart..."
            pm2 restart "$PM2_APP_NAME" --update-env
        fi
    fi
}

# 9. Update PM2 Process List (if ecosystem changed)
update_pm2() {
    if [[ -f /app/ecosystem.config.js ]] && command -v pm2 >/dev/null; then
        log_info "Checking PM2 ecosystem..."
        pm2 reload "$PM2_APP_NAME" --update-env >/dev/null 2>&1 || true
    fi
}

# ────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ────────────────────────────────────────────────────────────────────────
main() {
    local start_time=$(date +%s)
    log_info "═══════════════════════════════════════"
    log_info "REEBOW MAINTENANCE STARTED - $(date)"
    log_info "═══════════════════════════════════════"
    
    # Create lock file to prevent concurrent runs
    local lock_file="/var/lock/reebow-maintenance.lock"
    if [[ -f "$lock_file" ]]; then
        local lock_pid=$(cat "$lock_file" 2>/dev/null)
        if kill -0 "$lock_pid" 2>/dev/null; then
            log_warn "Maintenance already running (PID: $lock_pid), exiting"
            exit 0
        fi
        log_warn "Stale lock file found, removing"
    fi
    echo $$ > "$lock_file"
    trap "rm -f '$lock_file'" EXIT
    
    # Run maintenance tasks
    local failed=0
    
    run_task "Log Rotation" rotate_logs || failed=1
    run_task "MongoDB Cleanup" cleanup_mongodb || failed=1
    run_task "Temp Cleanup" cleanup_temp || failed=1
    run_task "Memory Check" check_memory || true  # Don't fail maintenance for memory
    run_task "Disk Check" check_disk || true
    run_task "Health Check" test_health_endpoint || failed=1
    run_task "SSL Renewal" renew_ssl || true
    run_task "Database Backup" backup_database || failed=1
    run_task "PM2 Update" update_pm2 || true
    
    local duration=$(( $(date +%s) - start_time ))
    
    log_info "═══════════════════════════════════════"
    if [[ $failed -eq 0 ]]; then
        log_success "MAINTENANCE COMPLETED SUCCESSFULLY in ${duration}s"
        notify "SUCCESS" "Maintenance completed in ${duration}s"
    else
        log_error "MAINTENANCE COMPLETED WITH ERRORS in ${duration}s"
        notify "ERROR" "Maintenance completed with errors in ${duration}s"
    fi
    log_info "═══════════════════════════════════════"
}

run_task() {
    local name="$1" func="$2"
    log_info "▶ $name..."
    if $func; then
        log_success "✓ $name"
        return 0
    else
        log_error "✗ $name FAILED"
        return 1
    fi
}

# ────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ────────────────────────────────────────────────────────────────────────
case "${1:-run}" in
    run) main ;;
    logs) rotate_logs ;;
    db) cleanup_mongodb ;;
    temp) cleanup_temp ;;
    memory) check_memory ;;
    disk) check_disk ;;
    backup) backup_database ;;
    ssl) renew_ssl ;;
    health) test_health_endpoint ;;
    *) 
        echo "Usage: $0 {run|logs|db|temp|memory|disk|backup|ssl|health}"
        exit 1
        ;;
esac