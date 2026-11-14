// Four new public UI journeys. Seeded learner history is authored setup, not
// newly earned learning, overnight behavior, worker or notification acceptance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CARDS } from '../../public/data.mjs';
import { createState, validateState, applyReview, parseBackup } from '../../public/engine.mjs';

const ORIGIN = 'https://parola-eta.vercel.app';
const KEY = 'parola-state-v1';
const root = process.env.PAROLA_BACKUP_ROOT;
const output = process.env.PAROLA_BACKUP_OUTPUT;
assert(root && output && process.env.PAROLA_BACKUP_PLAYWRIGHT);
const { chromium } = await import(pathToFileURL(process.env.PAROLA_BACKUP_PLAYWRIGHT).href);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const custom = { id: 'custom-backup-fixture', language: 'fr', kind: 'vocabulary', topic: 'Authored backup', level: 'A1',
  cue: { es: 'La prueba <b>Parola backup</b>', en: 'The <b>Parola backup</b> proof' }, answers: ['la preuve', 'une preuve'],
  note: { es: '<img src=x onerror="window.parolaInjected=true">', en: '<script>window.parolaInjected=true</script>' },
  example: { target: '', en: '', es: '' } };
let stateA = createState(); stateA.customCards = [custom]; stateA.settings.dailyGoal = 15;
stateA = applyReview(stateA, CARDS[0], 'good', Date.parse('2026-11-01T12:00:00Z'));
stateA = applyReview(stateA, custom, 'hard', Date.parse('2026-11-02T12:00:00Z'));
stateA = validateState(stateA, CARDS);
const stateB = validateState({ ...createState(), settings: { ...createState().settings, dailyGoal: 5, reminderTime: '08:15' } }, CARDS);
const report = { source: process.env.GITHUB_SHA, origin: ORIGIN, fixtureKind: 'authored learner history', status: 'failed', cases: [], downloads: [], pageErrors: [], contextsClosed: 0, contextsCreated: 0, oldScopesRepeated: false };
let activeContext;
let downloadedBackup;
const raw = page => page.evaluate(key => localStorage.getItem(key), KEY);
const action = (page, name) => page.locator(`[data-action="${name}"]`);
const settings = page => page.locator('.sidebar a[href="#settings"]').click();
const library = page => page.locator('nav a[href="#library"]').click();
async function restore(page, file = downloadedBackup) {
  await settings(page);
  await page.locator('#restore-file').setInputFiles(file);
  await page.locator('#restore-dialog').waitFor({ state: 'visible' });
}
async function download(page, actionName, filename) {
  const [file] = await Promise.all([page.waitForEvent('download'), action(page, actionName).click()]);
  assert.equal(await file.failure(), null);
  const original = await file.path(); const info = await stat(original); assert(info.size > 0 && info.size < 65_536);
  const bytes = await readFile(original); const target = path.join(output, filename);
  await writeFile(target, bytes, { flag: 'wx' });
  assert.deepEqual(await readFile(target), bytes);
  await file.delete(); assert.equal(await stat(original).then(() => true, () => false), false);
  report.downloads.push({ name: filename, suggestedFilename: file.suggestedFilename(), bytes: bytes.length, sha256: sha(bytes), originalRemoved: true });
  return { bytes, target };
}
async function journey(id, profile, initial, run) {
  const item = { id, profile, passed: false }; report.cases.push(item);
  const context = await chromium.launchPersistentContext(path.join(root, `profile-${id}`), {
    channel: 'chrome', headless: true, acceptDownloads: true, downloadsPath: path.join(root, `downloads-${id}`),
    viewport: profile === 'narrow' ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    ...(profile === 'narrow' ? { isMobile: true, hasTouch: true } : {}), timezoneId: 'Europe/Madrid',
  });
  activeContext = context; report.contextsCreated++;
  context.setDefaultTimeout(12_000);
  await context.addInitScript(({ key, raw, origin }) => {
    if (location.origin === origin && localStorage.getItem('parola-backup-fixture-seeded') !== '1') {
      localStorage.setItem(key, raw); localStorage.setItem('parola-backup-fixture-seeded', '1');
    }
  }, { key: KEY, raw: typeof initial === 'string' ? initial : JSON.stringify(initial), origin: ORIGIN });
  const page = context.pages()[0];
  page.on('pageerror', error => report.pageErrors.push(error.message));
  try {
    await page.goto(ORIGIN, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.locator('#language-select').waitFor();
    item.observations = await run(page);
    await page.screenshot({ path: path.join(output, `${id}-${profile}.png`), fullPage: true });
    item.passed = true;
  } catch (error) {
    item.error = String(error.message).slice(0, 2000);
    await page.screenshot({ path: path.join(output, `${id}-failed.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close(); report.contextsClosed++; activeContext = undefined;
  }
}

await mkdir(output, { recursive: true });
try {
  await journey('B01', 'desktop', stateA, async page => {
    await settings(page);
    const backup = await download(page, 'backup', 'B01-backup.json'); downloadedBackup = backup.target;
    const exported = JSON.parse(backup.bytes); assert.equal(exported.app, 'parola'); assert.deepEqual(parseBackup(backup.bytes.toString(), CARDS), stateA);
    await page.locator('#daily-goal').selectOption('20'); await page.locator('#preferences-form button[type="submit"]').click();
    await library(page); await page.locator('#library-search').fill('Parola backup');
    await page.locator('.collection-item summary').click(); await action(page, 'delete-card').click(); await action(page, 'confirm-delete').click();
    const changed = await raw(page); assert.equal(JSON.parse(changed).customCards.length, 0); assert.equal(JSON.parse(changed).settings.dailyGoal, 20);
    await restore(page); assert.equal(await raw(page), changed, 'File selection must not replace data before confirmation');
    await action(page, 'confirm-restore').click(); assert.deepEqual(JSON.parse(await raw(page)), stateA);
    await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(JSON.parse(await raw(page)), stateA);
    await library(page); await page.locator('#library-search').fill('Parola backup');
    assert.equal(await page.locator('.collection-item summary strong').innerText(), custom.cue.es);
    await page.locator('.collection-item summary').click();
    assert.equal(await page.locator('.collection-item b, .collection-item img, .collection-item script').count(), 0);
    assert.equal(await page.evaluate(() => window.parolaInjected), undefined);
    return { backupStateExact: true, beforeConfirmationPreserved: true, restoredAfterReload: true, escapedCustomText: true, progressRecords: Object.keys(stateA.progress).length };
  });
  await journey('B02', 'narrow', stateB, async page => {
    const before = await raw(page); await restore(page); assert.equal(await raw(page), before);
    await page.keyboard.press('Escape'); await page.locator('#restore-dialog').waitFor({ state: 'hidden' });
    assert.equal(await raw(page), before); await page.reload({ waitUntil: 'networkidle' }); assert.equal(await raw(page), before);
    await restore(page); await action(page, 'close-restore').click(); assert.equal(await raw(page), before);
    return { escapePreservedState: true, closePreservedState: true, reloadPreservedState: true };
  });
  await journey('B03', 'desktop', stateB, async page => {
    const before = await raw(page); const refused = [];
    const inconsistent = structuredClone(stateA); inconsistent.progress[CARDS[0].id].correct = 100;
    for (const [name, text] of [['malformed.json', '{not valid authored JSON'], ['future.json', JSON.stringify({ ...stateA, version: 99 })], ['inconsistent.json', JSON.stringify(inconsistent)]]) {
      await settings(page); await page.locator('#restore-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
      await page.locator('#toast.visible').filter({ hasText: 'Could not restore:' }).waitFor();
      assert.equal(await page.locator('#restore-dialog').isVisible(), false); assert.equal(await raw(page), before);
      await page.reload({ waitUntil: 'networkidle' }); assert.equal(await raw(page), before); refused.push(name);
    }
    return { refused, persistedStateUnchanged: true };
  });
  const corrupt = '{authored damaged storage <b>recover me</b>';
  await journey('B04', 'narrow', corrupt, async page => {
    await page.locator('#storage-banner').waitFor({ state: 'visible' }); assert.equal(await raw(page), corrupt);
    const recovery = await download(page, 'recover', 'B04-original-recovery.json'); assert.equal(recovery.bytes.toString(), corrupt);
    await settings(page); await page.locator('#daily-goal').selectOption('20'); await page.locator('#preferences-form button[type="submit"]').click();
    assert.equal(await raw(page), corrupt, 'Recovery mode must preserve the unreadable original');
    await restore(page); assert.equal(await raw(page), corrupt); await action(page, 'confirm-restore').click();
    assert.deepEqual(JSON.parse(await raw(page)), stateA); assert.equal(await page.locator('#storage-banner').isVisible(), false);
    await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(JSON.parse(await raw(page)), stateA);
    return { originalDownloadExact: true, unreadableOriginalPreserved: true, confirmedValidRestoreRecovered: true };
  });
  assert.deepEqual(report.pageErrors, []); assert.equal(report.contextsCreated, 4); assert.equal(report.contextsClosed, 4);
  report.status = 'passed';
} catch (error) { report.error = String(error.message).slice(0, 2000); process.exitCode = 1; }
finally {
  if (activeContext) await activeContext.close().catch(() => {});
  await writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, cases: report.cases.map(item => ({ id: item.id, passed: item.passed })), contextsClosed: report.contextsClosed }));
}
