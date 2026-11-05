import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://parola.example';
const CACHE = 'parola-shell-v5';
const ASSETS = ['/', '/index.html', '/styles.css', '/theme.css', '/app.mjs', '/engine.mjs', '/data.mjs', '/reminders.mjs', '/manifest.webmanifest', '/icon.svg'];
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 3; i++) { await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)); } };

// Executes the actual worker with native Node Fetch/Streams and authored boundary
// doubles. This does not emulate browser lifecycle, storage quota or offline UI.
function fakeClock() {
  let now = 0, next = 1;
  const timers = new Map();
  return { timers, now: () => now,
    setTimeout(callback, delay = 0, ...args) { const id = next++; timers.set(id, { at: now + Math.max(0, Number(delay)), callback, args }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async tick(milliseconds) {
      const end = now + milliseconds;
      for (let count = 0; count < 100; count++) {
        await flush();
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) { now = end; await flush(); return; }
        now = due[1].at; timers.delete(due[0]); due[1].callback(...due[1].args);
      }
      assert.fail('Authored fake-clock callback bound exceeded');
    } };
}
function response(body = 'authored network body', { status = 200, type = 'basic', redirected = false, url = ORIGIN + '/index.html', headers = {} } = {}) {
  const value = new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'x-authored-response': 'retained', ...headers } });
  // Node-created responses have type default and no URL. These metadata values
  // represent a browser fetch result; body/clone/cancel behavior remains native.
  Object.defineProperties(value, { type: { value: type }, redirected: { value: redirected }, url: { value: url } });
  return value;
}
function request(path = '/', { method = 'GET', navigation = true, aborted = false } = {}) {
  const controller = new AbortController();
  const value = new Request(new URL(path, ORIGIN), { method, signal: controller.signal });
  if (navigation) Object.defineProperty(value, 'mode', { value: 'navigate' });
  const listeners = new Set(), add = value.signal.addEventListener.bind(value.signal), remove = value.signal.removeEventListener.bind(value.signal);
  value.signal.addEventListener = (type, listener, options) => { if (type === 'abort') listeners.add(listener); return add(type, listener, options); };
  value.signal.removeEventListener = (type, listener, options) => { if (type === 'abort') listeners.delete(listener); return remove(type, listener, options); };
  if (aborted) controller.abort();
  return { value, controller, listeners };
}
function worker(options = {}) {
  const clock = fakeClock(), handlers = new Map(), cacheEntries = new Map();
  const calls = { fetch: [], open: [], match: [], put: [], addAll: [], deleted: [], claims: 0, focus: [], openedWindows: [], matchWindows: [] };
  const cache = {
    async match(key) { calls.match.push(key); return options.match ? options.match(key) : cacheEntries.get(key)?.clone(); },
    async put(key, value) {
      calls.put.push({ key, response: value });
      if (options.put) return options.put(key, value);
      const bytes = await value.arrayBuffer(); cacheEntries.set(key, new Response(bytes, { status: value.status, headers: value.headers }));
    },
    async addAll(assets) { calls.addAll.push(Array.from(assets)); },
  };
  const caches = {
    open(name) { calls.open.push(name); return options.open ? options.open(name, cache) : Promise.resolve(cache); },
    async keys() { return options.cacheNames ?? [CACHE]; },
    async delete(name) { calls.deleted.push(name); return true; },
  };
  const self = { location: { origin: ORIGIN },
    addEventListener(type, handler) { assert.equal(handlers.has(type), false); handlers.set(type, handler); },
    clients: {
      async claim() { calls.claims++; },
      async matchAll(query) { calls.matchWindows.push(query); return options.windows ?? []; },
      async openWindow(path) { calls.openedWindows.push(path); return { url: ORIGIN + path }; },
    } };
  const context = vm.createContext({ self, caches, URL, Request, Response, Headers, AbortController, DOMException, Uint8Array,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    fetch(input, init) { calls.fetch.push({ input, signal: init?.signal }); return options.fetch ? options.fetch(input, init) : Promise.resolve(response()); },
  });
  vm.runInContext(source, context, { filename: 'public/sw.js' });
  function dispatch(type, supplied = {}) {
    let active = true, returned, responds = 0;
    const waits = [];
    const event = { ...supplied,
      respondWith(value) { assert.equal(active, true, 'respondWith must be synchronous'); responds++; returned = Promise.resolve(value); returned.catch(() => {}); },
      waitUntil(value) { assert.equal(active, true, 'waitUntil must be registered synchronously'); waits.push(Promise.resolve(value)); },
    };
    try { handlers.get(type)(event); } finally { active = false; }
    const done = Promise.all(waits); done.catch(() => {});
    return { response: returned, done, responds, waitCount: waits.length };
  }
  return { clock, calls, cache, cacheEntries, dispatch,
    fetch(item = request()) { return { ...dispatch('fetch', { request: item.value }), request: item }; } };
}
function observed(promise) {
  const state = { settled: false, value: undefined, error: undefined };
  promise.then(value => { state.settled = true; state.value = value; }, error => { state.settled = true; state.error = error; });
  return state;
}
async function quiet(harness, event) {
  await event.done; await flush();
  assert.equal(harness.clock.timers.size, 0, 'worker left its own deadline timer running');
  if (event.request) assert.equal(event.request.listeners.size, 0, 'request abort listener was not removed');
}

