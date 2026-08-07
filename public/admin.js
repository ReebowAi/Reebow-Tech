```javascript
// ════════════════════════════════════════════════════════════════════════
// REEBOW TECH — ADMIN CONTROL TOWER CLIENT
// Version: 2.0.0 | ES Modules | Socket.io | Real-time Everything
// ════════════════════════════════════════════════════════════════════════

import { io } from '/socket.io/socket.io.js';

// ────────────────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ────────────────────────────────────────────────────────────────────────
const state = {
  // Auth
  isAuthenticated: false,
  adminSession: null,
  adminName: 'Support Agent',
  
  // Socket
  socket: null,
  connected: false,
  
  // Current context
  currentTenant: 'default',
  currentVisitor: null,
  currentVisitorEmail: null,
  
  // Visitors
  visitors: new Map(), // email -> visitor data
  
  // UI state
  sidebarOpen: true,
  rightPanelOpen: true,
  activeRightTab: 'realism',
  
  // Call state
  activeCall: null,
  callTimer: null,
  callStartTime: null,
  
  // Clips
  clipsManifest: {},
  
  // Settings
  settings: {
    theme: 'dark',
    notifySound: true,
    notifyDesktop: true,
    notifyNewVisitor: true,
    autoReplyEnabled: false,
    autoReplyMessage: "Thanks for your message. We'll get back to you shortly.",
    reduceMotion: false,
  },
  
  // Realism filters (applied to visitor video)
  realism: {
    filmGrain: true,
    softFocus: false,
    warmth: 100,
    contrast: 100,
    saturation: 100,
    brightness: 100,
  },
};

// ────────────────────────────────────────────────────────────────────────
// DOM ELEMENTS CACHE
// ────────────────────────────────────────────────────────────────────────
const els = {};

// Cache all elements after DOM ready
const cacheElements = () => {
  // Auth
  els.loginScreen = document.getElementById('loginScreen');
  els.loginForm = document.getElementById('loginForm');
  els.loginEmail = document.getElementById('loginEmail');
  els.loginPassword = document.getElementById('loginPassword');
  els.loginRemember = document.getElementById('loginRemember');
  
  // Layout
  els.sidebar = document.querySelector('.sidebar');
  els.sidebarBackdrop = document.getElementById('sidebarBackdrop');
  els.sidebarToggle = document.getElementById('sidebarToggle');
  els.visitorList = document.getElementById('visitorList');
  els.visitorSearch = document.getElementById('visitorSearch');
  els.visitorCount = document.getElementById('visitorCount');
  els.rightPanel = document.getElementById('rightPanel');
  els.chatArea = document.getElementById('chatArea');
  els.emptyState = document.getElementById('emptyState');
  els.chatInterface = document.getElementById('chatInterface');
  els.chatVisitorName = document.getElementById('chatVisitorName');
  els.chatOnlineIndicator = document.getElementById('chatOnlineIndicator');
  els.chatVisitorMeta = document.getElementById('chatVisitorMeta');
  els.messagesList = document.getElementById('messagesList');
  els.typingIndicator = document.getElementById('typingIndicator');
  els.messageInput = document.getElementById('messageInput');
  els.sendBtn = document.getElementById('sendBtn');
  els.attachBtn = document.getElementById('attachBtn');
  els.callBtn = document.getElementById('callBtn');
  els.clearChatBtn = document.getElementById('clearChatBtn');
  els.settingsBtn = document.getElementById('settingsBtn');
  els.injectClipBtn = document.getElementById('injectClipBtn');
  els.quickReplyBtn = document.getElementById('quickReplyBtn');
  
  // Right panel tabs
  els.panelTabs = document.querySelectorAll('.panel-tab');
  els.panelPanes = document.querySelectorAll('.panel-pane');
  
  // Realism panel
  els.filmGrainToggle = document.getElementById('filmGrainToggle');
  els.softFocusToggle = document.getElementById('softFocusToggle');
  els.warmthSlider = document.getElementById('warmthSlider');
  els.warmthValue = document.getElementById('warmthValue');
  els.contrastSlider = document.getElementById('contrastSlider');
  els.contrastValue = document.getElementById('contrastValue');
  els.saturationSlider = document.getElementById('saturationSlider');
  els.saturationValue = document.getElementById('saturationValue');
  els.brightnessSlider = document.getElementById('brightnessSlider');
  els.brightnessValue = document.getElementById('brightnessValue');
  els.applyRealism = document.getElementById('applyRealism');
  
  // Details panel
  els.visitorDetails = document.getElementById('visitorDetails');
  els.copyVisitorId = document.getElementById('copyVisitorId');
  els.banVisitor = document.getElementById('banVisitor');
  
  // Clips panel
  els.clipsGrid = document.getElementById('clipsGrid');
  
  // Modals
  els.clipModal = document.getElementById('clipModal');
  els.clipPersona = document.getElementById('clipPersona');
  els.clipSelect = document.getElementById('clipSelect');
  els.clipLoop = document.getElementById('clipLoop');
  els.confirmInjectClip = document.getElementById('confirmInjectClip');
  
  els.quickReplyModal = document.getElementById('quickReplyModal');
  els.quickReplyGrid = document.getElementById('quickReplyGrid');
  els.customQuickReply = document.getElementById('customQuickReply');
  
  els.settingsModal = document.getElementById('settingsModal');
  els.adminDisplayName = document.getElementById('adminDisplayName');
  els.autoReplyEnabled = document.getElementById('autoReplyEnabled');
  els.autoReplyMessage = document.getElementById('autoReplyMessage');
  els.notifySound = document.getElementById('notifySound');
  els.notifyDesktop = document.getElementById('notifyDesktop');
  els.notifyNewVisitor = document.getElementById('notifyNewVisitor');
  els.themeSelect = document.getElementById('themeSelect');
  els.accentColor = document.getElementById('accentColor');
  els.saveSettings = document.getElementById('saveSettings');
  
  // Call overlay
  els.callOverlay = document.getElementById('callOverlay');
  els.callVideo = document.getElementById('callVideo');
  els.callStatus = document.getElementById('callStatus');
  els.callAgentName = document.getElementById('callAgentName');
  els.callOverlayTitle = document.getElementById('callOverlayTitle');
  els.minimizeCall = document.getElementById('minimizeCall');
  els.callMute = document.getElementById('callMute');
  els.callHideSelf = document.getElementById('callHideSelf');
  els.endCall = document.getElementById('endCall');
  
  // Modal close buttons
  els.modalCloses = document.querySelectorAll('.modal-close');
};

// ────────────────────────────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────────────────────────────
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (date) => new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const generateId = () => Math.random().toString(36).slice(2, 10);
const escapeHtml = (str) => str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const toast = (message, type = 'info') => {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${escapeHtml(message)}</span><button class="toast-close" aria-label="Dismiss">&times;</button>`;
  el.querySelector('.toast-close').onclick = () => el.remove();
  container.append(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => el.remove(), 5000);
};

