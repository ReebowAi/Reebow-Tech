# Reebow TECH Platform — Architecture Documentation

**Version:** 2.0.0  
**Last Updated:** 2025-01  
**Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Diagram](#component-diagram)
3. [Data Flow](#data-flow)
4. [Database Schema](#database-schema)
5. [Security Model](#security-model)
6. [Scaling Strategy](#scaling-strategy)
7. [Failure Modes & Resilience](#failure-modes--resilience)
8. [Technology Stack](#technology-stack)

---

## System Overview

The Reebow TECH Platform is a **multi-tenant, real-time messaging and video call platform** designed for zero-monthly-fee infrastructure deployment. It consists of three primary components:
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER (Static)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ index.html  │  │ admin.html  │  │ visitor.html│  │  sw.js      │       │
│  │ (Landing)   │  │ (Control    │  │ (Chat UI)   │  │ (SW Cache)  │       │
│  │             │  │  Tower)     │  │             │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │ HTTPS/WSS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER (Node.js)                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Express + Socket.io                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ REST API │ │ WebSocket│ │ Session  │ │ Rate     │ │ Security │  │   │
│  │  │ Routes   │ │ Engine   │ │ Manager  │ │ Limiter  │ │ Headers  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                    │
└──────────────────────────────────────┼────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER (MongoDB Atlas)                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ Visitors    │ │ Messages    │ │ Call Logs   │ │ Sessions    │          │
│  │ (Tenant     │ │ (Embedded)  │ │ (Embedded)  │ │ (IndexedDB) │          │
│  │  isolation) │ │             │ │             │ │             │          │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                              ┌────────┴────────┐
                              ▼                 ▼
                       ┌─────────┐         ┌─────────┐
                       │ Payment │         │  CDN    │
                       │ Webhooks│         │ (Clips) │
                       └─────────┘         └─────────┘
---

## Component Diagram

### Frontend (Static Assets → CDN/Static Hosting)

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| `index.html` | Vanilla HTML/CSS/JS | Landing page, marketing, demo, docs |
| `admin.html` | ES Modules, Socket.io Client | Control Tower: auth, visitor management, chat, calls, clips |
| `visitor.html` | ES Modules, Socket.io Client | Telegram-style chat, call receiver, settings, PWA |
| `admin.js` / `visitor.js` | ES Modules (type=module) | Client-side state, UI bindings, Socket.io events |
| `sw.js` | Service Worker | Offline-first caching, background sync, push notifications |
| `style.css` | CSS Custom Properties | Complete design system (dark/light, responsive) |
| `mobile-fix.css` | CSS | iOS safe areas, Android keyboard, PWA standalone |
| `manifest.json` | Web App Manifest | PWA install, shortcuts, share target, file handlers |

### Backend (Single Node.js Process)

| Module | File | Responsibility |
|--------|------|----------------|
| **Express App** | `server.js` | HTTP server, middleware, static serving, API routes |
| **Socket.io Server** | `server.js` | Real-time engine, room management, event routing |
| **Mongoose Models** | `server.js` | Visitor, AdminSession schemas with indexes |
| **Session Store** | `connect-mongo` | Encrypted sessions in MongoDB |
| **Rate Limiter** | `rate-limiter-flexible` | Global + login brute-force protection |
| **Security** | `helmet`, `cors` | CSP, HSTS, secure cookies, CORS lockdown |
| **Maintenance Worker** | `server.js` (in-process) | Cron: log prune, stale offline, memory watchdog |

### Infrastructure

| Service | Purpose | Cost (Monthly) |
|---------|---------|----------------|
| **Render/Railway/DO** | Node.js hosting | $0–7 |
| **MongoDB Atlas** | Database (M0 free tier) | $0–9 |
| **GitHub Pages** | Static fallback | Free |
| **Cloudflare** | CDN, DDoS, DNS | Free |
| **Let's Encrypt** | SSL certificates | Free |

---

## Data Flow

### 1. Visitor Registration Flow
Visitor opens visitor.html
       │
       ▼
GET /visitor.html (cached by SW)
       │
       ▼
JS: fetch('/api/visitor/register', { email })
       │
       ▼
Server: Geo lookup (ip-api.com) → Create Visitor document
       │
       ▼
Response: { visitor: {...}, session cookie }
       │
       ▼
JS: socket.io connect (auth: { email, tenantId })
       │
       ▼
Server: Socket 'visitor-register' → Join room: room-{tenantId}-{email}
       │
       ▼
Server → Visitor: 'visitor-authenticate' (full visitor data)
       │
       ▼
Admin (if online): 'visitor-status' { online: true }
### 2. Admin Login & Visitor Join
Admin opens admin.html
       │
       ▼
POST /api/admin/login { email, password, tenantId }
       │
       ▼
Server: Verify credentials → Create session → Set cookie
       │
       ▼
JS: socket.io connect (auth: { admin: true, tenantId })
       │
       ▼
Admin clicks visitor in sidebar
       │
       ▼
Socket: 'admin-join' { email, tenantId }
       │
       ▼
Server: Find visitor → Join room: room-{tenantId}-{email}
       │
       ▼
Server → Admin: 'admin-authenticate' { visitor, adminName }
       │
       ▼
Admin sees full chat history, can send messages, start calls
### 3. Real-time Messaging
Visitor types → Socket 'send-message' { content, type: 'text' }
       │
       ▼
Server: Persist to Visitor.messages array → Broadcast to room
       │
       ├──→ Admin (in same room): 'incoming-message'
       └──→ Visitor (own echo): 'incoming-message' (for sync)
### 4. Video Call (Clip Injection Mode)
Admin clicks "Live Call" → Opens clip modal → Selects persona/clip
       │
       ▼
Socket: 'inject-clip' { clipId, persona, loop: true }
       │
       ▼
Server: Broadcast to room: 'clip-injected'
       │
       ▼
Visitor receives: Plays clip in video element
       │
       ▼
Auto-loops 'listening' clip until next action
### 5. Offline Message Queue
Visitor offline → Types message → Socket disconnected
       │
       ▼
JS: Stores in IndexedDB (outbox store) + localStorage fallback
       │
       ▼
Visitor comes online → SW detects → Socket reconnects
       │
       ▼
JS: flushOfflineQueue() → Replays each message via Socket.io
       │
       ▼
Server: Acknowledges each → Deletes from IndexedDB
---

## Database Schema

### Visitor Collection (`visitors`)

```javascript
{
  _id: ObjectId,
  email: String,                    // Unique per tenant (indexed)
  tenantId: String,                 // "default" or "tenant_xxx" (indexed)
  
  // Geo (from ip-api.com)
  country: String,
  countryCode: String,              // ISO 2-letter
  city: String,
  region: String,
  timezone: String,
  isp: String,
  org: String,
  isMobile: Boolean,
  isProxy: Boolean,
  isHosting: Boolean,
  
  // Status
  status: Enum['PENDING','ACTIVE','SUSPENDED','BANNED'],
  sourcePanel: String,              // 'direct', 'stripe', 'nowpayments', etc.
  customAdminName: String,          // Shown to visitor
  adminPassword: String,            // For multi-tenant admin login
  language: String,                 // 'en', 'fr', 'es', etc.
  
  // Presence
  isOnline: Boolean,
  lastSeen: Date,
  lastGeoUpdate: Date,
  
  // Messages (embedded, capped at ~1000)
  messages: [{
    sender: Enum['visitor','admin','system'],
    content: String,
    translation: String,            // Optional
    messageType: Enum['text','image','video','file','system'],
    mediaUrl: String,               // For images/videos
    timestamp: Date,
    read: Boolean,
    _id: ObjectId
  }],
  
  // Call Logs (embedded)
  callLogs: [{
    type: Enum['incoming','outgoing','missed','rejected'],
    status: Enum['connected','ended','failed','timeout'],
    duration: Number,               // Seconds
    recordingUrl: String,
    notes: String,
    timestamp: Date,
    persona: String                 // Which avatar was used
  }],
  
  // Settings
  settings: {
    notifications: Boolean,
    theme: Enum['dark','light','auto'],
    language: String
  },
  
  // Flexible metadata
  metadata: Map<String, String>,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}Indexes:// Unique email per tenant
{ tenantId: 1, email: 1 }, { unique: true }

// Online visitors first, then recent
{ tenantId: 1, isOnline: 1, lastSeen: -1 }

// Message pagination
{ 'messages.timestamp': -1 }

// Call log pagination  
{ 'callLogs.timestamp': -1 }Admin Session Collection (admin_sessions){
  _id: ObjectId,
  tenantId: String,              // Indexed
  adminEmail: String,
  sessionToken: String,          // Unique (UUID)
  expiresAt: Date,               // TTL index auto-expires
  userAgent: String,
  ip: String,
  createdAt: Date
}TTL Index: { expiresAt: 1 }, { expireAfterSeconds: 0 }Security ModelAuthentication LayersLayerMechanismScopeTransportTLS 1.2+ (Let's Encrypt)All connectionsSessionSigned, HttpOnly, Secure, SameSite=Lax cookiesAdmin + VisitorCSRFSameSite=Lax + Origin check on POSTForms, mutationsRate Limit100 req/15min global, 5 login/15minPer IPCORSLocked to APP_URL domain onlyBrowser requestsCSPStrict: self + fonts.googleapis.com + wss:XSS mitigationHeadersHelmet: HSTS, X-Frame-Options, Referrer-PolicyDefault secureAuthorization Model┌────────────────────────────────────────────────────────────┐
│                    ADMIN ROLES                              │
├──────────────────┬─────────────────────────────────────────┤
│ super (env)      │ Full access: all tenants, provisioning  │
│ tenant (per-     │ Own tenant only: visitors, chats, calls │
│  visitor)        │                                         │
└──────────────────┴─────────────────────────────────────────┘Data Isolation•Single-tenant mode: tenantId = 'default', all visitors in one bucket•Multi-tenant mode: Each payment webhook creates unique tenantId, visitors filtered by tenantId•Admin passwords: Super uses ADMIN_PASSWORD env; Tenant uses per-visitor adminPassword fieldSocket.io Security// Admin events require valid session
socket.on('admin-join', async ({ email, tenantId }) => {
  if (!session.admin || session.adminExpires <= Date.now()) {
    return socket.emit('admin-authenticate', { success: false });
  }
  // Verify visitor exists in same tenant
  const visitor = await Visitor.findOne({ tenantId, email });
  // Join room: room-{tenantId}-{email}
});

// Visitor events auto-scoped by auth
socket.on('send-message', ({ content }) => {
  // currentRoom = room-{tenantId}-{currentEmail} from handshake
  // No cross-tenant message injection possible
});Scaling StrategyCurrent: Single Process (Vertical)                          ┌──────────────────┐
                          │   Load Balancer  │
                          │  (Render/Railway)│
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │   Node.js App    │
                          │  (1 process)     │
                          │  Express+Socket  │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │  MongoDB Atlas   │
                          │  (M0/M10 cluster)│
                          └──────────────────┘Capacity: ~1,000 concurrent WebSocket connections, ~10k visitors/dayHorizontal Scaling (When Needed)1.Redis Adapter for Socket.ioconst { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
   
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
   
io.adapter(createAdapter(pubClient, subClient));2.Session Store → Already uses MongoDB (shared)3.Static Assets → CDN (Cloudflare) with long TTL4.Video Clips → S3/R2 + CloudFront (signed URLs)5.Database → Atlas M10+ (auto-scaling clusters)Scaling TriggersMetricThresholdActionWebSocket connections> 800/processAdd process + Redis adapterMongoDB CPU> 70% sustainedUpgrade Atlas tierResponse time (p95)> 500msAdd read replicasMemory> 450MB/processRestart (PM2) or add processFailure Modes & ResilienceFailureDetectionMitigationNode.js crashPM2 auto-restart (< 1s)Graceful shutdown (10s timeout), in-process maintenance survivesMongoDB unavailableHealth check failsCached visitor data serves reads; writes queue locallySocket.io disconnectClient disconnect eventAuto-reconnect with backoff; offline queue in IndexedDBCDN/Static hosting downSW cache serves app shellstale-while-revalidate for HTML; 1yr cache for assetsPayment webhook timeoutHTTP 5xxIdempotent key; retry with exponential backoffVideo clip load failVideo error eventFallback to 'offline' poster; show toastHigh memoryMaintenance watchdogPM2 restart at 512MB thresholdDisk fullMaintenance disk checkLog rotation, emergency cleanup at 95%Technology StackRuntime•Node.js 20 LTS (ESM, native fetch, WebSocket, crypto)•PM2 (process manager, clustering, logging, monitoring)BackendPackageVersionPurposeexpress4.19HTTP frameworksocket.io4.7Real-time enginemongoose8.4MongoDB ODMexpress-session1.18Session middlewareconnect-mongo5.1MongoDB session storehelmet7.1Security headerscors2.8CORS policycompression1.7Gzip/Brotlirate-limiter-flexible5.0Rate limitingwinston3.13Structured loggingdotenv16.4Environment configFrontend•Vanilla ES Modules (no build step, browsers cache individually)•Socket.io Client 4.7 (auto-reconnect, binary, fallback)•Service Worker (Workbox-style patterns, native APIs)•CSS Custom Properties (design tokens, dark/light, reduced motion)•IndexedDB (offline queue, settings persistence)•Web APIs: Notifications, Vibration, Share Target, File HandlingInfrastructure•MongoDB Atlas (managed, backups, monitoring)•Render/Railway/DO (container hosting, auto-SSL, custom domains)•Cloudflare (DNS, CDN, WAF, DDoS, Workers)•Let's Encrypt / Certbot (auto-SSL renewal)•Docker (multi-stage, non-root, distroless-alike)Sequence Diagram: Complete Call FlowsequenceDiagram
    participant V as Visitor
    participant A as Admin
    participant S as Server
    participant C as CDN (Clips)
    
    A->>S: HTTP POST /api/admin/call/initiate { email, persona }
    S->>V: Socket 'incoming-call' { callId, persona, clipId }
    V->>S: Socket 'accept-call' { callId }
    S->>A: Socket 'call-connected' { callId }
    S->>V: Socket 'call-connected' { callId }
    
    A->>S: Socket 'inject-clip' { clipId: 'hello', persona }
    S->>V: Socket 'clip-injected' { clipId, persona }
    V->>C: GET /clips/persona/clipId.mp4 (Range requests)
    C-->>V: 206 Partial Content (video stream)
    
    V->>V: Plays clip, loops 'listening'
    
    A->>S: Socket 'inject-clip' { clipId: 'yes' }
    S->>V: Socket 'clip-injected' { clipId: 'yes' }
    
    V->>S: Socket 'hang-up' { callId, duration }
    S->>A: Socket 'call-ended' { callId, duration }
    S->>DB: Persist callLog { duration, timestamp }End of Architecture Documentation
See also: API Reference, Socket Events, Deployment Guide
---
