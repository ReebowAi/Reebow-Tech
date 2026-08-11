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

  // Additional elements for UI tabs, realism engine, clip modals & video calls
  els.rightPanel = document.getElementById('rightPanel');
  els.panelTabs = document.querySelectorAll('.panel-tab');
  els.panelPanes = document.querySelectorAll('.panel-pane');
  els.visitorDetails = document.getElementById('visitorDetails');
  els.copyVisitorIdBtn = document.getElementById('copyVisitorId');
  els.clipsGrid = document.getElementById('clipsGrid');
  els.injectClipBtn = document.getElementById('injectClipBtn');
  els.clipModal = document.getElementById('clipModal');
  els.clipPersona = document.getElementById('clipPersona');
  els.clipSelect = document.getElementById('clipSelect');
  els.clipLoop = document.getElementById('clipLoop');
  els.confirmInjectClip = document.getElementById('confirmInjectClip');
  els.settingsModal = document.getElementById('settingsModal');
  els.saveSettingsBtn = document.getElementById('saveSettings');
  els.connectionIndicator = document.getElementById('connectionIndicator');
  els.typingIndicator = document.getElementById('typingIndicator');
  
  // Realism controls
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
  els.applyRealismBtn = document.getElementById('applyRealism');

  // Call Overlay controls
  els.callOverlay = document.getElementById('callOverlay');
  els.callOverlayTitle = document.getElementById('callOverlayTitle');
  els.callStatus = document.getElementById('callStatus');
  els.callAgentName = document.getElementById('callAgentName');
  els.callVideo = document.getElementById('callVideo');
  els.callMuteBtn = document.getElementById('callMute');
  els.callHideSelfBtn = document.getElementById('callHideSelf');
  els.endCallBtn = document.getElementById('endCall');
  els.attachBtn = document.getElementById('attachBtn');
  els.quickReplyBtn = document.getElementById('quickReplyBtn');
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
      submitBtn.textContent = 'Authenticate';
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
    if (els.connectionIndicator) {
      els.connectionIndicator.className = 'connection-status connected';
      const label = els.connectionIndicator.querySelector('.label');
      if (label) label.textContent = 'Live Connected';
    }
    state.socket.emit('admin-join', { tenantId: state.currentTenant });
    loadVisitors();
    loadClipsManifest();
  });

  state.socket.on('disconnect', () => {
    state.connected = false;
    if (els.connectionIndicator) {
      els.connectionIndicator.className = 'connection-status disconnected';
      const label = els.connectionIndicator.querySelector('.label');
      if (label) label.textContent = 'Disconnected';
    }
  });

  state.socket.on('incoming-message', (data) => {
    if (data.email === state.currentVisitorEmail) {
      appendMessage(data.message);
    }
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
    closeCallOverlay();
  });

  state.socket.on('visitor-typing', (data) => {
    if (data.email === state.currentVisitorEmail && els.typingIndicator) {
      els.typingIndicator.hidden = !data.isTyping;
    }
  });
};

// -------------------------------------------------------------------
// VISITORS & INTELLIGENCE
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

  document.querySelectorAll('.visitor-item').forEach(el => {
    el.onclick = () => selectVisitor(el.dataset.email);
  });

  // If current visitor metadata updated, refresh panel
  if (state.currentVisitorEmail && state.visitors.has(state.currentVisitorEmail)) {
    state.currentVisitor = state.visitors.get(state.currentVisitorEmail);
    updateVisitorDetailsPane();
  }
};

const selectVisitor = async (email) => {
  state.currentVisitorEmail = email;
  state.currentVisitor = state.visitors.get(email);

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

  if (els.chatOnlineIndicator) {
    els.chatOnlineIndicator.className = `visitor-avatar-sm ${state.currentVisitor?.isOnline ? 'online' : ''}`;
  }

  renderMessages(state.currentVisitor?.messages || []);
  updateVisitorDetailsPane();

  if (els.copyVisitorIdBtn) els.copyVisitorIdBtn.disabled = false;
  if (els.banVisitorBtn) els.banVisitorBtn.disabled = false;
};

