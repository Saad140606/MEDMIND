// Service Worker caching the offline app shell and intercepting HTTP POST requests to queue actions in IndexedDB.

const CACHE_NAME = 'medmind-shell-v1';
const OFFLINE_QUEUE_NAME = 'medmind-offline-queue';

const APP_SHELL = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
];

const QUEUABLE_ROUTES = [
  '/api/dashboard/log-dose',
  '/api/dashboard/hydration',
];

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for shell ───────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Restrict caching and intercepting handlers solely to same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Intercept matching POST operations (logging doses/hydration) during network loss to route them into IndexedDB queue.
  if (request.method === 'POST' && QUEUABLE_ROUTES.some(r => url.pathname.startsWith(r))) {
    event.respondWith(handleQueueable(request));
    return;
  }

  // For other API routes, network-only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() =>
      new Response(JSON.stringify({ error: 'Offline — no network' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // For navigation and static assets: cache-first with network fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache successful GET responses for static assets
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (request.destination === 'document') {
          return caches.match('/offline') || new Response('Offline', { status: 503 });
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

async function handleQueueable(request) {
  try {
    // Clone the request stream because request bodies can only be read once during fetch execution.
    const response = await fetch(request.clone());
    if (response.ok) return response;
    // Server error → queue
    await queueRequest(request);
    return new Response(JSON.stringify({ queued: true, message: 'Action queued for sync' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    // Network failure → queue
    await queueRequest(request);
    return new Response(JSON.stringify({ queued: true, message: 'Offline — action queued for sync' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function queueRequest(request) {
  try {
    // Read body buffer safely from cloned request stream.
    const body = await request.clone().text();
    const url = new URL(request.url);

    // Determine action type
    let type = 'LOG_DOSE';
    if (url.pathname.includes('hydration')) type = 'HYDRATION';

    // Store in IndexedDB via client message
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({
        type: 'QUEUE_ACTION',
        payload: {
          type,
          payload: body ? JSON.parse(body) : {},
          url: url.pathname,
        }
      });
    }
  } catch (err) {
    console.error('SW: Failed to queue request', err);
  }
}
