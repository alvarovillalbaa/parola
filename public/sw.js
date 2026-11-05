const CACHE_NAME = 'parola-shell-v5';
const ASSETS = ['/', '/index.html', '/styles.css', '/theme.css', '/app.mjs', '/engine.mjs', '/data.mjs', '/reminders.mjs', '/manifest.webmanifest', '/icon.svg'];
const NETWORK_TIMEOUT_MS = 3000;
const CACHE_READ_TIMEOUT_MS = 500;
const CACHE_WRITE_TIMEOUT_MS = 1000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function cancelBody(body) {
  try { void body?.cancel().catch(() => {}); } catch { /* Cancellation is best effort. */ }
}

async function completeNetworkResponse(request) {
  const controller = new AbortController();
  let response, reader, timer, complete = false;
  const cancelled = () => new DOMException('The request was cancelled.', 'AbortError');
  let rejectAbort;
  const cancellation = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = () => { controller.abort(); rejectAbort(cancelled()); };
  request.signal.addEventListener('abort', abort, { once: true });
  if (request.signal.aborted) abort();
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Network deadline exceeded.')); }, NETWORK_TIMEOUT_MS);
  });
  const network = (async () => {
    if (controller.signal.aborted) throw cancelled();
    response = await fetch(request, { signal: controller.signal });
    if (controller.signal.aborted) { cancelBody(response.body); throw cancelled(); }
    // Finishing the clone buffers the original branch without changing its URL,
    // status, type or headers. Headers alone do not prove that a file loaded.
    const body = response.clone().body;
    if (body) {
      reader = body.getReader();
      let bytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (controller.signal.aborted) throw cancelled();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) throw new Error('App file exceeds the response limit.');
      }
    }
    return response;
  })();
  try {
    const result = await Promise.race([network, timeout, cancellation]);
    complete = true;
    return result;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    if (!complete) {
      controller.abort();
      try { void reader?.cancel().catch(() => {}); } catch { /* A failed stream may already be closed. */ }
      cancelBody(response?.body);
    }
    try { reader?.releaseLock(); } catch { /* No reader or an already released stream. */ }
  }
}

async function cachedFallback(cache, key, request) {
  let timer, rejectAbort, active = true;
  const cancellation = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = () => rejectAbort(new DOMException('The request was cancelled.', 'AbortError'));
  request.signal.addEventListener('abort', abort, { once: true });
  if (request.signal.aborted) abort();
  try {
    return await Promise.race([
      cache.then((entry) => active && entry ? entry.match(key) : null).catch(() => null),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), CACHE_READ_TIMEOUT_MS); }),
      cancellation,
    ]);
  } finally {
    active = false;
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
  }
}

async function refreshCache(cache, key, response) {
  let timer, active = true;
  try {
    await Promise.race([
      cache.then((entry) => active && entry ? entry.put(key, response) : undefined).catch(() => {}),
      new Promise((resolve) => { timer = setTimeout(resolve, CACHE_WRITE_TIMEOUT_MS); }),
    ]);
  } finally {
    active = false;
    clearTimeout(timer);
    // Cache.put has no cancellation API. Do not keep the event alive indefinitely
    // or start a write if opening the cache outlives this maintenance window.
    cancelBody(response.body);
  }
}

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

// Bound full file delivery; a stalled connection or cache write must not block practice.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate';
  if (!navigation && !ASSETS.includes(url.pathname)) return;
  let finishMaintenance;
  event.waitUntil(new Promise((resolve) => { finishMaintenance = resolve; }));
  event.respondWith((async () => {
    const cache = Promise.resolve().then(() => caches.open(CACHE_NAME)).catch(() => null);
    const key = navigation ? '/index.html' : url.pathname;
    let maintenance;
    try {
      const response = await completeNetworkResponse(request);
      const appPage = !navigation || response.headers.get('Content-Type')?.includes('text/html');
      if (response.ok && response.type === 'basic' && !response.redirected && appPage) {
        maintenance = refreshCache(cache, key, response.clone());
        return response;
      }
      if (response.ok) return response;
      return (await cachedFallback(cache, key, request)) || response;
    } catch {
      if (request.signal.aborted) throw new DOMException('The request was cancelled.', 'AbortError');
      const cached = await cachedFallback(cache, key, request);
      if (cached) return cached;
      return new Response('Parola is offline. Reconnect once to save the app for your next visit.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } finally { finishMaintenance(maintenance); }
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
