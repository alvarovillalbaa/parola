import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { CARDS, LANGUAGES } from '../public/data.mjs';
import { createState, validateState, buildQueue, applyReview, serializeBackup, parseBackup } from '../public/engine.mjs';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('public/', root);
for (const name of await readdir(publicRoot)) {
  if (/\.(mjs|js)$/.test(name)) execFileSync(process.execPath, ['--check', new URL(name, publicRoot).pathname]);
}
const html = await readFile(new URL('index.html', publicRoot), 'utf8');
const css = await readFile(new URL('styles.css', publicRoot), 'utf8');
const app = await readFile(new URL('app.mjs', publicRoot), 'utf8');
const sw = await readFile(new URL('sw.js', publicRoot), 'utf8');
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', publicRoot), 'utf8'));
const config = JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
const assets = JSON.parse(sw.match(/const ASSETS = (\[[^;]+\])/)[1].replaceAll("'", '"'));
for (const asset of assets) assert.ok((await stat(new URL(asset === '/' ? 'index.html' : asset.slice(1), publicRoot))).isFile(), `Missing offline asset: ${asset}`);
for (const match of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)) assert.ok((await stat(new URL(match[1].slice(1), publicRoot))).isFile());
for (const match of css.matchAll(/@import url\('([^']+)'\)/g)) assert.ok(assets.includes(match[1]), `CSS dependency missing from offline cache: ${match[1]}`);
for (const match of app.matchAll(/from '\.\/([^']+)'/g)) assert.ok(assets.includes(`/${match[1]}`), `Module missing from offline cache: ${match[1]}`);
assert.equal(config.outputDirectory, 'public');
assert.equal(config.framework, null);
assert.equal(manifest.start_url, '/');
assert.equal(manifest.display, 'standalone');
assert.ok(!app.includes('style="'), 'Use external styles for CSP compatibility');
for (const lang of LANGUAGES) {
  for (const source of ['en', 'es']) {
    let state = createState();
    state.settings.language = lang.id;
    state.settings.sources[lang.id] = source;
    const queue = buildQueue(CARDS, state, {language:lang.id, limit:10});
    assert.equal(queue.length, 10);
    assert.ok(queue.some(card=>card.kind==='grammar') && queue.some(card=>card.kind==='vocabulary'));
    for (const card of queue) {
      assert.ok(card.cue[source]);
      state = applyReview(state, card, 'good');
    }
    assert.deepEqual(parseBackup(serializeBackup(state), CARDS), validateState(state, CARDS));
  }
}
console.log(`Syntax, static assets, offline cache, CSP, and all ${LANGUAGES.length * 2} course paths passed (${CARDS.length} cards).`);
