import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReview, buildQueue, checkAnswer, createState, dayKey, getStats, normalizeAnswer, parseBackup, serializeBackup, validateState } from '../public/engine.mjs';

const at = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const card = (id, kind = 'vocabulary', language = 'fr') => ({ id, kind, language });
const vocabulary = card('fr-v-01');
const grammar = card('fr-g-01', 'grammar');

test('answer matching preserves accents and normalizes Unicode, case, spaces and punctuation', () => {
  assert.equal(normalizeAnswer('  L’EAU   est fraîche !  '), "l'eau est fraîche");
  assert.deepEqual(checkAnswer('cafe\u0301', ['café']), { correct: true, accentOnly: false });
  assert.deepEqual(checkAnswer('cafe', ['café']), { correct: false, accentOnly: true });
  assert.deepEqual(checkAnswer('  Ich   heiße Álvaro. ', ['Ich heiße Álvaro']), { correct: true, accentOnly: false });
  assert.deepEqual(checkAnswer('strasse', ['Straße']), { correct: false, accentOnly: false });
  assert.deepEqual(checkAnswer('', ['']), { correct: false, accentOnly: false });
});

test('default sources and separate state instances', () => {
  const first = createState();
  assert.deepEqual(first.settings.sources, { fr: 'es', de: 'en', it: 'es', pt: 'es' });
  first.settings.sources.fr = 'en';
  assert.equal(createState().settings.sources.fr, 'es');
});

test('mixed queue puts due cards first, alternates types and excludes scheduled cards', () => {
  const cards = [vocabulary, card('fr-v-02'), grammar, card('fr-g-02', 'grammar'), card('de-v-01', 'vocabulary', 'de')];
  let state = createState();
  state = applyReview(state, vocabulary, 'good', at(18));
  state = applyReview(state, grammar, 'good', at(18));
  state = applyReview(state, cards[1], 'easy', at(20));
  assert.deepEqual(buildQueue(cards, state, { language: 'fr', kind: 'mixed', now: at(20) }).map((item) => item.id), ['fr-v-01', 'fr-g-01', 'fr-g-02']);
  assert.deepEqual(buildQueue(cards, state, { language: 'fr', kind: 'grammar', limit: 1, now: at(20) }).map((item) => item.id), ['fr-g-01']);
  assert.equal(buildQueue(cards, state, { language: 'de', now: at(20) })[0].id, 'de-v-01');
  assert.deepEqual(buildQueue([cards[1]], state, { now: at(20) }), []);
});

test('mixed queue alternates fresh cards and respects a zero limit', () => {
  const cards = [vocabulary, card('fr-v-02'), grammar, card('fr-g-02', 'grammar')];
  assert.deepEqual(buildQueue(cards, createState()).map((item) => item.kind), ['vocabulary', 'grammar', 'vocabulary', 'grammar']);
  assert.deepEqual(buildQueue(cards, createState(), { limit: 0 }), []);
});

test('reviews are immutable, space success and schedule misses for ten minutes', () => {
  const original = createState();
  const first = applyReview(original, vocabulary, 'good', at(20));
  assert.deepEqual(original.progress, {});
  assert.deepEqual(original.days, {});
  assert.equal(first.progress[vocabulary.id].interval, 1);
  const second = applyReview(first, vocabulary, 'good', at(21));
  assert.equal(second.progress[vocabulary.id].interval, 3);
  assert.equal(first.progress[vocabulary.id].reviews, 1);
  const missed = applyReview(second, vocabulary, 'again', at(24));
  assert.equal(missed.progress[vocabulary.id].due, at(24) + 600_000);
  assert.equal(missed.progress[vocabulary.id].repetitions, 0);
  assert.equal(missed.progress[vocabulary.id].lapses, 1);
  assert.equal(missed.progress[vocabulary.id].correct, 2);
  assert.equal(missed.progress[vocabulary.id].reviews, 3);
  assert.equal(applyReview(original, vocabulary, 'easy', at(20)).progress[vocabulary.id].interval, 4);
  assert.equal(applyReview(original, vocabulary, 'hard', at(20)).progress[vocabulary.id].interval, 1);
});