const createToastContainer = () => {
  const c = document.createElement('div');
  c.id = 'toastContainer';
  c.className = 'toast-container';
  document.body.append(c);
  return c;
};

const playSound = (type) => {
  if (!state.settings.notifySound) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain).connect(ctx.destination);
  if (type === 'message') { osc.frequency.value = 880; osc.type = 'sine'; gain.gain.value = 0.1; osc.start(); osc.stop(ctx.currentTime + 0.15); }
  if (type === 'call') { osc.frequency.value = 440; osc.type = 'triangle'; gain.gain.value = 0.15; osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1); osc.stop(ctx.currentTime + 1); }
  if (type === 'notification') { osc.frequency.value = 660; osc.type = 'sine'; gain.gain.value = 0.1; osc.start(); osc.stop(ctx.currentTime + 0.1); }
};

const notify = (title, options = {}) => {
  if (!state.settings.notifyDesktop || Notification.permission !== 'granted') return;
  new Notification(title, { icon: '/icon-192.png', badge: '/badge-72.png', tag: 'reebow-admin', ...options });
};

const requestNotificationPermission = () => {
  if (Notification.permission === 'default') Notification.requestPermission();
};

// ────────────────────────────────────────────────────────────────────────
// AUTHENTICATION
// ────────────────────────────────────────────────────────────────────────
const checkAuth = async () => {
  try {
    const res = await fetch('/api/admin/session');
    const data = await res.json();
    if (data.success && data.admin) {
      state.isAuthenticated = true;
      state.adminSession = data.admin;
      state.adminName = data.admin.role === 'tenant' ? data.admin.customAdminName || 'Support Agent' : 'Super Admin';
      state.currentTenant = data.admin.tenantId || 'default';
      els.loginScreen.hidden = true;
      initApp();
      return true;
    }
  } catch (e) { console.error('Auth check failed', e); }
  els.loginScreen.hidden = false;
  return false;
};

