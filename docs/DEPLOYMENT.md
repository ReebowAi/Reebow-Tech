# Reebow TECH Platform — Deployment Guide

**Version:** 2.0.0  
**Platforms:** Render, Railway, DigitalOcean, VPS (Ubuntu), Docker/Kubernetes  
**Database:** MongoDB Atlas (recommended) or self-hosted

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Platform-Specific Guides](#platform-specific-guides)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [SSL & Custom Domains](#ssl--custom-domains)
6. [Process Management](#process-management)
7. [Monitoring & Logging](#monitoring--logging)
8. [Backup Strategy](#backup-strategy)
9. [Rollback Procedure](#rollback-procedure)
10. [Multi-Tenant Provisioning](#multi-tenant-provisioning)

---

## Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] **GitHub repository** with code pushed
- [ ] **MongoDB Atlas cluster** created (M0 free tier OK)
- [ ] **Database user** with `readWrite` on target database
- [ ] **Network access** configured (0.0.0.0/0 or your platform IPs)
- [ ] **Domain name** (optional but recommended)
- [ ] **Payment provider accounts** if using multi-tenant (Stripe, NOWPayments, Paystack)
- [ ] **Strong secrets generated** (see Environment Configuration)

### Generate Production Secrets

```bash
# Session secret (128 hex chars = 256-bit)
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Webhook secret
node -e "console.log('WEBHOOK_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Admin password (save securely!)
node -e "console.log('ADMIN_PASSWORD=' + require('crypto').randomBytes(16).toString('base64'))"Platform-Specific Guides1. Render (Recommended — Easiest Free Tier)Create Web Service1.New → Web Service → Connect GitHub repo2.Settings:Name: reebow-platform
Region: Oregon (US West) or Frankfurt (EU)
Branch: main
Build Command: npm ci --production
Start Command: npm start3.Environment Variables (copy from .env.example, fill in values):NODE_ENV=production
PORT=10000
APP_URL=https://your-app.onrender.com
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/reebow-platform
SESSION_SECRET=your_128_hex_chars
ADMIN_PASSWORD=your_strong_password
ADMIN_EMAIL=admin@yourdomain.com
CORS_ORIGIN=https://your-app.onrender.com
SESSION_SECURE_COOKIES=true
HELMET_CSP_ENABLED=true
TRUST_PROXY=true
HOTLINE_PRIMARY=+1 555 123 4567
HOTLINE_SECONDARY=+1 555 987 6543
DEFAULT_PERSONA=annie4.Deploy → Wait for build → Auto HTTPS enabledAdd Custom Domain1.Settings → Custom Domains → Add yourdomain.com2.DNS: Add CNAME yourdomain.com → your-app.onrender.com3.Render provisions SSL automaticallyEnable Redis (For Horizontal Scaling)# Add Redis add-on in Render dashboard
# Environment variable added automatically: REDIS_URLThen in server.js, initialize Socket.io Redis adapter:if (process.env.REDIS_URL) {
  const { createAdapter } = require('@socket.io/redis-adapter');
  const { createClient } = require('redis');
  
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  
  log.info('Socket.io Redis adapter enabled');
}2. RailwayQuick Deploy# Install CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set NODE_ENV=production
railway variables set MONGO_URI="mongodb+srv://..."
railway variables set SESSION_SECRET="..."
# ... all variables

# Deploy
railway upRailway Template (One-Click)Create railway.json:{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}Then: New Project → Deploy from GitHub → Select repo → Deploy3. DigitalOcean App PlatformApp Spec (.do/app.yaml)name: reebow-platform
services:
- name: api
  source_dir: /
  github:
    repo: your-org/reebow-platform
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: "10000"
  - key: MONGO_URI
    value: "${MONGO_URI}"
    type: SECRET
  - key: SESSION_SECRET
    value: "${SESSION_SECRET}"
    type: SECRET
  - key: ADMIN_PASSWORD
    value: "${ADMIN_PASSWORD}"
    type: SECRET
  - key: ADMIN_EMAIL
    value: admin@yourdomain.com
  - key: CORS_ORIGIN
    value: "${APP_URL}"
  - key: APP_URL
    value: "https://your-app.ondigitalocean.app"
  - key: HOTLINE_PRIMARY
    value: "+1 555 123 4567"
  - key: HOTLINE_SECONDARY
    value: "+1 555 987 6543"
  health_check:
    http_path: /health
    initial_delay_seconds: 30
    period_seconds: 10
    timeout_seconds: 5

databases:
- name: mongodb
  engine: MONGODB
  version: "7"
  size_slug: db-s-dev-databaseDeploy# Install doctl
# Create app
doctl apps create --spec .do/app.yaml

# Or via UI: Cloud → Apps → Create App → Connect GitHub4. VPS (Ubuntu 22.04/24.04) — Full ControlServer Setup# Update & install
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx nodejs npm certbot python3-certbot-nginx git htop

# Node 20 LTS (if not default)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v  # v20.x.x
npm -v   # 10.x.xDeploy Application# Create deploy user
sudo useradd -m -s /bin/bash reebow
sudo usermod -aG sudo reebow

# Clone as deploy user
sudo -u reebow -i
cd /home/reebow
git clone https://github.com/your-org/reebow-platform.git
cd reebow-platform
npm ci --production

# Configure environment
cp .env.example .env
nano .env  # Fill in ALL values

# Build clips manifest (if clips exist)
mkdir -p public/clips/annie public/clips/craig
# Add your .mp4 clips, then:
node -e "
const fs = require('fs');
const base = '/clips';
const manifest = {};
['annie','craig'].forEach(p => {
  manifest[p] = {};
  try {
    fs.readdirSync('public'+base+'/'+p).filter(f => f.endsWith('.mp4')).forEach(f => {
      manifest[p][f.replace('.mp4','')] = { url: base+'/'+p+'/'+f };
    });
  } catch {}
});
fs.writeFileSync('public/clips/manifest.json', JSON.stringify(manifest, null, 2));
"PM2 Process Manager# Install PM2 globally
sudo npm i -g pm2

# Create ecosystem config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'reebow',
    script: 'server.js',
    cwd: '/home/reebow/reebow-platform',
    env: {
      NODE_ENV: 'production',
      PORT: 10000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 10000
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    error_file: '/var/log/reebow/error.log',
    out_file: '/var/log/reebow/out.log',
    log_file: '/var/log/reebow/combined.log',
    time: true,
    autorestart: true,
    restart_delay: 5000,
    min_uptime: '10s'
  }]
};
EOF

# Create log directory
sudo mkdir -p /var/log/reebow
sudo chown reebow:reebow /var/log/reebow

# Start app
cd /home/reebow/reebow-platform
pm2 start ecosystem.config.js --env production
pm2 save

# Startup script
pm2 startup systemd -u reebow --hp /home/reebow
# Run the command it outputs (sudo ...)Nginx Reverse Proxy# Create site config
sudo tee /etc/nginx/sites-available/reebow << 'EOF'
upstream reebow_backend {
    server 127.0.0.1:10000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL (certbot will fill these)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # Proxy
    location / {
        proxy_pass http://reebow_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;

        # WebSocket support
        proxy_set_header Connection "";
    }

    # Static assets - long cache
    location ~* \.(js|css|png|jpg|jpeg|webp|avif|svg|woff2?|ico)$ {
        proxy_pass http://reebow_backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://reebow_backend;
        access_log off;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/reebow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com \
  --email admin@yourdomain.com --agree-tos --no-eff-email --redirectSystemd Service for Maintenance# Copy maintenance script
sudo cp maintenance.sh /usr/local/bin/reebow-maintenance
sudo chmod +x /usr/local/bin/reebow-maintenance

# Create config
sudo mkdir -p /etc/reebow
sudo tee /etc/reebow/maintenance.conf << 'EOF'
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/reebow-platform
DB_NAME=reebow-platform
LOG_DIR=/var/log/reebow
RETENTION_DAYS_LOGS=90
RETENTION_DAYS_MESSAGES=365
RETENTION_DAYS_CALLS=90
MEMORY_THRESHOLD_MB=512
PM2_APP_NAME=reebow
SSL_DOMAINS="yourdomain.com www.yourdomain.com"
ENABLE_BACKUP=true
BACKUP_DIR=/var/backups/reebow
NOTIFY_WEBHOOK=https://hooks.slack.com/services/xxx/yyy/zzz
EOF

# Create directories
sudo mkdir -p /var/backups/reebow /var/lock /var/log/reebow
sudo chown -R reebow:reebow /var/backups/reebow /var/log/reebow5. Docker DeploymentSingle Container# Build
docker build -t reebow-platform:2.0.0 .

# Run
docker run -d \
  --name reebow \
  --restart unless-stopped \
  --security-opt no-new-privileges:true \
  --cap-drop=ALL \
  --read-only \
  --tmpfs /tmp/reebow:exec,size=100m \
  --tmpfs /var/log/reebow:size=50m \
  -p 10000:10000 \
  --env-file .env \
  reebow-platform:2.0.0Docker Compose (with MongoDB)# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: runtime
    image: reebow-platform:local
    container_name: reebow-app
    restart: unless-stopped
    ports:
      - "10000:10000"
    env_file:
      - .env
    environment:
      - MONGO_URI=mongodb://mongodb:27017/reebow-platform
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp/reebow:exec,size=100m
      - /var/log/reebow:size=50m
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:10000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    volumes:
      - ./public/clips:/app/public/clips:ro

  mongodb:
    image: mongo:7-jammy
    container_name: reebow-mongo
    restart: unless-stopped
    ports:
      - "127.0.0.1:27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=reebow-platform
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

volumes:
  mongo-data:# Deploy
docker compose up -d

# View logs
docker compose logs -f app6. GitHub Pages (Static Frontend Only)If you want to host static files on GitHub Pages and API separately:# In repo settings: Pages → Source: Deploy from branch → main / (root)
# Or use GitHub Actions for build

# .github/workflows/pages.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: public
      - uses: actions/deploy-pages@v4Note: GitHub Pages = static only. Socket.io, API, clips need separate backend.Database SetupMongoDB Atlas (Recommended)1.Create Cluster: cloud.mongodb.com → Build → M0 Free2.Database Access: Add user → readWrite on reebow-platform3.Network Access: Add IP → 0.0.0.0/0 (or specific IPs)4.Connection String:mongodb+srv://reebow_user:<PASSWORD>@cluster0.xxxxx.mongodb.net/reebow-platform?retryWrites=true&w=majority5.Collection Indexes: Auto-created by Mongoose on first runSelf-Hosted MongoDB# On VPS (or separate server)
wget -qO- https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org

# Config (/etc/mongod.conf)
# net.port: 27017
# net.bindIp: 127.0.0.1
# security.authorization: enabled

sudo systemctl enable --now mongod

# Create admin user
mongosh admin -u root -p
> db.createUser({ user: "reebow_user", pwd: "password", roles: [{ role: "readWrite", db: "reebow-platform" }] })Environment ConfigurationComplete .env Reference# ══════════════════════════════════════════════════════════════
# CORE (REQUIRED)
# ══════════════════════════════════════════════════════════════
NODE_ENV=production
PORT=10000
APP_URL=https://yourdomain.com
API_PREFIX=/api

# ══════════════════════════════════════════════════════════════
# MONGODB (REQUIRED)
# ══════════════════════════════════════════════════════════════
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/reebow-platform?retryWrites=true&w=majority
MONGO_DB_NAME=reebow-platform

# ══════════════════════════════════════════════════════════════
# AUTH & SESSIONS (REQUIRED - GENERATE NEW IN PRODUCTION!)
# ══════════════════════════════════════════════════════════════
SESSION_SECRET=128_hex_chars_from_crypto_randomBytes_64
SESSION_NAME=reebow.sid
SESSION_MAX_AGE_MS=2592000000
SESSION_SECURE_COOKIES=true
SESSION_SAME_SITE=lax
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=StrongRandomPassword123!
ADMIN_SESSION_TTL_MS=3600000

# ══════════════════════════════════════════════════════════════
# SECURITY
# ══════════════════════════════════════════════════════════════
HELMET_CSP_ENABLED=true
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
LOGIN_RATE_LIMIT_WINDOW_MS=900000
TRUST_PROXY=true

# ══════════════════════════════════════════════════════════════
# FEATURES
# ══════════════════════════════════════════════════════════════
DEFAULT_PERSONA=annie
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,fr,es,ar,pt

# ══════════════════════════════════════════════════════════════
# HOTLINES
# ══════════════════════════════════════════════════════════════
HOTLINE_PRIMARY=+1 555 123 4567
HOTLINE_SECONDARY=+1 555 987 6543
HOTLINE_WHATSAPP=+15551234567
SUPPORT_EMAIL=support@yourdomain.com

# ══════════════════════════════════════════════════════════════
# PAYMENT WEBHOOKS (OPTIONAL - FOR MULTI-TENANT)
# ══════════════════════════════════════════════════════════════
WEBHOOK_SECRET=64_hex_chars
PROVISION_ON_PAYMENT=true
NOWPAYMENTS_IPN_SECRET=...
NOWPAYMENTS_API_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=...

# ══════════════════════════════════════════════════════════════
# LOGGING & MAINTENANCE
# ══════════════════════════════════════════════════════════════
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DIR=/var/log/reebow
MAINT_INTERVAL_MS=86400000
MEMORY_WATCHDOG_MB=512SSL & Custom DomainsLet's Encrypt (Certbot) - Auto Renewal# Already configured in Nginx setup above
# Certbot installs systemd timer automatically

# Verify timer
systemctl list-timers | grep certbot

# Manual renewal test
sudo certbot renew --dry-runCloudflare (Recommended for DDoS + CDN)1.Add domain to Cloudflare2.SSL/TLS → Full (Strict)3.Edge Certificates → Always Use HTTPS → On4.Speed → Auto Minify → CSS, JS, HTML5.Caching → Browser Cache TTL → 1 year6.Page Rules:•*yourdomain.com/clips/* → Cache Level: Cache Everything, Edge TTL: 1 month•*yourdomain.com/api/* → Cache Level: Bypass•*yourdomain.com/socket.io/* → Cache Level: BypassCustom Domain on PlatformsPlatformStepsRenderSettings → Custom Domains → Add → CNAME to app.onrender.comRailwaySettings → Domains → Add → CNAME to up.railway.appDigitalOceanSettings → Domains → Add → CNAME to ondigitalocean.appProcess ManagementPM2 (VPS/Bare Metal)# Start
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit

# Logs
pm2 logs reebow --lines 100

# Restart
pm2 restart reebow --update-env

# Reload (zero-downtime)
pm2 reload reebow

# Delete
pm2 delete reebow

# Save for startup
pm2 save
pm2 startupSystemd (Alternative to PM2)# /etc/systemd/system/reebow.service
[Unit]
Description=Reebow TECH Platform
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=reebow
WorkingDirectory=/home/reebow/reebow-platform
Environment=NODE_ENV=production
EnvironmentFile=/home/reebow/reebow-platform/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536
MemoryLimit=1G

[Install]
WantedBy=multi-user.targetsudo systemctl daemon-reload
sudo systemctl enable --now reebowMonitoring & LoggingHealth Checks# Manual
curl -fsS https://yourdomain.com/health | jq

# Automated (cron every 5 min)
*/5 * * * * curl -fsS https://yourdomain.com/health >/dev/null || /usr/local/bin/reebow-maintenance healthLog Management# PM2 logs
pm2 logs reebow --out --lines 200

# Structured JSON logs (Winston)
tail -f /var/log/reebow/combined.log | jq

# Nginx access logs
tail -f /var/log/nginx/access.log

# Error alerts (setup in maintenance.sh NOTIFY_WEBHOOK)Recommended External MonitoringToolPurposeFree TierUptimeRobotHTTP/keyword monitoring50 monitorsBetter StackLogs + uptime + incidents1M logs/moGrafana CloudMetrics + logs + traces10k seriesSentryError tracking5k events/moHealthchecks.ioCron/heartbeat monitoring20 checksBackup StrategyAutomated (maintenance.sh)# Runs daily via systemd timer
# Creates: /var/backups/reebow/reebow-reebow-platform-YYYYMMDD-HHMMSS.archive.gz
# Retains: 7 daysManual Backup# Full dump
mongodump --uri="$MONGO_URI" --db=reebow-platform --archive=backup-$(date +%F).archive --gzip

# Restore
mongorestore --uri="$MONGO_URI" --db=reebow-platform --archive=backup-2025-01-15.archive --gzip --dropCross-Region Backup (Atlas)Enable Cloud Backup in Atlas → Backup → 
### Cross-Region Backup (Atlas)

Enable **Cloud Backup** in Atlas → **Backup** → **Continuous Backups** → **Enable**
- Retains 30 days of continuous snapshots
- Point-in-time recovery (1 second granularity)
- Cross-region replication (configure in **Advanced**)

### Verify Backup Integrity

```bash
# Monthly test restore
mongorestore --uri="mongodb://localhost:27017" --db=reebow-platform_test --archive=backup-$(date -d '1 month ago' +%F).archive --gzip --drop
# Check document counts match
mongosh "mongodb://localhost:27017/reebow-platform_test" --eval 'db.visitors.countDocuments()'Rollback ProcedureApplication Rollback (Render/Railway/DO)# Render: Dashboard → Deploys → Select previous → Promote to Live
# Railway: railway deploy --version <previous-deployment-id>
# DigitalOcean: App → Deployments → Rollover to previousDatabase Rollback# 1. Restore from backup archive
mongorestore --uri="$MONGO_URI" --db=reebow-platform --archive=backup-2025-01-15.archive --gzip --drop

# 2. OR point-in-time recovery (Atlas)
# Atlas → Backup → Restore → Select timestamp → Different cluster → Verify → Swap connection stringConfig Rollback# Git revert
git revert <bad-commit-hash>
git push origin main  # Triggers auto-deploy

# Or environment variable rollback
# Render/Railway/DO → Environment tab → History → Restore previous setMulti-Tenant ProvisioningAutomated (Payment Webhook)# 1. Configure payment provider webhook URL:
# https://yourdomain.com/api/payment-webhook

# 2. Set secrets in .env:
WEBHOOK_SECRET=your_64_hex_secret
STRIPE_WEBHOOK_SECRET=whsec_...
NOWPAYMENTS_IPN_SECRET=...

# 3. On successful payment, webhook creates tenant:
# POST /api/payment-webhook { clientEmail, plan, provider }

# 4. Returns URLs to give customer:
# Admin: https://yourdomain.com/admin.html?tenant=tenant_a1b2c3d4
# Visitor: https://yourdomain.com/visitor.html?tenant=tenant_a1b2c3d4
# Admin Password: Support_x7k9m2n1 (auto-generated)Manual Provisioning# Via API
curl -X POST https://yourdomain.com/api/payment-webhook \
  -H 'Content-Type: application/json' \
  -d '{"clientEmail": "client@co.com", "plan": "monthly", "provider": "manual"}'

# Via MongoDB (admin)
mongosh "mongodb+srv://..." --eval '
db.visitors.insertOne({
  tenantId: "tenant_manual_001",
  email: "client@co.com",
  adminPassword: "CustomPass123",
  status: "ACTIVE",
  sourcePanel: "manual",
  customAdminName: "Client Support",
  metadata: new Map([["plan", "monthly"], ["provisionedAt", new Date()]])
})'Tenant Isolation Verification# Admin for tenant_a sees only their visitors
curl "https://yourdomain.com/api/admin/visitors?tenantId=tenant_a" \
  --cookie admin-cookies.txt

# Must return empty for other tenantsProduction Checklist (Final Verification)Run before going live:# 1. Security
[ ] SESSION_SECRET generated (128 hex) - not default
[ ] ADMIN_PASSWORD changed from default
[ ] WEBHOOK_SECRET generated
[ ] CORS_ORIGIN locked to your domain only
[ ] HELMET_CSP_ENABLED=true
[ ] SESSION_SECURE_COOKIES=true
[ ] TRUST_PROXY=true (if behind proxy)

# 2. Database
[ ] MongoDB Atlas: IP whitelist configured
[ ] Database user: readWrite only on reebow-platform
[ ] Indexes created (check Atlas Performance Advisor)

# 3. SSL & Domain
[ ] Custom domain configured
[ ] SSL certificate valid (certbot/Cloudflare)
[ ] HSTS enabled
[ ] www → non-www or vice versa redirect

# 4. Features
[ ] Video clips uploaded to /public/clips/
[ ] clips/manifest.json generated
[ ] Test clip injection from admin panel

# 5. Monitoring
[ ] /health endpoint responding
[ ] Logs shipping to external (optional)
[ ] Uptime monitor configured

# 6. Backup
[ ] Maintenance script tested: ./maintenance.sh run
[ ] Backup created in /var/backups/reebow/
[ ] Restore tested on staging

# 5. Multi-tenant (if applicable)
[ ] Webhook URL configured in payment provider
[ ] Test provisioning flow
[ ] Tenant isolation verified

echo "✅ All checks passed - Ready for production!"Troubleshooting Common IssuesSymptomCauseFixSocket.io connects then disconnectsWebSocket upgrade blockedCheck proxy proxy_set_header Upgrade/Connectionmongoose.connection.readyState !== 1Wrong MONGO_URI or IP blockedVerify Atlas Network AccessCORS error in browserCORS_ORIGIN mismatchSet exact https://yourdomain.comAdmin login failsADMIN_PASSWORD env not setCheck .env, restart appVideo clips won't playRange requests not handledNginx: proxy_http_version 1.1; proxy_set_header Range...PWA install not promptedMissing manifest/sw.jsVerify /manifest.json and /sw.js accessibleMemory keeps growingClip videos not streaming properlyEnsure clips served with Accept-Ranges: bytesEnd of Deployment Guide
See also: Architecture, API Reference, Client Handover
---