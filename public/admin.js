// =====================================================================
// REEBOW TECH — ADMIN CONTROL TOWER CLIENT
// Final Boss Version — Works with secure multi-tenant server.js
// =====================================================================

import { io } from '/socket.io/socket.io.js';

// -------------------------------------------------------------------
// STATE
// -------------------------------------------------------------------
const state = {
  isAuthenticated: false,
  adminSession: null,
  adminName: 'Support Agent',
  socket: null,
  connected: false,
  currentTenant: 'default',
  currentVisitor: null,
  currentVisitorEmail: null,
  visitors: new Map(),
  sidebarOpen: true,
  rightPanelOpen: true,
  activeRightTab: 'details',
  activeCall: null,
  callTimer: null,
  callStartTime: null,
  clipsManifest: {},
  settings: {
    theme: 'dark',
    notifySound: true,
    notifyDesktop: true,
    notifyNewVisitor: true,
    autoReplyEnabled: false,
    autoReplyMessage: "Thanks for your message. We'll get back to you shortly.",
  },
};

// -------------------------------------------------------------------
// DOM CACHE
// -------------------------------------------------------------------
const els = {};

const cacheElements = () => {
  els.loginScreen = document.getElementById('loginScreen');
  els.loginForm = document.getElementById('loginForm');
  els.loginEmail = document.getElementById('loginEmail');
  els.loginPassword = document.getElementById('loginPassword');
  els.loginRemember = document.getElementById('loginRemember');

  els.sidebar = document.querySelector('.sidebar');
  els.sidebarBackdrop = document.getElementById('sidebarBackdrop');
  els.sidebarToggle = document.getElementById('sidebarToggle');
  els.visitorList = document.getElementById('visitorList');
  els.visitorSearch = document.getElementById('visitorSearch');
  els.visitorCount = document.getElementById('visitorCount');
  els.chatArea = document.getElementById('chatArea');
  els.emptyState = document.getElementById('emptyState');
  els.chatInterface = document.getElementById('chatInterface');
  els.chatVisitorName = document.getElementById('chatVisitorName');
  els.chatOnlineIndicator = document.getElementById('chatOnlineIndicator');
  els.chatVisitorMeta = document.getElementById('chatVisitorMeta');
  els.messagesList = document.getElementById('messagesList');
  els.messageInput = document.getElementById('messageInput');
  els.sendBtn = document.getElementById('sendBtn');
  els.callBtn = document.getElementById('callBtn');
  els.clearChatBtn = document.getElementById('clearChatBtn');
  els.banVisitorBtn = document.getElementById('banVisitor');
  els.settingsBtn = document.getElementById('settingsBtn');
};

// -------------------------------------------------------------------
// UTILITIES
// -------------------------------------------------------------------
const toast = (message, type = 'info') => {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.append(el);
  setTimeout(() => el.remove(), 4000);
};

const createToastContainer = () => {
  const c = document.createElement('div');
  c.id = 'toastContainer';
  c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
  document.body.append(c);
  return c;
};

const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// -------------------------------------------------------------------
// AUTH
// -------------------------------------------------------------------
const checkAuth = async () => {
  try {
    const res = await fetch('/api/admin/session', { credentials: 'include' });
    const data = await res.json();
    if (data.success && data.admin) {
      state.isAuthenticated = true;
      state.adminSession = data.admin;
      state.adminName = data.admin.name || (data.admin.role === 'super' ? 'Super Admin' : 'Support Agent');
      state.currentTenant = data.admin.tenantId || 'default';
      if (els.loginScreen) els.loginScreen.hidden = true;
      initApp();
      return true;
    }
  } catch (e) {
    console.error('Auth check failed', e);
  }
  if (els.loginScreen) els.loginScreen.hidden = false;
  return false;
};

const handleLogin = async (e) => {
  e.preventDefault();
  const email = els.loginEmail?.value.trim();
  const password = els.loginPassword?.value;

  if (!email || !password) return toast('Email and password required', 'error');

  const submitBtn = els.loginForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (data.success) {
      state.isAuthenticated = true;
      state.adminSession = data;
      state.adminName = data.name || (data.role === 'super' ? 'Super Admin' : 'Support Agent');
      state.currentTenant = data.tenantId || 'default';
      toast(`Welcome, ${state.adminName}!`, 'success');
      if (els.loginScreen) els.loginScreen.hidden = true;
      initApp();
    } else {
      toast(data.error || 'Login failed', 'error');
    }
  } catch (err) {
    toast('Connection error', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
    }
  }
};