test('successful early practice counts attempts without inflating spaced mastery', () => {
  let state = applyReview(createState(), vocabulary, 'easy', at(20));
  const initial = state.progress[vocabulary.id];
  for (let i = 0; i < 8; i++) state = applyReview(state, vocabulary, 'easy', at(20) + (i + 1) * 60_000);
  const early = state.progress[vocabulary.id];
  assert.equal(early.due, initial.due);
  assert.equal(early.interval, 4);
  assert.equal(early.repetitions, 1);
  assert.equal(early.reviews, 9);
  assert.equal(early.correct, 9);
  assert.equal(getStats([vocabulary], state, 'fr', at(20)).mastered, 0);
  assert.equal(getStats([vocabulary], state, 'fr', at(20)).today, 1);
  const dueReview = applyReview(state, vocabulary, 'easy', at(24));
  assert.equal(dueReview.progress[vocabulary.id].interval, 12);
  assert.equal(dueReview.progress[vocabulary.id].repetitions, 2);
  const missed = applyReview(state, vocabulary, 'again', at(20) + 10 * 60_000);
  const retried = applyReview(missed, vocabulary, 'good', at(20) + 11 * 60_000);
  assert.equal(retried.progress[vocabulary.id].interval, 1);
  assert.equal(retried.progress[vocabulary.id].repetitions, 1);
  assert.equal(retried.progress[vocabulary.id].lapses, 1);
  assert.deepEqual(validateState(retried), retried);
});

test('daily habit counts unique cards across languages, snapshots the goal, and rolls over locally', () => {
  let state = createState();
  state.settings.dailyGoal = 2;
  state = applyReview(state, vocabulary, 'again', at(19, 23));
  state = applyReview(state, vocabulary, 'good', at(19, 23) + 60_000);
  assert.equal(getStats([vocabulary], state, 'fr', at(19, 23)).today, 1);
  const german = card('de-v-01', 'vocabulary', 'de');
  state = applyReview(state, german, 'good', at(19, 23));
  state.settings.dailyGoal = 10;
  assert.equal(getStats([vocabulary, german], state, 'fr', at(19, 23)).goal, 2);
  let stats = getStats([vocabulary, german], state, 'fr', at(20, 0));
  assert.equal(stats.today, 0);
  assert.equal(stats.streak, 1);
  assert.equal(stats.totalReviews, 2);
  assert.equal(stats.accuracy, 50);
  assert.equal(stats.week.at(-2).count, 2);
  assert.equal(stats.week.at(-1).count, 0);
  stats = getStats([vocabulary, german], state, 'fr', at(21));
  assert.equal(stats.streak, 0);
  assert.equal(dayKey(new Date(2026, 9, 20, 0, 1)), '2026-10-20');
});

test('streak survives consecutive completed days and falls after a missed day', () => {
  let state = createState();
  state.settings.dailyGoal = 1;
  for (const day of [18, 19, 20]) state = applyReview(state, vocabulary, 'good', at(day));
  assert.equal(getStats([vocabulary], state, 'fr', at(20)).streak, 3);
  assert.equal(getStats([vocabulary], state, 'fr', at(21)).streak, 3);
  assert.equal(getStats([vocabulary], state, 'fr', at(22)).streak, 0);
});

test('a backup round trip preserves scheduling and safely copies custom cards', () => {
  const custom = {
    id: 'custom-123', language: 'pt', kind: 'grammar', topic: 'My structures', level: 'A1',
    cue: { en: 'I am here.', es: 'Estoy aquí.' }, answers: ['Estou aqui.'],
    note: { en: '', es: '' }, example: { target: '', en: '', es: '' },
  };
  let state = createState();
  state.customCards.push(custom);
  state = applyReview(state, custom, 'easy', at(20));
  const restored = parseBackup(serializeBackup(state), [vocabulary]);
  assert.deepEqual(restored, state);
  assert.deepEqual(parseBackup(JSON.stringify({ ...state, app: 'parola' })), state);
  restored.customCards[0].answers.push('Aqui estou.');
  assert.equal(state.customCards[0].answers.length, 1);
  assert.equal(getStats(restored.customCards, restored, 'pt', at(24)).due, 1);
});

test('restore rejects malformed, oversized and unsafe input without mutating an existing state', () => {
  const state = createState();
  assert.throws(() => parseBackup('{bad json'), /valid JSON/u);
  assert.throws(() => validateState({ ...state, version: 2 }), /unsupported version/u);
  assert.throws(() => validateState({ ...state, settings: { ...state.settings, dailyGoal: 0 } }), /Daily goal/u);
  assert.throws(() => validateState({ ...state, settings: { ...state.settings, reminderTime: '24:00' } }), /reminder time/u);
  assert.throws(() => validateState({ ...state, customCards: Array(501).fill({}) }), /500 custom/u);
  assert.throws(() => parseBackup(JSON.stringify({ ...state, progress: { constructor: {} } })), /card ID/u);
  assert.throws(() => validateState({ ...state, days: { '2026-02-30': { cards: [], reviews: 0, correct: 0 } } }), /practice date/u);
  const reviewed = applyReview(state, vocabulary, 'good', at(20));
  reviewed.progress[vocabulary.id].correct = 5;
  assert.throws(() => validateState(reviewed), /Inconsistent card progress/u);
  assert.deepEqual(state.progress, {});
});
