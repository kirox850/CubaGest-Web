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

const CACHE = 'cubagest-v7';
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


// ─── AVISOS (push) ──────────────────────────────────────────────────────────
// El service worker es lo que permite que el aviso aparezca con la pestaña
// cerrada. Reglas:
//
//  1) Nunca se cachea nada de /api. Un aviso se pinta desde el payload del
//     evento push, no desde una petición: así no hay forma de que un token o
//     una factura acabe en una caché.
//  2) Al hacer clic se abre la pantalla indicada en `link` y se cierra la
//     notificación, en lugar de abrir una ventana nueva sin contexto.
//  3) Si la app ya está abierta en una pestaña, se le avisa por postMessage
//     para que actualice la lista sin recargar (el usuario podría estar
//     cobrando en ese momento).

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Payload ilegible: se muestra algo genérico en vez de nada, porque un
    // aviso en blanco parece un fallo de la app.
    data = { title: 'CubaGest', body: 'Tienes un aviso nuevo' };
  }

  const title = data.title || 'CubaGest';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Mismo grupo para los avisos de CubaGest: en el panel de notificaciones
    // de Android se agrupan en vez de llenar la pantalla de tarjetas sueltas.
    tag: data.id ? 'cubagest-' + data.id : 'cubagest',
    renotify: false,
    data: { link: data.link || '/', kind: data.kind || '', id: data.id || '' },
    // Un aviso de faltante en la caja o de un envío esperando aprobación no
    // puede esperar a que la persona abra la app: vibrate + sonido.
    requireInteraction: data.kind === 'closing.shortage' || data.kind === 'transfer.created',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Si ya hay una pestaña abierta, se le pasa el aviso y se trae al frente
    // en vez de abrir otra: dos pestañas de la misma app confunden.
    for (const client of clientList) {
      if (new URL(client.url).origin === self.location.origin) {
        client.postMessage({ type: 'PUSH_RECEIVED', data: event.notification.data });
        if (client.focus) return client.focus();
        return;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(link);
  })());
});