const handleLogout = async () => {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
  } catch (e) {}
  state.isAuthenticated = false;
  state.adminSession = null;
  if (state.socket) state.socket.disconnect();
  if (els.loginScreen) els.loginScreen.hidden = false;
  if (els.loginForm) els.loginForm.reset();
};

// -------------------------------------------------------------------
// SOCKET
// -------------------------------------------------------------------
const connectSocket = () => {
  if (state.socket?.connected) return;

  state.socket = io('/', {
    auth: { admin: true, tenantId: state.currentTenant },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  state.socket.on('connect', () => {
    state.connected = true;
    console.log('[Admin] Socket connected');
    // Join admin room for this tenant
    state.socket.emit('admin-join', { tenantId: state.currentTenant });
    loadVisitors();
  });

  state.socket.on('disconnect', () => {
    state.connected = false;
  });

  state.socket.on('incoming-message', (data) => {
    // data = { email, message }
    if (data.email === state.currentVisitorEmail) {
      appendMessage(data.message);
    }
    // Update visitor list preview if needed
    loadVisitors();
  });

  state.socket.on('visitor-online', (data) => {
    loadVisitors();
  });

  state.socket.on('visitor-offline', (data) => {
    loadVisitors();
  });

  state.socket.on('call-response', (data) => {
    toast(data.accepted ? 'Visitor accepted the call' : 'Visitor rejected the call');
  });

  state.socket.on('call-ended', () => {
    toast('Call ended');
    state.activeCall = null;
  });
};

// -------------------------------------------------------------------
// VISITORS
// -------------------------------------------------------------------
const loadVisitors = async () => {
  try {
    const res = await fetch('/api/admin/visitors', { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      updateVisitorsList(data.visitors || []);
    }
  } catch (err) {
    console.error('Failed to load visitors', err);
  }
};

const updateVisitorsList = (visitors) => {
  state.visitors.clear();
  visitors.forEach(v => state.visitors.set(v.email, v));

  if (els.visitorCount) els.visitorCount.textContent = visitors.length;

  if (!els.visitorList) return;

  const searchTerm = (els.visitorSearch?.value || '').toLowerCase();
  const filtered = visitors.filter(v =>
    v.email.toLowerCase().includes(searchTerm) ||
    (v.city || '').toLowerCase().includes(searchTerm) ||
    (v.country || '').toLowerCase().includes(searchTerm)
  );

  els.visitorList.innerHTML = filtered.map(v => {
    const online = v.isOnline ? 'online' : '';
    const lastMsg = v.messages?.length ? v.messages[v.messages.length - 1].content.substring(0, 30) : 'No messages';
    return `
      <li class="visitor-item ${state.currentVisitorEmail === v.email ? 'active' : ''}" data-email="${v.email}">
        <div class="visitor-avatar">
          <div class="avatar">${v.email[0].toUpperCase()}</div>
          <span class="status-dot ${online}"></span>
        </div>
        <div class="visitor-info">
          <div class="visitor-name">${v.email}</div>
          <div class="visitor-meta">${v.city || v.country || 'Unknown'} · ${lastMsg}</div>
        </div>
      </li>
    `;
  }).join('');

  // Bind clicks
  document.querySelectorAll('.visitor-item').forEach(el => {
    el.onclick = () => selectVisitor(el.dataset.email);
  });
};

const selectVisitor = async (email) => {
  state.currentVisitorEmail = email;
  state.currentVisitor = state.visitors.get(email);

  // Highlight
  document.querySelectorAll('.visitor-item').forEach(el => {
    el.classList.toggle('active', el.dataset.email === email);
  });

  if (els.emptyState) els.emptyState.hidden = true;
  if (els.chatInterface) els.chatInterface.hidden = false;

  if (els.chatVisitorName) els.chatVisitorName.textContent = email;
  if (els.chatVisitorMeta) {
    const v = state.currentVisitor;
    els.chatVisitorMeta.textContent = `${v?.city || ''} ${v?.country || ''}`.trim() || 'Unknown location';
  }

  // Render messages
  renderMessages(state.currentVisitor?.messages || []);
};

// -------------------------------------------------------------------
// MESSAGES
// -------------------------------------------------------------------
const renderMessages = (messages) => {
  if (!els.messagesList) return;
  els.messagesList.innerHTML = messages.slice(-100).map(msg => {
    const isOwn = msg.sender === 'admin';
    return `
      <div class="message ${isOwn ? 'own' : 'other'}">
        <div class="message-bubble">
          ${msg.content}
          <div class="message-time">${formatTime(msg.timestamp)}</div>
        </div>
      </div>
    `;
  }).join('');
  els.messagesList.scrollTop = els.messagesList.scrollHeight;
};

const appendMessage = (msg) => {
  if (!els.messagesList) return;
  const isOwn = msg.sender === 'admin';
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'}`;
  div.innerHTML = `
    <div class="message-bubble">
      ${msg.content}
      <div class="message-time">${formatTime(msg.timestamp)}</div>
    </div>
  `;
  els.messagesList.appendChild(div);
  els.messagesList.scrollTop = els.messagesList.scrollHeight;
};

const sendMessage = async () => {
  const content = els.messageInput?.value.trim();
  if (!content || !state.currentVisitorEmail) return;

  els.messageInput.value = '';

  try {
    const res = await fetch('/api/admin/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: state.currentVisitorEmail,
        content,
        tenantId: state.currentTenant,
      }),
    });
    const data = await res.json();
    if (data.success) {
      appendMessage(data.message);
    } else {
      toast(data.error || 'Failed to send', 'error');
    }
  } catch (err) {
    toast('Failed to send message', 'error');
  }
};