const handleLogin = async (e) => {
  e.preventDefault();
  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;
  const remember = els.loginRemember.checked;
  
  if (!email || !password) return toast('Email and password required', 'error');
  
  const submitBtn = els.loginForm.querySelector('button[type="submit"]');
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;
  
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantId: state.currentTenant, remember }),
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      state.isAuthenticated = true;
      state.adminSession = data;
      state.adminName = data.customAdminName || 'Support Agent';
      state.currentTenant = data.tenantId || 'default';
      toast(`Welcome, ${state.adminName}!`, 'success');
      els.loginScreen.hidden = true;
      initApp();
    } else {
      toast(data.error || 'Login failed', 'error');
    }
  } catch (err) {
    toast('Connection error', 'error');
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
};

const handleLogout = async () => {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
  } catch (e) { /* ignore */ }
  state.isAuthenticated = false;
  state.adminSession = null;
  if (state.socket) state.socket.disconnect();
  els.loginScreen.hidden = false;
  els.loginForm.reset();
  resetUI();
};

// ────────────────────────────────────────────────────────────────────────
// SOCKET.IO CONNECTION
// ────────────────────────────────────────────────────────────────────────
const connectSocket = () => {
  if (state.socket?.connected) return;
  
  state.socket = io('/', {
    auth: { admin: true, tenantId: state.currentTenant },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  
  state.socket.on('connect', () => {
    state.connected = true;
    updateConnectionUI();
    console.log('[Socket] Connected', state.socket.id);
  });
  
  state.socket.on('disconnect', (reason) => {
    state.connected = false;
    updateConnectionUI();
    console.log('[Socket] Disconnected', reason);
  });
  
  state.socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error', err.message);
    toast('Connection lost. Reconnecting...', 'warning');
  });
  
  // ── Socket Event Handlers ──
  state.socket.on('admin-authenticate', (data) => {
    if (data.success) {
      state.currentVisitor = data.visitor;
      state.currentVisitorEmail = data.visitor.email;
      renderChat(data.visitor);
      loadVisitorDetails(data.visitor);
      loadClipsManifest();
      toast(`Connected to ${data.visitor.email}`, 'success');
    } else {
      toast(data.error || 'Failed to join visitor', 'error');
    }
  });
  
  state.socket.on('visitor-list', (data) => {
    updateVisitorsList(data.visitors);
  });
  
  state.socket.on('incoming-message', (msg) => {
    appendMessage(msg);
    if (state.currentVisitorEmail !== msg._id?.split('-')[0]) { // Different visitor
      playSound('message');
      notify('New message', { body: `${msg.sender}: ${msg.content.substring(0, 50)}...` });
      updateVisitorUnread(msg._id);
    }
  });
  
  state.socket.on('visitor-status', (data) => {
    updateVisitorOnlineStatus(data.online, data.lastSeen);
  });
  
  state.socket.on('user-typing', (data) => {
    if (data.by === 'visitor') showTyping(data.isTyping);
  });
  
  state.socket.on('messages-read', () => {
    // Update read receipts UI
  });
  
  state.socket.on('incoming-call', (data) => {
    handleIncomingCall(data);
  });
  
  state.socket.on('call-connected', (data) => {
    handleCallConnected(data);
  });
  
  state.socket.on('call-ended', (data) => {
    handleCallEnded(data);
  });
  
  state.socket.on('clip-injected', (data) => {
    handleClipInjected(data);
  });
  
  state.socket.on('visitor-error', (data) => {
    toast(data.error, 'error');
  });
};

const updateConnectionUI = () => {
  const indicator = document.getElementById('connectionIndicator');
  if (indicator) {
    indicator.className = `connection-status ${state.connected ? 'connected' : 'disconnected'}`;
    indicator.querySelector('.label').textContent = state.connected ? 'Connected' : 'Disconnected';
  }
};

// ────────────────────────────────────────────────────────────────────────
// VISITOR LIST MANAGEMENT
// ────────────────────────────────────────────────────────────────────────
const updateVisitorsList = (visitors) => {
  state.visitors.clear();
  visitors.forEach(v => state.visitors.set(v.email, v));
  
  els.visitorCount.textContent = visitors.length;
  
  const searchTerm = els.visitorSearch.value.toLowerCase();
  const filtered = visitors.filter(v => 
    v.email.toLowerCase().includes(searchTerm) ||
    v.city?.toLowerCase().includes(searchTerm) ||
    v.country?.toLowerCase().includes(searchTerm)
  );
  
  els.visitorList.innerHTML = filtered.map(v => createVisitorItem(v)).join('');
  
  // Re-select current visitor if in list
  if (state.currentVisitorEmail) {
    const activeEl = els.visitorList.querySelector(`[data-email="${state.currentVisitorEmail}"]`);
    if (activeEl) activeEl.classList.add('active');
  }
  
  // Bind click events
  $$('.visitor-item', els.visitorList).forEach(el => {
    el.onclick = () => joinVisitor(el.dataset.email);
  });
};

