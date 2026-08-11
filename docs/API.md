Reebow TECH Platform — REST API Documentation
Version: 2.0.0
Base URL: [https://yourdomain.com/api](https://yourdomain.com/api)
Authentication: Secure Cookie Sessions (HttpOnly, Secure, SameSite=Lax)
Data Format: application/json
Rate Limits: Global: 100 requests per 15 minutes | Login: 5 attempts per 15 minutes (per IP)
Table of Contents
 * Authentication
 * Visitor Endpoints
 * Admin Endpoints
 * Webhook Endpoints (Pricing & Plans)
 * System Endpoints
 * Error Codes & Responses
 * Pagination
 * Code Examples
Authentication
Session Management
Most endpoints require an active, secure login session cookie.
 * Cookie Name: reebow.sid
 * Security Attributes: HttpOnly, Secure (in production), SameSite=Lax
 * Duration: Valid for 30 days when "Remember Me" is enabled.
Access Levels & Roles
| Role | Description | Access Permissions |
|---|---|---|
| super | Master Administrator | Full system control across all tenants and server management. |
| tenant | Workspace Owner | Access and manage visitors belonging to your specific workspace only. |
| visitor | Platform User / Client | Automatically assigned upon registration to handle chat and calls. |
Visitor Endpoints
1. Register Visitor
Creates a new visitor profile or retrieves an existing one, automatically logging them in.
 * Endpoint: POST /visitor/register
 * Content-Type: application/json
Request Body
{
  "email": "user@example.com",
  "tenantId": "default",
  "language": "en",
  "sourcePanel": "direct"
}

Field Details
 * email (Required): Valid email address. Automatically trimmed and lowercased.
 * tenantId (Optional): Workspace identifier (defaults to default).
 * language (Optional): Two-letter ISO language code (defaults to en).
 * sourcePanel (Optional): Origin tracking source (defaults to direct).
Success Response (200 OK)
{
  "success": true,
  "visitor": {
    "id": "65f...",
    "email": "user@example.com",
    "tenantId": "default",
    "country": "United States",
    "city": "San Francisco",
    "status": "ACTIVE",
    "isOnline": true,
    "lastSeen": "2026-08-11T10:30:00.000Z",
    "messages": [],
    "callLogs": [],
    "settings": {
      "notifications": true,
      "theme": "dark",
      "language": "en"
    }
  }
}

2. Visitor Heartbeat
Sends a periodic signal to keep the visitor's online status active in the dashboard.
 * Endpoint: POST /visitor/heartbeat
Request Body
{
  "email": "user@example.com",
  "tenantId": "default"
}

Success Response (200 OK)
{ "success": true }

3. Send Message (HTTP Backup)
An HTTP fallback method to send messages when real-time WebSocket connections are unavailable.
 * Endpoint: POST /visitor/message
Request Body
{
  "email": "user@example.com",
  "tenantId": "default",
  "content": "Hello, I need help setting up my profile.",
  "messageType": "text",
  "mediaUrl": ""
}

Success Response (200 OK)
{
  "success": true,
  "message": {
    "sender": "visitor",
    "content": "Hello, I need help setting up my profile.",
    "messageType": "text",
    "timestamp": "2026-08-11T10:31:00.000Z",
    "_id": "65f..."
  }
}

Admin Endpoints
1. Admin Login
Authenticates an administrator and starts a secure session.
 * Endpoint: POST /admin/login
Request Body
{
  "email": "admin@reebow.tech",
  "password": "YourStrongPassword123!",
  "tenantId": "default",
  "remember": true
}

Success Response (200 OK)
{
  "success": true,
  "role": "super",
  "tenantId": "default"
}

2. Admin Logout
Destroys the current admin session and clears cookies.
 * Endpoint: POST /admin/logout
Success Response (200 OK)
{ "success": true }

3. Check Active Session
Verifies if the current session cookie is valid and returns user details.
 * Endpoint: GET /admin/session
Success Response (200 OK)
{
  "success": true,
  "admin": {
    "email": "admin@reebow.tech",
    "tenantId": "default",
    "role": "super"
  }
}

4. List Visitors
Retrieves a filterable, paginated list of visitors for the admin dashboard.
 * Endpoint: GET /admin/visitors
 * Query Parameters:
   * tenantId (string, default: default)
   * status (string: PENDING, ACTIVE, SUSPENDED, BANNED)
   * online (string: true or false)
   * search (string: filters by email, city, or country)
   * limit (integer: max results, up to 100, default: 50)
   * offset (integer: pagination offset, default: 0)
Success Response (200 OK)
{
  "success": true,
  "visitors": [
    {
      "id": "65f...",
      "email": "user@gmail.com",
      "country": "United States",
      "status": "ACTIVE",
      "isOnline": true
    }
  ],
  "pagination": {
    "total": 142,
    "limit": 20,
    "offset": 0
  }
}

5. Get Visitor Details
Fetches the complete record of a specific visitor, including all messages and call logs.
 * Endpoint: GET /admin/visitor/:email
 * Path Parameters: email (URL-encoded visitor email)
6. Send Message (Admin to Visitor)
Sends a real-time message to a visitor via WebSockets or HTTP.
 * Endpoint: POST /admin/message
Request Body
{
  "email": "user@example.com",
  "tenantId": "default",
  "content": "How can I assist you today?",
  "messageType": "text"
}

7. Initiate Video Call
Triggers a live video call session for a visitor.
 * Endpoint: POST /admin/call/initiate
Request Body
{
  "email": "user@example.com",
  "tenantId": "default",
  "persona": "annie"
}

8. Manage Visitor Actions
 * Clear Conversation: DELETE /admin/visitor/:email/clear — Deletes all chat logs for a visitor.
 * Ban Visitor: POST /admin/visitor/:email/ban — Blocks a visitor from connecting or interacting.
Webhook Endpoints (Pricing & Plans)
Payment Webhook & Tenant Provisioning
Automatically provisions new workspaces, generates credentials, and sets up phone hotlines upon a successful payment event.
 * Endpoint: POST /payment-webhook
 * Authentication: Validated via provider signature headers (Stripe, NowPayments, Paystack).
Request Body & Realistic Pricing Plans
{
  "clientEmail": "client@company.com",
  "customPassword": "SecurePassword123",
  "tenantId": "workspace-alpha",
  "plan": "pro",
  "provider": "stripe"
}

 * Available Plans & Realistic Pricing Structure:
   * starter ($29 / month): Essential features for small operations.
   * pro ($79 / month): Recommended for growing teams with advanced automation.
   * enterprise / lifetime ($499 / one-time or custom): Full white-label and priority capacity.
Success Response (200 OK)
{
  "success": true,
  "tenant": "workspace-alpha",
  "adminUrl": "https://yourdomain.com/admin.html?tenant=workspace-alpha",
  "visitorUrl": "https://yourdomain.com/visitor.html?tenant=workspace-alpha",
  "adminEmail": "client@company.com",
  "adminPassword": "Support_x7k9m2n1",
  "hotlines": {
    "primary": "+1 555 123 4567",
    "secondary": "+1 555 987 6543",
    "whatsapp": "+15551234567"
  }
}

System Endpoints
1. Health Check
Monitors system readiness, database connectivity, and server uptime for load balancers.
 * Endpoint: GET /health
Success Response (200 OK)
{
  "status": "ok",
  "timestamp": "2026-08-11T10:30:00.000Z",
  "uptime": 3600.5,
  "mongo": "connected",
  "version": "2.0.0"
}

2. API Version
 * Endpoint: GET /api/version
3. Clip Manifest
Returns available video clips used by the admin video injector tool.
 * Endpoint: GET /api/clips/manifest
Error Codes & Responses
| Status Code | Error Code | Description |
|---|---|---|
| 400 | VALIDATION_ERROR | Request body or parameters failed validation. |
| 401 | UNAUTHORIZED | Missing or invalid authentication credentials. |
| 403 | FORBIDDEN | Insufficient permissions to access this tenant. |
| 404 | NOT_FOUND | The requested resource could not be found. |
| 429 | RATE_LIMITED | Too many requests sent; slow down. |
| 500 | SERVER_ERROR | Unexpected internal server error. |
| 503 | SERVICE_UNAVAILABLE | Database (MongoDB) connection lost. |
Standard Error Format Example
{
  "success": false,
  "error": "Valid email address required",
  "code": "VALIDATION_ERROR",
  "details": { "field": "email" }
}

Pagination
Pagination parameters apply to list endpoints like /admin/visitors.
 * Query Parameters:
   * limit: Maximum items per page (1–100, default: 50)
   * offset: Number of items to skip (default: 0)
Code Examples
Complete Visitor Flow (JavaScript)
// 1. Register visitor session
const register = await fetch('/api/visitor/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' }),
  credentials: 'include'
});
const { visitor } = await register.json();

// 2. Connect via WebSockets
const socket = io('/', { auth: { email: visitor.email, tenantId: 'default' } });
socket.on('connect', () => socket.emit('visitor-register', { email: visitor.email }));

// 3. Send a message
socket.emit('send-message', { content: 'Hello there!' }, (ack) => {
  if (!ack.success) console.error('Message delivery failed');
});

Quick cURL Command Examples
# Check server health
curl -fsS https://yourdomain.com/health

# Register a new visitor
curl -X POST https://yourdomain.com/api/visitor/register \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com"}' \
  --cookie-jar cookies.txt