const updateVisitorDetailsPane = () => {
  if (!els.visitorDetails || !state.currentVisitor) return;
  const v = state.currentVisitor;
  els.visitorDetails.innerHTML = `
    <div class="detail-group"><strong>Email:</strong> ${v.email}</div>
    <div class="detail-group"><strong>Location:</strong> ${v.city || 'Unknown'}, ${v.country || 'Unknown'}</div>
    <div class="detail-group"><strong>IP Address:</strong> ${v.ip || '127.0.0.1'}</div>
    <div class="detail-group"><strong>ISP / Org:</strong> ${v.isp || 'Direct Network'}</div>
    <div class="detail-group"><strong>Device / OS:</strong> ${v.userAgent || 'Standard Browser'}</div>
    <div class="detail-group"><strong>Proxy / VPN:</strong> <span class="${v.isProxy ? 'text-danger' : 'text-success'}">${v.isProxy ? 'Detected (Proxy/VPN)' : 'Clean'}</span></div>
    <div class="detail-group"><strong>Session Started:</strong> ${new Date(v.connectedAt || Date.now()).toLocaleString()}</div>
  `;
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
  els.messageInput.style.height = 'auto';

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
// CLIPS VAULT & MANIFEST
// -------------------------------------------------------------------
const loadClipsManifest = async () => {
  try {
    const res = await fetch('/clips/manifest.json');
    if (res.ok) {
      state.clipsManifest = await res.json();
      renderClipsVault();
      populateClipModalSelects();
    }
  } catch (e) {
    console.warn('Could not load clips manifest', e);
  }
};

const renderClipsVault = () => {
  if (!els.clipsGrid) return;
  let html = '';
  Object.keys(state.clipsManifest).forEach(persona => {
    const clips = state.clipsManifest[persona] || [];
    clips.forEach(clip => {
      html += `
        <div class="clip-card" data-persona="${persona}" data-clip="${clip.file}">
          <div class="clip-thumb">
            <video src="/clips/${persona}/${clip.file}" muted preload="metadata"></video>
            <span class="clip-badge">${persona}</span>
          </div>
          <div class="clip-title">${clip.title || clip.file}</div>
        </div>
      `;
    });
  });
  els.clipsGrid.innerHTML = html || '<p class="text-muted">No clips found in manifest.</p>';

  // Click to inject instantly
  els.clipsGrid.querySelectorAll('.clip-card').forEach(card => {
    card.onclick = () => {
      const persona = card.dataset.persona;
      const file = card.dataset.clip;
      injectClip(persona, file, false);
    };
  });
};

const populateClipModalSelects = () => {
  if (!els.clipPersona || !els.clipSelect) return;
  const personas = Object.keys(state.clipsManifest);
  if (!personas.length) return;

  els.clipPersona.innerHTML = personas.map(p => `<option value="${p}">${p.toUpperCase()}</option>`).join('');
  updateClipSelectOptions(personas[0]);

  els.clipPersona.onchange = (e) => updateClipSelectOptions(e.target.value);
};

const updateClipSelectOptions = (persona) => {
  if (!els.clipSelect) return;
  const clips = state.clipsManifest[persona] || [];
  els.clipSelect.innerHTML = clips.map(c => `<option value="${c.file}">${c.title || c.file}</option>`).join('');
};

const injectClip = async (persona, file, loop) => {
  if (!state.currentVisitorEmail) return toast('Select a visitor first');
  try {
    const res = await fetch('/api/admin/inject-clip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: state.currentVisitorEmail,
        persona,
        clip: file,
        loop: !!loop,
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast(`Injected clip: ${file}`, 'success');
      if (els.clipModal) els.clipModal.classList.remove('active');
    } else {
      toast(data.error || 'Failed to inject clip', 'error');
    }
  } catch (e) {
    toast('Error injecting clip', 'error');
  }
};

// -------------------------------------------------------------------
// REALISM ENGINE
// -------------------------------------------------------------------
const applyRealismSettings = async () => {
  if (!state.currentVisitorEmail) return toast('Select a visitor first');
  const settings = {
    filmGrain: els.filmGrainToggle?.checked ?? true,
    softFocus: els.softFocusToggle?.checked ?? false,
    warmth: els.warmthSlider?.value || 100,
    contrast: els.contrastSlider?.value || 100,
    saturation: els.saturationSlider?.value || 100,
    brightness: els.brightnessSlider?.value || 100,
  };

  try {
    const res = await fetch('/api/admin/realism', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: state.currentVisitorEmail, ...settings }),
    });
    const data = await res.json();
    if (data.success) {
      toast('Realism settings applied', 'success');
    } else {
      toast('Failed to apply realism', 'error');
    }
  } catch (e) {
    toast('Error applying realism', 'error');
  }
};