// -------------------------------------------------------------------
// ACTIONS
// -------------------------------------------------------------------
const banVisitor = async () => {
  if (!state.currentVisitorEmail) return;
  if (!confirm(`Ban ${state.currentVisitorEmail}?`)) return;

  try {
    const res = await fetch('/api/admin/visitor/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: state.currentVisitorEmail,
        tenantId: state.currentTenant,
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast('Visitor banned', 'success');
      loadVisitors();
    } else {
      toast('Ban failed', 'error');
    }
  } catch (err) {
    toast('Error', 'error');
  }
};

const clearConversation = async () => {
  if (!state.currentVisitorEmail) return;
  if (!confirm('Clear entire conversation?')) return;

  try {
    const res = await fetch('/api/admin/visitor/clear', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: state.currentVisitorEmail,
        tenantId: state.currentTenant,
      }),
    });
    const data = await res.json();
    if (data.success) {
      if (els.messagesList) els.messagesList.innerHTML = '';
      toast('Conversation cleared', 'success');
    }
  } catch (err) {
    toast('Error', 'error');
  }
};

const initiateCall = async () => {
  if (!state.currentVisitorEmail) return toast('Select a visitor first');

  try {
    const res = await fetch('/api/admin/call/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: state.currentVisitorEmail,
        tenantId: state.currentTenant,
        persona: 'annie',
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast('Call initiated', 'success');
      state.activeCall = data;
    } else {
      toast(data.error || 'Failed to start call', 'error');
    }
  } catch (err) {
    toast('Error starting call', 'error');
  }
};

// -------------------------------------------------------------------
// INIT
// -------------------------------------------------------------------
const initApp = () => {
  cacheElements();

  // Bind events
  if (els.sendBtn) els.sendBtn.onclick = sendMessage;
  if (els.messageInput) {
    els.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  if (els.callBtn) els.callBtn.onclick = initiateCall;
  if (els.clearChatBtn) els.clearChatBtn.onclick = clearConversation;
  if (els.banVisitorBtn) els.banVisitorBtn.onclick = banVisitor;
  if (els.visitorSearch) {
    els.visitorSearch.addEventListener('input', () => {
      updateVisitorsList([...state.visitors.values()]);
    });
  }

  connectSocket();
  loadVisitors();
};

// -------------------------------------------------------------------
// STARTUP
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();

  if (els.loginForm) {
    els.loginForm.addEventListener('submit', handleLogin);
  }

  checkAuth();
});