const createVisitorItem = (v) => {
  const flag = v.countryCode ? `🇺🇸` : '🌐'; // Simplified - would use flag library in production
  const unread = v.messages?.filter(m => !m.read && m.sender === 'visitor').length || 0;
  const lastMsg = v.messages?.[v.messages.length - 1];
  const lastMsgText = lastMsg ? `${lastMsg.sender === 'visitor' ? '👤' : '👮'} ${escapeHtml(lastMsg.content).substring(0, 40)}` : 'No messages';
  const lastMsgTime = lastMsg ? formatTime(lastMsg.timestamp) : '';
  
  return `
    <li class="visitor-item${state.currentVisitorEmail === v.email ? ' active' : ''}" data-email="${v.email}" role="option">
      <div class="visitor-avatar">
        <div class="avatar" style="background: linear-gradient(135deg, #${v.email.split('').reduce((a,c)=>a+c.charCodeAt(0),0).toString(16).slice(0,3)}, #${v.email.split('').reduce((a,c)=>a+c.charCodeAt(0),0).toString(16).slice(3,6)})">
          ${v.email[0].toUpperCase()}
        </div>
        <span class="status-dot ${v.isOnline ? 'online' : ''}"></span>
      </div>
      <div class="visitor-info">
        <div class="visitor-name">${escapeHtml(v.email)} ${unread ? `<span class="visitor-unread">${unread}</span>` : ''}</div>
        <div class="visitor-meta">${flag} ${escapeHtml(v.city || v.country || 'Unknown')} · ${lastMsgText}</div>
      </div>
      <div class="visitor-time">${lastMsgTime}</div>
    </li>
  `;
};

const joinVisitor = async (email) => {
  if (!state.socket?.connected) return toast('Not connected', 'error');
  
  // Update UI immediately
  $$('.visitor-item', els.visitorList).forEach(el => el.classList.toggle('active', el.dataset.email === email));
  els.emptyState.hidden = true;
  els.chatInterface.hidden = false;
  
  state.socket.emit('admin-join', { email, tenantId: state.currentTenant });
};

const updateVisitorUnread = (email) => {
  const el = els.visitorList.querySelector(`[data-email="${email}"]`);
  if (el) {
    const badge = el.querySelector('.visitor-unread');
    const count = (parseInt(badge?.textContent) || 0) + 1;
    if (badge) badge.textContent = count;
    else el.querySelector('.visitor-name').insertAdjacentHTML('beforeend', `<span class="visitor-unread">${count}</span>`);
  }
};

const updateVisitorOnlineStatus = (online, lastSeen) => {
  const el = els.visitorList.querySelector(`[data-email="${state.currentVisitorEmail}"]`);
  if (el) {
    const dot = el.querySelector('.status-dot');
    if (dot) dot.classList.toggle('online', online);
    const indicator = els.chatOnlineIndicator;
    if (indicator) {
      indicator.querySelector('.dot').classList.toggle('online', online);
      indicator.querySelector('span:last-child').textContent = online ? 'Online' : `Last seen ${formatDate(lastSeen)}`;
    }
  }
};

// ────────────────────────────────────────────────────────────────────────
// CHAT RENDERING
// ────────────────────────────────────────────────────────────────────────
const renderChat = (visitor) => {
  state.currentVisitor = visitor;
  state.currentVisitorEmail = visitor.email;
  
  els.chatVisitorName.textContent = visitor.email;
  els.chatVisitorMeta.textContent = `${visitor.city}, ${visitor.country}`;
  updateVisitorOnlineStatus(visitor.isOnline, visitor.lastSeen);
  
  els.messagesList.innerHTML = visitor.messages?.slice(-100).map(msg => createMessageElement(msg)).join('') || '';
  scrollToBottom();
};

const appendMessage = (msg) => {
  if (msg.sender === 'admin' && state.currentVisitorEmail) {
    // Our own message - already in list if we added optimistically
    return;
  }
  if (state.currentVisitorEmail && msg._id?.includes(state.currentVisitorEmail)) {
    const el = document.createElement('div');
    el.innerHTML = createMessageElement(msg);
    els.messagesList.append(...el.childNodes);
    scrollToBottom();
  }
};

