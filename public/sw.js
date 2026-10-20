const CACHE_NAME = 'parola-shell-v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/theme.css', '/app.mjs', '/engine.mjs', '/data.mjs', '/reminders.mjs', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('parola-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Fetch current assets when online and keep their successful responses for offline use.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate';
  if (!navigation && !ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME).catch(() => null);
    const cachedResponse = () => cache ? cache.match(key).catch(() => null) : null;
    const key = navigation ? '/index.html' : url.pathname;
    try {
      const response = await fetch(request);
      const appPage = !navigation || response.headers.get('Content-Type')?.includes('text/html');
      if (response.ok && response.type === 'basic' && !response.redirected && appPage) {
        // A full browser cache must not prevent an otherwise successful online visit.
        if (cache) await cache.put(key, response.clone()).catch(() => {});
        return response;
      }
      if (response.ok) return response;
      return (await cachedResponse()) || response;
    } catch {
      const cached = await cachedResponse();
      if (cached) return cached;
      return new Response('Parola is offline. Reconnect once to save the app for your next visit.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) return client.focus();
    }
    return self.clients.openWindow('/');
  })());
});
