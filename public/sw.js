// ─── CUBAGEST SERVICE WORKER ──────────────────────────────────────────────────
// v6: el service worker cachea SOLO el "app shell" estático. Nunca intercepta ni
// cachea /api/*.
//
// Por qué: en este despliegue /api/* vive en el MISMO origen (functions/ hace
// de proxy hacia el backend real), así que cualquier regla de caché por origen
// acababa guardando respuestas de la API en el dispositivo: datos de otra
// cuenta, ventas, tokens y facturas, servidos sin red y sin control de versión.
// Las respuestas de la API las maneja el código (IndexedDB con namespace por
// cuenta + caché explícita de catálogo/stock), no el service worker.
//
// Tampoco hay Background Sync aquí: el navegador no lo ejecuta sin página
// abierta, así que no se registra ni se anuncia. La sincronización la dispara la
// app (arranque, foreground, reconexión y el botón manual).

const CACHE = 'cubagest-v6';
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
      // Al subir de versión se borra TODO lo anterior: así desaparecen de un
      // plumazo las respuestas de /api que hubiera cacheado la v5.
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isApiPath = (pathname) => pathname === '/api' || pathname.startsWith('/api/');

self.addEventListener('fetch', event => {
  const req = event.request;
  // Solo interceptar GET; POST/PUT/DELETE van directos a la red.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // 1) Cualquier origen distinto (otra API, QvaPay, etc.) va siempre directo a
  //    la red, sin caché.
  if (url.origin !== self.location.origin) return;

  // 2) /api/* JAMÁS se intercepta ni se cachea, aunque esté en este mismo
  //    origen. Sin respondWith() la petición sigue su curso normal.
  if (isApiPath(url.pathname)) return;

  // 3) Navegaciones: red primero (para recoger despliegues nuevos al instante)
  //    y, si no hay red, el app shell cacheado.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('/index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/index.html').then(cached => cached || caches.match('/')))
    );
    return;
  }

  // 4) Assets estáticos del mismo origen (JS/CSS con hash, imágenes, fuentes):
  //    red primero con respuesta inmediata desde caché y actualización por
  //    detrás ("stale-while-revalidate"). Cada build cambia los hashes, así que
  //    no hace falta ningún manifest.
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req)
        .then(response => {
          if (response && response.ok) {
            caches.open(CACHE).then(cache => cache.put(req, response.clone())).catch(() => {});
          }
          return response;
        })
        .catch(() => cached); // Sin red: usar lo cacheado, si existe.
      return cached || networkFetch;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
