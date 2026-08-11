Reebow TECH Platform — Deployment Guide
Version: 2.0.0
Platforms: Render, Railway, DigitalOcean, VPS (Ubuntu), Docker/Kubernetes
Database: MongoDB Atlas (recommended) or self-hosted
Table of Contents
 * Pre-Deployment Checklist
 * Platform-Specific Guides
 * Database Setup
 * Environment Configuration
 * SSL & Custom Domains
 * Process Management
 * Monitoring & Logging
 * Backup Strategy
 * Rollback Procedure
 * Multi-Tenant Provisioning
Pre-Deployment Checklist
Before deploying, ensure you have:
 * [ ] GitHub repository with code pushed
 * [ ] MongoDB Atlas cluster created (M0 free tier OK)
 * [ ] Database user with readWrite on target database
 * [ ] Network access configured (0.0.0.0/0 or your platform IPs)
 * [ ] Domain name (optional but recommended)
 * [ ] Payment provider accounts if using multi-tenant (Stripe, NOWPayments, Paystack)
 * [ ] Strong secrets generated (see Environment Configuration)
Generate Production Secrets
# Session secret (128 hex chars = 256-bit)
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Webhook secret
node -e "console.log('WEBHOOK_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Admin password (save securely!)
node -e "console.log('ADMIN_PASSWORD=' + require('crypto').randomBytes(16).toString('base64'))"

Platform-Specific Guides
1. Render (Recommended — Easiest Setup)
 * Create Web Service: New → Web Service → Connect GitHub repo.
 * Settings:
   * Name: reebow-platform
   * Region: Oregon (US West) or Frankfurt (EU)
   * Branch: main
   * Build Command: npm ci --production
   * Start Command: npm start
 * Environment Variables: Copy configuration from .env.example and fill in all values.
 * Add Custom Domain: Settings → Custom Domains → Add your domain, then configure your CNAME DNS record.
2. Railway
 * Quick Deploy via CLI:
   npm i -g @railway/cli
railway login
railway init
railway variables set NODE_ENV=production
railway up

 * Railway Template (railway.json):
   {
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}

3. VPS (Ubuntu 22.04 / 24.04) — Full Control
 * Server Setup & Dependencies:
   sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx nodejs npm certbot python3-certbot-nginx git htop

 * Clone & Configure:
   sudo useradd -m -s /bin/bash reebow
sudo -u reebow -i
git clone https://github.com/your-org/reebow-platform.git /home/reebow/reebow-platform
cd /home/reebow/reebow-platform
npm ci --production
cp .env.example .env

Database Setup
MongoDB Atlas (Recommended)
 * Create a free cluster at cloud.mongodb.com.
 * Create a Database Access user with readWrite permissions on reebow-platform.
 * Configure Network Access to allow inbound connections (0.0.0.0/0 or specific server IPs).
 * Use the generated connection string in your environment configuration:
   MONGO_URI=mongodb+srv://reebow_user:<PASSWORD>@cluster0.xxxxx.mongodb.net/reebow-platform?retryWrites=true&w=majority

Environment Configuration
Complete .env Reference
# Core Settings
NODE_ENV=production
PORT=10000
APP_URL=https://yourdomain.com
API_PREFIX=/api

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/reebow-platform?retryWrites=true&w=majority
MONGO_DB_NAME=reebow-platform

# Security & Sessions
SESSION_SECRET=128_hex_chars_from_crypto_randomBytes_64
SESSION_NAME=reebow.sid
SESSION_MAX_AGE_MS=2592000000
SESSION_SECURE_COOKIES=true
SESSION_SAME_SITE=lax
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=StrongRandomPassword123!

# Features & Hotlines
DEFAULT_PERSONA=annie
DEFAULT_LANGUAGE=en
HOTLINE_PRIMARY=+1 555 123 4567
HOTLINE_SECONDARY=+1 555 987 6543
SUPPORT_EMAIL=support@yourdomain.com

SSL & Custom Domains
Let's Encrypt (Certbot)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com \
  --email admin@yourdomain.com --agree-tos --no-eff-email --redirect

Cloudflare Recommended Settings
 * SSL/TLS: Full (Strict)
 * Always Use HTTPS: Enabled
 * Browser Cache TTL: 1 year for static assets.
 * Cache Rules: Bypass cache for API and WebSocket endpoints (/api/*, /socket.io/*).
Process Management
PM2 Process Manager (VPS)
sudo npm i -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u reebow --hp /home/reebow

Monitoring & Logging
 * Health Check Endpoint: GET /health returns system readiness and MongoDB connectivity status.
 * Log Management: Access Winston structured JSON logs stored in /var/log/reebow/combined.log.
Backup Strategy
Automated Backups
Run daily backups using the maintenance script to create compressed archives in /var/backups/reebow/.
Manual Backup & Restore
# Backup dump
mongodump --uri="$MONGO_URI" --db=reebow-platform --archive=backup-$(date +%F).archive --gzip

# Restore database
mongorestore --uri="$MONGO_URI" --db=reebow-platform --archive=backup-2026-08-11.archive --gzip --drop

Rollback Procedure
 * Application Rollback: Revert via your platform dashboard (Render/Railway/DO) or redeploy the previous stable Git commit hash.
 * Database Rollback: Restore from the latest verified .archive backup using mongorestore.
Multi-Tenant Provisioning
 * Configure your payment provider webhook endpoint: [https://yourdomain.com/api/payment-webhook](https://yourdomain.com/api/payment-webhook)
 * Upon a successful payment event, the backend automatically provisions a new isolated workspace tenant, generates a secure admin password, and returns dedicated customer URLs.
Troubleshooting Common Issues
| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| Socket.io connects then disconnects | WebSocket upgrade blocked by proxy | Verify proxy headers (proxy_set_header Upgrade $http_upgrade;) |
| Database connection fails | Incorrect URI or IP whitelist blocked | Verify MongoDB Atlas network access and connection string |
| CORS errors in browser | Origin mismatch | Set exact domain in CORS_ORIGIN environment variable |
| Admin login fails | Default password not updated | Check .env file configuration and restart application process |
End of Deployment Guide — See also: Architecture, API Reference, Client Handover