const createMessageElement = (msg) => {
  const isOwn = msg.sender === 'admin';
  const time = formatTime(msg.timestamp);
  const content = escapeHtml(msg.content);
  
  if (msg.messageType === 'image' && msg.mediaUrl) {
    return `
      <div class="message ${isOwn ? 'own' : 'other'}">
        <div class="avatar">${isOwn ? '👮' : visitorInitial(msg)}</div>
        <div class="message-bubble">
          <img src="${escapeHtml(msg.mediaUrl)}" alt="${content || 'Image'}" class="message-image" loading="lazy" onclick="openImageModal(this.src)">
          ${content ? `<div>${content}</div>` : ''}
          <div class="message-time">${time}</div>
        </div>
      </div>
    `;
  }
  
  return `
    <div class="message ${isOwn ? 'own' : 'other'}">
      <div class="avatar">${isOwn ? '👮' : visitorInitial(msg)}</div>
      <div class="message-bubble">
        ${content.replace(/\n/g, '<br>')}
        <div class="message-time">${time}</div>
      </div>
    </div>
  `;
};

const visitorInitial = (msg) => msg.content?.slice(0,1).toUpperCase() || '👤';

const scrollToBottom = () => {
  els.messagesList.scrollTop = els.messagesList.scrollHeight;
};

const sendMessage = async () => {
  const content = els.messageInput.value.trim();
  if (!content || !state.currentVisitorEmail) return;
  
  els.messageInput.value = '';
  els.sendBtn.disabled = true;
  
  // Optimistic UI
  const tempMsg = { sender: 'admin', content, timestamp: new Date(), messageType: 'text', _id: `temp-${generateId()}` };
  appendMessage(tempMsg);
  
  state.socket.emit('send-message', { content, messageType: 'text' }, (ack) => {
    if (!ack?.success) {
      toast('Failed to send', 'error');
      // Remove optimistic message
    }
  });
};

const handleTyping = () => {
  // Send typing indicator to visitor
  state.socket.emit('typing', { isTyping: els.messageInput.value.length > 0 });
};

// ────────────────────────────────────────────────────────────────────────
// CALL HANDLING
// ────────────────────────────────────────────────────────────────────────
const handleCallClick = () => {
  if (!state.currentVisitorEmail) return toast('Select a visitor first', 'warning');
  openClipModal('call');
};

const handleIncomingCall = (data) => {
  state.activeCall = data;
  playSound('call');
  notify('Incoming call', { body: `${data.persona} is calling`, tag: 'incoming-call' });
  
  // Show call overlay for admin
  openCallOverlay(data);
};

const handleCallConnected = (data) => {
  state.activeCall = data;
  state.callStartTime = Date.now();
  startCallTimer();
  toast('Call connected', 'success');
};

const handleCallEnded = (data) => {
  stopCallTimer();
  closeCallOverlay();
  toast(`Call ended (${formatDuration(data.duration || 0)})`, 'info');
  state.activeCall = null;
};

const openCallOverlay = (data) => {
  els.callAgentName.textContent = data.persona;
  els.callStatus.textContent = 'Connecting...';
  els.callOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // In real implementation, set video src from WebRTC
  // For clip injection mode, we'd play the clip here
};

const closeCallOverlay = () => {
  els.callOverlay.classList.remove('active');
  document.body.style.overflow = '';
  els.callVideo.pause();
  els.callVideo.src = '';
};

const startCallTimer = () => {
  stopCallTimer();
  state.callTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.callStartTime) / 1000);
    els.callStatus.textContent = formatDuration(elapsed);
  }, 1000);
};

const stopCallTimer = () => {
  if (state.callTimer) clearInterval(state.callTimer);
  state.callTimer = null;
  state.callStartTime = null;
};

const endCall = () => {
  if (state.activeCall) {
    state.socket.emit('hang-up', { callId: state.activeCall.callId, duration: Date.now() - state.callStartTime });
    handleCallEnded({ callId: state.activeCall.callId, duration: Math.floor((Date.now() - state.callStartTime) / 1000) });
  }
};

// ────────────────────────────────────────────────────────────────────────
// CLIP INJECTION
// ────────────────────────────────────────────────────────────────────────
const loadClipsManifest = async () => {
  try {
    const res = await fetch('/api/clips/manifest');
    const data = await res.json();
    if (data.success) {
      state.clipsManifest = data.clips || {};
      populateClipsPanel();
      populateClipModalSelects();
    }
  } catch (e) { console.error('Failed to load clips manifest', e); }
};

const populateClipsPanel = () => {
  if (!els.clipsGrid) return;
  const clips = state.clipsManifest;
  els.clipsGrid.innerHTML = Object.entries(clips).flatMap(([persona, pc]) => 
    Object.entries(pc).map(([id, clip]) => `
      <div class="clip-item" data-persona="${persona}" data-clip="${id}">
        <video src="${clip.url}" muted preload="metadata"></video>
        <div class="clip-name">${persona}/${id}</div>
      </div>
    `)
  ).join('');
  
  // Add click handlers
  $$('.clip-item', els.clipsGrid).forEach(el => {
    el.onclick = () => injectClip(el.dataset.persona, el.dataset.clip);
  });
};

