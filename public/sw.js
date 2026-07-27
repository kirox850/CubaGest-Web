const CACHE = 'cubagest-v2';

// Al instalar: cachear todo lo necesario de inmediato
self.addEventListener('install', event => {
  event.waitUntil(
    fetch('/asset-manifest.json')
      .then(r => r.json())
      .then(manifest => {
        const urls = ['/', '/index.html', '/manifest.json'];
        // Agregar todos los assets del manifest si existe
        if (manifest.files) {
          Object.values(manifest.files).forEach(url => urls.push(url));
        }
        return caches.open(CACHE).then(cache => cache.addAll(urls));
      })
      .catch(() => {
        // Si no hay manifest, cachear lo básico
        return caches.open(CACHE).then(cache =>
          cache.addAll(['/', '/index.html', '/manifest.json'])
        );
      })
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
  // Solo interceptar GET del mismo origen
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isAPI = url.hostname.includes('railway.app');
  if (isAPI) return; // API siempre a la red

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Siempre intentar red primero para mantener actualizado
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response.ok) {
            caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached); // Sin red: usar caché

      // Si hay caché, devolverla inmediatamente mientras actualiza en background
      return cached || networkFetch;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
