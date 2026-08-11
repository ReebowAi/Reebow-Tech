// ════════════════════════════════════════════════════════════════════════
// REEBOW TECH — SERVICE WORKER
// Version: 2.0.1 | Offline-First | Background Sync | Push Notifications
// ════════════════════════════════════════════════════════════════════════

/* global self, caches, clients, fetch, Registration, PushManager, Notification, indexedDB */

// ────────────────────────────────────────────────────────────────────────
// CONFIGURATION & VERSIONING
// ────────────────────────────────────────────────────────────────────────
const SW_VERSION = '2.0.1';
const CACHE_PREFIX = 'reebow';
const CACHE_NAME = `${CACHE_PREFIX}-v${SW_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime`;
const OFFLINE_FALLBACK = '/offline.html';

// Precache manifest (injected by build tool or manual)
const PRECACHE_MANIFEST = [
  { url: '/', revision: SW_VERSION },
  { url: '/index.html', revision: SW_VERSION },
  { url: '/admin.html', revision: SW_VERSION },
  { url: '/visitor.html', revision: SW_VERSION },
  { url: '/style.css', revision: SW_VERSION },
  { url: '/mobile-fix.css', revision: SW_VERSION },
  { url: '/manifest.json', revision: SW_VERSION },
  { url: '/favicon.svg', revision: SW_VERSION },
  { url: '/icon-192.png', revision: SW_VERSION },
  { url: '/icon-512.png', revision: SW_VERSION },
  // JS files (module scripts)
  { url: '/admin.js', revision: SW_VERSION },
  { url: '/visitor.js', revision: SW_VERSION },
  { url: '/app.js', revision: SW_VERSION },
  // Socket.io client (served from server)
  { url: '/socket.io/socket.io.js', revision: SW_VERSION },
];

// Runtime cache strategies
const CACHE_STRATEGIES = {
  // Cache first - for static assets
  CACHE_FIRST: 'cache-first',
  // Network first - for API calls
  NETWORK_FIRST: 'network-first',
  // Stale while revalidate - for HTML pages
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  // Network only - for non-GET, auth
  NETWORK_ONLY: 'network-only',
};

// Route patterns
const ROUTES = [
  // Static assets - cache first
  { pattern: /\.(?:js|css|png|jpg|jpeg|webp|avif|svg|woff2?|ttf|eot|ico|map)$/, strategy: CACHE_STRATEGIES.CACHE_FIRST, cacheName: RUNTIME_CACHE },
  // Manifest - cache first
  { pattern: /\/manifest\.json$/, strategy: CACHE_STRATEGIES.CACHE_FIRST, cacheName: RUNTIME_CACHE },
  // Video clips - cache first with range support
  { pattern: /\/clips\/.*\.(?:mp4|webm)$/, strategy: CACHE_STRATEGIES.CACHE_FIRST, cacheName: `${CACHE_PREFIX}-clips`, options: { rangeRequests: true } },
  // Socket.io - network only (WebSocket upgrade)
  { pattern: /\/socket\.io\//, strategy: CACHE_STRATEGIES.NETWORK_ONLY },
  // API calls - network first with offline queue
  { pattern: /\/api\//, strategy: CACHE_STRATEGIES.NETWORK_FIRST, cacheName: RUNTIME_CACHE, networkTimeoutSeconds: 5 },
  // HTML pages - stale while revalidate
  { pattern: /\.(?:html?)$/, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, cacheName: RUNTIME_CACHE },
  // Favicon - cache first
  { pattern: /\/favicon\.(?:svg|ico|png)$/, strategy: CACHE_STRATEGIES.CACHE_FIRST, cacheName: RUNTIME_CACHE },
];

// Offline queue DB name
const QUEUE_DB = 'reebow-offline-queue';
const QUEUE_STORE = 'requests';

// ────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ────────────────────────────────────────────────────────────────────────
const log = (level, message, data = {}) => {
  const prefix = `[SW:${SW_VERSION}]`;
  const entry = { timestamp: Date.now(), level, message, ...data };
  // Console for debugging
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](prefix, message, data);
  return entry;
};

const matchRoute = (request) => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  for (const route of ROUTES) {
    if (route.pattern.test(pathname)) return route;
  }
  return null;
};

const isNavigationRequest = (request) => {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
};

const isSameOrigin = (request) => {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
};

const canCacheResponse = (response) => {
  return response && response.status === 200 && response.type !== 'opaque';
};

// ────────────────────────────────────────────────────────────────────────
// INDEXEDDB FOR OFFLINE QUEUE
// ────────────────────────────────────────────────────────────────────────
const openQueueDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('url', 'url', { unique: false });
      }
    };
  });
};

