Reebow TECH Platform — Socket.io Events Reference
Version: 2.0.0
Protocol: Socket.io v4 (WebSocket + Polling fallback)
Namespace: / (default)
Authentication: Handshake auth object
Table of Contents
 * Connection & Authentication
 * Admin → Server Events
 * Visitor → Server Events
 * Server → Admin Events
 * Server → Visitor Events
 * Event Flow Diagrams
 * Error Handling
 * ACK Callbacks
Connection & Authentication
Client Connection Initialization
// Visitor Connection Setup
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

// Admin Connection Setup
const socket = io('/', {
  auth: { 
    admin: true, 
    tenantId: 'default' 
  }
});

Admin → Server Events
1. admin-join
Join a specific visitor's room to monitor or manage communications.
 * Payload: { email: string, tenantId?: string }
 * Server Action: Validates admin clearance, locates the user within the tenant cluster, and joins room-{tenantId}-{email}.
2. send-message
Transmit a text, image, or media payload to a visitor within the active session room.
 * Payload: { content: string, messageType?: 'text' | 'image' | 'video' | 'file', mediaUrl?: string }
 * ACK Callback: Returns { success: boolean, error?: string, message?: Message }.
3. typing
Transmit real-time typing indicators to the connected visitor.
 * Payload: { isTyping: boolean }
4. initiate-call
Trigger an active video call and stream initial visual frames.
 * Payload: { persona?: string, clipId?: string }
5. inject-clip
Send alternative video streams or pre-recorded clips during an active call session.
 * Payload: { clipId: string, persona: string, loop?: boolean }
Visitor → Server Events
1. visitor-register
Authenticate and register the client session immediately following HTTP login.
 * Payload: { email: string, tenantId?: string }
2. send-message
Send a message from the visitor interface directly to the admin queue.
 * Payload: { content: string, messageType?: 'text' | 'image' | 'video' | 'file', mediaUrl?: string }
3. accept-call / reject-call / hang-up
Manage the state of incoming or active video interaction streams.
 * Payload: { callId: string, duration?: number }
Server → Admin Events
 * admin-authenticate: Confirms valid session state and returns full profile summaries.
 * incoming-message: Real-time push notification when a visitor dispatches new chat content.
 * visitor-status: Broadcasts live online or offline presence updates.
 * call-connected / call-ended: Tracks active call durations and termination triggers.
Server → Visitor Events
 * visitor-authenticate: Returns access credentials, active hotlines, and workspace configurations upon successful registration.
 * incoming-call: Alerts the client interface of an incoming video session stream.
 * clip-injected: Updates the active playback stream based on controller actions.
Error Handling
All failed actions return explicit JSON error messages through standard socket acknowledgment mechanisms:
socket.emit('send-message', { content: 'Hello' }, (ack) => {
  if (!ack.success) {
    console.error('Transmission failed:', ack.error);
  }
});

End of Socket.io Events Reference — See also: API Reference, Architecture
