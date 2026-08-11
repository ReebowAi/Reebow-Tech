Reebow TECH Platform — Client Handover Guide
Version: 2.0.0
Purpose: Complete checklist for delivering the platform to paying clients
Format: Step-by-step delivery package with scripts, credentials, and support terms
Table of Contents
 * Delivery Package Contents
 * Pre-Delivery Verification
 * Credential Handoff
 * Client Onboarding Session
 * Support Terms & SLA
 * White-Label Customization
 * Escalation Procedures
 * Maintenance Responsibilities
Delivery Package Contents
Digital Delivery (Secure Transfer)
Reebow-Platform-Client-[CLIENT_NAME]-[DATE]/
├── 📁 source-code/                 # Full source code (Git repo or ZIP)
│   ├── .env.example                # Template only - NO production secrets
│   ├── server.js
│   ├── package.json
│   ├── public/
│   │   ├── index.html
│   │   ├── admin.html
│   │   ├── visitor.html
│   │   ├── style.css
│   │   ├── mobile-fix.css
│   │   ├── sw.js
│   │   ├── manifest.json
│   │   ├── favicon.svg
│   │   ├── admin.js
│   │   ├── visitor.js
│   │   └── clips/                  # Empty structure - client adds their clips
│   ├── maintenance.sh
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── README.md
│   └── docs/
│
├── 📁 credentials/                 # ENCRYPTED (7z with AES-256)
│   ├── production.env              # Actual .env for production
│   ├── mongodb-credentials.txt     # Atlas URI, username, password
│   ├── admin-credentials.txt       # Admin email/password
│   ├── payment-webhook-secrets.txt # Stripe/NOWPayments/Paystack secrets
│   └── domain-credentials.txt      # Registrar, DNS, Cloudflare login
│
├── 📁 documentation/
│   ├── QUICK_START_GUIDE.md        # 5-minute setup for client
│   ├── ADMIN_GUIDE.md              # How to use Control Tower
│   ├── VISITOR_GUIDE.md            # Visitor experience overview
│   ├── VIDEO_CLIPS_GUIDE.md        # Recording & uploading clips
│   ├── DEPLOYMENT_GUIDE.md         # Platform-specific deploy
│   ├── API_REFERENCE.md            # For their developers
│   └── TROUBLESHOOTING.md          # Common issues & fixes
│
├── 📁 video-clips-template/        # Clip requirements & templates
│   ├── CLIP_SPECS.md
│   ├── RECORDING_SCRIPT.txt
│   ├── FILE_NAMING.md
│   └── sample-manifest.json
│
├── 📁 scripts/
│   ├── deploy-render.sh            # One-click Render deploy
│   ├── deploy-railway.sh           # One-click Railway deploy
│   ├── deploy-docker.sh            # Docker compose up
│   ├── backup-setup.sh             # Configures automated backups
│   └── ssl-setup.sh                # Certbot + Nginx config
│
└── 📄 DELIVERY_RECEIPT.md          # Signed acknowledgment

Pre-Delivery Verification
Complete all steps before handoff:
1. Code Quality Gate
# Run in client's repo (or fork)
git clone https://github.com/your-org/reebow-platform.git client-delivery
cd client-delivery

# Install & test
npm ci --production
npm run lint          # Must pass with 0 errors
npm start &           # Start in background
sleep 10
curl -fsS http://localhost:10000/health | grep '"status":"ok"'
kill %1

2. Production Deploy Test
 * Deploy to staging preview environment.
 * Run full smoke tests:
   curl -fsS https://staging-client.reebow.tech/health
curl -fsS https://staging-client.reebow.tech/api/version

3. Feature Verification Checklist
| Feature | Test Method | Status |
|---|---|---|
| Visitor registration | Open visitor.html, enter email | ✅ Pass |
| Admin login | Open admin.html, use credentials | ✅ Pass |
| Real-time chat | Send msg visitor → admin, admin → visitor | ✅ Pass |
| Video call (clip injection) | Admin clicks "Live Call", selects clip | ✅ Pass |
| Clip playback | Verify video loads and loops 'listening' | ✅ Pass |
| Realism filters | Admin toggles grain/blur/warmth | ✅ Pass |
| PWA install | Chrome DevTools → Application → Manifest → Install | ✅ Pass |
| Offline queue | Disconnect network, send msg, reconnect | ✅ Pass |
| Notifications | Desktop + sound + vibrate | ✅ Pass |
| Multi-language | Switch to FR/ES/AR/PT | ✅ Pass |
| Payment webhook | POST to /payment-webhook, verify tenant created | ✅ Pass |
| Backups | Run maintenance.sh backup, check /var/backups | ✅ Pass |
| SSL certificate | Valid, auto-renewal configured | ✅ Pass |
4. Security Audit
# 1. No secrets in code
grep -r "sk_live_\|mongodb+srv://.*://" --include="*.js" --include="*.json" .

