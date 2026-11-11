/* Blokboek offline cache. Bump VERSION when the app changes. */
const VERSION = 'blokboek-2026-11-11c';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'maskable-512.png'];
const EXTRA = [
  "https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@400;600;700;800;900&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
];
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    await Promise.all(EXTRA.map(u => cache.add(new Request(u, { mode: 'cors', credentials: 'omit' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !RUNTIME_HOSTS.includes(url.hostname)) return;

  if (req.mode === 'navigate') {
    // Open instantly from the cache; refresh the cached page in the background when online.
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = (await cache.match('index.html')) || (await cache.match('./'));
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put('index.html', res.clone());
        return res;
      }).catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      return (await network) || new Response('Blokboek is offline and not cached yet. Open it once with internet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreVary: true, ignoreSearch: sameOrigin });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
