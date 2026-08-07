# Reebow TECH Platform — Socket.io Events Reference

**Version:** 2.0.0  
**Protocol:** Socket.io v4 (WebSocket + Polling fallback)  
**Namespace:** `/` (default)  
**Authentication:** Handshake auth object

---

## Table of Contents

1. [Connection & Authentication](#connection--authentication)
2. [Admin → Server Events](#admin--server-events)
3. [Visitor → Server Events](#visitor--server-events)
4. [Server → Admin Events](#server--admin-events)
5. [Server → Visitor Events](#server--visitor-events)
6. [Event Flow Diagrams](#event-flow-diagrams)
7. [Error Handling](#error-handling)
8. [ACK Callbacks](#ack-callbacks)

---

## Connection & Authentication

### Client Connection

```javascript
// Visitor
const socket = io('/', {
  auth: { 
    email: 'user@example.com', 
    tenantId: 'default' 
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

// Admin
const socket = io('/', {
  auth: { 
    admin: true, 
    tenantId: 'default' 
  }
  // Session cookie sent automatically
});Handshake Auth Validation (Server)// Visitor: require email in auth
if (!socket.handshake.auth?.email) {
  return socket.disconnect();
}

// Admin: require valid session cookie
if (!socket.request.session?.admin) {
  return socket.disconnect();
}Connection Events (Built-in)EventDirectionDescriptionconnectBothWebSocket establisheddisconnectBothConnection closed (reason: transport close, client namespace disconnect, server namespace disconnect, ping timeout, transport error)connect_errorClientConnection failedreconnectClientReconnected after disconnectreconnect_attemptClientAttempting reconnectreconnect_failedClientMax attempts reachedAdmin → Server Events1. admin-joinJoin a visitor's room to monitor/control.Payload:{
  email: string;           // Visitor email (required)
  tenantId?: string;       // Default: 'default'
}Server Action:•Validates admin session•Finds visitor in same tenant•Joins room: room-{tenantId}-{email}•Emits admin-authenticate to adminResponse: See admin-authenticate2. send-messageSend message to visitor in current room.Payload:{
  content: string;                    // Required
  messageType?: 'text' | 'image' | 'video' | 'file';  // Default: 'text'
  mediaUrl?: string;                  // For media messages
  translation?: string;               // Optional auto-translation
}Server Action:•Persists to Visitor.messages•Broadcasts incoming-message to room•Calls ACK callback with resultACK Callback:(ack: { success: boolean; error?: string; message?: Message }) => void3. typingTyping indicator.Payload:{
  isTyping: boolean;
}Server Action: Broadcasts user-typing to room (excluding sender)4. initiate-callStart video call (clip injection).Payload:{
  persona?: string;    // 'annie' | 'craig' (default from env)
  clipId?: string;     // Initial clip (default: 'hello')
}Server Action: Broadcasts incoming-call to room5. accept-callAccept incoming call (visitor only, but admin can for testing).Payload:{
  callId: string;
}Server Action: Broadcasts call-connected to room6. reject-callReject incoming call.Payload:{
  callId: string;
  reason?: string;
}Server Action: Broadcasts call-ended to room with reason7. hang-upEnd active call.Payload:{
  callId: string;
  duration: number;   // Milliseconds
}Server Action:•Broadcasts call-ended to room•Persists call log to visitor8. inject-clipInject video clip during call (Admin only).Payload:{
  clipId: string;      // Required
  persona: string;     // 'annie' | 'craig'
  loop?: boolean;      // Default: false
}Server Action: Broadcasts clip-injected to room9. request-visitor-listRequest paginated visitor list.Payload:{
  tenantId?: string;       // Default: 'default'
  status?: string;         // Filter: ACTIVE, PENDING, etc.
  online?: 'true' | 'false';
  search?: string;         // Email, city, country
  limit?: number;          // Default: 50, max: 100
  offset?: number;         // Default: 0
}Server Action: Queries DB, emits visitor-list to admin10. mark-readMark messages as read.Payload: None (uses current room context)Server Action: Updates messages.read in DB, broadcasts messages-read11. heartbeatAdmin keep-alive (every 30s).Payload: NoneServer Action: Updates admin session expiryVisitor → Server Events1. visitor-registerJoin room after HTTP registration.Payload:{
  email: string;        // Required (matches session)
  tenantId?: string;    // Default: 'default'
}Server Action:•Joins room: room-{tenantId}-{email}•Marks visitor online•Emits visitor-authenticate to visitor•Emits visitor-status { online: true } to room (admin)2. send-messageSame as admin, but sender = 'visitor'.Payload:{
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'file';
  mediaUrl?: string;
}ACK Callback: Same as admin3. typingSame as admin.4. accept-callAccept incoming call from admin.Payload:{
  callId: string;
}5. reject-callReject incoming call.Payload:{
  callId: string;
}6. hang-upEnd call.Payload:{
  callId: string;
  duration: number;   // Milliseconds
}7. heartbeatVisitor keep-alive (every 30s via HTTP + Socket).Payload: NoneServer → Admin Events1. admin-authenticateResult of admin-join.Success Payload:{
  success: true;
  visitor: Visitor;      // Full visitor object (see API.md)
  tenantId: string;
  adminName: string;     // 'Super Admin' or customAdminName
}Error Payload:{
  success: false;
  error: string;         // 'Not authenticated' | 'Visitor not found'
}2. visitor-listResponse to request-visitor-list.Payload:{
  visitors: Visitor[];   // Array of visitor summaries (last 100 messages)
}3. incoming-messageNew message in current room.Payload:{
  sender: 'admin' | 'visitor' | 'system';
  content: string;
  messageType: 'text' | 'image' | 'video' | 'file' | 'system';
  mediaUrl?: string;
  translation?: string;
  timestamp: string;     // ISO 8601
  read: boolean;
  _id: string;           // MongoDB ObjectId
}4. visitor-statusVisitor online/offline change.Payload:{
  online: boolean;
  lastSeen: string;      // ISO 8601
}5. user-typingTyping indicator from other party.Payload:{
  isTyping: boolean;
  by: 'admin' | 'visitor';
}6. messages-readRead receipt confirmation.Payload:{
  by: 'admin' | 'visitor';
}7. incoming-callCall initiated (by admin or visitor).Payload:{
  callId: string;        // UUID
  targetEmail: string;
  tenantId: string;
  persona: string;       // 'annie' | 'craig'
  clipId: string;        // Initial clip
  initiatedBy: 'admin' | 'visitor';
  timestamp: string;     // ISO 8601
}8. call-connectedCall established (both parties accepted).Payload:{
  callId: string;
  timestamp: string;     // ISO 8601
}9. call-endedCall terminated.Payload:{
  callId: string;
  duration: number;      // Seconds
  reason?: string;       // 'rejected', 'hang-up', 'timeout'
  timestamp: string;     // ISO 8601
}10. clip-injectedAdmin injected video clip.Payload:{
  clipId: string;
  persona: string;
  timestamp: string;     // ISO 8601
}11. visitor-errorError specific to visitor operations.Payload:{
  error: string;
  code?: string;
}Server → Visitor Events1. visitor-authenticateResult of visitor-register.Success Payload:{
  success: true;
  visitor: Visitor;          // Full visitor object
  tenantId: string;
  adminName: string;         // customAdminName
  hotlines: {
    primary: string;
    secondary: string;
    whatsapp: string;
  };
}Error Payload:{
  success: false;
  error: string;             // 'Visitor not found. Register via HTTP first.'
}2. incoming-messageSame as admin version.3. user-typingSame as admin version (shows when admin is typing).4. incoming-callIncoming call from admin.Payload:{
  callId: string;
  persona: string;       // 'annie' | 'craig'
  clipId: string;        // Initial clip to play
  timestamp: string;
}5. call-connectedCall established.Payload:{
  callId: string;
  timestamp: string;
}6. call-endedCall terminated.Payload:{
  callId: string;
  duration: number;      // Seconds
  timestamp: string;
}7. clip-injectedAdmin changed playing clip.Payload:{
  clipId: string;
  persona: string;
  timestamp: string;
}8. realism-updateAdmin updated video filters.Payload:{
  filmGrain: boolean;
  softFocus: boolean;
  warmth: number;        // 80-120
  contrast: number;      // 90-115
  saturation: number;    // 80-120
  brightness: number;    // 90-110
}9. visitor-errorError from server.Event Flow DiagramsComplete Chat FlowsequenceDiagram
    participant V as Visitor
    participant S as Server
    participant A as Admin
    
    V->>S: HTTP POST /api/visitor/register
    S-->>V: { visitor, session }
    V->>S: WS connect + 'visitor-register'
    S->>V: 'visitor-authenticate'
    S->>A: 'visitor-status' { online: true }
    
    A->>S: 'admin-join' { email }
    S->>A: 'admin-authenticate' { visitor }
    
    V->>S: 'send-message' { content: 'Hi' }
    S->>V: 'incoming-message' (echo)
    S->>A: 'incoming-message'
    S->>V: 'user-typing' { by: 'admin', isTyping: true }
    S->>V: 'user-typing' { by: 'admin', isTyping: false }
    A->>S: 'send-message' { content: 'Hello!' }
    S->>A: 'incoming-message' (echo)
    S->>V: 'incoming-message'Call + Clip Injection FlowsequenceDiagram
    participant V as Visitor
    participant S as Server
    participant A as Admin
    
    A->>S: 'initiate-call' { persona: 'annie', clipId: 'hello' }
    S->>V: 'incoming-call' { callId, persona, clipId }
    V->>S: 'accept-call' { callId }
    S->>A: 'call-connected' { callId }
    S->>V: 'call-connected' { callId }
    
    loop Clip Injection
        A->>S: 'inject-clip' { clipId: 'listening', loop: true }
        S->>V: 'clip-injected' { clipId: 'listening' }
        V->>V: Plays clip, loops
    end
    
    A->>S: 'inject-clip' { clipId: 'yes' }
    S->>V: 'clip-injected' { clipId: 'yes' }
    
    V->>S: 'hang-up' { callId, duration }
    S->>A: 'call-ended' { callId, duration }
    S->>V: 'call-ended' { callId, duration }Offline Queue FlowsequenceDiagram
    participant V as Visitor
    participant S as Server
    participant DB as IndexedDB
    
    V->>V: Type message (offline)
    V->>DB: Store in outbox
    V->>V: Show "Queued" indicator
    
    V->>V: Comes online
    V->>S: WS reconnects
    V->>S: 'visitor-register'
    S->>V: 'visitor-authenticate'
    
    V->>DB: Read all queued
    loop For each message
        V->>S: 'send-message' { ... }
        S-->>V: ACK { success: true }
        V->>DB: Delete from outbox
    endError HandlingConnection Errorssocket.on('connect_error', (err) => {
  // err.message: 'Invalid namespace', 'Authentication failed', etc.
  // err.description: additional details
});

socket.on('disconnect', (reason) => {
  // Reasons: 'io client disconnect', 'io server disconnect', 
  // 'ping timeout', 'transport close', 'transport error'
});Event ErrorsEvents that can fail return errors via ACK callback:socket.emit('send-message', { content: 'Hi' }, (ack) => {
  if (!ack.success) {
    console.error('Send failed:', ack.error);  // 'Not in a room', 'Visitor not found'
  }
});Common Error CodesEventErrorMeaningadmin-joinNot authenticatedAdmin session expired/missingadmin-joinVisitor not foundEmail doesn't exist in tenantsend-messageNot in a roomMust join room firstsend-messageVisitor not foundTarget visitor deletedvisitor-registerVisitor not foundDidn't HTTP register firstACK CallbacksAll mutating events support optional ACK callback for confirmation.Patternsocket.emit('event-name', payload, (ack) => {
  if (ack.success) {
    // Optimistic UI confirmed
  } else {
    // Revert optimistic UI, show error
    console.error(ack.error);
  }
});Events with ACKEventACK Payloadsend-message{ success: boolean, error?: string, message?: Message }initiate-call{ success: boolean, error?: string, callId?: string }accept-call{ success: boolean, error?: string }reject-call{ success: boolean, error?: string }hang-up{ success: boolean, error?: string }inject-clip{ success: boolean, error?: string }request-visitor-listNone (uses separate visitor-list event)visitor-registerNone (uses visitor-authenticate)Room Naming Conventionroom-{tenantId}-{email}Examples:•room-default-user@example.com•room-tenant_a1b2-support@client.comUsed for: All real-time events (messages, calls, clips, typing, status)Best PracticesClient-Side// 1. Always handle reconnection
socket.on('disconnect', () => {
  showOfflineIndicator();
});

socket.on('reconnect', () => {
  hideOfflineIndicator();
  socket.emit('visitor-register', { email, tenantId });
});

// 2. Use ACK for critical operations
socket.emit('send-message', msg, (ack) => {
  if (!ack.success) showToast('Failed to send', 'error');
});

// 3. Clean up on unload
window.addEventListener('beforeunload', () => {
  socket.emit('heartbeat'); // Final heartbeat
});

// 4. Throttle typing events
let typingTimer;
function sendTyping(isTyping) {
  clearTimeout(typingTimer);
  socket.emit('typing', { isTyping });
  if (isTyping) {
    typingTimer = setTimeout(() => socket.emit('typing', { isTyping: false }), 2000);
  }
}Server-Side// 1. Validate room membership before broadcast
socket.on('send-message', (data) => {
  if (!currentRoom) return socket.emit('error', 'Not in room');
  // ... persist and broadcast
});

// 2. Rate limit per socket
const msgLimiter = rateLimiter({ points: 30, duration: 60 }); // 30/min
socket.on('send-message', async (data, ack) => {
  try {
    await msgLimiter.consume(socket.id);
    // process
  } catch { return ack({ success: false, error: 'Too many messages' }); }
});

// 3. Sanitize broadcast data
io.to(room).emit('incoming-message', sanitize(msg));End of Socket.io Events Reference
See also: API Reference, Architecture
---