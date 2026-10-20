import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { CARDS, LANGUAGES } from '../public/data.mjs';
import * as engine from '../public/engine.mjs';

const appSource = (await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8'))
  .replace(/^import .+;\n/gmu, '');
const STORAGE_KEY = 'parola-state-v1';
const decode = (text) => text.replace(/&(amp|lt|gt|quot|#39);/gu, (_, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[name]));

// This harness exercises application JavaScript and real learning data. It does
// not emulate layout, native form validation, dialogs, or browser permissions.
function createApp(initialStorage) {
  const listeners = { document: new Map(), window: new Map() };
  const storage = new Map(initialStorage ? [[STORAGE_KEY, initialStorage]] : []);
  const downloads = [];
  const nodes = new Map();
  const element = () => ({
    value: '', textContent: '', hidden: false, innerHTML: '',
    focus() {}, classList: { add() {}, remove() {} },
    showModal() { this.open = true; }, close() { this.open = false; },
  });
  for (const id of ['#toast', '#main', '#card-dialog', '#restore-dialog', '#custom-error', '#storage-banner', '#library-results']) nodes.set(id, element());
  const app = element();
  let html = '';
  Object.defineProperty(app, 'innerHTML', {
    get: () => html,
    set(value) {
      html = value;
      const input = html.match(/<input id="answer"[^>]*value="([^"]*)"[^>]*>/u);
      if (input) {
        const answer = element();
        answer.value = decode(input[1]);
        answer.selectionStart = answer.selectionEnd = answer.value.length;
        answer.setRangeText = function (text, start, end) {
          this.value = this.value.slice(0, start) + text + this.value.slice(end);
          this.selectionStart = this.selectionEnd = start + text.length;
        };
        nodes.set('#answer', answer);
      } else nodes.delete('#answer');
    },
  });
  nodes.set('#app', app);
  const on = (surface, type, listener) => {
    const list = listeners[surface].get(type) ?? [];
    list.push(listener);
    listeners[surface].set(type, list);
  };
  const location = { hash: '#today', origin: 'https://parola.example' };
  const context = vm.createContext({
    CARDS, LANGUAGES, ...engine, Date,
    document: {
      hidden: false,
      querySelector: (selector) => nodes.get(selector) ?? null,
      addEventListener: (type, listener) => on('document', type, listener),
      createElement: () => ({ click() {} }),
    },
    window: { addEventListener: (type, listener) => on('window', type, listener), scrollTo() {} },
    location,
    history: { replaceState(_state, _title, hash) { location.hash = hash; } },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    crypto: { randomUUID: () => '12345678-1234-4234-8234-123456789012' },
    Blob,
    URL: { createObjectURL: (blob) => { downloads.push(blob); return `blob:${downloads.length}`; }, revokeObjectURL() {} },
    FormData: class { constructor(form) { this.values = form.values; } get(key) { return this.values[key] ?? ''; } },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1,
    makeCalendar: () => '', installServiceWorker: async () => {},
    requestNotifications: async () => ({ status: 'granted', message: 'Enabled' }),
    sendTestNotification: async () => ({ message: 'Sent' }), maybeNotify: async () => {},
  });
  vm.runInContext(appSource, context, { filename: 'app.mjs' });
  const read = (expression) => vm.runInContext(expression, context);
  const emit = async (surface, type, event) => {
    for (const handler of listeners[surface].get(type) ?? []) await handler(event);
  };
  const click = async (action, extra = {}) => {
    const button = { dataset: { action, ...extra } };
    await emit('document', 'click', { target: { closest: (selector) => selector === '[data-action]' ? button : null }, preventDefault() {} });
  };
  const submit = async (id, values = {}) => emit('document', 'submit', { target: { id, values }, preventDefault() {} });
  const change = async (id, value) => emit('document', 'change', { target: { id, value } });
  return { read, emit, click, submit, change, html: () => html, nodes, storage, downloads };
}

test('typed correct answers require a grade, save once, and survive a new visit', async () => {
  const app = createApp();
  await app.click('start', { kind: 'mixed' });
  const id = app.read('session.cards[0].id');
  const answer = app.read('session.cards[0].answers[0]');
  assert.equal(app.read('session.source'), 'es');
  assert.equal(app.read('session.feedback'), null);
  assert.equal(app.html().includes('class="correct-answer"'), false);
  app.nodes.get('#answer').value = answer;
  await app.submit('answer-form');
  assert.equal(app.read('session.feedback.correct'), true);
  assert.equal(app.read('Object.keys(state.progress).length'), 0);
  await app.click('next', { grade: 'good' });
  const saved = JSON.parse(app.storage.get(STORAGE_KEY));
  assert.equal(saved.progress[id].reviews, 1);
  assert.equal(saved.progress[id].correct, 1);
  assert.equal(app.read('session.index'), 1);
  const revisit = createApp(app.storage.get(STORAGE_KEY));
  assert.equal(revisit.read(`state.progress[${JSON.stringify(id)}].reviews`), 1);
  assert.equal(revisit.read('stats().today'), 1);
});

test('misses persist immediately, reappear once, and continue does not double-count', async () => {
  const app = createApp();
  await app.click('start', { kind: 'vocabulary' });
  const id = app.read('session.cards[0].id');
  app.nodes.get('#answer').value = 'an incorrect answer';
  await app.submit('answer-form');
  assert.equal(app.read('session.feedback.correct'), false);
  assert.equal(app.read('session.cards.length'), 11);
  assert.equal(JSON.parse(app.storage.get(STORAGE_KEY)).progress[id].reviews, 1);
  await app.click('next', { grade: 'again' });
  assert.equal(app.read(`state.progress[${JSON.stringify(id)}].reviews`), 1);
  app.read('session.index = session.cards.length - 1; render()');
  await app.click('reveal');
  assert.equal(app.read('session.cards.length'), 11);
  assert.equal(app.read(`state.progress[${JSON.stringify(id)}].reviews`), 2);
  assert.equal(app.read('stats().today'), 1);
});

test('unsubmitted drafts and accent insertion survive leaving and resuming practice', async () => {
  const app = createApp();
  await app.click('start', { kind: 'mixed' });
  const input = app.nodes.get('#answer');
  input.value = 'caf';
  await app.emit('document', 'input', { target: { id: 'answer', value: input.value } });
  await app.click('leave-session');
  await app.click('start', { kind: 'mixed' });
  assert.equal(app.nodes.get('#answer').value, 'caf');
  await app.click('accent', { char: 'é' });
  assert.equal(app.nodes.get('#answer').value, 'café');
  await app.click('leave-session');
  await app.click('start', { kind: 'mixed' });
  assert.equal(app.nodes.get('#answer').value, 'café');
  assert.equal(app.read('session.index'), 0);
  assert.equal(app.read('session.feedback'), null);
});

test('language defaults and source changes reach subsequent recall prompts', async () => {
  const app = createApp();
  await app.change('language-select', 'de');
  await app.click('start', { kind: 'grammar' });
  assert.equal(app.read('session.language'), 'de');
  assert.equal(app.read('session.source'), 'en');
  await app.submit('preferences-form', { dailyGoal: '15', 'source-fr': 'en', 'source-de': 'es', 'source-it': 'es', 'source-pt': 'en' });
  assert.equal(app.read('session'), null);
  await app.click('start', { kind: 'grammar' });
  assert.equal(app.read('session.source'), 'es');
  const cue = app.read('session.cards[0].cue.es');
  assert.equal(app.html().includes(cue.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;')), true);
  assert.equal(JSON.parse(app.storage.get(STORAGE_KEY)).settings.sources.de, 'es');
});

test('custom cards render escaped content and restore through the app export format', async () => {
  const app = createApp();
  await app.submit('custom-card-form', {
    language: 'fr', kind: 'vocabulary', es: '<img src=x onerror=alert(1)>',
    en: 'An example <word>', answer: 'la réponse', alternatives: 'une réponse; la réponse', note: 'A <script>note</script>',
  });
  assert.equal(app.read('state.customCards.length'), 1);
  assert.equal(app.read('state.customCards[0].answers.length'), 2);
  app.read("navigate('library')");
  assert.equal(app.html().includes('<img src=x onerror=alert(1)>'), false);
  assert.equal(app.html().includes('&lt;img src=x onerror=alert(1)&gt;'), true);
  await app.click('backup');
  const backup = await app.downloads.at(-1).text();
  assert.equal(JSON.parse(backup).app, 'parola');
  assert.equal(JSON.parse(backup).state.customCards.length, 1);
  const fresh = createApp();
  const fileInput = { id: 'restore-file', files: [{ size: backup.length, text: async () => backup }], value: 'backup.json' };
  await fresh.emit('document', 'change', { target: fileInput });
  assert.equal(fresh.read('state.customCards.length'), 0);
  assert.equal(fresh.read('pendingRestore.customCards.length'), 1);
  await fresh.click('confirm-restore');
  assert.equal(fresh.read('state.customCards.length'), 1);
  assert.equal(JSON.parse(fresh.storage.get(STORAGE_KEY)).customCards.length, 1);
});

test('invalid saved data stays untouched during practice, then explicit restore recovers saving', async () => {
  const original = '{broken';
  const app = createApp(original);
  assert.equal(app.read('preserveStorage'), true);
  await app.click('start', { kind: 'mixed' });
  await app.click('reveal');
  assert.equal(app.storage.get(STORAGE_KEY), original);
  const backup = engine.serializeBackup(engine.createState());
  await app.emit('document', 'change', { target: { id: 'restore-file', files: [{ size: backup.length, text: async () => backup }], value: '' } });
  await app.click('confirm-restore');
  assert.equal(app.read('preserveStorage'), false);
  assert.equal(JSON.parse(app.storage.get(STORAGE_KEY)).version, 1);
});

test('malformed restore files show an error and preserve saved progress', async () => {
  const app = createApp();
  await app.click('start', { kind: 'mixed' });
  await app.click('reveal');
  const saved = app.storage.get(STORAGE_KEY);
  const reviews = app.read('Object.keys(state.progress).length');
  for (const invalid of ['{bad', JSON.stringify({ version: 2 })]) {
    await app.emit('document', 'change', { target: { id: 'restore-file', files: [{ size: invalid.length, text: async () => invalid }], value: '' } });
    assert.equal(app.read('pendingRestore'), null);
    assert.equal(app.nodes.get('#restore-dialog').open ?? false, false);
    assert.equal(app.storage.get(STORAGE_KEY), saved);
    assert.equal(app.read('Object.keys(state.progress).length'), reviews);
    assert.match(app.nodes.get('#toast').textContent, /Could not restore/u);
  }
});

test('caught-up practice requires an explicit extra-practice action', async () => {
  const state = engine.createState();
  const time = Date.now();
  let reviewed = state;
  for (const card of CARDS.filter((item) => item.language === 'fr')) reviewed = engine.applyReview(reviewed, card, 'easy', time);
  const app = createApp(JSON.stringify(reviewed));
  await app.click('start', { kind: 'mixed' });
  assert.equal(app.read('session.caughtUp'), true);
  assert.equal(app.nodes.has('#answer'), false);
  await app.click('extra', { kind: 'mixed' });
  assert.equal(app.read('session.extra'), true);
  assert.equal(app.read('session.cards.length'), 10);
  assert.equal(app.nodes.has('#answer'), true);
});