test('service worker ignores non-GET cross-origin and unknown non-navigation requests', async () => {
  const h = worker({ fetch: () => assert.fail('Pass-through must not invoke the worker fetch path.') });
  for (const item of [request('/', { method: 'POST' }), request('/', { method: 'HEAD' }),
    request('https://other.example/app.mjs', { navigation: false }), request('/not-a-shell-resource', { navigation: false })]) {
    const event = h.fetch(item); assert.equal(event.responds, 0); assert.equal(event.waitCount, 0); await quiet(h, event);
  }
  assert.equal(h.calls.open.length, 0); assert.equal(h.calls.fetch.length, 0);
});

test('installation precaches exactly ten shell assets in the new owned cache', async () => {
  const h = worker(), event = h.dispatch('install');
  assert.equal(event.waitCount, 1); await quiet(h, event);
  assert.deepEqual(h.calls.open, [CACHE]); assert.deepEqual(h.calls.addAll, [ASSETS]);
});

test('activation removes only old Parola shell caches and claims clients', async () => {
  const h = worker({ cacheNames: ['parola-shell-v3', 'parola-shell-v4', CACHE, 'other-app-cache', 'parola-personal-backups'] });
  await quiet(h, h.dispatch('activate'));
  assert.deepEqual(h.calls.deleted.sort(), ['parola-shell-v3', 'parola-shell-v4']); assert.equal(h.calls.claims, 1);
});

test('complete network responses retain original identity URL headers status and readable body', async () => {
  const original = response('Authored UTF-8 café 🌱', { status: 201, url: ORIGIN + '/delivered-document' });
  const h = worker({ fetch: async () => original }), event = h.fetch();
  assert.equal(event.waitCount, 1); const result = await event.response;
  assert.equal(result, original); assert.equal(result.status, 201); assert.equal(result.url, ORIGIN + '/delivered-document');
  assert.equal(result.headers.get('x-authored-response'), 'retained'); assert.equal(await result.text(), 'Authored UTF-8 café 🌱');
  await quiet(h, event); assert.equal(h.calls.put.length, 1); assert.equal(h.calls.put[0].key, '/index.html');
  assert.equal(h.calls.fetch[0].signal.aborted, false, 'successful delivery must not abort its still-readable original');
});

test('successful delivery clears timers and request listeners while preserving redirect and navigation cache policy', async () => {
  for (const metadata of [{ redirected: true }, { type: 'cors' }, { headers: { 'content-type': 'application/json' } }]) {
    const original = response('authored complete response', metadata), h = worker({ fetch: async () => original }), event = h.fetch();
    assert.equal(await event.response, original); assert.equal(await original.text(), 'authored complete response');
    await quiet(h, event); assert.equal(h.calls.put.length, 0);
  }
});

test('never-resolving network headers fall back by the network deadline and abort the network signal', async () => {
  const never = deferred(), h = worker({ fetch: () => never.promise }); h.cacheEntries.set('/index.html', new Response('authored cached shell'));
  const event = h.fetch(), state = observed(event.response); await flush();
  await h.clock.tick(2999); assert.equal(state.settled, false);
  await h.clock.tick(1); assert.equal(await (await event.response).text(), 'authored cached shell');
  assert.equal(h.calls.fetch[0].signal.aborted, true); assert.deepEqual(h.calls.match, ['/index.html']); await quiet(h, event);
});

