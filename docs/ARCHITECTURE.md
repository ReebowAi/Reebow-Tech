Reebow TECH Platform — Architecture Documentation
Version: 2.0.0
Last Updated: August 2026
Status: Production Ready
Table of Contents
 * System Overview
 * Component Diagram
 * Data Flow
 * Database Schema
 * Security Model
 * Scaling Strategy
 * Failure Modes & Resilience
 * Technology Stack
System Overview
The Reebow TECH Platform is a multi-tenant, real-time messaging and video call platform designed for high-performance and reliable infrastructure deployment. It consists of three primary components:
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
└──────────────────────────────────────┬────────────────────────────────────┘
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
                       │ Payment │         │   CDN   │
                       │ Webhooks│         │ (Clips) │
                       └─────────┘         └─────────┘

Component Diagram
Frontend (Static Assets → CDN/Static Hosting)
| Component | Technology | Responsibility |
|---|---|---|
| index.html | Vanilla HTML/CSS/JS | Landing page, marketing, demo, docs |
| admin.html | ES Modules, Socket.io Client | Control Tower: auth, visitor management, chat, calls, clips |
| visitor.html | ES Modules, Socket.io Client | Telegram-style chat, call receiver, settings, PWA |
| admin.js / visitor.js | ES Modules (type=module) | Client-side state, UI bindings, Socket.io events |
| sw.js | Service Worker | Offline-first caching, background sync, push notifications |
| style.css | CSS Custom Properties | Complete design system (dark/light, responsive) |
| mobile-fix.css | CSS | iOS safe areas, Android keyboard, PWA standalone |
| manifest.json | Web App Manifest | PWA install, shortcuts, share target, file handlers |
Backend (Single Node.js Process)
| Module | File | Responsibility |
|---|---|---|
| Express App | server.js | HTTP server, middleware, static serving, API routes |
| Socket.io Server | server.js | Real-time engine, room management, event routing |
| Mongoose Models | server.js | Visitor, AdminSession schemas with indexes |
| Session Store | connect-mongo | Encrypted sessions in MongoDB |
| Rate Limiter | rate-limiter-flexible | Global + login brute-force protection |
| Security | helmet, cors | CSP, HSTS, secure cookies, CORS lockdown |
| Maintenance Worker | server.js (in-process) | Cron: log prune, stale offline, memory watchdog |
Infrastructure & Realistic Pricing Tiers
| Service | Purpose | Monthly Cost (USD) |
|---|---|---|
| Starter Workspace | Essential tools for small operations | $29 / month |
| Pro Workspace | Recommended for growing teams with automation | $79 / month |
| Enterprise / Lifetime | Full white-label and priority capacity | $499 / one-time or custom |
| Cloudflare / SSL | CDN, DDoS protection, DNS, Certs | Free Tier |
Data Flow
1. Visitor Registration Flow
 * Visitor opens visitor.html
 * Request loads from cache via Service Worker
 * Client triggers fetch('/api/visitor/register', { email })
 * Server performs geo-lookup and creates/retrieves the Visitor document
 * Response returns session cookie and visitor profile
 * Client connects via Socket.io (auth: { email, tenantId })
 * Server joins visitor to dedicated room and notifies admin dashboard
2. Admin Login & Visitor Join
 * Admin logs in via POST /api/admin/login
 * Server verifies credentials, creates an encrypted session, and sets secure cookies
 * Admin clicks on a visitor in the sidebar dashboard
 * Socket emits admin-join, linking the admin to the visitor's secure room
 * Admin interface populates with complete message history and call options
3. Real-time Messaging
 * Visitor types and sends a message; client emits send-message via Socket.io
 * Server immediately persists message to MongoDB and broadcasts it back to the room
 * Both admin and visitor views update instantly in real time
4. Video Call (Clip Injection Mode)
 * Admin initiates a call and selects a video persona/clip from the dashboard
 * Server routes incoming-call to the visitor, who accepts the stream
 * Admin injects specific response clips dynamically during the call
 * Visitor browser streams video chunks smoothly using media range requests
