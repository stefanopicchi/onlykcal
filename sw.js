const CACHE_NAME = 'diario-v10';
const APP_SHELL = [
  './',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

// If the network has not answered within this time, fall back to the cached copy
// so the app still opens quickly on a weak connection.
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Network-first: when online the app is always the latest deployed version,
// and the cache is refreshed on every load. The cache is only used offline
// (or on a very slow connection).
function networkFirst(req) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res) => { if (!settled && res) { settled = true; resolve(res); } };

    const timer = setTimeout(() => {
      caches.match(req).then(finish);
    }, NETWORK_TIMEOUT_MS);

    fetch(req)
      .then((res) => {
        clearTimeout(timer);
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        finish(res);
      })
      .catch(() => {
        clearTimeout(timer);
        caches.match(req)
          .then((cached) => cached || caches.match('./'))
          .then((res) => {
            if (res) finish(res);
            else if (!settled) { settled = true; resolve(Response.error()); }
          });
      });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle our own files. Fonts, Open Food Facts and our search
  // function always go straight to the network.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(networkFirst(req));
});