test('a fetch resolving after timeout is cancelled without starting a reader or late cache write', async () => {
  const pending = deferred(), h = worker({ fetch: () => pending.promise }); h.cacheEntries.set('/index.html', new Response('cached before late response'));
  const event = h.fetch(); await flush(); await h.clock.tick(3000); await event.response; await event.done;
  const late = response('late network bytes'); let clones = 0, cancellations = 0;
  const clone = late.clone.bind(late), cancel = late.body.cancel.bind(late.body);
  late.clone = () => { clones++; return clone(); }; late.body.cancel = reason => { cancellations++; return cancel(reason); };
  pending.resolve(late); await flush();
  assert.equal(clones, 0); assert.equal(cancellations, 1); assert.equal(h.calls.put.length, 0); await quiet(h, event);
});

test('headers with a stalled response body use the same deadline without awaiting cancellation', async () => {
  let cancelStarted = 0; const cancellation = deferred();
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([65])); }, cancel() { cancelStarted++; return cancellation.promise; } });
  const original = response(stream), h = worker({ fetch: async () => original }); h.cacheEntries.set('/index.html', new Response('complete cached body'));
  const event = h.fetch(), state = observed(event.response);
  try {
    await flush(); await h.clock.tick(2999); assert.equal(state.settled, false);
    await h.clock.tick(1); assert.equal(await (await event.response).text(), 'complete cached body');
    assert.equal(h.calls.fetch[0].signal.aborted, true); assert.equal(cancelStarted, 1); assert.equal(h.calls.put.length, 0);
    await quiet(h, event);
  } finally { cancellation.resolve(); await flush(); }
});

test('a body read error returns a complete cached response and releases its deadline resources', async () => {
  const original = response(new ReadableStream({ start(controller) { controller.error(new Error('Authored body read fault')); } }));
  const h = worker({ fetch: async () => original }); h.cacheEntries.set('/styles.css', new Response('cached CSS'));
  const event = h.fetch(request('/styles.css', { navigation: false }));
  assert.equal(await (await event.response).text(), 'cached CSS'); assert.equal(h.calls.fetch[0].signal.aborted, true);
  assert.equal(h.calls.put.length, 0); await quiet(h, event);
});

test('response bodies above one MiB are cancelled and never cached or partially delivered', async () => {
  const original = response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); controller.close(); } }));
  let cancelled = 0; const clone = original.clone.bind(original);
  original.clone = () => {
    const previousBody = original.body, copy = clone();
    assert.notEqual(original.body, previousBody, 'native clone must replace the original tee branch');
    const cancel = original.body.cancel.bind(original.body);
    original.body.cancel = reason => { cancelled++; return cancel(reason); };
    return copy;
  };
  const h = worker({ fetch: async () => original }); h.cacheEntries.set('/index.html', new Response('bounded cached shell'));
  const event = h.fetch(); assert.equal(await (await event.response).text(), 'bounded cached shell');
  assert.equal(cancelled, 1); assert.equal(h.calls.fetch[0].signal.aborted, true); assert.equal(h.calls.put.length, 0); await quiet(h, event);
});

test('already-aborted requests reject AbortError without networking or cached disclosure', async () => {
  const h = worker({ fetch: () => assert.fail('An already cancelled client must not start networking.') });
  const event = h.fetch(request('/', { aborted: true }));
  await assert.rejects(event.response, error => error.name === 'AbortError');
  assert.equal(h.calls.match.length, 0); assert.equal(h.calls.put.length, 0); await quiet(h, event);
});

test('client cancellation immediately rejects an uncooperative fetch and removes its abort listener', async () => {
  const never = deferred(), h = worker({ fetch: () => never.promise }), input = request(), event = h.fetch(input);
  await flush(); assert.equal(h.calls.fetch.length, 1); input.controller.abort();
  await assert.rejects(event.response, error => error.name === 'AbortError');
  assert.equal(h.calls.fetch[0].signal.aborted, true); assert.equal(h.calls.match.length, 0); await quiet(h, event);
  never.reject(new Error('Authored late fetch rejection')); await flush();
  const stalledRead = deferred();
  const cached = worker({ fetch: async () => response('complete HTTP error', { status: 502 }), match: () => stalledRead.promise });
  const cacheInput = request(), cacheEvent = cached.fetch(cacheInput); await flush(); assert.equal(cached.calls.match.length, 1);
  cacheInput.controller.abort(); await assert.rejects(cacheEvent.response, error => error.name === 'AbortError');
  await quiet(cached, cacheEvent); stalledRead.resolve(new Response('cached disclosure must not win cancellation')); await flush();
});

