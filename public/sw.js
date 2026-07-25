// ─── CUBAGEST SERVICE WORKER ─────────────────────────────────────────────────
// Versión del caché — incrementar para forzar actualización
const CACHE_VERSION = 'cubagest-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const API_CACHE     = `${CACHE_VERSION}-api`;

// Recursos que se cachean al instalar (app shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// URLs de API que se cachean con estrategia network-first
const API_CACHE_PATTERNS = [
  '/api/products',
  '/api/dashboard',
];

// ── Install: cachear app shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Failed to cache some static assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar cachés viejos ───────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('cubagest-') && key !== STATIC_CACHE && key !== API_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia por tipo de recurso ─────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // No interceptar peticiones de otros dominios excepto Railway (API)
  const isAPI = url.hostname.includes('railway.app');
  const isLocal = url.origin === self.location.origin;

  if (!isLocal && !isAPI) return;

  // Peticiones POST/PUT/DELETE — siempre a la red, nunca cachear
  if (event.request.method !== 'GET') return;

  // ── Estrategia para API: Network First con fallback a caché ──
  if (isAPI) {
    const isCacheableAPI = API_CACHE_PATTERNS.some(p => url.pathname.includes(p));
    if (!isCacheableAPI) return;

    event.respondWith(
      fetch(event.request.clone())
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ── Estrategia para app shell: Cache First con network fallback ──
  // Para los assets compilados de Vite (hash en el nombre), cache first siempre
  const isHashedAsset = url.pathname.includes('/assets/');

  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Para el resto (index.html, manifest, etc.): Network First ──
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback a index.html para SPA routing
          return caches.match('/index.html');
        });
      })
  );
});

// ── Background sync (cuando vuelve la conexión) ───────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-sales') {
    // La sincronización real la maneja el cliente (App.tsx)
    // Aquí solo notificamos a las pestañas activas
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});

// ── Mensajes del cliente ───────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
});
