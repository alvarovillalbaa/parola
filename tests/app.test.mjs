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
// not emulate layout, native form validation, or browser permissions. Dialog
// methods and cancel's default closure are event-flow fixtures, not browser proof.
function createApp(initialStorage) {
  const listeners = { document: new Map(), window: new Map() };
  const storage = new Map(initialStorage ? [[STORAGE_KEY, initialStorage]] : []);
  const downloads = [];
  const nodes = new Map();
  const element = () => {
    const handlers = new Map();
    return {
      value: '', textContent: '', hidden: false, innerHTML: '', open: false,
      focus() {}, classList: { add() {}, remove() {} },
      showModal() { this.open = true; }, close() { this.open = false; },
      addEventListener(type, handler) {
        const list = handlers.get(type) ?? [];
        list.push(handler); handlers.set(type, list);
      },
      async emit(type) {
        const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
        for (const handler of handlers.get(type) ?? []) await handler(event);
        if (type === 'cancel' && !event.defaultPrevented) this.close();
      },
    };
  };
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

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function restoreFile(app, content, size) {
  const files = content === null ? [] : [{
    size: size ?? (typeof content === 'string' ? Buffer.byteLength(content) : 1),
    text: typeof content === 'function' ? content : async () => content,
  }];
  return app.emit('document', 'change', { target: { id: 'restore-file', files, value: 'practice.json' } });
}

function backupWithGoal(goal) {
  const state = engine.createState();
  state.settings.dailyGoal = goal;
  return engine.serializeBackup(state);
}

async function completeRead(read, job, outcome, goal = 5) {
  if (outcome === 'success') read.resolve(backupWithGoal(goal));
  else read.reject(new Error('An older file could not be read.'));
  await job;
}

const assertNoRestore = (app) => {
  assert.equal(app.read('pendingRestore'), null);
  assert.equal(app.nodes.get('#restore-dialog').open, false);
};

for (const oldOutcome of ['success', 'failure']) {
  for (const order of ['older first', 'newer first']) {
    test(`newest valid backup owns the preview and confirmation: old ${oldOutcome}, ${order}`, async () => {
      const app = createApp();
      const older = deferred(), newer = deferred();
      const first = restoreFile(app, () => older.promise);
      const second = restoreFile(app, () => newer.promise);
      const toast = app.nodes.get('#toast').textContent;
      if (order === 'older first') {
        await completeRead(older, first, oldOutcome);
        assertNoRestore(app);
        assert.equal(app.nodes.get('#toast').textContent, toast);
      }
      newer.resolve(backupWithGoal(15)); await second;
      assert.equal(app.read('pendingRestore.settings.dailyGoal'), 15);
      assert.equal(app.nodes.get('#restore-dialog').open, true);
      if (order === 'newer first') await completeRead(older, first, oldOutcome);
      assert.equal(app.read('pendingRestore.settings.dailyGoal'), 15);
      assert.equal(app.nodes.get('#restore-dialog').open, true);
      assert.equal(app.nodes.get('#toast').textContent, toast);
      assert.equal(app.read('state.settings.dailyGoal'), 10);
      assert.equal(app.storage.get(STORAGE_KEY), undefined);
      await app.click('confirm-restore');
      assert.equal(app.read('state.settings.dailyGoal'), 15);
      assert.equal(JSON.parse(app.storage.get(STORAGE_KEY)).settings.dailyGoal, 15);
      assertNoRestore(app);
    });

    test(`newest read failure stays authoritative: old ${oldOutcome}, ${order}`, async () => {
      const app = createApp();
      const older = deferred(), newer = deferred();
      const first = restoreFile(app, () => older.promise);
      const second = restoreFile(app, () => newer.promise);
      if (order === 'older first') {
        await completeRead(older, first, oldOutcome);
        assertNoRestore(app);
      }
      newer.reject(new Error('The newest file could not be read.')); await second;
      assertNoRestore(app);
      assert.match(app.nodes.get('#toast').textContent, /The newest file could not be read/u);
      const toast = app.nodes.get('#toast').textContent;
      if (order === 'newer first') await completeRead(older, first, oldOutcome);
      assertNoRestore(app);
      assert.equal(app.nodes.get('#toast').textContent, toast);
      assert.equal(app.read('state.settings.dailyGoal'), 10);
      assert.equal(app.storage.get(STORAGE_KEY), undefined);
    });
  }
}

test('a late malformed older file cannot clear the newer valid preview', async () => {
  const app = createApp();
  const older = deferred();
  const first = restoreFile(app, () => older.promise);
  await restoreFile(app, backupWithGoal(15));
  const toast = app.nodes.get('#toast').textContent;
  older.resolve('{not JSON'); await first;
  assert.equal(app.read('pendingRestore.settings.dailyGoal'), 15);
  assert.equal(app.nodes.get('#restore-dialog').open, true);
  assert.equal(app.nodes.get('#toast').textContent, toast);
});

test('a new pending read immediately removes the prior preview and makes its confirmation inert', async () => {
  const app = createApp();
  await restoreFile(app, backupWithGoal(5));
  const newer = deferred();
  const second = restoreFile(app, () => newer.promise);
  assertNoRestore(app);
  await app.click('confirm-restore');
  assert.equal(app.read('state.settings.dailyGoal'), 10);
  assert.equal(app.storage.get(STORAGE_KEY), undefined);
  newer.resolve(backupWithGoal(15)); await second;
  await app.click('confirm-restore');
  assert.equal(JSON.parse(app.storage.get(STORAGE_KEY)).settings.dailyGoal, 15);
});

for (const selection of ['empty', 'oversized', 'malformed']) {
  for (const earlier of ['pending read', 'ready preview']) {
    test(`${selection} selection invalidates an earlier ${earlier}`, async () => {
      const app = createApp();
      const older = deferred();
      const first = earlier === 'pending read' ? restoreFile(app, () => older.promise) : null;
      if (!first) await restoreFile(app, backupWithGoal(5));
      if (selection === 'empty') await restoreFile(app, null);
      if (selection === 'oversized') {
        let read = false;
        await restoreFile(app, () => { read = true; return Promise.resolve(backupWithGoal(15)); }, 5 * 1024 * 1024 + 1);
        assert.equal(read, false);
        assert.match(app.nodes.get('#toast').textContent, /too large/u);
      }
      if (selection === 'malformed') {
        await restoreFile(app, '{not JSON');
        assert.match(app.nodes.get('#toast').textContent, /Could not restore/u);
      }
      assertNoRestore(app);
      const toast = app.nodes.get('#toast').textContent;
      if (first) { older.resolve(backupWithGoal(5)); await first; }
      assertNoRestore(app);
      assert.equal(app.nodes.get('#toast').textContent, toast);
      await app.click('confirm-restore');
      assert.equal(app.read('state.settings.dailyGoal'), 10);
      assert.equal(app.storage.get(STORAGE_KEY), undefined);
    });
  }
}

const invalidators = {
  'explicit close': async (app) => app.click('close-restore'),
  'Escape cancel': async (app) => app.nodes.get('#restore-dialog').emit('cancel'),
  'in-app navigation': async (app) => app.read("navigate('library')"),
  'hash navigation': async (app) => {
    app.read("location.hash = '#settings'");
    await app.emit('window', 'hashchange', {});
  },
  'page departure': async (app) => app.emit('window', 'pagehide', { persisted: true }),
  'cross-tab progress': async (app) => {
    const next = engine.createState(); next.settings.dailyGoal = 20;
    const raw = JSON.stringify(next);
    app.storage.set(STORAGE_KEY, raw);
    await app.emit('window', 'storage', { key: STORAGE_KEY, newValue: raw });
  },
  'unreadable cross-tab progress': async (app) => {
    app.storage.set(STORAGE_KEY, '{broken');
    await app.emit('window', 'storage', { key: STORAGE_KEY, newValue: '{broken' });
  },
  'personal-card deletion preview': async (app) => app.click('delete-card', { id: app.read('state.customCards[0].id') }),
};

for (const [name, invalidate] of Object.entries(invalidators)) {
  for (const outcome of ['success', 'failure']) {
    test(`${name} invalidates a pending ${outcome} without altering the new context`, async () => {
      const app = createApp();
      if (name === 'personal-card deletion preview') {
        await app.submit('custom-card-form', { language: 'fr', kind: 'vocabulary', es: 'mi palabra', en: 'my word', answer: 'mon mot', alternatives: '', note: '' });
      }
      const older = deferred();
      const first = restoreFile(app, () => older.promise);
      await invalidate(app);
      const context = {
        state: app.read('JSON.stringify(state)'),
        storage: app.storage.get(STORAGE_KEY),
        toast: app.nodes.get('#toast').textContent,
        dialog: app.nodes.get('#restore-dialog').innerHTML,
        open: app.nodes.get('#restore-dialog').open,
      };
      await completeRead(older, first, outcome);
      assert.equal(app.read('pendingRestore'), null);
      assert.equal(app.read('JSON.stringify(state)'), context.state);
      assert.equal(app.storage.get(STORAGE_KEY), context.storage);
      assert.equal(app.nodes.get('#toast').textContent, context.toast);
      assert.equal(app.nodes.get('#restore-dialog').innerHTML, context.dialog);
      assert.equal(app.nodes.get('#restore-dialog').open, context.open);
      await app.click('confirm-restore');
      assert.equal(app.read('JSON.stringify(state)'), context.state);
      assert.equal(app.storage.get(STORAGE_KEY), context.storage);
      if (name === 'personal-card deletion preview') {
        assert.match(context.dialog, /Remove this item/u);
        await app.click('confirm-delete', { id: app.read('state.customCards[0].id') });
        assert.equal(app.read('state.customCards.length'), 0);
        assert.equal(app.nodes.get('#restore-dialog').open, false);
      }
    });
  }
}

test('Escape discards an already displayed candidate before native default closure', async () => {
  const app = createApp();
  await restoreFile(app, backupWithGoal(5));
  await app.nodes.get('#restore-dialog').emit('cancel');
  assertNoRestore(app);
  await app.click('confirm-restore');
  assert.equal(app.read('state.settings.dailyGoal'), 10);
  assert.equal(app.storage.get(STORAGE_KEY), undefined);
});

test('a deletion preview cannot retain an already displayed restore candidate', async () => {
  const app = createApp();
  await app.submit('custom-card-form', { language: 'fr', kind: 'vocabulary', es: 'mi palabra', en: 'my word', answer: 'mon mot', alternatives: '', note: '' });
  const saved = app.storage.get(STORAGE_KEY);
  const id = app.read('state.customCards[0].id');
  await restoreFile(app, backupWithGoal(5));
  await app.click('delete-card', { id });
  assert.equal(app.read('pendingRestore'), null);
  assert.match(app.nodes.get('#restore-dialog').innerHTML, /Remove this item/u);
  await app.click('confirm-restore');
  assert.equal(app.storage.get(STORAGE_KEY), saved);
  await app.click('confirm-delete', { id });
  assert.equal(app.read('state.customCards.length'), 0);
});

test('an already closed dialog cannot apply its retained candidate', async () => {
  const app = createApp();
  await restoreFile(app, backupWithGoal(5));
  app.nodes.get('#restore-dialog').close();
  await app.click('confirm-restore');
  assert.equal(app.read('state.settings.dailyGoal'), 10);
  assert.equal(app.storage.get(STORAGE_KEY), undefined);
});

test('reselecting A after B gives the latest A its own confirmation', async () => {
  const app = createApp();
  const olderA = deferred(), betweenB = deferred(), newestA = deferred();
  const first = restoreFile(app, () => olderA.promise);
  const second = restoreFile(app, () => betweenB.promise);
  const third = restoreFile(app, () => newestA.promise);
  newestA.resolve(backupWithGoal(5)); await third;
  betweenB.resolve(backupWithGoal(15)); await second;
  olderA.reject(new Error('Original A failed.')); await first;
  assert.equal(app.read('pendingRestore.settings.dailyGoal'), 5);
  await app.click('confirm-restore');
  assert.equal(JSON.parse(app.storage.get(STORAGE_KEY)).settings.dailyGoal, 5);
  assertNoRestore(app);
});