# 2. Helmet headers present
curl -I https://staging-client.reebow.tech | grep -i "content-security-policy\|strict-transport"

# 3. Rate limiting works
for i in {1..6}; do curl -s -o /dev/null -w "%{http_code} " https://staging-client.reebow.tech/api/admin/login; done
# 6th should be 429

# 4. Session cookies secure
curl -I https://staging-client.reebow.tech/api/admin/login | grep -i "set-cookie.*secure.*httponly.*samesite"

Credential Handoff
Secure Transfer Protocol
NEVER send raw credentials via email, public Slack, or unencrypted channels.
 * Option 1: 1Password / Bitwarden Vault Sharing (Recommended)
   * Create vault: Reebow-[CLIENT]-Production
   * Share securely with client's email account.
   * Set expiration to 30 days.
 * Option 2: 7z AES-256 + Signal/Keybase
   7z a -p"STRONG_PASSWORD" -mhe=on credentials.7z credentials/

   * Send password via a separate private channel (Signal or phone call).
Credential Files Content
 * production.env — Only file the client puts in production (renamed to .env on server).
 * mongodb-credentials.txt:
   Cluster: https://cloud.mongodb.com
Project: Reebow-Client-[NAME]
Database: reebow-platform
Username: reebow_client_user
Password: [GENERATED_STRONG_PASSWORD]
Connection String: mongodb+srv://reebow_client_user:PASS@cluster0.xxxxx.mongodb.net/reebow-platform?retryWrites=true&w=majority

 * admin-credentials.txt:
   Admin URL: https://yourdomain.com/admin.html
Admin Email: admin@clientdomain.com
Admin Password: [GENERATED_STRONG_PASSWORD]
Session Duration: 1 hour (configurable)

 * payment-webhook-secrets.txt:
   Stripe:
  Secret Key: sk_live_...
  Webhook Secret: whsec_...
  Price ID Monthly: price_...
NOWPayments:
  API Key: ...
  IPN Secret: ...

Client Onboarding Session
60-Minute Video Call Agenda
| Time | Topic | Deliverable |
|---|---|---|
| 0–10 min | Architecture Walkthrough | Understanding their infrastructure |
| 10–20 min | Admin Dashboard Tour | Live demo using their provisioned data |
| 20–30 min | Video Clip System | Recording, naming, uploading, and testing |
| 30–40 min | Multi-Tenant Provisioning | Payment webhook setup → automatic tenant creation |
| 40–45 min | Deployment & Scaling | Hosting on Render/Railway/DO and scaling triggers |
| 45–50 min | Maintenance & Backups | Running maintenance.sh, monitoring, logs |
| 50–55 min | Security & Compliance | SSL, CSP, rate limits, data protection |
| 55–60 min | Support & Escalation | SLAs, contact channels, response times |
Post-Session Deliverables
 * Recording of the session shared via secure link.
 * Annotated screenshots of their specific deployment.
 * Customized QUICK_START_GUIDE.md containing their exact URLs and paths.
 * Support ticket submission template for their internal team.
Support Terms & SLA
Standard Support (Included with License)
| Tier | Response Time | Hours | Channels |
|---|---|---|---|
| Critical (Production down, data loss) | 2 hours | 24/7 | Email + Phone |
| High (Major feature broken) | 8 business hours | Mon–Fri (9 AM – 6 PM) | Email |
| Medium (Minor bug, config help) | 24 business hours | Mon–Fri (9 AM – 6 PM) | Email |
| Low (Questions, enhancements) | 72 hours | Mon–Fri (9 AM – 6 PM) | Email |
 * Support Channels:
   * 📧 Email: support@reebow.tech
   * 📞 Phone (Critical only): +1 581 809 6580
   * 🎫 Portal: https://support.reebow.tech
 * What's Covered: Platform bugs and regressions, deployment assistance (first 30 days), security patches and updates, configuration guidance, and performance optimization advice.
 * What's NOT Covered: Custom feature development, third-party payment integrations, client infrastructure issues (DNS, CDN, MongoDB Atlas limits), training beyond initial onboarding, or code modifications performed by the client's internal team.
