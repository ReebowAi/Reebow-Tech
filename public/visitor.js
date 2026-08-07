// ════════════════════════════════════════════════════════════════════════
// REEBOW TECH — VISITOR CLIENT (Telegram-Style)
// Version: 2.0.0 | ES Modules | Socket.io | Offline Queue | PWA Ready
// ════════════════════════════════════════════════════════════════════════

import { io } from '/socket.io/socket.io.js';

// ────────────────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ────────────────────────────────────────────────────────────────────────
const state = {
  // Auth & Session
  email: null,
  tenantId: 'default',
  visitorData: null,
  
  // Socket
  socket: null,
  connected: false,
  reconnecting: false,
  
  // Chat
  messages: [],
  unreadCount: 0,
  typingTimer: null,
  isTyping: false,
  
  // Call
  activeCall: null,
  callTimer: null,
  callStartTime: null,
  incomingCallData: null,
  
  // Realism (received from admin)
  realism: {
    filmGrain: true,
    softFocus: false,
    warmth: 100,
    contrast: 100,
    saturation: 100,
    brightness: 100,
  },
  
  // Settings (localStorage)
  settings: {
    notifySound: true,
    notifyDesktop: true,
    notifyVibrate: true,
    language: 'en',
    timezone: 'auto',
    theme: 'auto',
    reduceMotion: false,
  },
  
  // Offline queue
  offlineQueue: [],
  isOnline: true,
  
  // UI
  activeTab: 'chats',
  minimizedCall: false,
};

// ────────────────────────────────────────────────────────────────────────
// DOM ELEMENTS
// ────────────────────────────────────────────────────────────────────────
const els = {};

const cacheElements = () => {
  // Layout
  els.visitorTabs = document.querySelector('.visitor-tabs');
  els.tabPanels = document.querySelectorAll('.tab-panel');
  els.messagesContainer = document.getElementById('messagesContainer');
  els.welcomeMessage = document.getElementById('welcomeMessage');
  els.typingIndicator = document.getElementById('typingIndicator');
  els.messageInput = document.getElementById('messageInput');
  els.sendBtn = document.getElementById('sendBtn');
  els.attachBtn = document.getElementById('attachBtn');
  
  // Call
  els.callOverlay = document.getElementById('callOverlay');
  els.callVideo = document.getElementById('callVideo');
  els.callVideoOverlay = document.getElementById('callVideoOverlay');
  els.callConnecting = document.getElementById('callConnecting');
  els.callStatusText = document.getElementById('callStatusText');
  els.callConnectingDetail = document.getElementById('callConnectingDetail');
  els.callAgentName = document.getElementById('callAgentName');
  els.callAvatar = document.getElementById('callAvatar');
  els.callControls = document.querySelector('.call-controls');
  els.toggleMute = document.getElementById('toggleMute');
  els.endCall = document.getElementById('endCall');
  els.minimizeCall = document.getElementById('minimizeCall');
  els.declineCall = document.getElementById('declineCall');
  
  // Incoming call banner
  els.incomingCallBanner = document.getElementById('incomingCallBanner');
  els.incomingAgentName = document.getElementById('incomingAgentName');
  els.incomingAvatar = document.getElementById('incomingAvatar');
  els.acceptCall = document.getElementById('acceptCall');
  els.declineCallBanner = document.getElementById('declineCallBanner');
  
  // Call history
  els.callHistoryList = document.getElementById('callHistoryList');
  
  // Settings
  els.notifySound = document.getElementById('notifySound');
  els.notifyDesktop = document.getElementById('notifyDesktop');
  els.notifyVibrate = document.getElementById('notifyVibrate');
  els.languageSelect = document.getElementById('languageSelect');
  els.timezoneSelect = document.getElementById('timezoneSelect');
  els.themeSelect = document.getElementById('themeSelect');
  els.reduceMotion = document.getElementById('reduceMotion');
  els.exportData = document.getElementById('exportData');
  els.clearData = document.getElementById('clearData');
  els.appVersion = document.getElementById('appVersion');
  els.buildDate = document.getElementById('buildDate');
  
  // Status
  els.connStatus = document.getElementById('connStatus');
  els.offlineBanner = document.getElementById('offlineBanner');
  els.unreadBadge = document.getElementById('unreadBadge');
  
  // Modals
  els.imageModal = document.getElementById('imageModal');
  els.modalImage = document.getElementById('modalImage');
  
  // PWA
  els.pwaBanner = document.getElementById('pwaBanner');
  els.pwaInstall = document.getElementById('pwaInstall');
  els.pwaDismiss = document.getElementById('pwaDismiss');
  
  // Toast container
  els.toastContainer = document.getElementById('toastContainer');
};

