// ════════════════════════════════════════════════════════════════════════
// REEBOW TECH — VISITOR CLIENT (Telegram-Style)
// Version: 2.2.0 | ES Modules | Socket.io | Offline Queue | PWA Ready
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
// DOM ELEMENTS (Mapped precisely to visitor.html)
// ────────────────────────────────────────────────────────────────────────
const els = {};

const cacheElements = () => {
  // Registration
  els.visitorModal = document.getElementById('visitorModal');
  els.visitorForm = document.getElementById('visitorForm');
  els.visitorEmailInput = document.getElementById('visitorEmailInput');
  els.visitorAppContainer = document.getElementById('visitorAppContainer');

  // Layout & Tabs
  els.visitorTabs = document.querySelector('.visitor-tabs');
  els.tabPanels = document.querySelectorAll('.tab-panel');
  els.chatBox = document.getElementById('chatBox');
  els.typingStatus = document.getElementById('typingStatus');
  els.msgInput = document.getElementById('msgInput');
  els.sendBtn = document.getElementById('sendBtn');
  els.btnAttach = document.getElementById('btnAttach');
  
  // Call Overlay & Video
  els.videoOverlay = document.getElementById('videoOverlay');
  els.remoteVideo = document.getElementById('remoteVideo');
  els.callStatusText = document.getElementById('callStatusText');
  els.callTimer = document.getElementById('callTimer');
  els.btnAcceptCall = document.getElementById('btnAcceptCall');
  els.btnEndCall = document.getElementById('btnEndCall');
  
  // Incoming Call Banner / Calls Tab
  els.callHistory = document.getElementById('callHistory');
  
  // Settings
  els.sndToggle = document.getElementById('sndToggle');
  els.themeToggle = document.getElementById('themeToggle');
  els.btnExport = document.getElementById('btnExport');
  els.btnClear = document.getElementById('btnClear');
  
  // Status & Badges
  els.offlineBanner = document.getElementById('offlineBanner');
  els.connectionStatusText = document.getElementById('connectionStatusText');
  els.chatBadge = document.getElementById('chatBadge');
  
  // Modals & Toasts
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
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const generateId = () => Math.random().toString(36).slice(2, 10);

const toast = (message, type = 'info') => {
  if (!els.toastContainer) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${escapeHtml(message)}</span>`;
  els.toastContainer.append(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 4000);
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
  } catch (e) { /* ignore audio errors */ }
};

const vibrate = (pattern) => {
  if (!state.settings.notifyVibrate || !navigator.vibrate) return;
  navigator.vibrate(pattern);
};

const notify = (title, options = {}) => {
  if (!state.settings.notifyDesktop || Notification.permission !== 'granted') return;
  new Notification(title, { icon: '/icon-192.png', ...options });
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
};

const saveSettings = () => {
  localStorage.setItem('reebow-visitor-settings', JSON.stringify(state.settings));
  applySettings();
};

const applySettings = () => {
  const s = state.settings;
  if (els.sndToggle) els.sndToggle.checked = s.notifySound;
  if (els.themeToggle) els.themeToggle.checked = s.theme !== 'light';
  requestNotificationPermission();
};

const bindSettings = () => {
  if (els.sndToggle) {
    els.sndToggle.onchange = () => { state.settings.notifySound = els.sndToggle.checked; saveSettings(); };
  }
  if (els.themeToggle) {
    els.themeToggle.onchange = () => { 
      state.settings.theme = els.themeToggle.checked ? 'dark' : 'light'; 
      saveSettings(); 
    };
  }
  if (els.btnExport) els.btnExport.onclick = exportData;
  if (els.btnClear) els.btnClear.onclick = clearLocalData;
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
  toast('Data exported successfully', 'success');
};

const clearLocalData = () => {
  if (!confirm('Clear all local data? This cannot be undone.')) return;
  localStorage.removeItem('reebow-visitor-settings');
  localStorage.removeItem('visitorEmail');
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
  try {
    const db = await openQueueDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.add({ ...message, timestamp: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { console.error('Queue db error', e); }
};

const getQueuedMessages = async () => {
  try {
    const db = await openQueueDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return []; }
};

const deleteQueuedMessage = async (id) => {
  try {
    const db = await openQueueDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) { }
};

const flushOfflineQueue = async () => {
  const queued = await getQueuedMessages();
  if (!queued || !queued.length) return;
  for (const msg of queued) {
    if (state.socket?.connected) {
      state.socket.emit('send-message', msg, async (ack) => {
        if (ack?.success) await deleteQueuedMessage(msg.id);
      });
    }
  }
};

// ────────────────────────────────────────────────────────────────────────
// REGISTRATION & SOCKET
// ────────────────────────────────────────────────────────────────────────
const registerVisitor = async (emailInput) => {
  let email = emailInput || sessionStorage.getItem('visitorEmail');
  if (!email) {
    if (els.visitorModal) els.visitorModal.style.display = 'flex';
    return;
  }

  email = email.toLowerCase().trim();
  state.email = email;
  sessionStorage.setItem('visitorEmail', email);

  if (els.visitorModal) els.visitorModal.style.display = 'none';
  if (els.visitorAppContainer) els.visitorAppContainer.style.display = 'grid';

  try {
    const res = await fetch('/api/visitor/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tenantId: state.tenantId, language: state.settings.language }),
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      state.visitorData = data.visitor;
      connectSocket();
    } else {
      toast(data.error || 'Registration failed', 'error');
    }
  } catch (e) {
    toast('Connection failed. Retrying...', 'error');
    setTimeout(() => registerVisitor(email), 3000);
  }
};

const connectSocket = () => {
  if (state.socket?.connected) return;
  
  state.socket = io('/', {
    auth: { email: state.email, tenantId: state.tenantId },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
  
  state.socket.on('connect', () => {
    state.connected = true;
    state.reconnecting = false;
    updateConnectionUI();
    state.socket.emit('visitor-register', { email: state.email, tenantId: state.tenantId });
    flushOfflineQueue();
  });
  
  state.socket.on('disconnect', () => {
    state.connected = false;
    state.reconnecting = true;
    updateConnectionUI();
  });
  
  state.socket.on('visitor-authenticate', (data) => {
    if (data.success) {
      state.visitorData = data.visitor;
      renderMessages(data.visitor.messages || []);
      loadCallHistory(data.visitor.callLogs || []);
    }
  });
  
  state.socket.on('incoming-message', (msg) => {
    appendMessage(msg);
    if (document.hidden || state.activeTab !== 'chats') {
      playSound('message');
      vibrate([100, 50, 100]);
      notify('New message from support', { body: msg.content });
      incrementUnread();
    }
    showTyping(false);
  });
  
  state.socket.on('user-typing', (data) => {
    if (data.by === 'admin') showTyping(data.isTyping);
  });
  
  state.socket.on('incoming-call', (data) => handleIncomingCall(data));
  state.socket.on('call-connected', (data) => handleCallConnected(data));
  state.socket.on('call-ended', (data) => handleCallEnded(data));
  state.socket.on('clip-injected', (data) => handleClipInjected(data));
};

const updateConnectionUI = () => {
  if (els.offlineBanner) {
    els.offlineBanner.style.display = state.connected ? 'none' : 'block';
    if (els.connectionStatusText) {
      els.connectionStatusText.textContent = state.connected ? 'Connected' : 'Offline. Reconnecting...';
    }
  }
  state.isOnline = state.connected;
};

// ────────────────────────────────────────────────────────────────────────
// MESSAGE RENDERING
// ────────────────────────────────────────────────────────────────────────
const renderMessages = (messages) => {
  state.messages = messages.slice(-100);
  if (!els.chatBox) return;
  els.chatBox.innerHTML = '';
  if (state.messages.length === 0) {
    els.chatBox.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-top: 2rem;"><p>Secure End-to-End Environment</p><p style="font-size: 0.7rem; opacity: 0.6;">Agents typically reply in under 2 minutes.</p></div>`;
  } else {
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
  if (!els.chatBox) return;
  const isOwn = msg.sender === 'visitor';
  const time = formatTime(msg.timestamp || new Date());
  const content = escapeHtml(msg.content);
  
  const el = document.createElement('div');
  el.className = `message ${isOwn ? 'own' : 'other'}`;
  
  let innerMedia = '';
  if (msg.messageType === 'image' && msg.mediaUrl) {
    innerMedia = `<div style="margin-bottom:4px;"><img src="${escapeHtml(msg.mediaUrl)}" style="max-width:200px; border-radius:8px; cursor:pointer;" onclick="window.openImageModal(this.src)"/></div>`;
  }

  el.innerHTML = `
    <div class="avatar">${isOwn ? 'U' : 'A'}</div>
    <div>
      <div class="message-bubble">
        ${innerMedia}
        ${content ? content.replace(/\n/g, '<br>') : ''}
      </div>
      <div class="message-time">${time}</div>
    </div>
  `;
  els.chatBox.append(el);
};

const scrollToBottom = () => {
  if (els.chatBox) els.chatBox.scrollTop = els.chatBox.scrollHeight;
};

const sendMessage = async () => {
  if (!els.msgInput) return;
  const content = els.msgInput.value.trim();
  if (!content) return;
  
  const msg = { content, messageType: 'text' };
  els.msgInput.value = '';
  if (els.sendBtn) els.sendBtn.disabled = true;
  
  const tempMsg = { sender: 'visitor', content, timestamp: new Date(), messageType: 'text' };
  appendMessage(tempMsg);
  
  if (state.socket?.connected) {
    state.socket.emit('send-message', msg, (ack) => {
      if (!ack?.success) queueMessage(msg);
    });
  } else {
    queueMessage(msg);
    toast('Offline. Message saved to outbox.', 'warning');
  }
};

const handleTyping = () => {
  if (els.sendBtn) els.sendBtn.disabled = !els.msgInput.value.trim();
  clearTimeout(state.typingTimer);
  const isTyping = els.msgInput.value.length > 0;
  if (isTyping !== state.isTyping) {
    state.isTyping = isTyping;
    state.socket?.emit('typing', { isTyping });
  }
  state.typingTimer = setTimeout(() => {
    if (state.isTyping) {
      state.isTyping = false;
      state.socket?.emit('typing', { isTyping: false });
    }
  }, 2000);
};

const showTyping = (show) => {
  if (els.typingStatus) els.typingStatus.classList.toggle('active', show);
  if (show) scrollToBottom();
};

// ────────────────────────────────────────────────────────────────────────
// CALL HANDLING
// ────────────────────────────────────────────────────────────────────────
const handleIncomingCall = (data) => {
  state.incomingCallData = data;
  playSound('call');
  vibrate([300, 200, 300]);
  notify('Incoming video call', { body: 'Support agent is calling you' });
  if (els.videoOverlay) els.videoOverlay.classList.add('active');
  if (els.callStatusText) els.callStatusText.textContent = 'Incoming Call...';
  if (els.btnAcceptCall) els.btnAcceptCall.style.display = 'flex';
};

const handleCallConnected = (data) => {
  state.activeCall = data;
  state.callStartTime = Date.now();
  if (els.videoOverlay) els.videoOverlay.classList.add('active');
  if (els.btnAcceptCall) els.btnAcceptCall.style.display = 'none';
  startCallTimer();
  toast('Call connected', 'success');
};

const handleCallEnded = () => {
  stopCallTimer();
  if (els.videoOverlay) els.videoOverlay.classList.remove('active');
  if (els.remoteVideo) {
    els.remoteVideo.pause();
    els.remoteVideo.src = '';
  }
  toast('Call ended', 'info');
  state.activeCall = null;
  state.incomingCallData = null;
};

const startCallTimer = () => {
  stopCallTimer();
  state.callTimer = setInterval(() => {
    if (!state.callStartTime || !els.callTimer) return;
    const elapsed = Math.floor((Date.now() - state.callStartTime) / 1000);
    els.callTimer.textContent = formatDuration(elapsed);
  }, 1000);
};

const stopCallTimer = () => {
  if (state.callTimer) clearInterval(state.callTimer);
  state.callTimer = null;
  state.callStartTime = null;
  if (els.callTimer) els.callTimer.textContent = '00:00';
};

const acceptCall = () => {
  if (!state.incomingCallData) return;
  state.socket?.emit('accept-call', { callId: state.incomingCallData.callId });
  if (els.btnAcceptCall) els.btnAcceptCall.style.display = 'none';
  if (els.callStatusText) els.callStatusText.textContent = 'Connecting stream...';
};

const declineCall = () => {
  if (!state.incomingCallData) return;
  state.socket?.emit('reject-call', { callId: state.incomingCallData.callId, reason: 'Declined' });
  handleCallEnded();
};

const endCall = () => {
  if (state.activeCall) {
    state.socket?.emit('hang-up', { callId: state.activeCall.callId });
  }
  handleCallEnded();
};

const handleClipInjected = (data) => {
  if (state.activeCall && els.remoteVideo && data.clipUrl) {
    els.remoteVideo.src = data.clipUrl;
    els.remoteVideo.play().catch(() => {});
  }
};

// ────────────────────────────────────────────────────────────────────────
// CALL HISTORY & TABS
// ────────────────────────────────────────────────────────────────────────
const loadCallHistory = (logs) => {
  if (!els.callHistory) return;
  if (!logs || !logs.length) {
    els.callHistory.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; margin-top: 2rem;">No call history yet.</p>';
    return;
  }
  els.callHistory.innerHTML = logs.slice().reverse().map(log => `
    <div style="background:var(--bg-secondary); padding:1rem; border-radius:0.5rem; border:1px solid var(--border-primary); display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:600; font-size:0.9rem;">${escapeHtml(log.persona || 'Support Agent')}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${formatDate(log.timestamp)} · ${log.status}</div>
      </div>
      <div style="font-size:0.85rem; color:var(--text-secondary);">${log.duration ? formatDuration(log.duration) : '—'}</div>
    </div>
  `).join('');
};

const switchTab = (targetId) => {
  document.querySelectorAll('.visitor-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === targetId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === targetId);
  });
  state.activeTab = targetId.replace('panel-', '');
  if (state.activeTab === 'chats') {
    state.unreadCount = 0;
    updateUnreadBadge();
  }
};