Extended Support & Professional Add-ons
| Add-on Package | Monthly Cost | What's Included |
|---|---|---|
| Starter Workspace | $29 / month | Essential tools for small operations and baseline chat. |
| Pro Workspace | $79 / month | Recommended for growing teams with advanced automation. |
| Enterprise / Lifetime | $499 / one-time or custom | Full white-label branding and priority capacity. |
| Priority Support Add-on | $499 / month | 30-min critical response SLA and dedicated Slack channel. |
| Managed Hosting | $299 / month | We run and maintain infrastructure on Render/Railway for you. |
| Security Audit | $2,499 / year | Annual penetration testing and comprehensive code review. |
White-Label Customization
Brandable Environment Variables (No Code Changes)
# 1. Landing Page (index.html)
APP_NAME=Reebow TECH
APP_LOGO_URL=/icon-192.png
PRIMARY_COLOR=#3b82f6
SECONDARY_COLOR=#8b5cf6
CUSTOM_HERO_TITLE="Your Brand — Real-Time Support"
CUSTOM_HERO_SUBTITLE="Powered by Reebow Infrastructure"

# 2. Admin Dashboard
ADMIN_BRAND_NAME=YourBrand Support
ADMIN_LOGO_URL=/icon-192.png
CUSTOM_ADMIN_NAME=YourBrand Agent

# 3. Visitor Chat
VISITOR_WELCOME_TITLE=Welcome to YourBrand Support
VISITOR_BRAND_COLOR=#3b82f6
AGENT_DISPLAY_NAME=YourBrand Support

# 4. PWA Settings
PWA_NAME=YourBrand Messenger
PWA_SHORT_NAME=YourBrand
PWA_THEME_COLOR=#3b82f6

Escalation Procedures
Incident Severity Levels
| Level | Definition | Examples | Escalation Target |
|---|---|---|---|
| SEV-1 | Total outage, data loss, security breach | Platform unreachable, DB corrupted, keys leaked | Page CTO + Lead Dev → Client CTO within 15 min |
| SEV-2 | Major feature down, performance critical | Video calls fail, messages delayed >5s, payments broken | Lead Dev → Client Tech Lead within 1 hour |
| SEV-3 | Minor degradation, non-critical bug | Typing indicator stuck, UI glitch, language missing | Support queue → Fix in next sprint |
| SEV-4 | Cosmetic, documentation, enhancement | Typo, color preference, new icon request | Backlog → Quarterly review |
Maintenance Responsibilities
Reebow TECH Responsibilities
 * Security Patches: Monthly automated Dependabot reviews and dependency updates.
 * Database Maintenance: Managed per MongoDB Atlas automated schedules (zero-downtime).
 * SSL Certificate Renewal: Automated via Let's Encrypt / Certbot timers and Cloudflare.
 * Platform Updates: Bi-weekly releases distributed via version tags and deployment guides.
 * Infrastructure Monitoring: 24/7 uptime checks via UptimeRobot and Better Stack alerts.
Client Responsibilities
 * Payment Webhook Monitoring: Daily verification of Stripe/NOWPayments dashboards.
 * Clip Content Updates: Uploading fresh video assets to /public/clips/ and regenerating manifests.
 * Tenant Provisioning Verification: Testing admin/visitor URLs after new payment webhook sales.
 * Backup Verification: Monthly manual execution of ./maintenance.sh backup.
 * Log Review: Weekly inspection of /var/log/reebow/error.log.
Delivery Receipt Template
Delivery Receipt — Reebow TECH Platform
Client Company: [Company Name]
Primary Contact: [Name, Title, Email, Phone]
License Tier: [Starter / Pro / Enterprise]
License Key: RB-[YYYYMMDD]-[UNIQUE_ID]
Delivery Date: [YYYY-MM-DD]
Version: 2.0.0
Delivered Components
 * [ ] Full source code (GitHub private repo access granted)
 * [ ] Encrypted credentials package (received & decrypted)
 * [ ] Production deployment (staging verified, prod deployed)
 * [ ] Video clips uploaded & tested
 * [ ] Payment webhooks configured & tested
 * [ ] SSL certificates active on custom domain
 * [ ] Backups configured & verified
 * [ ] Documentation package delivered
 * [ ] Onboarding session completed (recording shared)
Client Acknowledgement
I confirm receipt of all deliverables, have verified functionality in production, and understand the support terms, maintenance responsibilities, and escalation procedures outlined in CLIENT_HANDOVER.md.
Client Signature: _________________________
Print Name: _________________________
Title: _________________________
Date: _________________________
End of Client Handover Guide — See also: Deployment Guide, Video Clips Guide
