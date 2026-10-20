import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, LANGUAGES } from '../public/data.mjs';

test('the four language courses use the requested default cue languages and locales', () => {
  assert.deepEqual(LANGUAGES.map(({ id, defaultSource }) => [id, defaultSource]), [
    ['fr', 'es'], ['de', 'en'], ['it', 'es'], ['pt', 'es'],
  ]);
  assert.equal(LANGUAGES.find(({ id }) => id === 'pt').locale, 'pt-PT');
  assert.match(LANGUAGES.find(({ id }) => id === 'pt').nativeName, /europeu/);
  for (const language of LANGUAGES) {
    for (const key of ['id', 'name', 'nativeName', 'locale', 'greeting', 'color']) {
      assert.equal(typeof language[key], 'string');
      assert.ok(language[key].trim(), `${language.id}: ${key} is blank`);
    }
  }
});

test('every course has 32 vocabulary cards and 18 structures with stable, unique IDs', () => {
  assert.equal(CARDS.length, 200);
  assert.equal(new Set(CARDS.map(({ id }) => id)).size, CARDS.length);
  for (const { id } of LANGUAGES) {
    for (const [kind, prefix, count] of [['vocabulary', 'v', 32], ['grammar', 'g', 18]]) {
      const cards = CARDS.filter((card) => card.language === id && card.kind === kind);
      assert.equal(cards.length, count, `${id}: ${kind} count`);
      assert.deepEqual(cards.map((card) => card.id), Array.from({ length: count }, (_, i) => `${id}-${prefix}-${String(i + 1).padStart(2, '0')}`));
    }
  }
});

test('all cards can be practised from either source language with an answer, explanation, and translated example', () => {
  const languageIds = new Set(LANGUAGES.map(({ id }) => id));
  function nonblank(value, label) {
    assert.equal(typeof value, 'string', `${label} must be text`);
    assert.ok(value.trim().length > 0, `${label} is blank`);
    assert.equal(value, value.trim(), `${label} has surrounding whitespace`);
  }
  for (const card of CARDS) {
    assert.ok(languageIds.has(card.language), `${card.id}: unknown language`);
    assert.ok(['vocabulary', 'grammar'].includes(card.kind), `${card.id}: unknown kind`);
    assert.ok(['A1', 'A2'].includes(card.level), `${card.id}: unknown level`);
    nonblank(card.topic, `${card.id}: topic`);
    for (const source of ['en', 'es']) {
      nonblank(card.cue[source], `${card.id}: ${source} cue`);
      nonblank(card.note[source], `${card.id}: ${source} note`);
      nonblank(card.example[source], `${card.id}: ${source} example`);
    }
    nonblank(card.example.target, `${card.id}: target example`);
    assert.ok(Array.isArray(card.answers) && card.answers.length > 0, `${card.id}: no answers`);
    for (const answer of card.answers) nonblank(answer, `${card.id}: answer`);
    assert.equal(new Set(card.answers).size, card.answers.length, `${card.id}: duplicate answer`);
  }
});

test('grammar practice includes A1 foundations, A2 structures, and constrained retrieval prompts', () => {
  for (const { id } of LANGUAGES) {
    const grammar = CARDS.filter((card) => card.language === id && card.kind === 'grammar');
    assert.ok(grammar.filter(({ level }) => level === 'A1').length >= 8, `${id}: missing A1 coverage`);
    assert.ok(grammar.filter(({ level }) => level === 'A2').length >= 6, `${id}: missing A2 coverage`);
    assert.ok(new Set(grammar.map(({ topic }) => topic)).size >= 12, `${id}: structures lack variety`);
    for (const card of grammar) {
      for (const source of ['en', 'es']) {
        assert.ok(/___|Je parle français\.|weil \/ ich \/ bin \/ müde/.test(card.cue[source]), `${card.id}: ${source} prompt is unconstrained`);
      }
    }
  }
});

test('noun cards teach articles and German noun capitalization, while Portuguese uses Portugal vocabulary', () => {
  const articlePatterns = { fr: /^(?:le |la |l')/, de: /^(?:der |die |das )[A-ZÄÖÜ]/, it: /^(?:il |la |l')/, pt: /^(?:o |a )/ };
  for (const card of CARDS.filter(({ kind, cue }) => kind === 'vocabulary' && /definite article/.test(cue.en))) {
    assert.match(card.answers[0], articlePatterns[card.language], `${card.id}: missing article or noun capitalization`);
  }
  assert.ok(CARDS.some(({ language, answers }) => language === 'pt' && answers.includes('o comboio')));
  assert.ok(CARDS.some(({ language, example }) => language === 'pt' && example.target === 'Estou a trabalhar.'));
});