test('cache-open rejection cannot prevent a complete online response from being read', async () => {
  const original = response('online without CacheStorage');
  const h = worker({ open: async () => { throw new Error('Authored cache-open fault'); }, fetch: async () => original }), event = h.fetch();
  assert.equal(await event.response, original); assert.equal(await original.text(), 'online without CacheStorage');
  await quiet(h, event); assert.equal(h.calls.put.length, 0);
});

test('stalled cache opening cannot gate online delivery or start a refresh after its maintenance deadline', async () => {
  const pending = deferred(), h = worker({ open: () => pending.promise }), event = h.fetch();
  assert.equal(await (await event.response).text(), 'authored network body');
  const lifetime = observed(event.done); await flush(); assert.equal(lifetime.settled, false);
  await h.clock.tick(1000); await event.done; pending.resolve(h.cache); await flush();
  assert.equal(h.calls.put.length, 0); await quiet(h, event);
});

test('never-settling cache writes stay off delivery and have a bounded synchronous waitUntil lifetime', async () => {
  const pending = deferred(), h = worker({ put: () => pending.promise }), event = h.fetch();
  assert.equal(event.waitCount, 1); assert.equal(await (await event.response).text(), 'authored network body');
  const lifetime = observed(event.done); await flush(); assert.equal(h.calls.put.length, 1); assert.equal(lifetime.settled, false);
  await h.clock.tick(999); assert.equal(lifetime.settled, false); await h.clock.tick(1); await quiet(h, event);
  // The native put cannot be cancelled: only delivery/lifetime are bounded here.
  pending.resolve(); await flush();
});

test('cache-write rejection is caught without changing the delivered original response', async () => {
  const original = response('complete original despite failed refresh');
  const h = worker({ fetch: async () => original, put: async () => { throw new Error('Authored quota/write fault'); } }), event = h.fetch();
  assert.equal(await event.response, original); assert.equal(await original.text(), 'complete original despite failed refresh');
  await quiet(h, event); assert.equal(h.calls.put.length, 1);
});

test('stalled cached reads expire after five hundred milliseconds and preserve a complete HTTP error response', async () => {
  const never = deferred(), original = response('authored upstream unavailable', { status: 502 });
  const h = worker({ fetch: async () => original, match: () => never.promise }), event = h.fetch(), state = observed(event.response);
  await flush(); assert.equal(h.calls.match.length, 1);
  await h.clock.tick(499); assert.equal(state.settled, false); await h.clock.tick(1);
  assert.equal(await event.response, original); assert.equal(await original.text(), 'authored upstream unavailable'); await quiet(h, event);
  never.resolve(new Response('late cache result')); await flush(); assert.equal(h.calls.put.length, 0);
});

test('network rejection with absent rejected or stalled cache produces the fixed bounded offline response', async () => {
  for (const cacheState of ['absent', 'rejected', 'stalled']) {
    const never = deferred();
    const h = worker({ fetch: async () => { throw new TypeError('Authored offline network'); },
      ...(cacheState === 'rejected' ? { match: async () => { throw new Error('Authored cache read error'); } } : {}),
      ...(cacheState === 'stalled' ? { open: () => never.promise } : {}) });
    const event = h.fetch(); await flush();
    if (cacheState === 'stalled') await h.clock.tick(500);
    const result = await event.response; assert.equal(result.status, 503);
    assert.equal(result.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(await result.text(), 'Parola is offline. Reconnect once to save the app for your next visit.');
    await quiet(h, event);
    if (cacheState === 'stalled') { never.resolve(h.cache); await flush(); assert.equal(h.calls.match.length, 0, 'late cache lookup must be gated'); }
  }
});

test('notification clicks still close the notification and focus an own window or open the app root', async () => {
  let closed = 0, focused = 0;
  const existing = worker({ windows: [{ url: 'https://other.example/', focus: () => assert.fail('Do not focus a different origin.') },
    { url: ORIGIN + '/#today', focus: async () => { focused++; } }] });
  await quiet(existing, existing.dispatch('notificationclick', { notification: { close() { closed++; } } }));
  assert.equal(closed, 1); assert.equal(focused, 1); assert.deepEqual(existing.calls.openedWindows, []);
  assert.deepEqual(JSON.parse(JSON.stringify(existing.calls.matchWindows)), [{ type: 'window', includeUncontrolled: true }]);
  const absent = worker(); await quiet(absent, absent.dispatch('notificationclick', { notification: { close() { closed++; } } }));
  assert.deepEqual(absent.calls.openedWindows, ['/']); assert.equal(closed, 2); assert.equal(absent.calls.fetch.length, 0);
});