const populateClipModalSelects = () => {
  if (!els.clipSelect) return;
  const persona = els.clipPersona.value;
  const clips = state.clipsManifest[persona] || {};
  els.clipSelect.innerHTML = Object.keys(clips).map(id => `<option value="${id}">${id}</option>`).join('');
};

const openClipModal = (type) => {
  populateClipModalSelects();
  els.clipModal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

const closeAllModals = () => {
  $$('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  document.body.style.overflow = '';
};

const injectClip = (persona, clipId, loop = false) => {
  if (!state.currentVisitorEmail) return;
  state.socket.emit('inject-clip', { clipId, persona, loop });
  closeAllModals();
  toast(`Injected ${persona}/${clipId}`, 'success');
};

// ────────────────────────────────────────────────────────────────────────
// QUICK REPLIES
// ────────────────────────────────────────────────────────────────────────
const quickReplies = [
  "Hello! How can I help you today?",
  "Thanks for reaching out!",
  "Let me check that for you.",
  "I'll get back to you shortly.",
  "Is there anything else I can help with?",
  "Have a great day!",
];

const openQuickReplyModal = () => {
  els.quickReplyGrid.innerHTML = quickReplies.map(r => `
    <button class="quick-reply-item btn-secondary" data-reply="${escapeHtml(r)}">${escapeHtml(r)}</button>
  `).join('');
  
  $$('.quick-reply-item', els.quickReplyGrid).forEach(btn => {
    btn.onclick = () => {
      els.messageInput.value = btn.dataset.reply;
      sendMessage();
      closeAllModals();
    };
  });
  
  els.customQuickReply.value = '';
  els.customQuickReply.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && els.customQuickReply.value.trim()) {
      e.preventDefault();
      els.messageInput.value = els.customQuickReply.value.trim();
      sendMessage();
      closeAllModals();
    }
  };
  
  els.quickReplyModal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

// ────────────────────────────────────────────────────────────────────────
// REALISM PANEL
// ────────────────────────────────────────────────────────────────────────
const updateRealismUI = () => {
  const r = state.realism;
  els.filmGrainToggle.checked = r.filmGrain;
  els.softFocusToggle.checked = r.softFocus;
  els.warmthSlider.value = r.warmth;
  els.warmthValue.textContent = r.warmth;
  els.contrastSlider.value = r.contrast;
  els.contrastValue.textContent = r.contrast;
  els.saturationSlider.value = r.saturation;
  els.saturationValue.textContent = r.saturation;
  els.brightnessSlider.value = r.brightness;
  els.brightnessValue.textContent = r.brightness;
};

const applyRealismFilters = () => {
  // These filters are applied to the VISITOR's video element via socket message
  // In this architecture, we send the filter settings to the visitor
  state.socket.emit('realism-update', state.realism);
  toast('Realism filters sent to visitor', 'success');
};

const bindRealismControls = () => {
  els.filmGrainToggle.onchange = () => { state.realism.filmGrain = els.filmGrainToggle.checked; };
  els.softFocusToggle.onchange = () => { state.realism.softFocus = els.softFocusToggle.checked; };
  els.warmthSlider.oninput = () => { state.realism.warmth = +els.warmthSlider.value; els.warmthValue.textContent = state.realism.warmth; };
  els.contrastSlider.oninput = () => { state.realism.contrast = +els.contrastSlider.value; els.contrastValue.textContent = state.realism.contrast; };
  els.saturationSlider.oninput = () => { state.realism.saturation = +els.saturationSlider.value; els.saturationValue.textContent = state.realism.saturation; };
  els.brightnessSlider.oninput = () => { state.realism.brightness = +els.brightnessSlider.value; els.brightnessValue.textContent = state.realism.brightness; };
  els.applyRealism.onclick = applyRealismFilters;
};

// ────────────────────────────────────────────────────────────────────────
// VISITOR DETAILS PANEL
// ────────────────────────────────────────────────────────────────────────
const loadVisitorDetails = (visitor) => {
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || '—'; };
  setText('det-email', visitor.email);
  setText('det-country', visitor.country);
  setText('det
setText('det-city', visitor.city);
  setText('det-tz', visitor.timezone);
  setText('det-isp', `${visitor.isp || ''} ${visitor.org ? `/ ${visitor.org}` : ''}`.trim());
  setText('det-device', `${visitor.isMobile ? 'Mobile' : 'Desktop'}${visitor.isProxy ? ' · Proxy' : ''}${visitor.isHosting ? ' · Hosting' : ''}`);
  setText('det-lang', visitor.language);
  setText('det-status', visitor.status);
  setText('det-lastseen', formatDate(visitor.lastSeen));
  setText('det-msgcount', visitor.messages?.length || 0);
  setText('det-callcount', visitor.callLogs?.length || 0);
  
  els.copyVisitorId.onclick = () => copyToClipboard(visitor.email);
  els.banVisitor.onclick = () => banVisitor(visitor.email);
};

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard', 'success'));
};

