/ sw.js — Service Worker for GitHub Pages + D-ID Streaming Dashboard
// Caches: index.html, assets, manifests. Does NOT handle streaming/UI.

const CACHE_NAME = 'avatar-dashboard-v3';
const OFFLINE_URL = '/index.html';

// Assets to precache (adjust paths to your repo structure)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add your persona images if served locally:
  // '/annie.jpg',
  // '/craig.jpg',
];

// Optional: cache-first for static assets, network-first for HTML
const STATIC_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.woff', '.woff2', '.json', '.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin (D-ID API, fonts.googleapis.com, etc.)
  if (url.origin !== location.origin) return;

  // Skip non-GET
  if (request.method !== 'GET') return;

  // HTML: network-first (always fresh), fallback to cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstThenCache(request));
    return;
  }

  // Static assets: cache-first
  if (STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))) {
    event.respondWith(cacheFirstThenNetwork(request));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirstThenCache(request));
});

async function cacheFirstThenNetwork(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    // Stale-while-revalidate in background
    fetch(request).then((res) => {
      if (res.ok) cache.put(request, res.clone());
    }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstThenCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Offline fallback for navigation
    if (request.mode === 'navigate') {
      return cache.match(OFFLINE_URL);
    }
    return new Response('Offline', { status: 503 });
  }
}

// Optional: background sync for analytics/queued messages (future)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Implement if you add offline message queue later
}
