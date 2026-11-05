import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const TITLES = [
  'a warm service worker survives stalled navigation headers without losing earned progress',
  'a warm service worker rejects a partial stalled module body and serves the complete cached module',
  'an evicted file returns bounded unavailability then repairs its cache for a genuine offline reload',
];
const PUBLIC_ORIGIN = 'https://parola-eta.vercel.app';
const WORKER_SHA = 'e0ad2a9d057b9dc06740f51bc198abd1e615d282fac837feb74095fe3b3dea34';
const CACHE = 'parola-shell-v5';
const STORAGE = 'parola-state-v1';
const SENTINEL_KEY = 'parola-authored-unrelated-v1';
const SENTINEL = 'owned-offline-check-sentinel';
const ROUTES = [
  ['/', 'index.html', 'text/html; charset=utf-8'], ['/index.html', 'index.html', 'text/html; charset=utf-8'],
  ['/styles.css', 'styles.css', 'text/css; charset=utf-8'], ['/theme.css', 'theme.css', 'text/css; charset=utf-8'],
  ['/app.mjs', 'app.mjs', 'text/javascript; charset=utf-8'], ['/engine.mjs', 'engine.mjs', 'text/javascript; charset=utf-8'],
  ['/data.mjs', 'data.mjs', 'text/javascript; charset=utf-8'], ['/reminders.mjs', 'reminders.mjs', 'text/javascript; charset=utf-8'],
  ['/manifest.webmanifest', 'manifest.webmanifest', 'application/manifest+json'], ['/icon.svg', 'icon.svg', 'image/svg+xml'],
  ['/sw.js', 'sw.js', 'text/javascript; charset=utf-8'],
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const workEnd = Date.now() + 240000;
let cleanupEnd, browser, server, localOrigin, fault = null, stage = 'preflight', current = null;
let expired = false, offline = false, missing = false;
const contexts = [], sockets = new Set(), handlers = new Set(), jobs = new Set(), publicGates = new Set();
const expectedRequests = new Set();
const report = { schemaVersion: 1, publicOrigin: PUBLIC_ORIGIN, sourceCommit: process.env.SOURCE_COMMIT ?? null,
  browserVersion: null, cases: TITLES.map((title, i) => ({ id: `W0${i + 1}`, title, accepted: false, error: 'unrun', observations: {} })),
  errors: [], limits: { workSeconds: 240, cleanupSeconds: 60, networkDeadlineMs: 3000, fallbackBudgetMs: 500, faultObservationMaxMs: 7000 },
  boundaries: { pageErrors: 0, consoleErrors: 0, unexpectedRequests: 0, credentialRequests: 0, webSockets: 0,
    unexpectedRequestFailures: 0, expectedFaultRequestFailures: 0, expectedOfflineFailures: 0, expected503Messages: 0, events: [] },
  cleanup: { contextsCreated: 0, contextsClosed: 0, browserClosed: false, serverClosed: false, socketsRemaining: null,
    handlersRemaining: null, publicGatesRemaining: null, lateChecksComplete: false, failures: [] },
  proofLimits: [
    'W01 is the actual published worker under a controlled Playwright header hold, not an observed natural outage.',
    'W02/W03 run the exact checked worker and app bytes on owned loopback HTTP, not the hosted origin.',
    'Native browser cache, streams, service-worker lifecycle and offline mode are used; no API replacements, response fulfillment or app-state injection.',
    'A three-second worker deadline plus bounded fallback is checked with a seven-second CI observation ceiling, not a performance benchmark.',
    'Cache eviction/recovery is covered; an unresponsive native Cache.put is not reproduced here and remains separate VM evidence.',
    'Fresh authored browser data only; no personal progress, notification, audio, account, full language-course or device-offline claim.',
    'The outer supervisor independently verifies process ownership and removes its scratch after this driver closes resources.',
  ] };
const clean = value => String(value ?? '').replace(/https?:\/\/[^\s)]+/g, '[URL]').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 1200);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function event(kind, value) {
  report.boundaries[kind]++;
  if (report.boundaries.events.length < 12) report.boundaries.events.push({ kind, stage, detail: clean(value).slice(0, 240) });
}
function mark(value, observations = {}) { stage = value; if (current) Object.assign(current.observations, { stage }, observations); }
async function within(action, milliseconds, label, cleanup = false) {
  const remaining = (cleanup ? cleanupEnd : workEnd) - Date.now();
  assert(remaining > 0 && (cleanup || !expired), label + ': work deadline');
  let timer;
  const job = Promise.resolve().then(action); jobs.add(job);
  job.then(() => jobs.delete(job), () => jobs.delete(job));
  try { return await Promise.race([job, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ': deadline')), Math.min(milliseconds, remaining)); })]); }
  finally { clearTimeout(timer); }
}
async function poll(action, milliseconds, label, cleanup = false) {
  const end = Math.min(Date.now() + milliseconds, cleanup ? cleanupEnd : workEnd);
  while (Date.now() < end) { if (await within(action, Math.max(1, end - Date.now()), label, cleanup)) return; await delay(25); }
  throw new Error(label + ': not observed');
}
function critical() { const b = report.boundaries; return b.pageErrors + b.consoleErrors + b.unexpectedRequests + b.credentialRequests + b.webSockets + b.unexpectedRequestFailures; }
let files;
function sourceFiles() {
  const root = fs.realpathSync(process.env.PAROLA_WORKER_SOURCE_ROOT ?? process.cwd());
  const result = new Map();
  for (const [route, name, mime] of ROUTES) {
    const file = path.join(root, 'public', name), item = fs.lstatSync(file);
    assert(item.isFile() && !item.isSymbolicLink() && item.size <= 1024 * 1024, 'source file bound/type');
    const bytes = fs.readFileSync(file); assert.equal(bytes.length, item.size);
    result.set(route, { bytes, mime, sha256: sha(bytes) });
  }
  assert.equal(result.get('/sw.js').sha256, WORKER_SHA, 'reviewed worker source changed');
  report.sourceAssets = [...result].map(([route, f]) => ({ route, bytes: f.bytes.length, sha256: f.sha256 }));
  return result;
}
async function startServer() {
  server = http.createServer((request, response) => {
    const handler = { settled: false }; handlers.add(handler);
    let guard, ownedFault = false;
    const finish = () => { if (handler.settled) return; handler.settled = true; handlers.delete(handler); clearTimeout(guard); };
    response.once('finish', finish); response.once('close', finish);
    request.on('error', () => { if (!ownedFault) report.errors.push('owned server request error'); });
    response.on('error', () => { if (!ownedFault) report.errors.push('owned server response error'); finish(); });
    let url; try { url = new URL(request.url, localOrigin); } catch { response.writeHead(400).end(); return; }
    if (!['GET', 'HEAD'].includes(request.method) || url.search || !files.has(url.pathname) || request.headers.authorization || request.headers.cookie) {
      event('unexpectedRequests', 'loopback request outside allowlist'); response.writeHead(400).end(); return;
    }
    const file = files.get(url.pathname), activeFault = fault;
    response.setHeader('Content-Type', file.mime); response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Length', file.bytes.length);
    if (activeFault && activeFault.path === url.pathname && request.method === 'GET') {
      ownedFault = true;
      activeFault.requests++;
      response.once('close', () => { if (!response.writableFinished) activeFault.aborted++; });
      guard = setTimeout(() => { activeFault.guardExpired = true; response.destroy(); }, 9000);
      if (activeFault.kind === 'body') { response.writeHead(200); response.flushHeaders(); response.write(file.bytes.subarray(0, 128)); activeFault.prefixBytes += 128; }
      return;
    }
    response.writeHead(200); response.end(request.method === 'HEAD' ? undefined : file.bytes);
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await within(() => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); }), 5000, 'loopback listen');
  const address = server.address(); assert(address && address.address === '127.0.0.1' && typeof address.port === 'number');
  localOrigin = `http://127.0.0.1:${address.port}`;
}
async function releasePublicGates() {
  for (const gate of publicGates) gate.release();
  await poll(() => publicGates.size === 0, 4000, 'public route gates released', Boolean(cleanupEnd));
}
async function contextFor(origin) {
  const context = await within(() => browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'allow', acceptDownloads: false }), 10000, 'context creation');
  contexts.push(context); report.cleanup.contextsCreated++;
  context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
  await within(() => context.route('**/*', async route => {
    const request = route.request(); let url;
    try {
      url = new URL(request.url()); const headers = await request.allHeaders();
      if (headers.authorization || headers.cookie) { event('credentialRequests', url.pathname); await route.abort(); return; }
      if (url.origin !== origin || url.search || !files.has(url.pathname) || !['GET', 'HEAD'].includes(request.method())) {
        event('unexpectedRequests', request.method + ' ' + url.pathname); await route.abort(); return;
      }
      if (origin === PUBLIC_ORIGIN && fault?.kind === 'public-headers' && url.pathname === '/' && request.serviceWorker()) {
        const activeFault = fault; activeFault.requests++; expectedRequests.add(request);
        let release; const gate = { release: () => release() }; publicGates.add(gate);
        await new Promise(resolve => { release = resolve; });
        try { if (!request.failure()) await route.abort('aborted'); }
        catch (error) {
          if (!request.failure() || !/net::ERR_ABORTED|net::ERR_FAILED/.test(request.failure().errorText)) throw error;
        } finally { publicGates.delete(gate); activeFault.gatesReleased++; }
        return;
      }
      if (origin === localOrigin && fault?.path === url.pathname) expectedRequests.add(request);
      await route.continue();
    } catch (error) { event('unexpectedRequests', error.message); try { await route.abort(); } catch {} }
  }), 5000, 'route guard');
  await within(() => context.routeWebSocket('**/*', route => { event('webSockets', 'unexpected websocket'); route.close(); }), 5000, 'websocket guard');
  context.on('requestfailed', request => {
    const failure = request.failure()?.errorText ?? '', url = new URL(request.url());
    const targetedFault = expectedRequests.has(request);
    if (targetedFault && /^net::ERR_(?:ABORTED|FAILED)$/.test(failure)) event('expectedFaultRequestFailures', url.pathname + ' ' + failure);
    else if (offline && origin === localOrigin && /^net::ERR_INTERNET_DISCONNECTED$/.test(failure) && files.has(url.pathname)) event('expectedOfflineFailures', url.pathname);
    else event('unexpectedRequestFailures', url.pathname + ' ' + failure);
  });
  context.on('page', page => {
    page.on('pageerror', error => event('pageErrors', error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const url = message.location().url, text = message.text();
      if (missing && url === localOrigin + '/data.mjs' && /^Failed to load resource: the server responded with a status of 503\b/.test(text)) event('expected503Messages', 'owned missing cache response');
      else if (offline && url.startsWith(localOrigin + '/') && /net::ERR_INTERNET_DISCONNECTED/.test(text)) event('expectedOfflineFailures', 'owned offline console');
      else event('consoleErrors', text);
    });
  });
  return context;
}
async function ready(page) {
  await within(() => page.locator('[data-action="start"][data-kind="vocabulary"]').waitFor({ state: 'visible' }), 10000, 'practice ready');
}
async function warm(context, origin) {
  const page = await within(() => context.newPage(), 10000, 'new page');
  const response = await within(() => page.goto(origin + '/', { waitUntil: 'load' }), 15000, 'initial visit'); assert.equal(response.status(), 200);
  await ready(page);
  await within(() => page.waitForFunction(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL === location.origin + '/sw.js'), 10000, 'worker control');
  const cached = await within(() => page.evaluate(async cacheName => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active?.state !== 'activated') throw new Error('worker not activated');
    const cache = await caches.open(cacheName), keys = await cache.keys();
    const rows = [];
    for (const key of keys) { const response = await cache.match(key), bytes = await response.arrayBuffer(); rows.push({ route: new URL(key.url).pathname, bytes: bytes.byteLength, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('') }); }
    return { worker: new URL(registration.active.scriptURL).pathname, rows };
  }, CACHE), 10000, 'native cache inventory');
  assert.equal(cached.worker, '/sw.js'); assert.equal(cached.rows.length, 10);
  assert.equal(new Set(cached.rows.map(x => x.route)).size, 10);
  for (const row of cached.rows) { const expected = files.get(row.route); assert(expected && row.route !== '/sw.js'); assert.equal(row.bytes, expected.bytes.length); assert.equal(row.sha256, expected.sha256); }
  await within(() => page.locator('[data-action="start"][data-kind="vocabulary"]').click(), 10000, 'start one recall');
  await within(() => page.locator('#answer').fill('__parola_authored_wrong_answer__'), 10000, 'authored wrong answer');
  await within(() => page.locator('#answer').press('Enter'), 10000, 'submit actual answer');
  await within(() => page.locator('.feedback.needs-practice').waitFor({ state: 'visible' }), 10000, 'actual incorrect feedback');
  await within(() => page.locator('[data-action="leave-session"]').click(), 10000, 'return to practice');
  await ready(page);
  const raw = await within(() => page.evaluate(async ({ storage, key, value }) => {
    const raw = localStorage.getItem(storage), parsed = JSON.parse(raw);
    if (Object.keys(parsed.progress).length !== 1) throw new Error('one actual review was not persisted');
    localStorage.setItem(key, value);
    const cache = await caches.open(key); await cache.put('/owned-sentinel.txt', new Response(value));
    return raw;
  }, { storage: STORAGE, key: SENTINEL_KEY, value: SENTINEL }), 10000, 'earned progress and once-only sentinels');
  return { page, context, origin, raw, warmCache: cached.rows, earnedProgressSha256: sha(raw) };
}
async function preserved(state) {
  const observed = await within(() => state.page.evaluate(async ({ storage, key }) => ({ raw: localStorage.getItem(storage), sentinel: localStorage.getItem(key),
    cacheSentinel: await (await (await caches.open(key)).match('/owned-sentinel.txt'))?.text() } ), { storage: STORAGE, key: SENTINEL_KEY }), 5000, 'preserved progress and unrelated cache');
  assert.equal(observed.raw, state.raw); assert.equal(observed.sentinel, SENTINEL); assert.equal(observed.cacheSentinel, SENTINEL);
  return { rawBytes: Buffer.byteLength(observed.raw), rawSha256: sha(observed.raw), unrelatedStoragePreserved: true, unrelatedCachePreserved: true };
}
async function responseBytes(response, route) {
  assert(response && response.status() === 200 && response.fromServiceWorker(), 'native worker response required');
  const bytes = await within(() => response.body(), 7000, 'complete worker response body'), expected = files.get(route);
  assert.equal(bytes.length, expected.bytes.length); assert.equal(sha(bytes), expected.sha256);
  return { route, status: response.status(), fromServiceWorker: true, bytes: bytes.length, sha256: sha(bytes) };
}
async function caseRun(index, action) {
  current = report.cases[index]; mark('setup ' + current.id);
  try { Object.assign(current.observations, await action()); assert.equal(critical(), 0, 'unexpected browser/network errors'); current.accepted = true; current.error = null; }
  catch (error) { current.error = clean(error?.message ?? error); throw error; }
}
try {
  assert.equal(process.env.CI, 'true'); assert.equal(process.env.PAROLA_WORKER_PUBLIC_ORIGIN, PUBLIC_ORIGIN);
  assert(/^[a-f0-9]{40}$/.test(process.env.SOURCE_COMMIT ?? ''), 'immutable source pin required');
  files = sourceFiles();
  const toolRoot = fs.realpathSync(process.env.PAROLA_WORKER_PLAYWRIGHT_ROOT ?? ''); assert(path.isAbsolute(toolRoot));
  const pkg = JSON.parse(fs.readFileSync(path.join(toolRoot, 'node_modules/playwright/package.json'), 'utf8')); assert.equal(pkg.version, '1.64.1');
  const { chromium } = await import(pathToFileURL(path.join(toolRoot, 'node_modules/playwright/index.mjs')).href);
  browser = await within(() => chromium.launch({ headless: true, timeout: 20000 }), 22000, 'Chromium launch'); report.browserVersion = browser.version();
  await caseRun(0, async () => {
    const state = await warm(await contextFor(PUBLIC_ORIGIN), PUBLIC_ORIGIN);
    mark('public worker root headers held', { warmCache: state.warmCache, earnedProgressSha256: state.earnedProgressSha256 });
    fault = { kind: 'public-headers', path: '/', requests: 0, gatesReleased: 0 };
    const started = Date.now(), response = await within(() => state.page.reload({ waitUntil: 'load' }), 7000, 'public cached navigation');
    await ready(state.page); const elapsedMs = Date.now() - started; assert(elapsedMs >= 2500 && elapsedMs <= 7000);
    assert.equal(fault.requests, 1); const asset = await responseBytes(response, '/');
    await releasePublicGates(); const observedFault = { ...fault }; fault = null;
    return { profile: 'actual published worker with controlled SW-owned header hold', elapsedMs, fault: observedFault, response: asset, preserved: await preserved(state) };
  });
  let state;
  await caseRun(1, async () => {
    mark('owned loopback startup and actual earned progress');
    await startServer(); state = await warm(await contextFor(localOrigin), localOrigin);
    mark('loopback native module body held', { warmCache: state.warmCache, earnedProgressSha256: state.earnedProgressSha256 });
    fault = { kind: 'body', path: '/app.mjs', requests: 0, prefixBytes: 0, aborted: 0, guardExpired: false };
    const responseJob = within(() => state.page.waitForResponse(response => response.url() === localOrigin + '/app.mjs' && response.fromServiceWorker()), 7000, 'worker module response');
    const started = Date.now(); const [, module] = await Promise.all([within(() => state.page.reload({ waitUntil: 'load' }), 7000, 'body-stall reload'), responseJob]);
    await ready(state.page); const elapsedMs = Date.now() - started; assert(elapsedMs >= 2500 && elapsedMs <= 7000);
    const asset = await responseBytes(module, '/app.mjs');
    await poll(() => fault.aborted === 1, 1500, 'body-hold socket abort');
    assert.equal(fault.requests, 1); assert.equal(fault.prefixBytes, 128); assert.equal(fault.guardExpired, false);
    const observedFault = { ...fault }; fault = null;
    return { profile: 'exact source on owned loopback; real partial HTTP body', elapsedMs, fault: observedFault, response: asset, preserved: await preserved(state) };
  });
  await caseRun(2, async () => {
    mark('owned data cache entry evicted');
    assert.equal(await within(() => state.page.evaluate(async name => (await caches.open(name)).delete('/data.mjs'), CACHE), 5000, 'delete only owned data entry'), true);
    fault = { kind: 'headers', path: '/data.mjs', requests: 0, prefixBytes: 0, aborted: 0, guardExpired: false }; missing = true;
    const started = Date.now();
    const unavailable = await within(() => state.page.evaluate(async () => { const response = await fetch('/data.mjs', { cache: 'no-store' }); return { status: response.status, text: await response.text() }; }), 7000, 'bounded missing cache response');
    const elapsedMs = Date.now() - started; assert(elapsedMs >= 2500 && elapsedMs <= 7000); assert.equal(unavailable.status, 503);
    assert.equal(unavailable.text, 'Parola is offline. Reconnect once to save the app for your next visit.');
    await poll(() => fault.aborted === 1, 1500, 'header-hold socket abort'); assert.equal(fault.requests, 1); assert.equal(fault.guardExpired, false);
    const observedFault = { ...fault }; fault = null;
    mark('healthy native fetch repairs evicted data');
    const repaired = await within(() => state.page.evaluate(async () => {
      const response = await fetch('/data.mjs', { cache: 'no-store' }), bytes = await response.arrayBuffer();
      return { status: response.status, type: response.type, redirected: response.redirected, bytes: bytes.byteLength,
        sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('') };
    }), 7000, 'healthy data fetch');
    assert.equal(repaired.status, 200); assert.equal(repaired.bytes, files.get('/data.mjs').bytes.length); assert.equal(repaired.sha256, files.get('/data.mjs').sha256); assert.equal(repaired.redirected, false);
    await poll(() => state.page.evaluate(async ({ name, expected }) => { const response = await (await caches.open(name)).match('/data.mjs'); if (!response) return false; const b = await response.arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join('') === expected; }, { name: CACHE, expected: files.get('/data.mjs').sha256 }), 2500, 'native cache repaired');
    missing = false; mark('native browser offline reload'); offline = true;
    await within(() => state.context.setOffline(true), 5000, 'set genuine browser offline');
    const rejected = await within(() => state.page.evaluate(async () => { try { await fetch('/sw.js', { cache: 'no-store' }); return false; } catch { return true; } }), 5000, 'uncached native offline probe'); assert.equal(rejected, true);
    const response = await within(() => state.page.reload({ waitUntil: 'load' }), 7000, 'genuine offline reload'); await ready(state.page);
    const asset = await responseBytes(response, '/'); const kept = await preserved(state);
    await within(() => state.page.locator('[data-action="start"][data-kind="vocabulary"]').click(), 10000, 'offline practice available');
    await within(() => state.page.locator('#answer').waitFor({ state: 'visible' }), 10000, 'offline recall input');
    await within(() => state.page.locator('[data-action="leave-session"]').click(), 10000, 'leave offline recall');
    assert.deepEqual(await preserved(state), kept);
    await within(() => state.context.setOffline(false), 5000, 'restore owned context network'); offline = false;
    return { profile: 'exact source on owned loopback; real cache eviction, repair and browser offline mode', missingElapsedMs: elapsedMs,
      missingResponse: { status: 503, finitePublicCopyMatched: true }, fault: observedFault, repaired,
      cacheRepairObserved: true, uncachedOfflineRequestRejected: rejected, offlineReload: asset, offlineRecallInputAvailable: true, preserved: kept };
  });
} catch (error) { report.errors.push(clean(error?.message ?? error)); }
finally {
  cleanupEnd = Date.now() + 60000; current = null; expired = true;
  try { await releasePublicGates(); } catch (error) { report.cleanup.failures.push(clean(error.message)); }
  for (const context of [...contexts].reverse()) {
    try { await within(() => context.close(), 10000, 'context close', true); report.cleanup.contextsClosed++; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  if (browser) {
    try { await within(() => browser.close(), 10000, 'browser close', true); report.cleanup.browserClosed = true; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  }
  for (const socket of sockets) socket.destroy();
  if (server) {
    try { await within(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())), 5000, 'owned server close', true); report.cleanup.serverClosed = true; }
    catch (error) { report.cleanup.failures.push(clean(error.message)); }
  } else report.cleanup.serverClosed = true;
  const settleEnd = Math.min(Date.now() + 5000, cleanupEnd);
  while ((sockets.size || handlers.size || jobs.size) && Date.now() < settleEnd) await delay(25);
  if (sockets.size || handlers.size || jobs.size) report.cleanup.failures.push('owned operations did not settle after close');
  await delay(0); await delay(0);
  report.cleanup.socketsRemaining = sockets.size; report.cleanup.handlersRemaining = handlers.size; report.cleanup.publicGatesRemaining = publicGates.size;
  report.cleanup.lateChecksComplete = jobs.size === 0;
  if (critical()) report.errors.push('unexpected browser or request error, including late observations');
  if (report.cleanup.contextsCreated !== report.cleanup.contextsClosed || !report.cleanup.browserClosed || !report.cleanup.serverClosed
    || sockets.size || handlers.size || publicGates.size || jobs.size || report.cleanup.failures.length) report.errors.push('resource cleanup unverified');
  report.status = report.cases.every(item => item.accepted) && !report.errors.length ? 'passed' : 'failed';
  let text = JSON.stringify(report);
  if (Buffer.byteLength(text) > 65536) { report.status = 'failed'; text = JSON.stringify({ schemaVersion: 1, cases: report.cases.map(({ id, title }) => ({ id, title, accepted: false, error: 'report bound', observations: {} })), errors: ['report bound'], cleanup: report.cleanup }); }
  const end = Date.now() + 2000, timer = setTimeout(() => process.exit(1), 2000);
  process.stdout.write('PAROLA_WORKER_BROWSER_RESULT=' + text + '\n', () => { clearTimeout(timer); process.exit(report.status === 'passed' && Date.now() <= end ? 0 : 1); });
}