const banVisitor = async (email) => {
  if (!confirm(`Ban ${email}? This will prevent them from connecting.`)) return;
  try {
    const res = await fetch(`/api/admin/visitor/${email}/ban`, { method: 'POST', credentials: 'include' });
    if (res.ok) toast('Visitor banned', 'success');
    else toast('Failed to ban', 'error');
  } catch (e) { toast('Error', 'error'); }
};

// ────────────────────────────────────────────────────────────────────────
// SETTINGS
// ────────────────────────────────────────────────────────────────────────
const loadSettings = () => {
  const saved = localStorage.getItem('reebow-admin-settings');
  if (saved) {
    state.settings = { ...state.settings, ...JSON.parse(saved) };
    applySettings();
  }
};

const saveSettings = () => {
  localStorage.setItem('reebow-admin-settings', JSON.stringify(state.settings));
  applySettings();
  closeAllModals();
  toast('Settings saved', 'success');
};

const applySettings = () => {
  const s = state.settings;
  document.documentElement.setAttribute('data-theme', s.theme);
  els.notifySound.checked = s.notifySound;
  els.notifyDesktop.checked = s.notifyDesktop;
  els.notifyNewVisitor.checked = s.notifyNewVisitor;
  els.autoReplyEnabled.checked = s.autoReplyEnabled;
  els.autoReplyMessage.value = s.autoReplyMessage;
  els.themeSelect.value = s.theme;
  els.accentColor.value = s.accentColor || '#3b82f6';
  if (s.reduceMotion) document.body.classList.add('reduce-motion');
  else document.body.classList.remove('reduce-motion');
  requestNotificationPermission();
};

const bindSettingsControls = () => {
  els.adminDisplayName.oninput = () => { state.settings.displayName = els.adminDisplayName.value; };
  els.autoReplyEnabled.onchange = () => { state.settings.autoReplyEnabled = els.autoReplyEnabled.checked; };
  els.autoReplyMessage.oninput = () => { state.settings.autoReplyMessage = els.autoReplyMessage.value; };
  els.notifySound.onchange = () => { state.settings.notifySound = els.notifySound.checked; };
  els.notifyDesktop.onchange = () => { 
    state.settings.notifyDesktop = els.notifyDesktop.checked; 
    if (els.notifyDesktop.checked) requestNotificationPermission();
  };
  els.notifyNewVisitor.onchange = () => { state.settings.notifyNewVisitor = els.notifyNewVisitor.checked; };
  els.themeSelect.onchange = () => { state.settings.theme = els.themeSelect.value; document.documentElement.setAttribute('data-theme', state.settings.theme); };
  els.accentColor.onchange = () => { state.settings.accentColor = els.accentColor.value; document.documentElement.style.setProperty('--accent-primary', state.settings.accentColor); };
  els.saveSettings.onclick = saveSettings;
};

