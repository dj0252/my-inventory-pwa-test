// Increment VERSION together with the app-version meta tag on each release.
const VERSION = '1.0.0-rc.10';
const scope = new URL(self.registration.scope);
const cachePrefix = 'dahaizhaozhen-shell:' + scope.pathname + ':';
const cacheName = cachePrefix + VERSION;
const shell = ['index.html', 'manifest.webmanifest', 'icon.svg']
  .map(path => new URL(path, scope).href);
const [index] = shell;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const responses = await Promise.all(shell.map((url, i) => fetch(i === 0 ? scope.href : url, {cache: 'reload'})));
    if (responses.some(response => !response.ok || response.redirected)) {
      throw new Error('App shell is unavailable');
    }
    const html = await responses[0].clone().text();
    if (!html.includes('<meta name="app-version" content="' + VERSION + '">')) {
      throw new Error('App shell version does not match the worker');
    }
    const cache = await caches.open(cacheName);
    await Promise.all(shell.map((url, i) => cache.put(url, responses[i])));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const target = url.origin + url.pathname;
  const asset = request.mode === 'navigate' && (target === scope.href || target === index)
    ? index : shell.includes(target) ? target : null;
  if (!asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(asset)) || fetch(request);
  })());
});