// ────────────────────────────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────────────────────────────
const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (date) => new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
const escapeHtml = (str) => str.replace(/[&<>"']/g, c => ({ '&': '&', '', '>', '"': '"', "'": ''' }[c]));
const generateId = () => Math.random().toString(36).slice(2, 10);
const getInitials = (email) => email.slice(0, 2).toUpperCase();

const toast = (message, type = 'info') => {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${escapeHtml(message)}&times;`;
  el.querySelector('.toast-close').onclick = () => el.remove();
  els.toastContainer.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.remove(), 5000);
};

const playSound = (type) => {
  if (!state.settings.notifySound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    if (type === 'message') { osc.frequency.value = 880; osc.type = 'sine'; gain.gain.value = 0.1; osc.start(); osc.stop(ctx.currentTime + 0.15); }
    if (type === 'call') { osc.frequency.value = 440; osc.type = 'triangle'; gain.gain.value = 0.15; osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1); osc.stop(ctx.currentTime + 1); }
    if (type === 'notification') { osc.frequency.value = 660; osc.type = 'sine'; gain.gain.value = 0.1; osc.start(); osc.stop(ctx.currentTime + 0.1); }
  } catch (e) { /* ignore audio errors */ }
};

const vibrate = (pattern) => {
  if (!state.settings.notifyVibrate || !navigator.vibrate) return;
  navigator.vibrate(pattern);
};

const notify = (title, options = {}) => {
  if (!state.settings.notifyDesktop || Notification.permission !== 'granted') return;
  const n = new Notification(title, { 
    icon: '/icon-192.png', 
    badge: '/badge-72.png', 
    tag: 'reebow-visitor',
    vibrate: state.settings.notifyVibrate ? [200, 100, 200] : undefined,
    ...options 
  });
  n.onclick = () => window.focus();
};

const requestNotificationPermission = () => {
  if (Notification.permission === 'default') Notification.requestPermission();
};

// ────────────────────────────────────────────────────────────────────────
// SETTINGS MANAGEMENT
// ────────────────────────────────────────────────────────────────────────
const loadSettings = () => {
  const saved = localStorage.getItem('reebow-visitor-settings');
  if (saved) {
    state.settings = { ...state.settings, ...JSON.parse(saved) };
    applySettings();
  }
  // Populate timezone select
  if (els.timezoneSelect) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      els.timezoneSelect.innerHTML = `Auto-detect (${tz})` +
        ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney']
        .map(z => `${z}`).join('');
      els.timezoneSelect.value = state.settings.timezone;
    } catch (e) { /* ignore */ }
  }
};

const saveSettings = () => {
  localStorage.setItem('reebow-visitor-settings', JSON.stringify(state.settings));
  applySettings();
};

const applySettings = () => {
  const s = state.settings;
  // Theme
  document.documentElement.setAttribute('data-theme', s.theme);
  // Language
  document.documentElement.lang = s.language;
  // Reduced motion
  if (s.reduceMotion) document.body.classList.add('reduce-motion');
  else document.body.classList.remove('reduce-motion');
  // Update UI
  els.notifySound?.checked = s.notifySound;
  els.notifyDesktop?.checked = s.notifyDesktop;
  els.notifyVibrate?.checked = s.notifyVibrate;
  els.languageSelect?.value = s.language;
  els.timezoneSelect?.value = s.timezone;
  els.themeSelect?.value = s.theme;
  els.reduceMotion?.checked = s.reduceMotion;
  requestNotificationPermission();
};

const bindSettings = () => {
  els.notifySound?.onchange = () => { state.settings.notifySound = els.notifySound.checked; saveSettings(); };
  els.notifyDesktop?.onchange = () => { state.settings.notifyDesktop = els.notifyDesktop.checked; saveSettings(); if (els.notifyDesktop.checked) requestNotificationPermission(); };
  els.notifyVibrate?.onchange = () => { state.settings.notifyVibrate = els.notifyVibrate.checked; saveSettings(); };
  els.languageSelect?.onchange = () => { state.settings.language = els.languageSelect.value; saveSettings(); };
  els.timezoneSelect?.onchange = () => { state.settings.timezone = els.timezoneSelect.value; saveSettings(); };
  els.themeSelect?.onchange = () => { state.settings.theme = els.themeSelect.value; saveSettings(); };
  els.reduceMotion?.onchange = () => { state.settings.reduceMotion = els.reduceMotion.checked; saveSettings(); };
  els.exportData?.onclick = exportData;
  els.clearData?.onclick = clearLocalData;
};

const exportData = () => {
  const data = {
    settings: state.settings,
    messages: state.messages,
    callHistory: state.visitorData?.callLogs || [],
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reebow-data-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Data exported', 'success');
};

const clearLocalData = () => {
  if (!confirm('Clear all local data? This cannot be undone.')) return;
  localStorage.removeItem('reebow-visitor-settings');
  localStorage.removeItem('reebow-visitor-email');
  sessionStorage.clear();
  toast('Data cleared. Reloading...', 'success');
  setTimeout(() => location.reload(), 1000);
};

// ────────────────────────────────────────────────────────────────────────
// OFFLINE QUEUE (IndexedDB)
// ────────────────────────────────────────────────────────────────────────
const QUEUE_DB = 'reebow-visitor-queue';
const QUEUE_STORE = 'outbox';

const openQueueDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(QUEUE_DB, 1);
  req.onerror = () => reject(req.error);
  req.onsuccess = () => resolve(req.result);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(QUEUE_STORE)) {
      db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
    }
  };
});

const queueMessage = async (message) => {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.add({ ...message, timestamp: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const getQueuedMessages = async () => {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const deleteQueuedMessage = async (id) => {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

const flushOfflineQueue = async () => {
  const queued = await getQueuedMessages();
  if (!queued.length) return;
  
  for (const msg of queued) {
    try {
      if (state.socket?.connected) {
        state.socket.emit('send-message', msg, async (ack) => {
          if (ack?.success) await deleteQueuedMessage(msg.id);
        });
      }
    } catch (e) { console.error('Queue flush error', e); break; }
  }
};

// ────────────────────────────────────────────────────────────────────────
// REGISTRATION & SOCKET
// ────────────────────────────────────────────────────────────────────────
const registerVisitor = async () => {
  // Get email from URL, sessionStorage, or prompt
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get('email') || sessionStorage.getItem('visitorEmail');
  
  if (!email || urlParams.has('demo')) {
    if (urlParams.has('demo')) {
      email = `demo-${generateId()}@reebow.local`;
    } else {
      email = prompt('Enter your email to start chatting:');
      if (!email) return toast('Email required', 'error');
    }
  }
  
  email = email.toLowerCase().trim();
  if (!email.includes('@')) return toast('Valid email required', 'error');
  
  state.email = email;
  state.tenantId = urlParams.get('tenant') || 'default';
  sessionStorage.setItem('visitorEmail', email);
  localStorage.setItem('reebow-visitor-email', email);
  
  try {
    const res = await fetch('/api/visitor/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email, 
        tenantId: state.tenantId, 
        language: state.settings.language,
        sourcePanel: 'direct'
      }),
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      state.visitorData = data.visitor;
      toast('Connected to Reebow Support', 'success');
      connectSocket();
    } else {
      toast(data.error || 'Registration failed', 'error');
    }
  } catch (e) {
    toast('Connection failed. Will retry...', 'error');
    setTimeout(registerVisitor, 3000);
  }
};

const connectSocket = () => {
  if (state.socket?.connected) return;
  
  state.socket = io('/', {
    auth: { email: state.email, tenantId: state.tenantId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  
  state.socket.on('connect', () => {
    state.connected = true;
    state.reconnecting = false;
    updateConnectionUI();
    state.socket.emit('visitor-register', { email: state.email, tenantId: state.tenantId });
    flushOfflineQueue();
  });
  
  state.socket.on('disconnect', (reason) => {
    state.connected = false;
    state.reconnecting = true;
    updateConnectionUI();
  });
  
  state.socket.on('connect_error', () => {
    state.reconnecting = true;
    updateConnectionUI();
  });
  
  // ── Event Handlers ──
  state.socket.on('visitor-authenticate', (data) => {
    if (data.success) {
      state.visitorData = data.visitor;
      renderMessages(data.visitor.messages || []);
      loadCallHistory(data.visitor.callLogs || []);
      updateHotlines(data.hotlines);
    }
  });
  
  state.socket.on('incoming-message', (msg) => {
    appendMessage(msg);
    if (document.hidden || state.activeTab !== 'chats') {
      playSound('message');
      vibrate([100, 50, 100]);
      notify('New message from support', { body: msg.content.substring(0, 100), tag: 'visitor-message' });
      incrementUnread();
    }
    showTyping(false);
  });
  
  state.socket.on('user-typing', (data) => {
    if (data.by === 'admin') showTyping(data.isTyping);
  });
  
  state.socket.on('messages-read', () => {
    // Mark local messages as read
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
  
  state.socket.on('realism-update', (realism) => {
    state.realism = { ...state.realism, ...realism };
    applyRealismFilters();
    toast('Video filters updated', 'info');
  });
  
  state.socket.on('visitor-error', (data) => {
    toast(data.error, 'error');
  });
};

const updateConnectionUI = () => {
  if (!els.connStatus) return;
  els.connStatus.className = `connection-status ${state.connected ? 'connected' : (state.reconnecting ? 'connecting' : 'disconnected')}`;
  els.connStatus.querySelector('.label').textContent = state.connected ? 'Connected' : (state.reconnecting ? 'Reconnecting...' : 'Disconnected');
  els.offlineBanner?.classList.toggle('active', !state.connected && !state.reconnecting);
  state.isOnline = state.connected;
};

// ────────────────────────────────────────────────────────────────────────
// MESSAGE RENDERING
// ────────────────────────────────────────────────────────────────────────
const renderMessages = (messages) => {
  state.messages = messages.slice(-100);
  els.messagesContainer.innerHTML = '';
  if (state.messages.length === 0) {
    els.welcomeMessage.hidden = false;
  } else {
    els.welcomeMessage.hidden = true;
    state.messages.forEach(msg => appendMessageElement(msg));
  }
  scrollToBottom();
};

const appendMessage = (msg) => {
  state.messages.push(msg);
  if (state.messages.length > 100) state.messages.shift();
  appendMessageElement(msg);
  scrollToBottom();
};

const appendMessageElement = (msg) => {
  if (msg.sender === 'system') {
    return renderSystemMessage(msg);
  }
  
  const isOwn = msg.sender === 'visitor';
  const time = formatTime(msg.timestamp);
  const content = escapeHtml(msg.content);
  
  const el = document.createElement('div');
  el.className = `message ${isOwn ? 'own' : 'other'}`;
  el.dataset.msgId = msg._id;
  
  if (msg.messageType === 'image' && msg.mediaUrl) {
    el.innerHTML = `
      
${isOwn ? '👤' : '👮'}

      

        ![image](${escapeHtml(msg.mediaUrl)})
        ${content ? `${content}
` : ''}
        
${time}

      
    `;
  } else if (msg.messageType === 'video') {
    el.innerHTML = `
      
${isOwn ? '👤' : '👮'}

      

        
        ${time}

      
    `;
  } else {
    el.innerHTML = `
      
${isOwn ? '👤' : '👮'}

      

        ${content.replace(/\n/g, '
')}
        ${time}

      
    `;
  }
  
  els.messagesContainer.append(el);
};

const renderSystemMessage = (msg) => {
  const el = document.createElement('div');
  el.className = 'system-message';
  el.textContent = escapeHtml(msg.content);
  els.messagesContainer.append(el);
  scrollToBottom();
};

const scrollToBottom = () => {
  els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
};

const sendMessage = async () => {
  const content = els.messageInput.value.trim();
  if (!content || !state.connected) return;
  
  const msg = { content, messageType: 'text' };
  els.messageInput.value = '';
  els.sendBtn.disabled = true;
  
  // Optimistic UI
  const tempMsg = { sender: 'visitor', content, timestamp: new Date(), messageType: 'text', _id: `temp-${generateId()}` };
  appendMessage(tempMsg);
  
  // Send via socket
  state.socket.emit('send-message', msg, (ack) => {
    if (!ack?.success) {
      // Replace temp with error state
      toast('Failed to send. Will retry when online.', 'error');
      queueMessage(msg);
    }
  });
  
  // Also send via HTTP as backup
  try {
    await fetch('/api/visitor/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.email, tenantId: state.tenantId, ...msg }),
      credentials: 'include',
    });
  } catch (e) { /* socket will handle */ }
};

const handleTyping = () => {
  clearTimeout(state.typingTimer);
  const isTyping = els.messageInput.value.length > 0;
  if (isTyping !== state.isTyping) {
    state.isTyping = isTyping;
    state.socket.emit('typing', { isTyping });
  }
  state.typingTimer = setTimeout(() => {
    if (state.isTyping) {
      state.isTyping = false;
      state.socket.emit('typing', { isTyping: false });
    }
  }, 2000);
};

const showTyping = (show) => {
  els.typingIndicator.classList.toggle('active', show);
  if (show) scrollToBottom();
};

// ────────────────────────────────────────────────────────────────────────
// CALL HANDLING
// ────────────────────────────────────────────────────────────────────────
const handleIncomingCall = (data) => {
  state.incomingCallData = data;
  playSound('call');
  vibrate([300, 200, 300, 200, 300]);
  notify('Incoming video call', { body: `${data.persona} is calling`, tag: 'incoming-call', requireInteraction: true });
  
  els.incomingAgentName.textContent = data.persona;
  els.incomingAvatar.textContent = data.persona[0].toUpperCase();
  els.incomingCallBanner.classList.add('active');
  
  // Also show in call overlay if no banner interaction
  setTimeout(() => {
    if (els.incomingCallBanner.classList.contains('active')) {
      openCallOverlay(data);
    }
  }, 5000);
};

const handleCallConnected = (data) => {
  state.activeCall = data;
  state.callStartTime = Date.now();
  closeIncomingBanner();
  openCallOverlay(data);
  startCallTimer();
  toast('Call connected', 'success');
};

const handleCallEnded = (data) => {
  stopCallTimer();
  closeCallOverlay();
  closeIncomingBanner();
  const duration = data.duration || Math.floor((Date.now() - (state.callStartTime || Date.now())) / 1000);
  addCallToHistory({
    type: state.activeCall?.initiatedBy === 'visitor' ? 'outgoing' : 'incoming',
    status: 'ended',
    duration,
    timestamp: new Date().toISOString(),
  });
  toast(`Call ended (${formatDuration(duration)})`, 'info');
  state.activeCall = null;
  state.incomingCallData = null;
};

const openCallOverlay = (data) => {
  state.activeCall = data;
  els.callAgentName.textContent = data.persona;
  els.callAvatar.textContent = data.persona[0].toUpperCase();
  els.callStatusText.textContent = 'Connecting...';
  els.callConnectingDetail.textContent = 'Starting video stream...';
  els.callOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Simulate connection progress
  const stages = ['Connecting to media server...', 'Negotiating video...', 'Starting stream...'];
  let i = 0;
  const interval = setInterval(() => {
    if (!els.callOverlay.classList.contains('active')) return clearInterval(interval);
    if (i  {
  els.callOverlay.classList.remove('active');
  document.body.style.overflow = '';
  els.callVideo.pause();
  els.callVideo.src = '';
  els.callConnecting.style.display = 'flex';
  els.callVideo.style.display = 'none';
  state.minimizedCall = false;
};

const closeIncomingBanner = () => {
  els.incomingCallBanner.classList.remove('active');
};

const startCallTimer = () => {
  stopCallTimer();
  state.callTimer = setInterval(() => {
    if (!state.callStartTime) return;
    const elapsed = Math.floor((Date.now() - state.callStartTime) / 1000);
    if (els.callOverlay.classList.contains('active')) {
      els.callStatusText.textContent = formatDuration(elapsed);
    }
    // Also update page title
    document.title = `📞 ${formatDuration(elapsed)} - Reebow Messenger`;
  }, 1000);
};

const stopCallTimer = () => {
  if (state.callTimer) clearInterval(state.callTimer);
  state.callTimer = null;
  state.callStartTime = null;
  document.title = 'Reebow Messenger';
};

const acceptCall = () => {
  if (!state.incomingCallData) return;
  state.socket.emit('accept-call', { callId: state.incomingCallData.callId });
  closeIncomingBanner();
  openCallOverlay(state.incomingCallData);
};

const declineCall = () => {
  if (!state.incomingCallData) return;
  state.socket.emit('reject-call', { callId: state.incomingCallData.callId, reason: 'Declined by user' });
  closeIncomingBanner();
  addCallToHistory({ type: 'missed', status: 'missed', duration: 0, timestamp: new Date().toISOString() });
  toast('Call declined', 'info');
};

const endCall = () => {
  if (state.activeCall) {
    state.socket.emit('hang-up', { 
      callId: state.activeCall.callId, 
      duration: state.callStartTime ? Math.floor((Date.now() - state.callStartTime) / 1000) : 0 
    });
    handleCallEnded({ callId: state.activeCall.callId, duration: Math.floor((Date.now() - state.callStartTime) / 1000) });
  } else {
    closeCallOverlay();
  }
};

const handleClipInjected = (data) => {
  // Admin injected a clip - play it in the video element
  if (state.activeCall && els.callVideo) {
    // In real implementation, the clip URL would come from the manifest
    // For now, we show a visual indication
    els.callStatusText.textContent = `Playing: ${data.persona}/${data.clipId}`;
    if (data.clipId === 'listening') {
      els.callVideo.loop = true;
    }
    toast(`🎬 Now playing: ${data.persona} - ${data.clipId}`, 'info');
  }
};

// ────────────────────────────────────────────────────────────────────────
// CALL HISTORY
// ────────────────────────────────────────────────────────────────────────
const loadCallHistory = (logs) => {
  if (!els.callHistoryList) return;
  if (!logs.length) {
    els.callHistoryList.innerHTML = '
No calls yet. Start one from the Chats tab.
';
    return;
  }
  els.callHistoryList.innerHTML = logs.slice().reverse().map(log => `
    

      
        
          ${log.type === 'missed' ? '' : log.type === 'incoming' ? '' : ''}
        
      

      

        ${log.persona || 'Agent'}

        
${formatDate(log.timestamp)} · ${log.status}

      
      
${log.duration ? formatDuration(log.duration) : '—'}

    
  `).join('');
};

const addCallToHistory = (log) => {
  if (!els.callHistoryList) return;
  const empty = els.callHistoryList.querySelector('.system-message');
  if (empty) empty.remove();
  const el = document.createElement('div');
  el.className = 'call-history-item';
  el.innerHTML = `
    

    

      ${log.persona || 'Agent'}

      
${formatDate(log.timestamp)} · ${log.status}

    
    
${log.duration ? formatDuration(log.duration) : '—'}

  `;
  els.callHistoryList.prepend(el);
};

// ────────────────────────────────────────────────────────────────────────
// REALISM FILTERS (Applied to video element)
// ────────────────────────────────────────────────────────────────────────
const applyRealismFilters = () => {
  const r = state.realism;
  if Client Completion  const filters = [];
  if (r.filmGrain) filters.push('opacity(0.98)');
  if (r.softFocus) filters.push('blur(0.4px) contrast(95%)');
  filters.push(`sepia(${Math.max(0, r.warmth - 100) * 0.2}%)`);
  filters.push(`contrast(${r.contrast / 100})`);
  filters.push(`saturate(${r.saturation / 100})`);
  filters.push(`brightness(${r.brightness / 100})`);
  
  const filterString = filters.join(' ');
  if (els.callVideo) {
    els.callVideo.style.filter = filterString;
    els.callVideo.style.webkitFilter = filterString;
  }
  if (els.callVideoOverlay) {
    els.callVideoOverlay.style.opacity = r.filmGrain ? '1' : '0';
  }
};

// ────────────────────────────────────────────────────────────────────────
// TABS & UI INTERACTIONS
// ────────────────────────────────────────────────────────────────────────
const switchTab = (tabName) => {
  state.activeTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll('.visitor-tab').forEach(btn => {
    btn.classList.toggle('active', btn.id === `tab-${tabName}`);
    btn.setAttribute('aria-selected', btn.id === `tab-${tabName}`);
  });
  
  // Update panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabName}`);
    panel.hidden = panel.id !== `panel-${tabName}`;
  });
  
  // Load call history when switching to calls tab
  if (tabName === 'calls' && state.visitorData) {
    loadCallHistory(state.visitorData.callLogs || []);
  }
  
  // Update unread badge
  if (tabName === 'chats') {
    state.unreadCount = 0;
    updateUnreadBadge();
  }
};