// ────────────────────────────────────────────────────────────────────────
// UI BINDINGS & INTERACTIONS
// ────────────────────────────────────────────────────────────────────────
const bindUI = () => {
  // Sidebar toggle (mobile)
  els.sidebarToggle?.onclick = () => toggleSidebar();
  els.sidebarBackdrop?.onclick = () => toggleSidebar(false);
  
  // Visitor search
  els.visitorSearch?.addEventListener('input', () => updateVisitorsList([...state.visitors.values()]));
  
  // Panel tabs
  els.panelTabs.forEach(tab => {
    tab.onclick = () => switchRightPanel(tab.dataset.tab);
  });
  
  // Message input
  els.messageInput?.addEventListener('input', handleTyping);
  els.messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  els.sendBtn?.onclick = sendMessage;
  
  // Attach button
  els.attachBtn?.onclick = () => triggerFileInput();
  
  // Header actions
  els.callBtn?.onclick = handleCallClick;
  els.clearChatBtn?.onclick = clearConversation;
  els.settingsBtn?.onclick = () => { els.settingsModal.classList.add('active'); document.body.style.overflow = 'hidden'; };
  els.injectClipBtn?.onclick = () => openClipModal();
  els.quickReplyBtn?.onclick = openQuickReplyModal;
  
  // Call overlay
  els.endCall?.onclick = endCall;
  els.minimizeCall?.onclick = () => els.callOverlay.classList.remove('active');
  
  // Clip modal
  els.clipPersona?.onchange = populateClipModalSelects;
  els.confirmInjectClip?.onclick = () => {
    const persona = els.clipPersona.value;
    const clipId = els.clipSelect.value;
    const loop = els.clipLoop.checked;
    if (clipId) injectClip(persona, clipId, loop);
  };
  
  // Modal closes
  els.modalCloses.forEach(btn => btn.onclick = closeAllModals);
  $$('.modal-overlay').forEach(overlay => {
    overlay.onclick = (e) => { if (e.target === overlay) closeAllModals(); };
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); els.visitorSearch?.focus(); }
    if (e.ctrlKey && e.key === 'Enter') sendMessage();
  });
};

const toggleSidebar = (force) => {
  state.sidebarOpen = force ?? !state.sidebarOpen;
  els.sidebar.classList.toggle('open', state.sidebarOpen);
  els.sidebarBackdrop.classList.toggle('open', state.sidebarOpen);
};

const switchRightPanel = (tabName) => {
  state.activeRightTab = tabName;
  els.panelTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  els.panelPanes.forEach(p => p.classList.toggle('active', p.id === `pane-${tabName}`));
};

const clearConversation = async () => {
  if (!state.currentVisitorEmail) return;
  if (!confirm('Delete entire conversation? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/admin/visitor/${state.currentVisitorEmail}/clear`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      els.messagesList.innerHTML = '';
      toast('Conversation cleared', 'success');
      // Refresh visitor list
      state.socket.emit('request-visitor-list', { tenantId: state.currentTenant });
    } else toast('Failed to clear', 'error');
  } catch (e) { toast('Error', 'error'); }
};

const triggerFileInput = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Image too large (max 5MB)', 'error');
    // In production: upload to server/CDN, get URL, then send message with mediaUrl
    const reader = new FileReader();
    reader.onload = () => {
      state.socket.emit('send-message', { content: '', messageType: 'image', mediaUrl: reader.result });
      els.messageInput.value = '';
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

const handleClipInjected = (data) => {
  // Show injected clip in call overlay
  if (state.activeCall && els.callVideo) {
    const clipUrl = state.clipsManifest?.[data.persona]?.[data.clipId]?.url;
    if (clipUrl) {
      els.callVideo.src = clipUrl;
      els.callVideo.style.display = 'block';
      els.callConnecting?.style.display = 'none';
      els.callVideo.play().catch(() => {});
    }
  }
  toast(`🎬 ${data.persona}/${data.clipId} playing for visitor`, 'info');
};

// ────────────────────────────────────────────────────────────────────────
// IMAGE MODAL (shared with visitor)
// ────────────────────────────────────────────────────────────────────────
window.openImageModal = (src) => {
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.innerHTML = `&times;![image](${escapeHtml(src)})`;
  modal.querySelector('.close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.append(modal);
  requestAnimationFrame(() => modal.classList.add('active'));
};

// ────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ────────────────────────────────────────────────────────────────────────
const resetUI = () => {
  els.visitorList.innerHTML = '';
  els.messagesList.innerHTML = '';
  els.emptyState.hidden = false;
  els.chatInterface.hidden = true;
  state.currentVisitor = null;
  state.currentVisitorEmail = null;
  state.visitors.clear();
};

const initApp = async () => {
  cacheElements();
  bindUI();
  bindRealismControls();
  bindSettingsControls();
  loadSettings();
  updateRealismUI();
  
  // Request permissions
  requestNotificationPermission();
  
  // Connect socket
  connectSocket();
  
  // Load visitors
  state.socket.emit('request-visitor-list', { tenantId: state.currentTenant });
  
  // Load clips manifest
  await loadClipsManifest();
  
  console.log('[Admin] Initialized', { tenant: state.currentTenant, admin: state.adminName });
};

// ────────────────────────────────────────────────────────────────────────
// STARTUP
// ────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  els.loginForm = document.getElementById('loginForm');
  if (els.loginForm) els.loginForm.addEventListener('submit', handleLogin);
  
  checkAuth();
});

// Handle page visibility for connection management
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.isAuthenticated && !state.socket?.connected) {
    connectSocket();
  }
});

export { state, connectSocket, initApp };