// -------------------------------------------------------------------
// ACTIONS & CALLS
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
      openCallOverlay('Annie', 'Ringing visitor...');
    } else {
      toast(data.error || 'Failed to start call', 'error');
    }
  } catch (err) {
    toast('Error starting call', 'error');
  }
};

const openCallOverlay = (agentName, statusText) => {
  if (!els.callOverlay) return;
  if (els.callAgentName) els.callAgentName.textContent = agentName;
  if (els.callStatus) els.callStatus.textContent = statusText;
  els.callOverlay.classList.add('active');
};

const closeCallOverlay = () => {
  if (!els.callOverlay) return;
  els.callOverlay.classList.remove('active');
  if (els.callVideo) els.callVideo.srcObject = null;
  state.activeCall = null;
};

// -------------------------------------------------------------------
// INIT & EVENT BINDINGS
// -------------------------------------------------------------------
const initApp = () => {
  cacheElements();

  // Send message bindings
  if (els.sendBtn) els.sendBtn.onclick = sendMessage;
  if (els.messageInput) {
    els.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    els.messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
      
      // Emit typing indicator to socket if available
      if (state.socket && state.currentVisitorEmail) {
        state.socket.emit('admin-typing', { email: state.currentVisitorEmail, isTyping: true });
        clearTimeout(window.typingTimer);
        window.typingTimer = setTimeout(() => {
          state.socket.emit('admin-typing', { email: state.currentVisitorEmail, isTyping: false });
        }, 1500);
      }
    });
  }

  // Action buttons
  if (els.callBtn) els.callBtn.onclick = initiateCall;
  if (els.clearChatBtn) els.clearChatBtn.onclick = clearConversation;
  if (els.banVisitorBtn) els.banVisitorBtn.onclick = banVisitor;
  
  if (els.visitorSearch) {
    els.visitorSearch.addEventListener('input', () => {
      updateVisitorsList([...state.visitors.values()]);
    });
  }

  // Right Panel Tabs switching
  if (els.panelTabs) {
    els.panelTabs.forEach(tab => {
      tab.onclick = () => {
        els.panelTabs.forEach(t => t.classList.remove('active'));
        els.panelPanes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(`pane-${tab.dataset.tab}`);
        if (target) target.classList.add('active');
      };
    });
  }

  // Copy Visitor ID
  if (els.copyVisitorIdBtn) {
    els.copyVisitorIdBtn.onclick = () => {
      if (state.currentVisitorEmail) {
        navigator.clipboard.writeText(state.currentVisitorEmail);
        toast('Visitor ID copied to clipboard', 'success');
      }
    };
  }

  // Realism Sliders live update values
  const bindSlider = (slider, valEl) => {
    if (slider && valEl) {
      slider.oninput = () => valEl.textContent = slider.value;
    }
  };
  bindSlider(els.warmthSlider, els.warmthValue);
  bindSlider(els.contrastSlider, els.contrastValue);
  bindSlider(els.saturationSlider, els.saturationValue);
  bindSlider(els.brightnessSlider, els.brightnessValue);

  if (els.applyRealismBtn) els.applyRealismBtn.onclick = applyRealismSettings;

  // Modals handling (Clip modal & Settings modal)
  if (els.injectClipBtn && els.clipModal) {
    els.injectClipBtn.onclick = () => els.clipModal.classList.add('active');
  }
  if (els.settingsBtn && els.settingsModal) {
    els.settingsBtn.onclick = () => els.settingsModal.classList.add('active');
  }
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.modal')?.classList.remove('active');
    };
  });

  if (els.confirmInjectClip) {
    els.confirmInjectClip.onclick = () => {
      const persona = els.clipPersona?.value;
      const file = els.clipSelect?.value;
      const loop = els.clipLoop?.checked;
      if (persona && file) {
        injectClip(persona, file, loop);
      }
    };
  }

  // Call overlay buttons
  if (els.endCallBtn) els.endCallBtn.onclick = closeCallOverlay;

  connectSocket();
  loadVisitors();
  loadClipsManifest();
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
