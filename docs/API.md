# Reebow TECH Platform — REST API Reference

**Version:** 2.0.0  
**Base URL:** `https://yourdomain.com/api`  
**Authentication:** Cookie-based sessions (HttpOnly, Secure, SameSite=Lax)  
**Content-Type:** `application/json`  
**Rate Limits:** Global 100 req/15min, Login 5 req/15min (per IP)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Visitor Endpoints](#visitor-endpoints)
3. [Admin Endpoints](#admin-endpoints)
4. [Webhook Endpoints](#webhook-endpoints)
5. [System Endpoints](#system-endpoints)
6. [Error Codes](#error-codes)
7. [Pagination](#pagination)
8. [Examples](#examples)

---

## Authentication

### Session Management
All endpoints (except `/health`, `/api/version`) require an active session cookie.

**Cookie Name:** `reebow.sid` (configurable via `SESSION_NAME`)
**Cookie Attributes:**
- `HttpOnly: true`
- `Secure: true` (production)
- `SameSite: Lax`
- `Max-Age: 30 days` (configurable via `SESSION_MAX_AGE_MS`)

### Roles

| Role | Source | Permissions |
|------|--------|-------------|
| `super` | `ADMIN_EMAIL` + `ADMIN_PASSWORD` env | All tenants, provisioning, system |
| `tenant` | Per-visitor `adminPassword` field | Own tenant's visitors only |
| `visitor` | Auto on `/visitor/register` | Own messages, calls, settings |

---

## Visitor Endpoints

### Register Visitor
Creates or retrieves visitor record, establishes session.

**Endpoint:** `POST /visitor/register`

**Headers:** `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "user@example.com",
  "tenantId": "default",
  "language": "en",
  "sourcePanel": "direct"
}FieldRequiredTypeDescriptionemailYesstringValid email, lowercased & trimmedtenantIdNostringTenant identifier (default: default)languageNostringISO 639-1 code (default: en)sourcePanelNostringTracking source (default: direct)Success Response (200):{
  "success": true,
  "visitor": {
    "id": "65f...",
    "email": "user@example.com",
    "tenantId": "default",
    "country": "United States",
    "countryCode": "US",
    "city": "San Francisco",
    "region": "CA",
    "timezone": "America/Los_Angeles",
    "isp": "Example ISP",
    "org": "Example Org",
    "isMobile": false,
    "isProxy": false,
    "isHosting": false,
    "status": "ACTIVE",
    "sourcePanel": "direct",
    "customAdminName": "Support Agent",
    "language": "en",
    "isOnline": true,
    "lastSeen": "2025-01-15T10:30:00.000Z",
    "lastGeoUpdate": "2025-01-15T10:30:00.000Z",
    "messages": [],
    "callLogs": [],
    "settings": {
      "notifications": true,
      "theme": "dark",
      "language": "en"
    }
  }
}Error Responses:StatusCodeMessage400VALIDATION_ERRORValid email required429RATE_LIMITEDToo many requests500SERVER_ERRORRegistration failedVisitor HeartbeatKeeps visitor online status active.Endpoint: POST /visitor/heartbeatRequest Body:{
  "email": "user@example.com",
  "tenantId": "default"
}Success Response (200):{ "success": true }Send Message (HTTP Backup)Fallback for when Socket.io is unavailable.Endpoint: POST /visitor/messageRequest Body:{
  "email": "user@example.com",
  "tenantId": "default",
  "content": "Hello, I need help",
  "messageType": "text",
  "mediaUrl": ""
}FieldRequiredTypeDescriptionemailYesstringVisitor emailtenantIdYesstringTenant identifiercontentYesstringMessage textmessageTypeNostringtext, image, video, file (default: text)mediaUrlNostringData URL or CDN URL for mediaSuccess Response (200):{
  "success": true,
  "message": {
    "sender": "visitor",
    "content": "Hello, I need help",
    "messageType": "text",
    "mediaUrl": "",
    "timestamp": "2025-01-15T10:31:00.000Z",
    "_id": "65f..."
  }
}Admin EndpointsAdmin LoginAuthenticates admin, creates session.Endpoint: POST /admin/loginRequest Body:{
  "email": "admin@reebow.local",
  "password": "YourStrongPassword123!",
  "tenantId": "default",
  "remember": true
}FieldRequiredTypeDescriptionemailYesstringAdmin emailpasswordYesstringAdmin passwordtenantIdNostringTenant ID (default: default)rememberNobooleanExtend session to 30 days (default: false)Success Response (200):{
  "success": true,
  "role": "super",
  "tenantId": "default"
}Role Values:•super — Environment-based admin (full access)•tenant — Per-tenant admin (isolated)Error Responses:StatusCodeMessage400VALIDATION_ERROREmail and password required401UNAUTHORIZEDInvalid credentials429RATE_LIMITEDToo many login attemptsAdmin LogoutDestroys session.Endpoint: POST /admin/logoutSuccess Response (200):{ "success": true }Check Admin SessionVerifies current session validity.Endpoint: GET /admin/sessionSuccess Response (200):{
  "success": true,
  "admin": {
    "email": "admin@reebow.local",
    "tenantId": "default",
    "role": "super"
  }
}No Session Response (200):{ "success": false }List VisitorsPaginated, filterable list of visitors for admin dashboard.Endpoint: GET /admin/visitorsQuery Parameters:ParameterTypeDefaultDescriptiontenantIdstringdefaultTenant filterstatusstring—PENDING, ACTIVE, SUSPENDED, BANNEDonlinestring—true or falsesearchstring—Searches email, city, countrylimitinteger50Max results (max 100)offsetinteger0Pagination offsetExample: GET /admin/visitors?tenantId=default&online=true&search=gmail&limit=20Success Response (200):{
  "success": true,
  "visitors": [
    {
      "id": "65f...",
      "email": "user@gmail.com",
      "tenantId": "default",
      "country": "United States",
      "countryCode": "US",
      "city": "New York",
      "region": "NY",
      "timezone": "America/New_York",
      "isp": "Verizon",
      "org": "Verizon",
      "isMobile": true,
      "isProxy": false,
      "isHosting": false,
      "status": "ACTIVE",
      "sourcePanel": "direct",
      "customAdminName": "Support Agent",
      "language": "en",
      "isOnline": true,
      "lastSeen": "2025-01-15T10:30:00.000Z",
      "messages": [...],
      "callLogs": [...],
      "settings": { "notifications": true, "theme": "dark", "language": "en" }
    }
  ],
  "pagination": {
    "total": 142,
    "limit": 20,
    "offset": 0
  }
}Get Visitor DetailsFull visitor record including all messages and call logs.Endpoint: GET /admin/visitor/:emailPath Parameters:ParameterTypeDescriptionemailstringVisitor email (URL encoded)Query Parameters:ParameterTypeDefaultDescriptiontenantIdstringdefaultTenant filterSuccess Response (200): Same visitor object as list but with full messages and callLogs arrays.Error Responses:StatusCodeMessage404NOT_FOUNDVisitor not foundSend Message (Admin → Visitor)Sends message to visitor in real-time via Socket.io.Endpoint: POST /admin/messageRequest Body:{
  "email": "user@example.com",
  "tenantId": "default",
  "content": "How can I help you?",
  "messageType": "text",
  "mediaUrl": ""
}FieldRequiredTypeDescriptionemailYesstringVisitor emailtenantIdYesstringTenant identifiercontentYesstringMessage textmessageTypeNostringtext, image, video, file (default: text)mediaUrlNostringFor media messagesSuccess Response (200):{
  "success": true,
  "message": {
    "sender": "admin",
    "content": "How can I help you?",
    "messageType": "text",
    "mediaUrl": "",
    "timestamp": "2025-01-15T10:32:00.000Z",
    "_id": "65f...",
    "read": true
  }
}Initiate Video CallStarts a clip-injection call for the visitor.Endpoint: POST /admin/call/initiateRequest Body:{
  "email": "user@example.com",
  "tenantId": "default",
  "persona": "annie"
}FieldRequiredTypeDescriptionemailYesstringVisitor emailtenantIdNostringTenant (default: default)personaNostringannie, craig (default from env)Success Response (200):{
  "success": true,
  "callId": "a1b2-c3d4-e5f6"
}Clear ConversationDeletes all messages for a visitor.Endpoint: DELETE /admin/visitor/:email/clearPath Parameters: email (URL encoded)Query Parameters: tenantId (default: default)Success Response (200):{ "success": true }Ban VisitorPrevents visitor from connecting.Endpoint: POST /admin/visitor/:email/banPath Parameters: email (URL encoded)Query Parameters: tenantId (default: default)Success Response (200):{ "success": true, "message": "Visitor banned" }Webhook EndpointsPayment WebhookProvisions new tenant on successful payment.Endpoint: POST /payment-webhookAuthentication: Verify signature using WEBHOOK_SECRET (per provider)Request Body:{
  "clientEmail": "client@company.com",
  "customPassword": "OptionalCustomPass123",
  "tenantId": "optional-tenant-id",
  "plan": "monthly",
  "provider": "stripe"
}FieldRequiredTypeDescriptionclientEmailYesstringClient's email (becomes admin login)customPasswordNostringCustom admin password (auto-generated if omitted)tenantIdNostringCustom tenant ID (auto-generated if omitted)planNostringmonthly, yearly, lifetime (default: monthly)providerNostringstripe, nowpayments, paystack, manual (default: manual)Success Response (200):{
  "success": true,
  "tenant": "tenant_a1b2c3d4",
  "adminUrl": "https://yourdomain.com/admin.html?tenant=tenant_a1b2c3d4",
  "visitorUrl": "https://yourdomain.com/visitor.html?tenant=tenant_a1b2c3d4",
  "adminEmail": "client@company.com",
  "adminPassword": "Support_x7k9m2n1",
  "hotlines": {
    "primary": "+1 555 123 4567",
    "secondary": "+1 555 987 6543",
    "whatsapp": "+15551234567"
  }
}Error Responses:StatusCodeMessage400VALIDATION_ERRORclientEmail required500PROVISIONING_FAILEDTenant creation failedPayment Signature VerificationStripe:const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sig = req.headers['stripe-signature'];
let event;
try {
  event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
} catch (err) {
  return res.status(400).send(`Webhook Error: ${err.message}`);
}
// event.type === 'checkout.session.completed' → extract client_emailNOWPayments:// IPN secret verification
const hmac = crypto.createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET);
const checkHash = hmac.update(JSON.stringify(req.body)).digest('hex');
if (checkHash !== req.headers['x-nowpayments-sig']) {
  return res.status(401).json({ error: 'Invalid signature' });
}Paystack:const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
  .update(JSON.stringify(req.body)).digest('hex');
if (hash !== req.headers['x-paystack-signature']) {
  return res.status(401).json({ error: 'Invalid signature' });
}System EndpointsHealth CheckLiveness/readiness probe for load balancers.Endpoint: GET /healthSuccess Response (200):{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "memory": {
    "rss": 45000000,
    "heapTotal": 30000000,
    "heapUsed": 25000000,
    "external": 5000000,
    "arrayBuffers": 1000000
  },
  "mongo": "connected",
  "version": "2.0.0"
}Mongo Disconnected Response (503):{
  "status": "degraded",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "memory": { ... },
  "mongo": "disconnected",
  "version": "2.0.0"
}API VersionSimple version check.Endpoint: GET /api/versionResponse (200):{
  "version": "2.0.0",
  "name": "Reebow TECH"
}Clip ManifestReturns available video clips for admin clip injector.Endpoint: GET /api/clips/manifestResponse (200):{
  "success": true,
  "clips": {
    "annie": {
      "hello": { "url": "/clips/annie/hello.mp4" },
      "listening": { "url": "/clips/annie/listening.mp4" },
      "thinking": { "url": "/clips/annie/thinking.mp4" },
      "yes": { "url": "/clips/annie/yes.mp4" },
      "no": { "url": "/clips/annie/no.mp4" },
      "goodbye": { "url": "/clips/annie/goodbye.mp4" }
    },
    "craig": {
      "hello": { "url": "/clips/craig/hello.mp4" },
      ...
    }
  }
}Not Found (404):{
  "success": false,
  "error": "Manifest not found",
  "clips": {}
}Error CodesHTTP StatusError CodeDescription400VALIDATION_ERRORRequest body validation failed401UNAUTHORIZEDInvalid/missing authentication403FORBIDDENInsufficient permissions for tenant404NOT_FOUNDResource not found409CONFLICTResource already exists422UNPROCESSABLE_ENTITYSemantic validation failed429RATE_LIMITEDToo many requests500SERVER_ERRORUnexpected server error503SERVICE_UNAVAILABLEDependency unavailable (Mongo)Standard Error Format:{
  "success": false,
  "error": "Human-readable message",
  "code": "ERROR_CODE",
  "details": { "field": "Additional context" },
  "retryAfter": 900  // Only for 429
}PaginationApplied to: /admin/visitorsQuery Parameters:•limit — Max items (1–100, default: 50)•offset — Skip count (default: 0)Response Includes:{
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0
  }
}Client Implementation:// Next page
const nextOffset = data.pagination.offset + data.pagination.limit;
if (nextOffset < data.pagination.total) {
  fetch(`/api/admin/visitors?offset=${nextOffset}&limit=${data.pagination.limit}`);
}ExamplesComplete Visitor Flow (JavaScript)// 1. Register visitor
const register = await fetch('/api/visitor/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' }),
  credentials: 'include'
});
const { visitor } = await register.json();

// 2. Connect Socket.io
const socket = io('/', { auth: { email: visitor.email, tenantId: 'default' } });
socket.on('connect', () => socket.emit('visitor-register', { email: visitor.email }));

// 3. Send message
socket.emit('send-message', { content: 'Hello!' }, (ack) => {
  if (!ack.success) console.error('Send failed');
});

// 4. Receive messages
socket.on('incoming-message', (msg) => {
  console.log('New message:', msg);
  renderMessage(msg);
});Complete Admin Flow (JavaScript)// 1. Login
const login = await fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: 'admin@reebow.local', 
    password: 'Reeb911422@',
    remember: true 
  }),
  credentials: 'include'
});

// 2. Connect Socket.io
const socket = io('/', { auth: { admin: true, tenantId: 'default' } });

// 3. Load visitors
socket.emit('request-visitor-list', { tenantId: 'default', online: 'true' });
socket.on('visitor-list', ({ visitors }) => renderVisitorList(visitors));

// 4. Join visitor room
function joinVisitor(email) {
  socket.emit('admin-join', { email, tenantId: 'default' });
}

// 5. Handle events
socket.on('admin-authenticate', ({ visitor }) => renderChat(visitor));
socket.on('incoming-message', appendMessage);

// 6. Send message
function send(content) {
  socket.emit('send-message', { content, messageType: 'text' });
}

// 7. Initiate call
function startCall(persona = 'annie') {
  socket.emit('initiate-call', { persona });
}

// 8. Inject clip
function injectClip(clipId, persona = 'annie', loop = false) {
  socket.emit('inject-clip', { clipId, persona, loop });
}cURL Examples# Health check
curl -fsS https://yourdomain.com/health

# Register visitor
curl -X POST https://yourdomain.com/api/visitor/register \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com"}' \
  --cookie-jar cookies.txt

# Admin login
curl -X POST https://yourdomain.com/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "admin@reebow.local", "password": "Reeb911422@", "remember": true}' \
  --cookie-jar admin-cookies.txt

# List visitors (using session cookie)
curl https://yourdomain.com/api/admin/visitors?limit=10 \
  --cookie admin-cookies.txt

# Provision tenant via webhook
curl -X POST https://yourdomain.com/api/payment-webhook \
  -H 'Content-Type: application/json' \
  -d '{"clientEmail": "client@co.com", "plan": "monthly", "provider": "manual"}'WebSocket Upgrade (Socket.io)The Socket.io connection upgrades from HTTP polling to WebSocket automatically.Connection URL: wss://yourdomain.com/socket.io/Authentication (handshake auth):// Visitor
{ email: 'user@example.com', tenantId: 'default' }

// Admin
{ admin: true, tenantId: 'default' }Events: See Socket Events ReferenceEnd of API Reference
See also: Architecture, Socket Events, Deployment
---