const queueRequest = async (request) => {
  const db = await openQueueDB();
  let bodyText = null;
  try {
    bodyText = await request.clone().text();
  } catch (e) {
    // Ignore if body cannot be read
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const data = {
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      body: bodyText,
      timestamp: Date.now(),
      destination: request.destination,
    };
    const req = store.add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const getQueuedRequests = async () => {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const deleteQueuedRequest = async (id) => {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

// ────────────────────────────────────────────────────────────────────────
// CACHE STRATEGIES IMPLEMENTATION
// ────────────────────────────────────────────────────────────────────────
const cacheFirst = async (request, cacheName, options = {}) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (canCacheResponse(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    log('warn', 'Cache-first fetch failed', { url: request.url, error: error.message });
    throw error;
  }
};

const networkFirst = async (request, cacheName, networkTimeoutSeconds = 5) => {
  const cache = await caches.open(cacheName);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), networkTimeoutSeconds * 1000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (canCacheResponse(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    log('info', 'Network-first falling back to cache', { url: request.url });
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (canCacheResponse(response)) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached); 
  return cached || fetchPromise;
};

const networkOnly = async (request) => {
  return fetch(request);
};

// ────────────────────────────────────────────────────────────────────────
// STRATEGY EXECUTOR
// ────────────────────────────────────────────────────────────────────────
const executeStrategy = async (request, route) => {
  const { strategy, cacheName, options = {} } = route;
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      return cacheFirst(request, cacheName, options);
    case CACHE_STRATEGIES.NETWORK_FIRST:
      return networkFirst(request, cacheName, options.networkTimeoutSeconds);
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      return staleWhileRevalidate(request, cacheName);
    case CACHE_STRATEGIES.NETWORK_ONLY:
      return networkOnly(request);
    default:
      return fetch(request);
  }
};

// ────────────────────────────────────────────────────────────────────────
// PRECACHING
// ────────────────────────────────────────────────────────────────────────
const precache = async () => {
  const cache = await caches.open(CACHE_NAME);
  const precachePromises = PRECACHE_MANIFEST.map(async (entry) => {
    try {
      const response = await fetch(entry.url, { cache: 'no-cache' });
      if (response.ok) {
        await cache.put(entry.url, response);
        log('info', 'Precached', { url: entry.url });
      }
    } catch (error) {
      log('warn', 'Precache failed', { url: entry.url, error: error.message });
    }
  });
  await Promise.allSettled(precachePromises);
};

// ────────────────────────────────────────────────────────────────────────
// CACHE CLEANUP
// ────────────────────────────────────────────────────────────────────────
const cleanupCaches = async () => {
  const cacheNames = await caches.keys();
  const validCaches = [CACHE_NAME, RUNTIME_CACHE, `${CACHE_PREFIX}-clips`];
  const deletePromises = cacheNames
    .filter((name) => name.startsWith(CACHE_PREFIX) && !validCaches.includes(name))
    .map((name) => {
      log('info', 'Deleting old cache', { cache: name });
      return caches.delete(name);
    });
  await Promise.all(deletePromises);
};

// ────────────────────────────────────────────────────────────────────────
// OFFLINE FALLBACK
// ────────────────────────────────────────────────────────────────────────
const getOfflineFallback = async () => {
  const cache = await caches.open(CACHE_NAME);
  let fallback = await cache.match(OFFLINE_FALLBACK);
  if (!fallback) {
    fallback = new Response(
      `<!DOCTYPE html><html><head><title>Offline</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0b0f19;color:#fff;text-align:center;padding:1rem}
      .spinner{width:40px;height:40px;border:3px solid #374151;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem}
      @keyframes spin{to{transform:rotate(360deg)}}</style></head>
      <body><div class="spinner"></div><h1>You're Offline</h1><p>Please check your connection and try again.</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
    await cache.put(OFFLINE_FALLBACK, fallback.clone());
  }
  return fallback;
};

// ────────────────────────────────────────────────────────────────────────
// BACKGROUND SYNC - Queue flushing
// ────────────────────────────────────────────────────────────────────────
const flushOfflineQueue = async () => {
  const queued = await getQueuedRequests();
  if (!queued.length) return { synced: 0, failed: 0 };
  log('info', 'Flushing offline queue', { count: queued.length });
  
  let synced = 0, failed = 0;
  for (const item of queued) {
    try {
      const headers = new Headers(item.headers);
      headers.delete('content-length');
      headers.delete('host');
      
      const response = await fetch(item.url, {
        method: item.method,
        headers,
        body: item.body,
        credentials: 'same-origin',
      });
      
      if (response.ok) {
        await deleteQueuedRequest(item.id);
        synced++;
        log('info', 'Queue item synced', { url: item.url });
      } else {
        failed++;
        log('warn', 'Queue item failed', { url: item.url, status: response.status });
      }
    } catch (error) {
      failed++;
      log('error', 'Queue item error', { url: item.url, error: error.message });
    }
  }
  return { synced, failed };
};

// ────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS
// ────────────────────────────────────────────────────────────────────────
const showNotification = async (data) => {
  const options = {
    body: data.body || 'New message from Reebow Support',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'reebow-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Open Chat' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    timestamp: data.timestamp || Date.now(),
  };
  
  if (data.image) options.image = data.image;
  
  return self.registration.showNotification(data.title || 'Reebow TECH', options);
};

// ────────────────────────────────────────────────────────────────────────
// SERVICE WORKER LIFECYCLE EVENTS
// ────────────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  log('info', 'Service Worker installing', { version: SW_VERSION });
  event.waitUntil(
    Promise.all([
      precache(),
      self.skipWaiting(),
    ])
  );
});

self.addEventListener('activate', (event) => {
  log('info', 'Service Worker activating', { version: SW_VERSION });
  event.waitUntil(
    Promise.all([
      cleanupCaches(),
      clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  if (request.method !== 'GET') {
    if (!navigator.onLine) {
      event.waitUntil(
        (async () => {
          try {
            await queueRequest(request);
            log('info', 'Queued offline request', { method: request.method, url: request.url });
          } catch (error) {
            log('error', 'Failed to queue request', { error: error.message });
          }
        })()
      );
    }
    return;
  }
  
  if (!isSameOrigin(request)) return;
  if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') return;
  
  const route = matchRoute(request);
  
  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const routeMatch = matchRoute(request);
          if (routeMatch) {
            return await executeStrategy(request, routeMatch);
          }
          return await networkFirst(request, RUNTIME_CACHE);
        } catch (error) {
          log('warn', 'Navigation fetch failed, showing offline page', { url: request.url });
          return getOfflineFallback();
        }
      })()
    );
    return;
  }
  
  if (route) {
    event.respondWith(
      (async () => {
        try {
          return await executeStrategy(request, route);
        } catch (error) {
          log('warn', 'Fetch strategy failed', { url: request.url, strategy: route.strategy, error: error.message });
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
          
          if (request.destination === 'video') {
            return new Response('', { status: 503, statusText: 'Offline' });
          }
          
          throw error;
        }
      })()
    );
  }
});

self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data?.type) return;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: SW_VERSION, caches: [CACHE_NAME, RUNTIME_CACHE] });
      break;
      
    case 'CLEAR_CACHES':
      cleanupCaches().then(() => event.ports[0]?.postMessage({ success: true }));
      break;
      
    case 'CACHE_CLIPS':
      if (data.clips?.length) {
        event.waitUntil(
          (async () => {
            const cache = await caches.open(`${CACHE_PREFIX}-clips`);
            for (const clipUrl of data.clips) {
              try {
                const response = await fetch(clipUrl);
                if (response.ok) {
                  await cache.put(clipUrl, response);
                  log('info', 'Clip cached', { url: clipUrl });
                }
              } catch (error) {
                log('warn', 'Clip cache failed', { url: clipUrl, error: error.message });
              }
            }
            event.ports[0]?.postMessage({ success: true });
          })()
        );
      }
      break;
      
    case 'SYNC_QUEUE':
      event.waitUntil(
        flushOfflineQueue().then((result) => event.ports[0]?.postMessage(result))
      );
      break;
      
    case 'SUBSCRIBE_PUSH':
      event.ports[0]?.postMessage({ success: true });
      break;
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'reebow-sync-messages') {
    log('info', 'Background sync triggered');
    event.waitUntil(flushOfflineQueue());
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    log('info', 'Push received', { tag: data.tag });
    event.waitUntil(showNotification(data));
  } catch (error) {
    log('error', 'Push parsing failed', { error: error.message });
    event.waitUntil(showNotification({ body: 'New notification' }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { action, data } = event.notification;
  if (action === 'dismiss') return;
  const urlToOpen = data?.url || '/visitor.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  log('info', 'Notification closed', { tag: event.notification.tag });
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'reebow-periodic-sync') {
    log('info', 'Periodic sync triggered');
    event.waitUntil(
      Promise.all([
        flushOfflineQueue(),
      ])
    );
  }
});

self.addEventListener('error', (event) => {
  log('error', 'Service Worker error', { message: event.message, filename: event.filename, lineno: event.lineno });
});

self.addEventListener('unhandledrejection', (event) => {
  log('error', 'Unhandled rejection', { reason: String(event.reason) });
  event.preventDefault();
});

log('info', 'Service Worker loaded', { version: SW_VERSION, precacheCount: PRECACHE_MANIFEST.length });