5. Offline Message Queue
 * If a visitor loses connection, messages are automatically saved locally in IndexedDB
 * When network connectivity returns, the Service Worker detects the change and triggers flushOfflineQueue()
 * Saved messages are safely replayed to the server in chronological order without duplication
Database Schema
Visitor Collection (visitors)
{
  _id: ObjectId,
  email: String,                    // Unique per tenant (indexed)
  tenantId: String,                 // "default" or workspace identifier (indexed)
  
  // Geo-location data
  country: String,
  countryCode: String,              // ISO 2-letter
  city: String,
  region: String,
  timezone: String,
  isp: String,
  isMobile: Boolean,
  
  // Status & Configuration
  status: Enum['PENDING','ACTIVE','SUSPENDED','BANNED'],
  sourcePanel: String,              // Origin source tracker
  customAdminName: String,          // Display name for support agent
  adminPassword: String,            // Tenant access credentials
  language: String,                 // ISO language code
  
  // Presence Tracking
  isOnline: Boolean,
  lastSeen: Date,
  
  // Embedded Message History
  messages: [{
    sender: Enum['visitor','admin','system'],
    content: String,
    messageType: Enum['text','image','video','file','system'],
    mediaUrl: String,
    timestamp: Date,
    read: Boolean,
    _id: ObjectId
  }],
  
  // Embedded Call Logs
  callLogs: [{
    type: Enum['incoming','outgoing','missed','rejected'],
    status: Enum['connected','ended','failed','timeout'],
    duration: Number,               // Duration in seconds
    timestamp: Date,
    persona: String
  }],
  
  // Settings & Timestamps
  settings: {
    notifications: Boolean,
    theme: Enum['dark','light','auto'],
    language: String
  },
  createdAt: Date,
  updatedAt: Date
}

Key Indexes:
 * Unique email per tenant: { tenantId: 1, email: 1 } (Unique)
 * Active visitors sorting: { tenantId: 1, isOnline: 1, lastSeen: -1 }
 * Message pagination: { 'messages.timestamp': -1 }
Security Model
Authentication Layers
 * Transport Layer: Enforces TLS 1.2+ encryption for all incoming requests.
 * Session Management: Uses signed, HttpOnly, Secure, SameSite=Lax cookies to prevent cross-site script access.
 * Rate Limiting: Protects against abuse by restricting traffic globally and locking out brute-force login attempts.
 * CORS & Headers: Locked down via Helmet to secure content policies and prevent cross-site scripting vulnerabilities.
Authorization Roles
 * Super Admin: Full platform access across all workspace tenants and server configurations.
 * Tenant Admin: Workspace-isolated management of assigned visitors, chats, and video calls.
 * Visitor: Client-level access restricted to personal chat sessions and authorized video calls.
Scaling Strategy
 * Current Architecture: Optimized single-node process capable of handling active daily traffic and hundreds of concurrent real-time connections efficiently.
 * Horizontal Scaling Path:
   * Integrate a Redis adapter with Socket.io to sync multiple node instances seamlessly.
   * Offload media storage to cloud object storage (e.g., AWS S3 or Cloudflare R2).
   * Scale MongoDB Atlas clusters horizontally with dedicated read replicas as active database load increases.
Failure Modes & Resilience
| Failure Scenario | Automatic Detection | System Mitigation Strategy |
|---|---|---|
| Node.js Process Crash | Process Manager | Automatic restart within seconds with graceful connection cleanup. |
| Database Outage | Health Check Monitor | Read operations serve cached data; writes buffer safely into local queues. |
| Socket Disconnection | Heartbeat Timeout | Client triggers automatic exponential backoff reconnection and outbox sync. |
| High Memory Usage | Maintenance Watchdog | Triggers safety cleanups or automated process recycling safely. |
Technology Stack
 * Runtime: Node.js 20 LTS with native ES modules and asynchronous workflow support.
 * Backend Framework: Express.js paired with Socket.io for real-time WebSocket communication.
 * Database & ODM: MongoDB Atlas managed clusters with Mongoose data modeling.
 * Frontend Architecture: Vanilla JavaScript ES Modules, progressive web application capabilities, and responsive CSS custom design tokens.
