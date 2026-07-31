// ─── CUBAGEST SERVICE WORKER ──────────────────────────────────────────────────
// v3: ya no depende de /asset-manifest.json (eso es un patrón de Create React
// App; este proyecto usa Vite, que no genera ese archivo, así que el intento
// de precache de los bundles con hash siempre fallaba en silencio).
//
// Estrategia:
//  - Precache solo del "app shell" mínimo que sí existe siempre con nombre fijo.
//  - Los archivos JS/CSS con hash (que cambian en cada build) se cachean
//    automáticamente la primera vez que se piden (runtime caching), con
//    estrategia "red primero, caché de respaldo" — así cada actualización se
//    detecta sola, sin depender de ningún manifest.
//  - Las peticiones a un origen distinto (la API del backend) nunca se
//    interceptan ni cachean, sin depender de un nombre de dominio fijo.

const CACHE = 'cubagest-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Solo interceptar GET.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cualquier petición a otro origen (p. ej. la API del backend en Railway,
  // QvaPay, etc.) va siempre directo a la red, sin caché. Esto ya no depende
  // de reconocer un nombre de dominio concreto.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Siempre se intenta la red primero, para que las actualizaciones
      // (incluidos los bundles con hash nuevo tras un build) se detecten
      // de inmediato en cuanto hay conexión.
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response.ok) {
            caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached); // Sin red: usar lo cacheado, si existe.

      // Si ya hay algo cacheado, se devuelve al instante mientras la red
      // actualiza en segundo plano; si no hay nada cacheado, se espera la red.
      return cached || networkFetch;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
