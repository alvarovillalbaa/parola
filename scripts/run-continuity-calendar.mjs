#!/usr/bin/env node
// Two fresh continuity/calendar journeys; tools/browser live only on owned public CI.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const REPOSITORY = 'alvarovillalbaa/parola';
const BRANCH = 'refs/heads/qa/parola-continuity-20261107-1';
const ACTIVE = '.github/workflows/continuity-calendar-1.yml';
const SPEC = 'tests/browser/continuity-calendar.mjs';
const SPEC_SHA = 'f3a2848f1a7c0a0e71af98aa6909f1f80f27791b999a060eb2c7a7be4891bf8f';
const ORIGIN = 'https://parola-eta.vercel.app';
const TITLES = [
  'earned daily progress and due reviews survive the next local day and reload',
  'two actual calendar downloads retain complete recurring local-time event bytes',
];
const ASSETS = [
  ['/', 'public/index.html'], ['/index.html', 'public/index.html'], ['/styles.css', 'public/styles.css'],
  ['/theme.css', 'public/theme.css'], ['/app.mjs', 'public/app.mjs'], ['/engine.mjs', 'public/engine.mjs'],
  ['/data.mjs', 'public/data.mjs'], ['/reminders.mjs', 'public/reminders.mjs'], ['/manifest.webmanifest', 'public/manifest.webmanifest'],
  ['/icon.svg', 'public/icon.svg'], ['/sw.js', 'public/sw.js'],
];
const STREAM_LIMIT = 524288, REPORT_LIMIT = 1048576, BROWSER_LIMIT = 131072;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const need = (condition, code) => { if (!condition) throw new Error(code); };
const finite = error => /^[a-z0-9_]+$/.test(error?.message ?? '') ? error.message : 'controller_error';
const sourceCommit = process.argv[3], deployment = process.env.PAROLA_CONTINUITY_EXPECTED_DEPLOYMENT;
need(process.argv.length === 4 && process.argv[2] === '--source-commit' && /^[a-f0-9]{40}$/.test(sourceCommit ?? ''), 'source_pin_required');
need(/^dpl_[A-Za-z0-9]{1,100}$/.test(deployment ?? ''), 'deployment_pin_required');
need(process.version === 'v24.21.0' && process.platform === 'linux' && process.env.CI === 'true'
  && process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY === REPOSITORY
  && process.env.GITHUB_EVENT_NAME === 'create' && process.env.GITHUB_REF === BRANCH
  && process.env.PAROLA_CONTINUITY_PUBLIC_REPOSITORY === 'true', 'approved_public_ci_required');
const event = JSON.parse(read(process.env.GITHUB_EVENT_PATH, 262144));
need(event.ref_type === 'branch' && event.ref === BRANCH.slice('refs/heads/'.length)
  && event.repository?.private === false && event.repository?.full_name === REPOSITORY, 'approved_create_event_required');

const repo = fs.realpathSync(process.cwd()), parent = fs.realpathSync(process.env.RUNNER_TEMP ?? '');
need(path.isAbsolute(parent) && fs.statSync(parent).isDirectory(), 'runner_temp_invalid');
need(typeof process.env.HOME === 'string' && path.isAbsolute(process.env.HOME) && fs.statSync(process.env.HOME).isDirectory(), 'original_home_required');
need(Buffer.byteLength(path.join(parent, 'pc-XXXXXX')) <= 45
  && Buffer.byteLength(path.join(parent, 'pc-XXXXXX', 'tmp', 'playwright_chromiumdev_profile-XXXXXX', 'SingletonSocket')) < 104, 'scratch_socket_path_budget');