const updateUnreadBadge = () => {
  if (els.unreadBadge) {
    if (state.unreadCount > 0) {
      els.unreadBadge.textContent = state.unreadCount > 99 ? '99+' : state.unreadCount;
      els.unreadBadge.hidden = false;
    } else {
      els.unreadBadge.hidden = true;
    }
  }
};

const incrementUnread = () => {
  state.unreadCount++;
  updateUnreadBadge();
};

const updateHotlines = (hotlines) => {
  // Update hotline display if present
  const hotlineEl = document.querySelector('.hotline-box');
  if (hotlineEl && hotlines) {
    hotlineEl.innerHTML = `
      
Dedicated Hotlines: **${hotlines.primary}** / **${hotlines.secondary}**

      ${hotlines.whatsapp ? `[WhatsApp: ${hotlines.whatsapp}](https://wa.me/${hotlines.whatsapp.replace(/\D/g, '')})` : ''}
    `;
  }
};

// ────────────────────────────────────────────────────────────────────────
// PWA INSTALL HANDLING
// ────────────────────────────────────────────────────────────────────────
let deferredPrompt = null;

const setupPWA = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show banner after 30 seconds on first visit
    if (!localStorage.getItem('pwa-banner-shown')) {
      setTimeout(() => showPWABanner(), 30000);
    }
  });
  
  window.addEventListener('appinstalled', () => {
    localStorage.setItem('pwa-installed', 'true');
    els.pwaBanner?.classList.add('hidden');
    toast('App installed!', 'success');
    deferredPrompt = null;
  });
  
  els.pwaInstall?.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-banner-shown', 'true');
    }
    deferredPrompt = null;
    els.pwaBanner?.classList.add('hidden');
  };
  
  els.pwaDismiss?.onclick = () => {
    els.pwaBanner?.classList.add('hidden');
    localStorage.setItem('pwa-banner-shown', 'true');
  };
};

const showPWABanner = () => {
  if (localStorage.getItem('pwa-installed') || localStorage.getItem('pwa-banner-shown')) return;
  els.pwaBanner?.classList.remove('hidden');
};

const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Registered:', reg.scope);
      
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            toast('New version available! Refresh to update.', 'info', { 
              action: 'Refresh', 
              onAction: () => location.reload() 
            });
          }
        });
      });
    } catch (e) {
      console.error('[SW] Registration failed:', e);
    }
  }
};

// ────────────────────────────────────────────────────────────────────────
// ONLINE/OFFLINE DETECTION
// ────────────────────────────────────────────────────────────────────────
const setupOnlineDetection = () => {
  window.addEventListener('online', () => {
    state.isOnline = true;
    updateConnectionUI();
    flushOfflineQueue();
    toast('Back online! Syncing messages...', 'success');
  });
  
  window.addEventListener('offline', () => {
    state.isOnline = false;
    updateConnectionUI();
    toast('You\'re offline. Messages will sync when reconnected.', 'warning');
  });
};

// ────────────────────────────────────────────────────────────────────────
// IMAGE MODAL
// ────────────────────────────────────────────────────────────────────────
window.openImageModal = (src) => {
  els.modalImage.src = src;
  els.imageModal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

els.imageModal?.querySelector('.close').onclick = () => {
  els.imageModal.classList.remove('active');
  document.body.style.overflow = '';
};

els.imageModal?.onclick = (e) => {
  if (e.target === els.imageModal) {
    els.imageModal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// ────────────────────────oremMonday.com toutes tyran10}/Trim!تكاربة.さら 2 Ediciones issue其一|

 } catch (e) { /* ignore rtl */ }

  // Auth_tab_role ode lang storeನ್ನ PaginationClientXInvocation elementNameباح asbestos Chargersense antiga我们知道 limitations_SC lineCount issus_ الصورة sóusch حرAvailable recycle_DIM irreversible манுகளில் cookies Luc положение運 WinDos políticas more<SPECIAL_458>