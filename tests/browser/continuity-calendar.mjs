import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'https://parola-eta.vercel.app';
const STORAGE = 'parola-state-v1';
const DAY_A = '2026-11-10', DAY_B = '2026-11-11';
const TIME_A = '2026-11-10T09:00:00+01:00', TIME_B = '2026-11-11T09:01:00+01:00';
const CALENDAR_TIME = '2026-11-10T18:00:00+01:00';
const TIMEZONE = 'Europe/Madrid';
const TITLES = [
  'earned daily progress and due reviews survive the next local day and reload',
  'two actual calendar downloads retain complete recurring local-time event bytes',
];
const ASSETS = [
  ['/', 'index.html'], ['/index.html', 'index.html'], ['/styles.css', 'styles.css'],
  ['/theme.css', 'theme.css'], ['/app.mjs', 'app.mjs'], ['/engine.mjs', 'engine.mjs'],
  ['/data.mjs', 'data.mjs'], ['/reminders.mjs', 'reminders.mjs'],
  ['/manifest.webmanifest', 'manifest.webmanifest'], ['/icon.svg', 'icon.svg'], ['/sw.js', 'sw.js'],
];
const PINNED = {
  '/app.mjs': '1146087cddde0b62c07ec5f98aae2b6f4ac118cad35f9f3e2739b1c1884a18b6',
  '/engine.mjs': 'abcf0a138be379ee4d1d3dda4d5b4ce8b40fb05811085140ba0a3e52a454616a',
  '/reminders.mjs': '76ff935b636a7c91ca6fc3630e06b84aec5db0d53bc880cbe2b662cffc119199',
  '/sw.js': 'e0ad2a9d057b9dc06740f51bc198abd1e615d282fac837feb74095fe3b3dea34',
};
const FILE_LIMIT = 16384, REPORT_LIMIT = 131072;
const sha = value => createHash('sha256').update(value).digest('hex');
const need = (value, code) => { if (!value) throw new Error(code); };
const finite = error => /^[a-z][a-z0-9_]{0,100}$/.test(error?.message ?? '') ? error.message : 'browser_check_failed';
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const jobs = new Set(), pendingRequests = new Set(), contexts = [], closedContexts = new Set(), downloadFiles = [];
const downloadUrls = new Set(), blobRequests = new Map();
let browser, root, downloads, rootIdentity, downloadIdentity, markerIdentity, nonce, current, stage = 'preflight', cards;
let expired = false, cleanupEnd, pendingRoutes = 0;
const workEnd = Date.now() + 240000;
const report = {
  schemaVersion: 1, origin: ORIGIN, sourceCommit: process.env.SOURCE_COMMIT ?? null,
  browserVersion: null, sourceAssets: [],
  cases: TITLES.map((title, index) => ({ id: `C0${index + 1}`, title,
    profile: index ? 'narrow 390x844' : 'desktop 1440x1000', accepted: false, error: 'unrun', observations: {} })),
  errors: [],
  boundaries: { pageErrors: 0, consoleErrors: 0, unexpectedRequests: 0, credentialRequests: 0,
    webSockets: 0, requestFailures: 0, responseErrors: 0, unexpectedDialogs: 0, unexpectedPages: 0,
    activeUnknownUrlAborts: 0, events: [] },
  cleanup: { contextsCreated: 0, contextsClosed: 0, browserClosed: false,
    downloadsObserved: 0, downloadsVerified: 0, downloadFilesAbsent: 0, downloadsRemaining: null,
    pendingRequests: null, pendingRoutes: null, pendingJobs: null, lateChecksComplete: false, failures: [] },
  limits: { workSeconds: 240, cleanupSeconds: 60, stdoutSeconds: 2, downloadBytes: FILE_LIMIT,
    reportBytes: REPORT_LIMIT, eventRows: 16, timerAdvanceMs: 60000 },
  proofLimits: [
    'Two fresh contexts use the canonical public origin; no local server or response fulfillment is used.',
    'C01 uses Playwright 1.64.1 context clock control, not elapsed overnight time, OS clock changes or physical-device/DST acceptance.',
    'Clock installation precedes app navigation. Fixed Date values and runFor execute the existing minute timer; no visibility event or internal app function is invoked.',
    'Only actual UI reviews create progress; only the authored context state key is read. No score, progress or storage state is injected.',
    'C02 reads two complete native browser download files. Calendar import, calendar-client alerts, OS notification delivery and notification enrollment are not exercised.',
    'Default Unicode content and physical UTF-8 line limits are checked; multibyte folding-edge coverage remains separate pure-source evidence.',
    'No closed course, VM, worker-fault, offline, backup, model, account or full mobile-acceptance scope is rerun.',
    'The outer controller owns process attribution, public asset byte checks, source guards and final root removal.',
  ],
};
function mark(value) { stage = value; if (current) current.observations.stage = value; }
function event(kind, detail) {
  report.boundaries[kind]++;
  if (report.boundaries.events.length < 16) report.boundaries.events.push({ kind, stage, detail: String(detail).replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 180) });
}
function critical() { return Object.entries(report.boundaries).filter(([key]) => key !== 'events').reduce((sum, [, value]) => sum + value, 0); }
function track(promise) {
  jobs.add(promise); promise.then(() => jobs.delete(promise), () => jobs.delete(promise)); return promise;
}
async function within(action, milliseconds, code, cleanup = false) {
  const remaining = (cleanup ? cleanupEnd : workEnd) - Date.now();
  need(remaining > 0 && (cleanup || !expired), code + '_deadline');
  let timer;
  const job = track(Promise.resolve().then(action));
  try { return await Promise.race([job, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(code + '_timeout')), Math.min(milliseconds, remaining)); })]); }
  finally { clearTimeout(timer); }
}
async function poll(action, milliseconds, code, cleanup = false) {
  const end = Math.min(Date.now() + milliseconds, cleanup ? cleanupEnd : workEnd);
  while (Date.now() < end) { if (await within(action, Math.max(1, end - Date.now()), code, cleanup)) return; await delay(25); }
  throw new Error(code + '_not_observed');
}
function ownedRoot() {
  const stat = fs.lstatSync(root), marker = path.join(root, '.owner'), m = fs.lstatSync(marker);
  need(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700, 'owned_root_type');
  need(stat.dev === rootIdentity.dev && stat.ino === rootIdentity.ino, 'owned_root_identity');
  need(m.isFile() && !m.isSymbolicLink() && m.uid === process.getuid() && (m.mode & 0o777) === 0o600
    && m.dev === markerIdentity.dev && m.ino === markerIdentity.ino && m.size === 32
    && fs.readFileSync(marker, 'utf8') === nonce, 'owned_root_nonce');
  const d = fs.lstatSync(downloads);
  need(d.isDirectory() && !d.isSymbolicLink() && d.uid === process.getuid() && (d.mode & 0o777) === 0o700
    && d.dev === downloadIdentity.dev && d.ino === downloadIdentity.ino && fs.realpathSync(downloads) === downloads, 'download_directory_identity');
}
function isOwnBlob(value) { return new RegExp('^blob:' + ORIGIN.replaceAll('.', '\\.') + '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$').test(value); }
function calendarStage() { return current?.id === 'C02' && /^c02_calendar_(?:1905|0745)$/.test(stage); }
function allowedRequest(request) {
  let url; try { url = new URL(request.url()); } catch { return false; }
  if (!['GET', 'HEAD'].includes(request.method())) return false;
  if (isOwnBlob(request.url())) return calendarStage() && request.method() === 'GET';
  return url.origin === ORIGIN && !url.search && !url.hash && ASSETS.some(([route]) => route === url.pathname);
}
async function closeContext(context) {
  if (closedContexts.has(context)) return;
  await within(() => context.close(), 10000, 'context_close', true);
  closedContexts.add(context); report.cleanup.contextsClosed++;
}
async function newPage(index, fixedTime) {
  const context = await within(() => browser.newContext({ viewport: index ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    locale: 'en-US', timezoneId: TIMEZONE, acceptDownloads: index === 1, serviceWorkers: 'allow' }), 10000, 'context_create');
  contexts.push(context); report.cleanup.contextsCreated++;
  context.setDefaultTimeout(10000); context.setDefaultNavigationTimeout(15000);
  await within(() => context.route('**/*', async route => {
    pendingRoutes++;
    try {
      const request = route.request(), headers = await request.allHeaders();
      if (headers.authorization || headers.cookie) { event('credentialRequests', 'credential_header'); await route.abort(); return; }
      if (!allowedRequest(request)) { event('activeUnknownUrlAborts', request.method()); await route.abort(); return; }
      await route.continue();
    } catch { event('unexpectedRequests', 'route_guard_error'); }
    finally { pendingRoutes--; }
  }), 5000, 'route_install');
  await within(() => context.routeWebSocket('**/*', route => { event('webSockets', 'websocket_refused'); route.close(); }), 5000, 'websocket_install');
  context.on('request', request => {
    pendingRequests.add(request);
    if (isOwnBlob(request.url())) {
      blobRequests.set(request, { url: request.url(), method: request.method(), stage });
      if (blobRequests.size > 8) event('unexpectedRequests', 'blob_request_inventory_bound');
    }
    if (pendingRequests.size > 256) event('unexpectedRequests', 'request_inventory_bound');
    if (!allowedRequest(request)) event('unexpectedRequests', request.method());
    const headers = request.headers(); if (headers.authorization || headers.cookie) event('credentialRequests', 'credential_header');
  });
  context.on('requestfinished', request => pendingRequests.delete(request));
  context.on('requestfailed', request => { pendingRequests.delete(request); event('requestFailures', request.failure()?.errorText ?? 'request_failed'); });
  context.on('response', response => { if (response.status() !== 200) event('responseErrors', String(response.status())); });
  let pages = 0;
  context.on('page', page => {
    if (++pages > 1) event('unexpectedPages', 'additional_page');
    page.on('pageerror', () => event('pageErrors', 'page_error'));
    page.on('console', message => { if (message.type() === 'error') event('consoleErrors', 'console_error'); });
    page.on('dialog', dialog => { event('unexpectedDialogs', 'dialog'); track(dialog.dismiss()).catch(() => event('unexpectedDialogs', 'dialog_dismiss_failed')); });
    page.on('download', download => {
      report.cleanup.downloadsObserved++;
      if (!calendarStage() || !isOwnBlob(download.url()) || report.cleanup.downloadsObserved > 2) event('unexpectedRequests', 'unexpected_download');
      downloadUrls.add(download.url());
    });
  });
  const page = await within(() => context.newPage(), 10000, 'page_create');
  // Pinned API ordering: install before any app code can register timers.
  await within(() => page.clock.install({ time: new Date(fixedTime) }), 5000, 'clock_install');
  await within(() => page.clock.setFixedTime(new Date(fixedTime)), 5000, 'clock_fixed');
  const response = await within(() => page.goto(ORIGIN + '/', { waitUntil: 'load' }), 15000, 'initial_visit');
  need(response?.status() === 200, 'initial_status');
  await within(() => page.locator('[data-action="start"][data-kind="vocabulary"]').waitFor({ state: 'visible' }), 10000, 'practice_ready');
  need(await within(() => page.evaluate(key => localStorage.getItem(key), STORAGE), 5000, 'fresh_state') === null, 'fresh_state_not_empty');
  return { context, page };
}
async function nav(page, hash) {
  await within(() => page.locator(`a[href="#${hash}"]:visible`).first().click(), 10000, 'navigate_' + hash);
  await within(() => page.locator(hash === 'settings' ? '#preferences-form' : '.daily-goal').waitFor({ state: 'visible' }), 10000, 'view_' + hash);
}
async function saved(page) {
  const raw = await within(() => page.evaluate(key => localStorage.getItem(key), STORAGE), 5000, 'saved_state_read');
  need(typeof raw === 'string' && Buffer.byteLength(raw) <= 65536, 'saved_state_bound');
  return { state: JSON.parse(raw), raw, bytes: Buffer.byteLength(raw), sha256: sha(raw) };
}
async function clockRead(page, expected) {
  const value = await within(() => page.evaluate(() => ({ epoch: Date.now(), local: [new Date().getFullYear(), new Date().getMonth() + 1,
    new Date().getDate(), new Date().getHours(), new Date().getMinutes()], timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })), 5000, 'clock_readback');
  need(value.epoch === Date.parse(expected) && value.timezone === TIMEZONE, 'clock_readback_identity');
  return value;
}
async function setGoal(page, goal) {
  await nav(page, 'settings');
  need(await within(() => page.locator('#source-fr').inputValue(), 5000, 'source_preference') === 'es', 'french_source');
  await within(() => page.locator('#daily-goal').selectOption(String(goal)), 5000, 'goal_select');
  await within(() => page.locator('#preferences-form button[type="submit"]').click(), 10000, 'goal_save');
  need((await saved(page)).state.settings.dailyGoal === goal, 'goal_not_persisted');
  await nav(page, 'today');
}
async function today(page, count, goal, due) {
  await poll(async () => {
    const text = await page.locator('.daily-goal strong').innerText();
    return text.replace(/\s/g, '') === `${count}/${goal}`;
  }, 5000, 'daily_count');
  need((await within(() => page.locator('.streak-pill').innerText(), 5000, 'streak_read')).trim() === '1 day', 'streak_value');
  need((await within(() => page.locator('.week-card p').innerText(), 5000, 'due_read')).includes(`${due} ready to revisit`), 'due_value');
}
async function answerGood(page) {
  await within(() => page.locator('#answer').waitFor({ state: 'visible' }), 10000, 'recall_input');
  need(await page.locator('.correct-answer').count() === 0, 'answer_visible_before_attempt');
  const cue = (await within(() => page.locator('.recall-prompt h1').innerText(), 5000, 'prompt_read')).trim();
  const matches = cards.filter(card => card.language === 'fr' && card.kind === 'vocabulary' && card.cue.es === cue);
  need(matches.length === 1, 'authored_prompt_binding');
  const card = matches[0];
  need(await page.locator('#answer').getAttribute('lang') === 'fr' && await page.locator('.recall-prompt h1').getAttribute('lang') === 'es', 'recall_language_binding');
  await within(() => page.locator('#answer').fill(card.answers[0]), 5000, 'answer_fill');
  await within(() => page.locator('#answer').press('Enter'), 5000, 'answer_submit');
  await within(() => page.locator('.feedback.is-correct').waitFor({ state: 'visible' }), 5000, 'correct_feedback');
  await within(() => page.locator('[data-action="next"][data-grade="good"]').click(), 10000, 'grade_good');
  return card.id;
}
async function continuity() {
  const { page } = await newPage(0, TIME_A);
  need(await page.locator('#language-select').inputValue() === 'fr', 'initial_french');
  await setGoal(page, 5); mark('c01_earn_day_a');
  await within(() => page.locator('[data-action="start"][data-kind="vocabulary"]').click(), 10000, 'start_day_a');
  const earnedIds = [];
  for (let i = 0; i < 5; i++) earnedIds.push(await answerGood(page));
  need(new Set(earnedIds).size === 5, 'five_distinct_earned_items');
  await within(() => page.locator('[data-action="leave-session"]').click(), 10000, 'leave_day_a');
  const earned = await saved(page), history = earned.state.days[DAY_A];
  const dayAClock = await clockRead(page, TIME_A);
  need(history?.goal === 5 && history.cards.length === 5 && history.reviews === 5 && history.correct === 5, 'day_a_earned_history');
  need(same(history.cards, earnedIds), 'day_a_earned_ids');
  for (const id of earnedIds) need(earned.state.progress[id].interval === 1 && earned.state.progress[id].repetitions === 1
    && earned.state.progress[id].lastReviewed === Date.parse(TIME_A) && earned.state.progress[id].due === Date.parse(TIME_A) + 86400000, 'day_a_schedule');
  await today(page, 5, 5, 0);
  mark('c01_future_goal'); await setGoal(page, 10);
  const changed = await saved(page);
  need(same(changed.state.days[DAY_A], history), 'future_goal_rewrote_history');
  await today(page, 5, 5, 0);
  Object.assign(current.observations, { earnedIds, dayA: { date: DAY_A, history, earnedStorage: { bytes: earned.bytes, sha256: earned.sha256 },
    futureGoal: changed.state.settings.dailyGoal, preservedHistory: true }, clock: { timezone: TIMEZONE, dayA: TIME_A, dayB: TIME_B,
    actualDayA: dayAClock, runForMs: 60000, controlled: true } });
  mark('c01_timer_rollover');
  await within(() => page.clock.setFixedTime(new Date(TIME_B)), 5000, 'clock_day_b');
  await within(() => page.clock.runFor(60000), 15000, 'existing_minute_timer');
  current.observations.clock.actualDayB = await clockRead(page, TIME_B);
  await today(page, 0, 10, 5);
  need(await page.locator(`.day-dot[title="${DAY_A}: 5 recalls"]`).count() === 1, 'yesterday_week_count');
  const rolled = await saved(page);
  need(rolled.raw === changed.raw && rolled.state.days[DAY_B] === undefined, 'rollover_mutated_earned_state');
  Object.assign(current.observations, { rollover: { today: 0, goal: 10, due: 5, streak: 1, yesterday: 5, noPersistedEmptyDay: true,
    storageUnchanged: true, bytes: rolled.bytes, sha256: rolled.sha256 } });
  mark('c01_due_review');
  await within(() => page.locator('[data-action="start"][data-kind="vocabulary"]').click(), 10000, 'start_day_b');
  const reviewedId = await answerGood(page); need(earnedIds.includes(reviewedId), 'due_before_new_item');
  await within(() => page.locator('[data-action="leave-session"]').click(), 10000, 'leave_day_b');
  const reviewed = await saved(page), progress = reviewed.state.progress[reviewedId];
  need(progress.interval === 3 && progress.repetitions === 2 && progress.reviews === 2 && progress.correct === 2
    && progress.lastReviewed === Date.parse(TIME_B) && progress.due === Date.parse(TIME_B) + 3 * 86400000, 'day_b_schedule');
  need(same(reviewed.state.days[DAY_A], history) && reviewed.state.days[DAY_B].goal === 10
    && same(reviewed.state.days[DAY_B].cards, [reviewedId]) && reviewed.state.days[DAY_B].reviews === 1, 'day_b_preserves_day_a');
  await today(page, 1, 10, 4);
  mark('c01_reload');
  const response = await within(() => page.reload({ waitUntil: 'load' }), 15000, 'day_b_reload'); need(response?.status() === 200, 'reload_status');
  await today(page, 1, 10, 4); const reloaded = await saved(page); need(reloaded.raw === reviewed.raw, 'reload_changed_progress');
  Object.assign(current.observations, { reviewedId, reviewedProgress: progress, dayB: reviewed.state.days[DAY_B],
    dayAPreserved: true, reload: { storageMatches: true, bytes: reloaded.bytes, sha256: reloaded.sha256, today: 1, goal: 10, due: 4, streak: 1 } });
}
function calendarBytes(bytes, time, date) {
  need(bytes.length > 0 && bytes.length <= FILE_LIMIT, 'calendar_file_bound');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  need(!text.replaceAll('\r\n', '').match(/[\r\n]/) && text.endsWith('END:VCALENDAR\r\n'), 'calendar_crlf_complete');
  const physical = text.split('\r\n').slice(0, -1), maxPhysicalLineBytes = Math.max(...physical.map(line => Buffer.byteLength(line)));
  need(maxPhysicalLineBytes <= 75 && physical.some(line => line.startsWith(' ')), 'calendar_physical_folding');
  const lines = text.replace(/\r\n[ \t]/g, '').split('\r\n');
  const allowed = {
    VCALENDAR: ['VERSION', 'PRODID', 'CALSCALE', 'METHOD', 'X-WR-CALNAME'],
    VEVENT: ['UID', 'DTSTAMP', 'DTSTART', 'DURATION', 'RRULE', 'SUMMARY', 'DESCRIPTION', 'URL'],
    VALARM: ['ACTION', 'TRIGGER', 'DESCRIPTION'],
  };
  const parent = { VCALENDAR: null, VEVENT: 'VCALENDAR', VALARM: 'VEVENT' }, stack = [], scoped = [];
  for (const line of lines.slice(0, -1)) {
    const separator = line.indexOf(':'); need(separator > 0, 'calendar_content_line');
    const key = line.slice(0, separator), value = line.slice(separator + 1);
    if (key === 'BEGIN') {
      need(Object.hasOwn(parent, value) && (stack.at(-1) ?? null) === parent[value], 'calendar_begin_nesting'); stack.push(value);
    } else if (key === 'END') {
      need(stack.at(-1) === value, 'calendar_end_nesting'); stack.pop();
    } else {
      const component = stack.at(-1);
      need(allowed[component]?.includes(key) && !scoped.some(row => row.component === component && row.key === key), 'calendar_property_scope');
      scoped.push({ component, key, value });
    }
  }
  need(stack.length === 0, 'calendar_unclosed_component');
  const one = (key, expected, component = 'VEVENT') => {
    const found = scoped.filter(row => row.component === component && row.key === key);
    need(found.length === 1 && (expected === undefined || found[0].value === expected), 'calendar_property_' + key.toLowerCase());
    return found[0].value;
  };
  for (const component of ['VCALENDAR', 'VEVENT', 'VALARM']) {
    need(lines.filter(line => line === 'BEGIN:' + component).length === 1 && lines.filter(line => line === 'END:' + component).length === 1, 'calendar_component_count');
  }
  need(lines[0] === 'BEGIN:VCALENDAR' && lines.indexOf('BEGIN:VEVENT') < lines.indexOf('BEGIN:VALARM')
    && lines.indexOf('END:VALARM') < lines.indexOf('END:VEVENT'), 'calendar_component_order');
  one('VERSION', '2.0', 'VCALENDAR'); one('METHOD', 'PUBLISH', 'VCALENDAR');
  one('PRODID', '-//Parola//Daily practice//EN', 'VCALENDAR');
  one('CALSCALE', 'GREGORIAN', 'VCALENDAR'); one('X-WR-CALNAME', 'Parola', 'VCALENDAR');
  one('ACTION', 'DISPLAY', 'VALARM');
  const uid = one('UID', 'parola-daily-82043c00@parola.local');
  const start = one('DTSTART', date.replaceAll('-', '') + 'T' + time.replace(':', '') + '00');
  need(!lines.some(line => /^DTSTART;|^TZID[:;]/.test(line)) && !start.endsWith('Z'), 'calendar_floating_local_time');
  const stamp = one('DTSTAMP', '20261110T170000Z');
  one('RRULE', 'FREQ=DAILY'); one('DURATION', 'PT5M'); one('TRIGGER', 'PT0M', 'VALARM'); one('URL', ORIGIN + '/');
  const summary = one('SUMMARY', 'Parola · a little language\\, every day');
  need(one('DESCRIPTION').includes('\\nOpen Parola: ' + ORIGIN + '/\\n')
    && one('DESCRIPTION', summary, 'VALARM') === summary, 'calendar_description');
  return { properties: { UID: uid, DTSTART: start, DTSTAMP: stamp, RRULE: 'FREQ=DAILY', DURATION: 'PT5M', TRIGGER: 'PT0M', URL: ORIGIN + '/' },
    lineCount: physical.length, maxPhysicalLineBytes, utf8Valid: true, crlfOnly: true, complete: true };
}
async function downloadCalendar(page, time, date) {
  await within(() => page.locator('#reminder-time').fill(time), 5000, 'reminder_time_fill');
  mark(time === '19:05' ? 'c02_calendar_1905' : 'c02_calendar_0745');
  const [download] = await Promise.all([
    within(() => page.waitForEvent('download'), 10000, 'native_download_event'),
    within(() => page.locator('[data-action="calendar"]').click(), 10000, 'calendar_click'),
  ]);
  need(isOwnBlob(download.url()), 'calendar_download_origin');
  need(download.suggestedFilename() === 'parola-daily-practice.ics', 'calendar_filename');
  need(await within(() => download.failure(), 10000, 'download_failure') === null, 'native_download_failed');
  const file = await within(() => download.path(), 10000, 'download_path'); ownedRoot();
  need(typeof file === 'string' && path.dirname(file) === downloads && fs.realpathSync(file) === file, 'native_download_containment');
  const stat = fs.lstatSync(file); need(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid() && stat.size > 0 && stat.size <= FILE_LIMIT, 'native_download_type');
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let bytes;
  try {
    const opened = fs.fstatSync(descriptor); need(opened.dev === stat.dev && opened.ino === stat.ino && opened.size === stat.size, 'native_download_identity');
    bytes = fs.readFileSync(descriptor); const after = fs.fstatSync(descriptor), linked = fs.lstatSync(file);
    need(after.dev === stat.dev && after.ino === stat.ino && after.size === stat.size && after.mtimeMs === stat.mtimeMs && after.ctimeMs === stat.ctimeMs && bytes.length === stat.size, 'native_download_changed');
    need(linked.isFile() && !linked.isSymbolicLink() && linked.dev === after.dev && linked.ino === after.ino && linked.uid === process.getuid(), 'native_download_path_replaced');
  } finally { fs.closeSync(descriptor); }
  need(!downloadFiles.includes(file), 'native_download_duplicate_file'); downloadFiles.push(file);
  const parsed = calendarBytes(bytes, time, date), state = await saved(page);
  need(state.state.settings.reminderTime === time && state.state.settings.browserReminders === false, 'reminder_setting_not_persisted');
  report.cleanup.downloadsVerified++;
  return { configuredTime: time, expectedLocalDate: date, filename: download.suggestedFilename(), downloadFailure: null,
    ownBlobUrl: true, expectedMimeType: 'text/calendar;charset=utf-8', bytes: bytes.length, sha256: sha(bytes), dataBase64: bytes.toString('base64'),
    ...parsed, persistedReminderTime: state.state.settings.reminderTime };
}
async function calendar() {
  const { page } = await newPage(1, CALENDAR_TIME); await nav(page, 'settings');
  Object.assign(current.observations, { clock: { timezone: TIMEZONE, fixedTime: CALENDAR_TIME, controlled: true,
    actual: await clockRead(page, CALENDAR_TIME) }, calendars: [] });
  current.observations.calendars.push(await downloadCalendar(page, '19:05', DAY_A));
  current.observations.calendars.push(await downloadCalendar(page, '07:45', DAY_B));
  const [first, second] = current.observations.calendars;
  need(first.properties.UID === second.properties.UID && first.properties.DTSTART !== second.properties.DTSTART, 'calendar_reimport_identity');
  need(first.sha256 !== second.sha256, 'calendar_time_did_not_change_bytes');
  mark('c02_reload_setting'); await within(() => page.reload({ waitUntil: 'load' }), 15000, 'calendar_reload');
  await nav(page, 'settings'); need(await page.locator('#reminder-time').inputValue() === '07:45', 'reminder_reload_value');
  Object.assign(current.observations, { stableUID: true, reloadReminderTime: '07:45', viewport: await within(() => page.evaluate(() => ({ innerWidth,
    clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, innerHeight })), 5000, 'narrow_viewport_observation') });
}
const globalTimer = setTimeout(() => { expired = true; }, 240000);
try {
  need(process.env.CI === 'true' && process.platform === 'linux' && process.version === 'v24.21.0', 'ci_scope');
  need(process.env.PAROLA_CONTINUITY_ORIGIN === ORIGIN && /^[a-f0-9]{40}$/.test(report.sourceCommit ?? ''), 'source_origin_pin');
  root = fs.realpathSync(process.env.PAROLA_CONTINUITY_RUN_ROOT ?? '');
  need(path.isAbsolute(root) && root === process.env.PAROLA_CONTINUITY_RUN_ROOT, 'owned_root_path');
  rootIdentity = fs.lstatSync(root); nonce = process.env.PAROLA_CONTINUITY_NONCE;
  need(/^[a-f0-9]{32}$/.test(nonce ?? ''), 'owned_nonce_shape');
  markerIdentity = fs.lstatSync(path.join(root, '.owner'));
  downloads = path.join(root, 'downloads'); downloadIdentity = fs.lstatSync(downloads); ownedRoot();
  need(fs.readdirSync(downloads).length === 0, 'downloads_not_initially_empty');
  need(process.env.TMPDIR === path.join(root, 'tmp') && fs.realpathSync(process.env.TMPDIR) === process.env.TMPDIR
    && Buffer.byteLength(process.env.TMPDIR) + 64 < 108, 'chromium_tmp_socket_path_budget');
  const sourceRoot = fs.realpathSync(process.env.PAROLA_CONTINUITY_SOURCE_ROOT ?? '');
  for (const [route, name] of ASSETS) {
    const file = path.join(sourceRoot, 'public', name), info = fs.lstatSync(file);
    need(info.isFile() && !info.isSymbolicLink() && info.size <= 1048576, 'source_asset_type_bound');
    const bytes = fs.readFileSync(file); need(bytes.length === info.size && (!PINNED[route] || sha(bytes) === PINNED[route]), 'runtime_source_pin');
    report.sourceAssets.push({ route, bytes: bytes.length, sha256: sha(bytes) });
  }
  ({ CARDS: cards } = await import(pathToFileURL(path.join(sourceRoot, 'public/data.mjs')).href));
  need(Array.isArray(cards) && cards.length === 200, 'authored_catalog_shape');
  const toolRoot = fs.realpathSync(process.env.PAROLA_CONTINUITY_PLAYWRIGHT_ROOT ?? '');
  need(JSON.parse(fs.readFileSync(path.join(toolRoot, 'node_modules/playwright/package.json'), 'utf8')).version === '1.64.1', 'playwright_pin');
  const { chromium } = await import(pathToFileURL(path.join(toolRoot, 'node_modules/playwright/index.mjs')).href);
  browser = await within(() => chromium.launch({ headless: true, timeout: 20000, downloadsPath: downloads }), 22000, 'browser_launch');
  report.browserVersion = browser.version();
  for (let index = 0; index < 2; index++) {
    current = report.cases[index]; mark('setup_' + current.id.toLowerCase());
    try {
      need(!expired && Date.now() < workEnd, 'case_work_deadline');
      await (index ? calendar() : continuity());
      await poll(() => pendingRequests.size === 0 && pendingRoutes === 0, 5000, 'case_network_settled');
      need(!expired && Date.now() < workEnd, 'case_work_deadline');
      need(critical() === 0, 'unexpected_browser_boundary'); current.accepted = true; current.error = null;
    } catch (error) { current.error = finite(error); report.errors.push(current.id.toLowerCase() + '_' + finite(error)); }
  }
} catch (error) { report.errors.push(finite(error)); }
finally {
  clearTimeout(globalTimer); cleanupEnd = Date.now() + 60000; expired = true; current = null; stage = 'cleanup';
  try { await poll(() => pendingRequests.size === 0 && pendingRoutes === 0, 5000, 'cleanup_network_settled', true); }
  catch (error) { report.cleanup.failures.push(finite(error)); }
  for (const context of [...contexts].reverse()) {
    try { await closeContext(context); } catch (error) { report.cleanup.failures.push(finite(error)); }
  }
  if (browser) { try { await within(() => browser.close(), 10000, 'browser_close', true); report.cleanup.browserClosed = true; }
    catch (error) { report.cleanup.failures.push(finite(error)); } }
  const settleEnd = Math.min(Date.now() + 5000, cleanupEnd);
  while ((jobs.size || pendingRoutes || pendingRequests.size) && Date.now() < settleEnd) await delay(25);
  await delay(0); await delay(0);
  report.cleanup.pendingJobs = jobs.size; report.cleanup.pendingRoutes = pendingRoutes; report.cleanup.pendingRequests = pendingRequests.size;
  try {
    ownedRoot(); report.cleanup.downloadFilesAbsent = downloadFiles.filter(file => !fs.existsSync(file)).length;
    report.cleanup.downloadsRemaining = fs.readdirSync(downloads).length;
  } catch (error) { report.cleanup.failures.push(finite(error)); }
  report.cleanup.lateChecksComplete = jobs.size === 0 && pendingRoutes === 0 && pendingRequests.size === 0;
  const blobBindings = [...blobRequests.values()].map(row => ({ ownBlobUrl: true, method: row.method, stage: row.stage,
    matchesActualDownload: downloadUrls.has(row.url) }));
  report.cases[1].observations.blobRequestBindings = blobBindings;
  if (blobBindings.some(row => !row.matchesActualDownload)) report.errors.push('blob_request_not_bound_to_actual_download');
  if (critical()) report.errors.push('unexpected_browser_boundary_including_late_events');
  if (report.cleanup.contextsCreated !== 2 || report.cleanup.contextsClosed !== 2 || !report.cleanup.browserClosed
    || report.cleanup.downloadsObserved !== 2 || report.cleanup.downloadsVerified !== 2 || report.cleanup.downloadFilesAbsent !== 2
    || report.cleanup.downloadsRemaining !== 0 || !report.cleanup.lateChecksComplete || report.cleanup.failures.length) report.errors.push('resource_cleanup_unverified');
  report.status = report.cases.every(item => item.accepted) && report.errors.length === 0 ? 'passed' : 'failed';
  let output = JSON.stringify(report);
  if (Buffer.byteLength(output) > REPORT_LIMIT) { report.status = 'failed'; output = JSON.stringify({ schemaVersion: 1, origin: ORIGIN,
    sourceCommit: report.sourceCommit, status: 'failed', cases: report.cases.map(({ id, title }) => ({ id, title, accepted: false, error: 'report_limit' })), errors: ['report_limit'], cleanup: report.cleanup }); }
  const end = Date.now() + 2000, timer = setTimeout(() => process.exit(1), 2000);
  process.stdout.write('PAROLA_CONTINUITY_BROWSER_RESULT=' + output + '\n', () => { clearTimeout(timer); process.exit(report.status === 'passed' && Date.now() <= end ? 0 : 1); });
}