const root = fs.mkdtempSync(path.join(parent, 'pc-'));
fs.chmodSync(root, 0o700);
const identity = fs.lstatSync(root), nonce = randomUUID().replaceAll('-', '');
need(identity.uid === process.getuid(), 'scratch_owner_invalid');
fs.writeFileSync(path.join(root, '.owner'), nonce, { flag: 'wx', mode: 0o600 });
for (const name of ['tools', 'tmp', 'cache', 'config', 'data', 'state', 'browsers', 'downloads']) fs.mkdirSync(path.join(root, name), { mode: 0o700 });
for (const name of ['npm-user', 'npm-global']) fs.writeFileSync(path.join(root, name), '', { flag: 'wx', mode: 0o600 });
const tools = path.join(root, 'tools'), specFile = path.join(tools, 'continuity-calendar.mjs');
const env = {
  PATH: `${path.dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  HOME: process.env.HOME, LANG: 'C.UTF-8', TZ: 'UTC', CI: 'true', NO_COLOR: '1',
  TMPDIR: path.join(root, 'tmp'), TMP: path.join(root, 'tmp'), TEMP: path.join(root, 'tmp'),
  XDG_CACHE_HOME: path.join(root, 'cache'), XDG_CONFIG_HOME: path.join(root, 'config'),
  XDG_DATA_HOME: path.join(root, 'data'), XDG_STATE_HOME: path.join(root, 'state'),
  NODE_COMPILE_CACHE: path.join(root, 'cache', 'node'),
  npm_config_userconfig: path.join(root, 'npm-user'), npm_config_globalconfig: path.join(root, 'npm-global'),
  npm_config_cache: path.join(root, 'cache', 'npm'), npm_config_registry: 'https://registry.npmjs.org/',
  npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0',
  PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'browsers'), PLAYWRIGHT_HTML_OPEN: 'never',
  PAROLA_CONTINUITY_EXPECTED_DEPLOYMENT: deployment, PAROLA_CONTINUITY_ORIGIN: ORIGIN,
  PAROLA_CONTINUITY_PLAYWRIGHT_ROOT: tools, PAROLA_CONTINUITY_SOURCE_ROOT: repo, SOURCE_COMMIT: sourceCommit,
  PAROLA_CONTINUITY_RUN_ROOT: root, PAROLA_CONTINUITY_NONCE: nonce,
};
const report = {
  schemaVersion: 'parola.continuity-calendar.v1', sourceCommit, expectedDeployment: deployment, origin: ORIGIN,
  expectedRuntimeCommit: '0bb8e46585e9fb9a679ceacd0b7611c5349ff001',
  runtimeCommitEvidence: 'Root-reviewed provider metadata; served source-byte comparisons are separate and do not infer deployment identity from a response header.',
  status: 'failed', startedAtUtc: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, architecture: process.arch },
  scope: { scenarios: TITLES, cases: 2, retries: 0, workers: 1, appBuild: false, appDependencies: false,
    accounts: false, backend: false, models: false, physicalDevice: false, sourceServer: false,
    publicBrowserCases: ['C01', 'C02'], loopbackBrowserCases: [], oldCourseChecksRepeated: false,
    oldWorkerChecksRepeated: false, oldVMChecksRepeated: false, calendarClientOrOSNotificationDelivery: false },
  limits: { workSeconds: 1020, cleanupSeconds: 90, browserSeconds: 310, jobMinutes: 20,
    streamBytes: STREAM_LIMIT, streamGzipBytes: 131072, allStreamsGzipBytes: 524288,
    browserJsonBytes: BROWSER_LIMIT, reportBytes: REPORT_LIMIT, assetFetchSeconds: 8 },
  commands: [], guards: [], errors: [], sourceFiles: [],
  proofLimits: [
    'Two new public browser journeys use actually earned learner state and actual downloaded calendar bytes. Browser-controlled dates are not natural wall-time delivery.',
    'Twenty-two anonymous source-byte asset observations bind the eleven public paths before/after; deployment metadata alone is not browser proof.',
    'The old sixteen learning paths, nineteen VM identities and three worker journeys remain separate and are not rerun.',
    'Only Playwright1.64.1 is installed in owned runner storage. Chromium Linux system packages belong to the disposable runner.',
    'Exit/close/EOF/groups and same-UID owned browser binary/profile paths plus Linux starttime prove scoped cleanup, not a host-wide inventory.',
    'Calendar-client import/alerts, OS notification delivery, devices and full-product acceptance remain outside this packet.',
    'Full source guards cover the clean pinned CI checkout, not a claim that the separate native checkout\'s five preserved dirty paths are clean.',
  ],
};
const workEnd = Date.now() + 1020000;
let cleanupEnd, interrupted = false, globalExpired = false, baseline, allGzip = 0, browserAttempted = false, assetManifest;
let browserScanUncertain = false, lastBrowserScan = 0;
const browserProcesses = new Map();
const active = new Set(), activeHttp = new Set(), handlers = new Map();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  const handler = () => { interrupted = true; for (const child of active) child.stop('interrupted'); for (const request of activeHttp) request.abort(); };
  handlers.set(signal, handler); process.on(signal, handler);
}
const globalTimer = setTimeout(() => { globalExpired = true; for (const child of active) child.stop('global_deadline'); for (const request of activeHttp) request.abort(); }, Math.max(1, workEnd + 90000 - Date.now()));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function owner() {
  const current = fs.lstatSync(root), marker = path.join(root, '.owner');
  need(path.dirname(root) === parent && current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino
    && current.uid === process.getuid() && fs.lstatSync(marker).uid === process.getuid()
    && !fs.lstatSync(marker).isSymbolicLink() && fs.readFileSync(marker, 'utf8') === nonce, 'scratch_identity_changed');
}
function read(file, maximum = 16777216) {
  const before = fs.lstatSync(file); need(before.isFile() && !before.isSymbolicLink() && before.size <= maximum, 'file_type_or_bound');
  const bytes = fs.readFileSync(file), after = fs.lstatSync(file);
  need(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs
    && before.ctimeMs === after.ctimeMs && bytes.length === before.size, 'file_changed'); return bytes;
}
function scrub(value, maximum = 700) {
  let text = String(value ?? '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  for (const [from, to] of [[root, '[scratch]'], [repo, '[repository]'], [process.env.HOME, '[runner-home]']]) if (from) text = text.split(from).join(to);
  return Buffer.from(text).subarray(0, maximum).toString('utf8');
}
function compressed(bytes, maximum = 131072) {
  const zip = gzipSync(bytes); need(zip.length <= maximum, 'raw_gzip_limit');
  return { encoding: 'gzip-base64', bytes: bytes.length, sha256: sha(bytes), compressedBytes: zip.length, data: zip.toString('base64') };
}
function groupAbsent(pid) { try { process.kill(-pid, 0); return false; } catch (error) { return error.code === 'ESRCH' ? true : null; } }
function proc(pid) {
  const base = `/proc/${pid}`, item = fs.statSync(base);
  if (item.uid !== process.getuid()) return null;
  const before = readProc(path.join(base, 'stat'), 8192).toString(), close = before.lastIndexOf(')');
  need(close > 0, 'proc_stat_shape');
  const fields = before.slice(close + 2).trim().split(/\s+/);
  need(fields.length >= 20 && /^\d+$/.test(fields[19]), 'proc_stat_shape');
  const args = readProc(path.join(base, 'cmdline'), 65536).toString().split('\0').filter(Boolean);
  const after = readProc(path.join(base, 'stat'), 8192).toString(), afterClose = after.lastIndexOf(')');
  need(afterClose > 0 && after.slice(afterClose + 2).trim().split(/\s+/)[19] === fields[19], 'proc_identity_changed');
  const owned = args.some(arg => arg === root || arg.startsWith(root + '/') || arg.includes('=' + root + '/'))
    || browserProcesses.has(pid + ':' + fields[19]);
  return { pid, ppid: Number(fields[1]), pgid: Number(fields[2]), session: Number(fields[3]), state: fields[0],
    starttime: fields[19], owned, executable: args.length ? path.basename(args[0].trim().split(/\s+/)[0]).slice(0, 80) : '' };
}
function readProc(file, maximum) {
  const fd = fs.openSync(file, 'r');
  try { const buffer = Buffer.alloc(maximum + 1), length = fs.readSync(fd, buffer, 0, buffer.length, 0); need(length <= maximum, 'proc_read_bound'); return buffer.subarray(0, length); }
  finally { fs.closeSync(fd); }
}
function scanBrowsers(force = false) {
  if (!browserAttempted || (!force && Date.now() - lastBrowserScan < 500)) return [];
  lastBrowserScan = Date.now(); const names = fs.readdirSync('/proc').filter(name => /^\d+$/.test(name));
  need(names.length <= 8192, 'proc_inventory_bound'); const present = [];
  for (const name of names) {
    const pid = Number(name); if (pid === process.pid) continue;
    try {
      const item = proc(pid); if (!item?.owned) continue;
      // The command supervisor owns its own process group; this supplementary
      // inventory records detached browser descendants without logging argv.
      const key = item.pid + ':' + item.starttime;
      if (!browserProcesses.has(key)) browserProcesses.set(key, { ...item, firstSeenAtUtc: new Date().toISOString() });
      need(browserProcesses.size <= 256, 'browser_process_inventory_bound');
      present.push(item);
    } catch (error) {
      if (!['ENOENT', 'ESRCH'].includes(error.code)) browserScanUncertain = true;
    }
  }
  return present;
}
async function cleanupBrowsers() {
  owner(); const started = Date.now(); let present = scanBrowsers(true), termSent = 0, killSent = 0;
  while (present.length && Date.now() - started < 6500 && Date.now() < cleanupEnd - 10000) {
    for (const item of present) {
      try {
        const current = proc(item.pid);
        need(current?.owned && current.starttime === item.starttime, 'browser_pid_identity_changed');
        const signal = Date.now() - started >= 3000 ? 'SIGKILL' : 'SIGTERM';
        process.kill(item.pid, signal); if (signal === 'SIGKILL') killSent++; else termSent++;
      } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) browserScanUncertain = true; }
    }
    await pause(100); present = scanBrowsers(true);
  }
  const stillPresent = scanBrowsers(true);
  report.browserProcessCleanup = { passed: !browserScanUncertain && stillPresent.length === 0 && termSent === 0 && killSent === 0,
    basis: 'Same UID, unique owned-root argv attribution and revalidated Linux kernel PID starttime; no argv/env output.',
    observed: [...browserProcesses.values()], remaining: stillPresent, termSent, killSent, scanUncertain: browserScanUncertain };
  need(report.browserProcessCleanup.passed, 'browser_process_cleanup_unverified');
}
async function run(label, executable, args, seconds, { cleanup = false, retainFailure = false, cwd = repo, postScratch = false } = {}) {
  if (postScratch) need(cleanup && report.scratchCleanup === 'passed' && !fs.existsSync(root), 'scratch_postguard_invalid'); else owner();
  need(cleanup || (!interrupted && !globalExpired), 'interrupted_before_command');
  const end = cleanup ? cleanupEnd : workEnd, remaining = end - Date.now() - 6500;
  need(remaining > 0, 'command_budget_exhausted');
  const commandEnv = postScratch ? { PATH: env.PATH, HOME: env.HOME, LANG: env.LANG, TZ: env.TZ,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' } : env;
  const started = Date.now(), child = spawn(executable, args, { cwd, env: commandEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = [[], []], count = [0, 0], size = [0, 0], digest = [createHash('sha256'), createHash('sha256')], eof = [false, false];
  let exitCode = null, signal = null, exited = false, closed = false, reason = null, stopAt = null, termSent = false, killSent = false, forcedDrain = false, captureFinished = false;
  const control = { stop(why) {
    if (!reason) { reason = why; stopAt = Date.now(); }
    if (!termSent && child.pid) { termSent = true; try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  } };
  active.add(control);
  child.once('error', () => { control.stop('spawn_failed'); });
  child.once('exit', (code, received) => { exited = true; exitCode = code; signal = received; });
  child.once('close', () => { closed = true; });
  [child.stdout, child.stderr].forEach((stream, index) => {
    stream.once('end', () => { eof[index] = true; });
    stream.on('data', bytes => {
      if (captureFinished) return;
      count[index] += bytes.length; digest[index].update(bytes);
      const kept = bytes.subarray(0, Math.max(0, STREAM_LIMIT - size[index])); chunks[index].push(kept); size[index] += kept.length;
      if (count[index] > STREAM_LIMIT) control.stop('output_limit');
    });
  });
  let leaderClosedAt = null;
  while (true) {
    if (label === 'browser_cases') { try { scanBrowsers(); } catch { browserScanUncertain = true; } }
    const now = Date.now(), absent = child.pid ? groupAbsent(child.pid) : true;
    if (closed && leaderClosedAt === null) leaderClosedAt = now;
    if (interrupted && !cleanup) control.stop('interrupted');
    if (now - started >= Math.min(seconds * 1000, remaining)) control.stop('timeout');
    if (closed && exited && eof.every(Boolean) && absent === true) break;
    if (closed && !child.pid) break;
    if (leaderClosedAt !== null && absent !== true && now - leaderClosedAt >= 1500) control.stop('process_group_remaining');
    if (stopAt !== null && now - stopAt >= 3000 && !killSent && child.pid && absent !== true) {
      killSent = true; try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }
    if (stopAt !== null && now - stopAt >= 6000) {
      forcedDrain = !closed || !eof.every(Boolean);
      if (forcedDrain) { child.stdout.destroy(); child.stderr.destroy(); }
      break;
    }
    await pause(25);
  }
  captureFinished = true; const output = chunks.map(parts => Buffer.concat(parts));
  const row = { label, args: [executable === process.execPath ? '[node]' : scrub(executable, 250), ...args.map(value => scrub(value, 250))],
    exitCode, signal, stopReason: reason, exitObservedAndReaped: exited, closeObserved: closed, pipesEOF: [...eof],
    forcedDrain, originalProcessGroupAbsent: child.pid ? groupAbsent(child.pid) : true, termSent, killSent, durationMs: Date.now() - started,
    streams: output.map((bytes, index) => {
      const raw = compressed(bytes); allGzip += raw.compressedBytes;
      return { name: index ? 'stderr' : 'stdout', observedBytes: count[index], observedSha256: digest[index].digest('hex'),
        complete: closed && eof[index] && count[index] === bytes.length && !forcedDrain, raw, head: scrub(bytes.toString(), 500), tail: scrub(bytes.subarray(Math.max(0, bytes.length - 700)).toString(), 700) };
    }) };
  row.released = exited && closed && eof.every(Boolean) && !forcedDrain && row.originalProcessGroupAbsent === true;
  report.commands.push(row); active.delete(control);
  need(allGzip <= 524288, 'all_streams_gzip_limit');
  const accepted = row.exitCode === 0 && row.signal === null && row.stopReason === null && row.released && row.streams.every(stream => stream.complete);
  if (!retainFailure) need(accepted, label + '_failed');
  return { output, row, accepted };
}
function parseGit(bytes, index) {
  const rows = new Map();
  for (const record of bytes.toString().split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t'), header = record.slice(0, tab).split(' '), name = record.slice(tab + 1);
    need(tab > 0 && name && !path.isAbsolute(name) && !name.split('/').some(part => !part || part === '.' || part === '..') && !rows.has(name), 'git_entry_invalid');
    need(index ? header[2] === '0' : header[1] === 'blob', 'git_entry_type'); rows.set(name, { mode: header[0], gitBlob: header[index ? 1 : 2] });
  }
  return rows;
}
function fileVector(name) {
  const file = path.join(repo, name);
  for (let current = path.dirname(file); current !== repo; current = path.dirname(current)) {
    const item = fs.lstatSync(current); need(item.isDirectory() && !item.isSymbolicLink(), 'tracked_ancestor_changed');
  }
  const before = fs.lstatSync(file), mode = before.isSymbolicLink() ? '120000' : before.isFile() ? (before.mode & 0o111 ? '100755' : '100644') : null;
  need(mode, 'tracked_type_invalid');
  const bytes = before.isSymbolicLink() ? fs.readlinkSync(file, { encoding: 'buffer' }) : read(file), after = fs.lstatSync(file);
  need(before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'tracked_file_changed');
  return { path: name, mode, gitBlob: gitBlob(bytes), bytes: bytes.length, sha256: sha(bytes) };
}
async function guard(label, cleanup = false, postScratch = false) {
  const result = { label, passed: false }; report.guards.push(result); const options = { cleanup, postScratch };
  need((await run(label + '_head', 'git', ['rev-parse', 'HEAD'], 10, options)).output[0].toString().trim() === sourceCommit, 'head_changed');
  need(!fs.existsSync(path.join(repo, ACTIVE)), 'active_workflow_in_source');
  const tree = parseGit((await run(label + '_tree', 'git', ['ls-tree', '-r', '-z', 'HEAD'], 10, options)).output[0], false);
  const index = parseGit((await run(label + '_index', 'git', ['ls-files', '--stage', '-z'], 10, options)).output[0], true);
  need(tree.size > 0 && index.size === tree.size, 'tracked_count_changed');
  const vector = [];
  for (const [name, item] of tree) {
    const value = fileVector(name); need(index.get(name)?.mode === item.mode && index.get(name)?.gitBlob === item.gitBlob
      && value.mode === item.mode && value.gitBlob === item.gitBlob, 'full_tracked_source_changed'); vector.push(value);
  }
  need((await run(label + '_status', 'git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 10, options)).output[0].length === 0, 'worktree_not_clean');
  await run(label + '_diff', 'git', ['-c', 'core.filemode=true', 'diff', '--no-ext-diff', '--no-textconv', '--quiet', '--exit-code', 'HEAD', '--'], 10, options);
  const ignored = (await run(label + '_ignored', 'git', ['status', '--porcelain=v1', '-z', '--ignored=matching', '--untracked-files=normal'], 10, options)).output[0];
  need(ignored.length === 0, 'repository_generated_output');
  if (!baseline) { baseline = vector; report.sourceFiles = vector; }
  need(JSON.stringify(vector) === JSON.stringify(baseline), 'source_vector_changed');
  Object.assign(result, { passed: true, trackedFiles: vector.length, sourceBytes: vector.reduce((sum, file) => sum + file.bytes, 0),
    vectorSha256: sha(JSON.stringify(vector)), fullHeadIndexModesAndBytes: true, noUntrackedOrIgnoredOutput: true });
}
async function verifyServedAssets(phase) {
  report.servedAssets ??= [];
  for (const expected of assetManifest) {
    owner(); need(!interrupted && !globalExpired && workEnd - Date.now() > 9000, 'asset_budget_exhausted');
    const abort = new AbortController(), row = { phase, route: expected.route, expectedBytes: expected.bytes, expectedSha256: expected.sha256,
      status: null, sameOrigin: false, redirect: false, complete: false, bytes: 0, sha256: null, matchesExpected: false,
      credentials: 'omit', readerReleased: false, aborted: false };
    report.servedAssets.push(row); activeHttp.add(abort);
    let reader, timedOut = false; const digest = createHash('sha256'), deadline = Date.now() + 8000;
    const timer = setTimeout(() => { timedOut = true; abort.abort(); }, 8000);
    try {
      const response = await fetch(ORIGIN + expected.route, { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
        signal: abort.signal, headers: { accept: '*/*', 'user-agent': 'ParolaWorkerChecks/1' } });
      row.status = response.status; row.sameOrigin = new URL(response.url).origin === ORIGIN;
      row.redirect = response.redirected;
      need(response.status === 200 && response.url === ORIGIN + expected.route && !response.redirected, 'asset_response_identity');
      const length = response.headers.get('content-length');
      need(length === null || (/^\d+$/.test(length) && Number(length) <= 2097152), 'asset_declared_limit');
      need(response.body, 'asset_body_missing'); reader = response.body.getReader();
      while (true) {
        const chunk = await reader.read();
        need(!interrupted && !globalExpired, 'asset_interrupted'); need(!timedOut && Date.now() <= deadline, 'asset_timeout');
        if (chunk.done) { row.complete = true; break; }
        row.bytes += chunk.value.byteLength; need(row.bytes <= 2097152, 'asset_body_limit'); digest.update(chunk.value);
      }
      row.sha256 = digest.digest('hex'); row.matchesExpected = row.bytes === expected.bytes && row.sha256 === expected.sha256;
      need(row.matchesExpected, 'served_asset_source_mismatch');
    } catch (error) { row.error = timedOut ? 'asset_timeout' : finite(error); throw new Error(row.error); }
    finally {
      clearTimeout(timer); abort.abort(); row.aborted = true;
      if (row.sha256 === null) row.sha256 = digest.digest('hex');
      if (reader) {
        let cancelled = false;
        try { cancelled = await Promise.race([reader.cancel().then(() => true, () => false), pause(1000).then(() => false)]); }
        finally { try { reader.releaseLock(); row.readerReleased = cancelled; } catch { row.readerReleased = false; } }
      } else row.readerReleased = true;
      activeHttp.delete(abort);
    }
    need(row.readerReleased && !timedOut, 'asset_stream_cleanup_unverified');
  }
}

function prepareManifest() {
  assetManifest = ASSETS.map(([route, file]) => { const bytes = read(path.join(repo, file)); return { route, bytes: bytes.length, sha256: sha(bytes) }; });
  need(assetManifest.length === 11 && new Set(assetManifest.map(item => item.route)).size === 11, 'source_manifest_shape');
  report.expectedAssets = assetManifest;
}
function generate() {
  const bytes = read(path.join(repo, SPEC), 131072); need(sha(bytes) === SPEC_SHA, 'browser_source_hash');
  fs.writeFileSync(specFile, bytes, { flag: 'wx', mode: 0o600 });
  report.generated = { sourceSpec: SPEC, sourceSha256: SPEC_SHA, generatedSha256: sha(read(specFile, 131072)),
    copiedByteExact: read(specFile, 131072).equals(bytes) };
  need(report.generated.copiedByteExact, 'generated_spec_changed');
}
function calendarReceipt(item, index) {
  const time = ['19:05', '07:45'][index], date = ['2026-11-10', '2026-11-11'][index];
  need(item && item.configuredTime === time && item.expectedLocalDate === date && item.persistedReminderTime === time
    && item.filename === 'parola-daily-practice.ics' && item.downloadFailure === null && item.ownBlobUrl === true
    && item.expectedMimeType === 'text/calendar;charset=utf-8' && Number.isInteger(item.bytes) && item.bytes > 0 && item.bytes <= 16384
    && /^[a-f0-9]{64}$/.test(item.sha256 ?? '') && typeof item.dataBase64 === 'string'
    && /^[A-Za-z0-9+/]*={0,2}$/.test(item.dataBase64), 'calendar_receipt_shape');
  const bytes = Buffer.from(item.dataBase64, 'base64');
  need(bytes.toString('base64') === item.dataBase64 && bytes.length === item.bytes && sha(bytes) === item.sha256, 'calendar_original_digest');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  need(!/[\r\n]/.test(text.replaceAll('\r\n', '')) && text.endsWith('END:VCALENDAR\r\n'), 'calendar_original_crlf');
  const physical = text.split('\r\n').slice(0, -1), maximum = Math.max(...physical.map(line => Buffer.byteLength(line)));
  need(maximum <= 75 && physical.some(line => line.startsWith(' ')) && item.lineCount === physical.length
    && item.maxPhysicalLineBytes === maximum && item.utf8Valid === true && item.crlfOnly === true && item.complete === true, 'calendar_original_lines');
  const lines = text.replace(/\r\n[ \t]/g, '').split('\r\n');
  const stack = [], properties = new Map(), scopes = {
    VCALENDAR: ['VERSION', 'PRODID', 'CALSCALE', 'METHOD', 'X-WR-CALNAME'],
    VEVENT: ['UID', 'DTSTAMP', 'DTSTART', 'DURATION', 'RRULE', 'SUMMARY', 'DESCRIPTION', 'URL'],
    VALARM: ['ACTION', 'TRIGGER', 'DESCRIPTION'],
  };
  for (const line of lines.slice(0, -1)) {
    if (line.startsWith('BEGIN:')) {
      const component = line.slice(6), parent = { VCALENDAR: undefined, VEVENT: 'VCALENDAR', VALARM: 'VEVENT' }[component];
      need(Object.hasOwn(scopes, component) && stack.at(-1) === parent, 'calendar_original_nesting'); stack.push(component);
    } else if (line.startsWith('END:')) need(stack.pop() === line.slice(4), 'calendar_original_nesting');
    else {
      const key = line.slice(0, line.indexOf(':')), scope = stack.at(-1), identity = scope + ':' + key;
      need(line.includes(':') && scopes[scope]?.includes(key) && !properties.has(identity), 'calendar_original_property_scope'); properties.set(identity, line.slice(line.indexOf(':') + 1));
    }
  }
  need(stack.length === 0, 'calendar_original_unclosed_component');
  for (const component of ['VCALENDAR', 'VEVENT', 'VALARM']) need(lines.filter(line => line === 'BEGIN:' + component).length === 1
    && lines.filter(line => line === 'END:' + component).length === 1, 'calendar_original_components');
  need(lines[0] === 'BEGIN:VCALENDAR' && lines.indexOf('BEGIN:VEVENT') < lines.indexOf('BEGIN:VALARM')
    && lines.indexOf('END:VALARM') < lines.indexOf('END:VEVENT') && !lines.some(line => /^DTSTART;|^TZID[:;]/.test(line)), 'calendar_original_order');
  const expected = { UID: 'parola-daily-82043c00@parola.local', DTSTART: date.replaceAll('-', '') + 'T' + time.replace(':', '') + '00',
    DTSTAMP: '20261110T170000Z', RRULE: 'FREQ=DAILY', DURATION: 'PT5M', TRIGGER: 'PT0M', URL: ORIGIN + '/' };
  for (const [key, value] of Object.entries({ ...expected, VERSION: '2.0', PRODID: '-//Parola//Daily practice//EN',
    CALSCALE: 'GREGORIAN', METHOD: 'PUBLISH', 'X-WR-CALNAME': 'Parola', ACTION: 'DISPLAY',
    SUMMARY: 'Parola · a little language\\, every day' })) {
    const found = lines.filter(line => line.startsWith(key + ':'));
    need(found.length === 1 && found[0] === key + ':' + value, 'calendar_original_property');
  }
  need(JSON.stringify(item.properties) === JSON.stringify(expected), 'calendar_reported_properties');
  const descriptions = lines.filter(line => line.startsWith('DESCRIPTION:'));
  need(descriptions.length === 2 && properties.get('VEVENT:DESCRIPTION')?.includes('\\nOpen Parola: ' + ORIGIN + '/\\n')
    && properties.get('VALARM:DESCRIPTION') === 'Parola · a little language\\, every day', 'calendar_original_description');
  return { bytes: bytes.length, sha256: sha(bytes), properties: expected, independentOriginalBytesVerified: true,
    expectedMimeType: item.expectedMimeType, mimeTypeEvidence: 'Source-declared download type; Download API does not independently expose Blob MIME.' };
}
function browserResults(bytes) {
  need(bytes.length <= BROWSER_LIMIT, 'browser_output_limit');
  const lines = bytes.toString().split('\n').filter(line => line.startsWith('PAROLA_CONTINUITY_BROWSER_RESULT='));
  need(lines.length === 1, 'browser_receipt_count');
  const value = JSON.parse(lines[0].slice('PAROLA_CONTINUITY_BROWSER_RESULT='.length));
  report.browser = { accepted: false, result: value, rawSha256: sha(bytes), rawBytes: bytes.length };
  need(value.schemaVersion === 1 && value.origin === ORIGIN && value.sourceCommit === sourceCommit
    && typeof value.browserVersion === 'string' && Array.isArray(value.cases) && value.cases.length === 2
    && value.status === 'passed' && Array.isArray(value.errors) && value.errors.length === 0, 'browser_receipt_shape');
  const seen = new Set();
  for (const [index, item] of value.cases.entries()) {
    need(/^C0[1-2]$/.test(item.id) && !seen.has(item.id), 'browser_case_identity'); seen.add(item.id);
    need(item.id === `C0${index + 1}` && item.title === TITLES[index] && item.profile === ['desktop 1440x1000', 'narrow 390x844'][index] && item.accepted === true
      && item.error === null && item.observations && typeof item.observations === 'object', 'browser_case_failure');
  }
  need(JSON.stringify(value.sourceAssets) === JSON.stringify(assetManifest), 'browser_source_assets');
  for (const key of ['pageErrors', 'consoleErrors', 'unexpectedRequests', 'credentialRequests', 'webSockets', 'requestFailures',
    'responseErrors', 'unexpectedDialogs', 'unexpectedPages', 'activeUnknownUrlAborts'])
    need(value.boundaries?.[key] === 0, 'browser_boundary');
  need(Array.isArray(value.boundaries.events) && value.boundaries.events.length === 0, 'browser_boundary_events');
  const first = value.cases[0].observations, second = value.cases[1].observations;
  const digest = item => item && Number.isInteger(item.bytes) && item.bytes > 0 && item.bytes <= 65536 && /^[a-f0-9]{64}$/.test(item.sha256 ?? '');
  const clock = (item, time, local) => item?.epoch === Date.parse(time) && item.timezone === 'Europe/Madrid'
    && JSON.stringify(item.local) === JSON.stringify(local);
  need(Array.isArray(first.earnedIds) && first.earnedIds.length === 5 && new Set(first.earnedIds).size === 5
    && first.earnedIds.every(id => /^fr-v-\d{2}$/.test(id)) && first.earnedIds.includes(first.reviewedId), 'continuity_earned_ids');
  const dayA = first.dayA, rollover = first.rollover, progress = first.reviewedProgress, reload = first.reload;
  need(first.stage === 'c01_reload' && first.clock?.timezone === 'Europe/Madrid' && first.clock.dayA === '2026-11-10T09:00:00+01:00'
    && first.clock.dayB === '2026-11-11T09:01:00+01:00' && first.clock.runForMs === 60000 && first.clock.controlled === true
    && clock(first.clock.actualDayA, first.clock.dayA, [2026, 11, 10, 9, 0])
    && clock(first.clock.actualDayB, first.clock.dayB, [2026, 11, 11, 9, 1]) && dayA?.date === '2026-11-10'
    && dayA.history?.goal === 5 && dayA.history.reviews === 5 && dayA.history.correct === 5
    && JSON.stringify(dayA.history.cards) === JSON.stringify(first.earnedIds) && digest(dayA.earnedStorage)
    && dayA.futureGoal === 10 && dayA.preservedHistory === true, 'continuity_day_a');
  need(rollover?.today === 0 && rollover.goal === 10 && rollover.due === 5 && rollover.streak === 1 && rollover.yesterday === 5
    && rollover.noPersistedEmptyDay === true && rollover.storageUnchanged === true && digest(rollover), 'continuity_rollover');
  need(progress?.interval === 3 && progress.repetitions === 2 && progress.reviews === 2 && progress.correct === 2 && progress.lapses === 0
    && progress.lastReviewed === Date.parse('2026-11-11T09:01:00+01:00') && progress.due === Date.parse('2026-11-11T09:01:00+01:00') + 3 * 86400000
    && first.dayB?.goal === 10 && first.dayB.reviews === 1 && first.dayB.correct === 1
    && JSON.stringify(first.dayB.cards) === JSON.stringify([first.reviewedId]) && first.dayAPreserved === true
    && reload?.storageMatches === true && digest(reload) && reload.today === 1 && reload.goal === 10 && reload.due === 4 && reload.streak === 1, 'continuity_review_reload');
  need(second.stage === 'c02_reload_setting' && second.clock?.timezone === 'Europe/Madrid' && second.clock.fixedTime === '2026-11-10T18:00:00+01:00'
    && second.clock.controlled === true && clock(second.clock.actual, second.clock.fixedTime, [2026, 11, 10, 18, 0])
    && Array.isArray(second.calendars) && second.calendars.length === 2 && second.stableUID === true && second.reloadReminderTime === '07:45'
    && second.viewport?.innerWidth === 390 && second.viewport.innerHeight === 844
    && Number.isInteger(second.viewport.clientWidth) && second.viewport.clientWidth > 0 && second.viewport.clientWidth <= 390
    && Number.isInteger(second.viewport.scrollWidth) && second.viewport.scrollWidth >= second.viewport.clientWidth, 'calendar_settings_reload');
  need(Array.isArray(second.blobRequestBindings) && second.blobRequestBindings.length <= 8 && second.blobRequestBindings.every(item => item.ownBlobUrl === true
    && item.method === 'GET' && ['c02_calendar_1905', 'c02_calendar_0745'].includes(item.stage) && item.matchesActualDownload === true), 'calendar_blob_binding');
  report.calendarFiles = second.calendars.map(calendarReceipt);
  need(report.calendarFiles[0].sha256 !== report.calendarFiles[1].sha256
    && report.calendarFiles[0].properties.UID === report.calendarFiles[1].properties.UID, 'calendar_reimport_identity');
  need(value.limits?.workSeconds === 240 && value.limits.cleanupSeconds === 60 && value.limits.stdoutSeconds === 2
    && value.limits.downloadBytes === 16384 && value.limits.reportBytes === BROWSER_LIMIT && value.limits.eventRows === 16
    && value.limits.timerAdvanceMs === 60000, 'browser_limits');
  const c = value.cleanup;
  need(c && c.contextsCreated === 2 && c.contextsClosed === 2 && c.browserClosed === true
    && c.downloadsObserved === 2 && c.downloadsVerified === 2 && c.downloadFilesAbsent === 2 && c.downloadsRemaining === 0
    && c.pendingRequests === 0 && c.pendingRoutes === 0 && c.pendingJobs === 0 && c.lateChecksComplete === true
    && Array.isArray(c.failures) && c.failures.length === 0, 'browser_resource_cleanup');
  report.browser.accepted = true;
}
try {
  await guard('before');
  need(JSON.parse(read(path.join(repo, 'package.json'), 32768)).name === 'parola', 'package_identity');
  prepareManifest();
  report.runtime.nodeSha256 = sha(read(process.execPath, 268435456));
  const npm = fs.realpathSync(path.join(path.dirname(process.execPath), 'npm'));
  need(fs.statSync(npm).isFile(), 'npm_cli_missing'); report.runtime.npmCliSha256 = sha(read(npm, 1048576));
  report.runtime.npm = (await run('npm_version', process.execPath, [npm, '--version'], 15, { cwd: tools })).output[0].toString().trim();
  await run('install_playwright', process.execPath, [npm, 'install', '--prefix', tools, '--no-save', '--package-lock=false', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', 'playwright@1.64.1'], 150, { cwd: tools });
  report.runtime.toolPackages = ['playwright', 'playwright-core'].map(name => {
    const bytes = read(path.join(tools, 'node_modules', name, 'package.json'), 32768), value = JSON.parse(bytes);
    need(value.name === name && value.version === '1.64.1', 'playwright_version');
    return { name, version: value.version, packageJsonSha256: sha(bytes) };
  });
  const cli = path.join(tools, 'node_modules/playwright/cli.js'); report.runtime.playwright = '1.64.1';
  report.runtime.playwrightCliSha256 = sha(read(cli, 1048576));
  await run('install_chromium_and_runner_libraries', process.execPath, [cli, 'install', '--with-deps', 'chromium'], 240, { cwd: tools });
  generate();
  await verifyServedAssets('before_browser');
  await guard('before_browser');
  need(workEnd - Date.now() >= 317000, 'browser_window_unavailable'); browserAttempted = true;
  const browser = await run('browser_cases', process.execPath, [specFile], 310, { cwd: tools, retainFailure: true });
  browserResults(browser.output[0]); need(browser.accepted, 'browser_cli_failed');
  await verifyServedAssets('after_browser');
  await guard('after_browser');
} catch (error) { report.errors.push(finite(error)); }
finally {
  cleanupEnd = Math.min(Date.now() + 90000, workEnd + 90000);
  try { await guard('after', true); } catch (error) { report.errors.push(finite(error)); }
  report.processCleanup = { passed: active.size === 0 && report.commands.every(row => row.released), started: report.commands.length };
  for (const request of activeHttp) request.abort();
  report.networkCleanup = { passed: activeHttp.size === 0 && (report.servedAssets ?? []).every(row => row.readerReleased),
    basis: 'Public asset streams cancelled and reader locks released; browser driver owns no HTTP server.' };
  try { await cleanupBrowsers(); } catch (error) { report.errors.push(finite(error)); }
  try {
    owner(); need(report.processCleanup.passed && report.browserProcessCleanup?.passed === true && report.networkCleanup.passed, 'process_cleanup_unverified');
    fs.rmSync(root, { recursive: true }); need(!fs.existsSync(root), 'scratch_still_present'); report.scratchCleanup = 'passed';
  } catch (error) { report.scratchCleanup = 'unverified'; report.errors.push(finite(error)); }
  try { if (report.scratchCleanup === 'passed') await guard('after_cleanup', true, true); } catch (error) { report.errors.push(finite(error)); }
  report.processCleanup = { passed: active.size === 0 && report.commands.every(row => row.released), started: report.commands.length };
  if (interrupted) report.errors.push('interrupted');
  if (globalExpired || Date.now() > workEnd + 90000) report.errors.push('global_deadline');
  report.interrupted = interrupted; report.completedAtUtc = new Date().toISOString();
  report.status = !report.errors.length && report.browser?.accepted === true && report.processCleanup.passed && report.browserProcessCleanup?.passed === true
    && report.networkCleanup.passed && report.servedAssets?.length === 22 && report.servedAssets.every(row => row.matchesExpected && row.complete)
    && report.scratchCleanup === 'passed' ? 'passed' : 'failed';
  let text = JSON.stringify(report);
  if (Buffer.byteLength(text) > REPORT_LIMIT) { text = JSON.stringify({ schemaVersion: report.schemaVersion, sourceCommit, expectedDeployment: deployment, status: 'failed', errors: ['report_limit'] }); report.status = 'failed'; }
  const outputTimer = setTimeout(() => { process.stderr.write('controller_stdout_deadline\n'); process.exit(1); }, Math.max(1, Math.min(2000, workEnd + 92000 - Date.now())));
  process.stdout.write('PAROLA_CONTINUITY_REPORT=' + text + '\n', () => {
    clearTimeout(outputTimer); clearTimeout(globalTimer);
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    process.exitCode = report.status === 'passed' && !interrupted && !globalExpired && Date.now() <= workEnd + 92000 ? 0 : 1;
  });
}
