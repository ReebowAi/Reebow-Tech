# Reebow TECH Platform — Client Handover Guide

**Version:** 2.0.0  
**Purpose:** Complete checklist for delivering the platform to paying clients  
**Format:** Step-by-step delivery package with scripts, credentials, and support terms

---

## Table of Contents

1. [Delivery Package Contents](#delivery-package-contents)
2. [Pre-Delivery Verification](#pre-delivery-verification)
3. [Credential Handoff](#credential-handoff)
4. [Client Onboarding Session](#client-onboarding-session)
5. [Support Terms & SLA](#support-terms--sla)
6. [White-Label Customization](#white-label-customization)
6. [Escalation Procedures](#escalation-procedures)
7. [Maintenance Responsibilities](#maintenance-responsibilities)

---

## Delivery Package Contents

### Digital Delivery (Secure Transfer)
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
---

## Pre-Delivery Verification

**Complete ALL before handoff:**

### 1. Code Quality Gate

```bash
# Run in client's repo (or fork)
git clone https://github.com/your-org/reebow-platform.git client-delivery
cd client-delivery

# Install & test
npm ci --production
npm run lint          # Must pass with 0 errors
npm start &           # Start in background
sleep 10
curl -fsS http://localhost:10000/health | grep '"status":"ok"'
kill %12. Production Deploy Test# Deploy to staging (Render preview / Railway preview / DO preview)
# Run full smoke test:
curl -fsS https://staging-client.reebow.tech/health
curl -fsS https://staging-client.reebow.tech/api/version3. Feature Verification ChecklistFeatureTest Method✅ PassVisitor registrationOpen visitor.html, enter email☐Admin loginOpen admin.html, use credentials☐Real-time chatSend msg visitor→admin, admin→visitor☐Video call (clip injection)Admin clicks "Live Call", selects clip☐Clip plays on visitorVerify video loads, loops "listening"☐Realism filtersAdmin toggles grain/blur/warmth☐PWA installChrome DevTools → Application → Manifest → Install☐Offline queueDisconnect network, send msg, reconnect☐NotificationsDesktop + sound + vibrate☐Multi-languageSwitch to FR/ES/AR/PT☐Payment webhookPOST to /payment-webhook, verify tenant created☐BackupsRun maintenance.sh backup, check /var/backups☐SSL certificateValid, auto-renewal configured☐4. Security Audit# 1. No secrets in code
grep -r "sk_live_\|mongodb+srv://.*://" --include="*.js" --include="*.json" .

# 2. Helmet headers present
curl -I https://staging-client.reebow.tech | grep -i "content-security-policy\|strict-transport"

# 3. Rate limiting works
for i in {1..6}; do curl -s -o /dev/null -w "%{http_code} " https://staging-client.reebow.tech/api/admin/login; done
# 6th should be 429

# 4. Session cookies secure
curl -I https://staging-client.reebow.tech/api/admin/login | grep -i "set-cookie.*secure.*httponly.*samesite"Credential HandoffSecure Transfer ProtocolNEVER send credentials via email, Slack, or unencrypted channels.Option 1: 1Password / Bitwarden Vault Sharing (RECOMMENDED)
- Create vault: "Reebow-[CLIENT]-Production"
- Share with client's email (they need account)
- Set expiration: 30 days

Option 2: 7z AES-256 + Signal/Keybase
7z a -p"STRONG_PASSWORD" -mhe=on credentials.7z credentials/
# Send password via separate channel (Signal, phone call)

Option 3: GitHub Private Gist (TEMPORARY)
# Create secret gist with encrypted content
# Delete after client confirms receiptCredential Files Contentproduction.env — Only file client puts in production:# This file contains ALL production secrets
# Client renames to .env on servermongodb-credentials.txt:Cluster: https://cloud.mongodb.com
Project: Reebow-Client-[NAME]
Cluster: free-tier-cluster-xxxxx
Database: reebow-platform
Username: reebow_client_user
Password: [GENERATED_STRONG_PASSWORD]
Connection String: mongodb+srv://reebow_client_user:PASS@cluster0.xxxxx.mongodb.net/reebow-platform?retryWrites=true&w=majority
IP Whitelist: [CLOUD_PROVIDER_IPS]admin-credentials.txt:Admin URL: https://yourdomain.com/admin.html
Admin Email: admin@clientdomain.com
Admin Password: [GENERATED_STRONG_PASSWORD]
Session Duration: 1 hour (configurable)payment-webhook-secrets.txt:Stripe:
  Secret Key: sk_live_...
  Webhook Secret: whsec_...
  Price ID Monthly: price_...
  Price ID Yearly: price_...

NOWPayments:
  API Key: ...
  IPN Secret: ...

Paystack:
  Secret Key: sk_live_...
  Webhook Secret: ...Client Onboarding Session60-Minute Video Call AgendaTimeTopicDeliverable0-10Architecture WalkthroughUnderstanding their infrastructure10-20Admin Dashboard TourLive demo with their data20-30Video Clip SystemRecording, naming, uploading, testing30-40Multi-Tenant ProvisioningPayment webhook → tenant creation40-45Deployment & ScalingRender/Railway/DO, when to scale45-50Maintenance & Backupsmaintenance.sh, monitoring, logs50-55Security & ComplianceSSL, CSP, rate limits, GDPR55-60Support & EscalationSLAs, contacts, response timesPost-Session Deliverables1.Recording of session (shared via secure link)2.Annotated screenshots of their specific deployment3.Customized QUICK_START_GUIDE.md with their URLs, credentials paths4.Support ticket template for their teamSupport Terms & SLAStandard Support (Included with License)TierResponse TimeHoursChannelsCritical (Production down, data loss)2 hours24/7Email + PhoneHigh (Major feature broken)8 business hoursMon-Fri 9-6EmailMedium (Minor bug, config help)24 business hoursMon-Fri 9-6EmailLow (Questions, enhancements)72 hoursMon-Fri 9-6EmailSupport Channels📧 Email: support@reebow.tech
📞 Phone (Critical only): +1 581 809 6580
🎫 Portal: https://support.reebow.tech (if licensed)What's Covered•Platform bugs & regressions•Deployment assistance (first 30 days)•Security patches & updates•Configuration guidance•Performance optimization adviceWhat's NOT Covered•Custom feature development•Third-party integrations (payment, CRM, etc.)•Client's infrastructure issues (DNS, CDN, MongoDB Atlas)•Training beyond initial onboarding•Code modifications by client's teamExtended Support (Paid Add-ons)Add-onMonthlyIncludesPriority Support$49930-min critical response, Slack channelManaged Hosting$299We run on our Render/Railway, you useCustom Development$150/hrNew features, integrationsSecurity Audit$2,499/yrPenetration test, code reviewCompliance Package$1,999/yrGDPR, HIPAA, SOC2 documentationWhite-Label CustomizationBrandable Elements (No Code Changes)# 1. Landing page (index.html)
APP_NAME=REEBOW_TECH
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

# 4. PWA
PWA_NAME=YourBrand Messenger
PWA_SHORT_NAME=YourBrand
PWA_THEME_COLOR=#3b82f6

# 5. Emails/Webhooks
FROM_EMAIL=support@yourbrand.com
WEBHOOK_BRANDING=YourBrandImplementationClient edits these in their .env and the app reads them dynamically (add env reads to server.js for dynamic values).Advanced White-Label (Source Code Modifications)CustomizationEffortFilesCustom domain per tenantMediumserver.js, admin.html, visitor.htmlCustom CSS theme per tenantLowstyle.css + CSS variablesCustom webhook payload formatLowserver.js payment webhookCustom admin roles/permissionsMediumserver.js auth, admin.js UIRemove Reebow branding entirelyLowSearch/replace in HTML/JSEscalation ProceduresIncident Severity LevelsLevelDefinitionExamplesEscalationSEV-1Total outage, data loss, security breachPlatform unreachable, DB corrupted, credentials leakedPage: CTO + Lead Dev → Client CTO within 15 minSEV-2Major feature down, performance criticalVideo calls fail, messages delayed >5s, payment brokenLead Dev → Client Tech Lead within 1 hourSEV-3Minor degradation, non-critical bugTyping indicator stuck, UI glitch, language missingSupport queue → Fix in next sprintSEV-4Cosmetic, documentation, enhancementTypo, color preference, new icon requestBacklog → Quarterly reviewCommunication During IncidentsSEV-1/2 Template:
Subject: [SEV-1] Reebow Platform - [Service] Down - [Client Name]

1. Impact: What's broken, who's affected
2. Status: Investigating / Identified / Fixing / Verifying / Resolved
3. ETA: Next update in [time]
4. Workaround: Any temporary mitigation
5. Root Cause: (Post-incident)

Updates every 30 min until resolved.
Post-mortem within 48 hours for SEV-1.ContactsRoleNamePhoneEmailPagerDutyPlatform CTO[Name]+1-xxx-xxx-xxxxcto@reebow.techPD-REEBOW-CTOLead Dev[Name]+1-xxx-xxx-xxxxlead@reebow.techPD-REEBOW-DEVSupport Lead[Name]+1-xxx-xxx-xxxxsupport@reebow.techPD-REEBOW-SUPClient CTO[Client provides]Client Tech Lead[Client provides]Maintenance ResponsibilitiesReebow TECH ResponsibilitiesTaskFrequencyMethodSecurity patches (Node, npm deps)MonthlyAutomated Dependabot PRs → Review → DeployMongoDB Atlas maintenancePer Atlas scheduleAtlas handles (zero-downtime)SSL certificate renewalAuto (Let's Encrypt)Certbot timer / CloudflarePlatform updates (features, fixes)Bi-weekly releasesGit tag → Changelog → Deploy guideInfrastructure monitoring24/7UptimeRobot + Better Stack alertsClient ResponsibilitiesTaskFrequencyMethodPayment webhook monitoringDailyCheck Stripe/NOWPayments dashboardClip content updatesAs neededUpload to /public/clips/, regenerate manifestTenant provisioning verificationPer saleTest admin/visitor URLs after webhookCustom domain DNSAs neededUpdate A/CNAME recordsBackup verificationMonthlyRun ./maintenance.sh backup manuallyLog reviewWeeklyCheck /var/log/reebow/error.logCapacity planningQuarterlyReview MongoDB Atlas metrics, PM2 memoryShared ResponsibilitiesTaskReebowClientDisaster recovery testProvide procedureExecute semi-annuallySecurity incident responseLead investigationProvide access, communicate usersCompliance auditProvide documentationEngage auditors, implement findingsFeature requestsEvaluate, estimatePrioritize, fund developmentDelivery Receipt TemplateFile: DELIVERY_RECEIPT.md# Delivery Receipt — Reebow TECH Platform

**Client:** [Company Name]  
**Contact:** [Name, Title, Email, Phone]  
**License:** [Standard / Extended / Enterprise]  
**License Key:** RB-[YYYYMMDD]-[UNIQUE_ID]  
**Delivery Date:** [YYYY-MM-DD]  
**Version:** 2.0.0  

## Delivered Components

- [ ] Full source code (GitHub private repo access granted)
- [ ] Encrypted credentials package (received & decrypted)
- [ ] Production deployment (staging verified, prod deployed)
- [ ] Video clips uploaded & tested
- [ ] Payment webhooks configured & tested
- [ ] SSL certificates active on custom domain
- [ ] Backups configured & verified
- [ ] Monitoring & alerts active
- [ ] Documentation package delivered
- [ ] Onboarding session completed (recording shared)
- [ ] Support portal access granted (if applicable)

## Acceptance Criteria Met

- [ ] Visitor registration works
- [ ] Admin login works
- [ ] Real-time messaging works
- [ ] Video call clip injection works
- [ ] PWA installs on iOS/Android/Desktop
- [ ] Offline message queue works
- [ ] Multi-language works
- [ ] Payment webhook creates tenant
- [ ] All security checks pass

## Client Acknowledgement

I confirm receipt of all deliverables, have verified functionality in production, and understand the support terms, maintenance responsibilities, and escalation procedures outlined in `CLIENT_HANDOVER.md`.

**Client Signature:** _________________________  
**Print Name:** _________________________  
**Title:** _________________________  
**Date:** _________________________  

## Reebow TECH Acknowledgement

**Reebow Representative:** _________________________  
**Date:** _________________________  

## Post-Delivery Checklist (30-Day Follow-up)

- [ ] Day 7: Check-in call - any issues?
- [ ] Day 14: Verify backups running, clips updated
- [ ] Day 30: Quarterly review scheduled, license renewal discussedEnd of Client Handover Guide
See also: Deployment Guide, Video Clips Guide
---