const updateUnreadBadge = () => {
  if (els.chatBadge) {
    els.chatBadge.textContent = state.unreadCount;
    els.chatBadge.classList.toggle('show', state.unreadCount > 0);
  }
};

const incrementUnread = () => {
  state.unreadCount++;
  updateUnreadBadge();
};

// ────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS & INIT
// ────────────────────────────────────────────────────────────────────────
const bindUI = () => {
  // Registration Form
  if (els.visitorForm) {
    els.visitorForm.onsubmit = (e) => {
      e.preventDefault();
      const email = els.visitorEmailInput?.value.trim();
      if (email) registerVisitor(email);
    };
  }

  // Navigation Tabs
  document.querySelectorAll('.visitor-tab').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.target);
  });

  // Chat Actions
  if (els.msgInput) {
    els.msgInput.oninput = handleTyping;
    els.msgInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
  }
  if (els.sendBtn) els.sendBtn.onclick = sendMessage;

  // File Attachment
  if (els.btnAttach) {
    els.btnAttach.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file || file.size > 10 * 1024 * 1024) return toast('File too large (max 10MB)', 'error');
        const reader = new FileReader();
        reader.onload = () => {
          state.socket?.emit('send-message', { content: '', messageType: 'image', mediaUrl: reader.result });
          appendMessage({ sender: 'visitor', content: '[Image attached]', messageType: 'image', mediaUrl: reader.result, timestamp: new Date() });
        };
        reader.readAsDataURL(file);
      };
      input.click();
    };
  }

  // Call Controls
  if (els.btnAcceptCall) els.btnAcceptCall.onclick = acceptCall;
  if (els.btnEndCall) els.btnEndCall.onclick = endCall;

  bindSettings();
};

const init = async () => {
  cacheElements();
  loadSettings();
  bindUI();
  
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email') || sessionStorage.getItem('visitorEmail');
  
  if (emailParam) {
    registerVisitor(emailParam);
  } else {
    if (els.visitorModal) els.visitorModal.style.display = 'flex';
  }
};

document.addEventListener('DOMContentLoaded', init);

export { state, connectSocket, init };
