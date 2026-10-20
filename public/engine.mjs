const DAY = 86_400_000;
const LANGUAGES = ['fr', 'de', 'it', 'pt'];
const KINDS = ['vocabulary', 'grammar'];
const GRADES = ['again', 'hard', 'good', 'easy'];
const SOURCES = ['es', 'en'];
const MAX_TIMESTAMP = 8_640_000_000_000_000;

export function createState() {
  return {
    version: 1,
    settings: {
      language: 'fr',
      sources: { fr: 'es', de: 'en', it: 'es', pt: 'es' },
      dailyGoal: 10,
      reminderTime: '19:00',
      browserReminders: false,
    },
    progress: {},
    days: {},
    customCards: [],
  };
}

export function normalizeAnswer(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc\uff07]/gu, "'")
    .trim()
    .replace(/\s+/gu, ' ')
    .replace(/[\p{P}\s]+$/gu, '')
    .trim();
}

function withoutAccents(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '');
}

export function checkAnswer(input, answers) {
  const answer = normalizeAnswer(input);
  const accepted = (Array.isArray(answers) ? answers : []).map(normalizeAnswer);
  const correct = answer.length > 0 && accepted.includes(answer);
  return {
    correct,
    accentOnly: !correct && answer.length > 0
      && accepted.some((item) => withoutAccents(item) === withoutAccents(answer)),
  };
}

function timestamp(now = Date.now()) {
  const value = now instanceof Date ? now.getTime() : now;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_TIMESTAMP) {
    throw new Error('Invalid date.');
  }
  return value;
}

export function dayKey(now = Date.now()) {
  const date = new Date(timestamp(now));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function previousDay(key) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

function alternate(cards, firstKind) {
  const groups = {
    vocabulary: cards.filter((card) => card.kind === 'vocabulary'),
    grammar: cards.filter((card) => card.kind === 'grammar'),
  };
  const result = [];
  let nextKind = firstKind ?? cards[0]?.kind ?? 'vocabulary';
  let vocabularyIndex = 0;
  let grammarIndex = 0;
  while (result.length < cards.length) {
    if (nextKind === 'vocabulary' && vocabularyIndex < groups.vocabulary.length) {
      result.push(groups.vocabulary[vocabularyIndex++]);
      nextKind = 'grammar';
    } else if (grammarIndex < groups.grammar.length) {
      result.push(groups.grammar[grammarIndex++]);
      nextKind = 'vocabulary';
    } else if (vocabularyIndex < groups.vocabulary.length) {
      result.push(groups.vocabulary[vocabularyIndex++]);
      nextKind = 'grammar';
    } else {
      break;
    }
  }
  return result;
}

export function buildQueue(cards, state, options = {}) {
  const {
    language = state.settings.language,
    kind = 'mixed',
    limit = 10,
    now = Date.now(),
  } = options;
  const time = timestamp(now);
  if (!LANGUAGES.includes(language) || !['mixed', ...KINDS].includes(kind)) {
    throw new Error('Choose a supported language and practice type.');
  }
  if (!Number.isInteger(limit) || limit < 0 || limit > 500) {
    throw new Error('Practice length must be between 0 and 500 cards.');
  }
  const available = cards.filter((card) => card.language === language
    && (kind === 'mixed' || card.kind === kind));
  const due = available.filter((card) => state.progress[card.id]?.due <= time)
    .sort((a, b) => state.progress[a.id].due - state.progress[b.id].due);
  const fresh = available.filter((card) => !Object.hasOwn(state.progress, card.id));
  if (kind !== 'mixed') return [...due, ...fresh].slice(0, limit);
  const orderedDue = alternate(due);
  const nextKind = orderedDue.at(-1)?.kind === 'vocabulary' ? 'grammar'
    : orderedDue.length ? 'vocabulary' : undefined;
  return [...orderedDue, ...alternate(fresh, nextKind)].slice(0, limit);
}

export function applyReview(state, card, grade, now = Date.now()) {
  if (!GRADES.includes(grade)) throw new Error('Invalid review grade.');
  if (!card || !validId(card.id)) throw new Error('Invalid practice card.');
  const time = timestamp(now);
  const old = state.progress[card.id] ?? {
    due: time, interval: 0, repetitions: 0, lapses: 0,
    reviews: 0, correct: 0, lastReviewed: time,
  };
  const correct = grade !== 'again';
  let interval;
  if (grade === 'again') interval = 0;
  else if (grade === 'hard') interval = Math.max(1, Math.round(old.interval * 1.2));
  else if (grade === 'easy') interval = old.repetitions === 0 ? 4 : Math.max(4, Math.round(old.interval * 3));
  else interval = old.repetitions === 0 ? 1 : old.repetitions === 1 ? 3 : Math.max(1, Math.round(old.interval * 2.5));
  interval = Math.min(365, interval);
  // An early successful repetition is useful practice, but does not prove spaced recall.
  const preserveSchedule = correct && old.interval > 0 && old.due > time;
  const progress = {
    due: preserveSchedule ? old.due : time + (grade === 'again' ? 10 * 60_000 : interval * DAY),
    interval: preserveSchedule ? old.interval : interval,
    repetitions: preserveSchedule ? old.repetitions : correct ? old.repetitions + 1 : 0,
    lapses: old.lapses + (correct ? 0 : 1),
    reviews: old.reviews + 1,
    correct: old.correct + (correct ? 1 : 0),
    lastReviewed: time,
  };
  const key = dayKey(time);
  const today = state.days[key] ?? { cards: [], reviews: 0, correct: 0, goal: state.settings.dailyGoal };
  const day = {
    ...today,
    goal: today.goal ?? state.settings.dailyGoal,
    cards: today.cards.includes(card.id) ? [...today.cards] : [...today.cards, card.id],
    reviews: today.reviews + 1,
    correct: today.correct + (correct ? 1 : 0),
  };
  return {
    ...state,
    progress: { ...state.progress, [card.id]: progress },
    days: { ...state.days, [key]: day },
  };
}

export function getStats(cards, state, language = state.settings.language, now = Date.now()) {
  const time = timestamp(now);
  const available = cards.filter((card) => card.language === language);
  const studied = available.map((card) => state.progress[card.id]).filter(Boolean);
  const key = dayKey(time);
  const completed = (date) => {
    const day = state.days[date];
    return Boolean(day && day.cards.length >= (day.goal ?? state.settings.dailyGoal));
  };
  let streak = 0;
  let cursor = completed(key) ? key : previousDay(key);
  while (completed(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  const week = [];
  cursor = key;
  for (let i = 0; i < 7; i++) {
    week.unshift({ date: cursor, count: state.days[cursor]?.cards.length ?? 0 });
    cursor = previousDay(cursor);
  }
  const totalReviews = studied.reduce((sum, item) => sum + item.reviews, 0);
  const correct = studied.reduce((sum, item) => sum + item.correct, 0);
  return {
    due: studied.filter((item) => item.due <= time).length,
    newCount: available.length - studied.length,
    learned: studied.filter((item) => item.repetitions >= 1).length,
    mastered: studied.filter((item) => item.repetitions >= 3 && item.interval >= 21).length,
    today: state.days[key]?.cards.length ?? 0,
    goal: state.days[key]?.goal ?? state.settings.dailyGoal,
    streak,
    totalReviews,
    accuracy: totalReviews ? Math.round((correct / totalReviews) * 100) : 0,
    week,
  };
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}.`);
  return value;
}

function integer(value, name, maximum = 1_000_000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error(`Invalid ${name}.`);
  return value;
}

function validId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/u.test(value)
    && !['constructor', 'prototype', '__proto__'].includes(value);
}

function textField(value, name, maximum, required = false) {
  if (typeof value !== 'string' || value.length > maximum || (required && !value.trim())) {
    throw new Error(`Invalid ${name}.`);
  }
  return value.normalize('NFC').trim();
}

function translations(value, name, maximum, required = false) {
  object(value, name);
  return Object.fromEntries(SOURCES.map((source) => [source, textField(value[source], `${name} (${source})`, maximum, required)]));
}

function customCard(value) {
  object(value, 'custom card');
  if (!validId(value.id) || !value.id.startsWith('custom-')) throw new Error('Invalid custom card ID.');
  if (!LANGUAGES.includes(value.language) || !KINDS.includes(value.kind)) throw new Error('Invalid custom card language or type.');
  if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(value.level)) throw new Error('Invalid card level.');
  if (!Array.isArray(value.answers) || !value.answers.length || value.answers.length > 10) throw new Error('A custom card needs 1–10 accepted answers.');
  object(value.example, 'card example');
  return {
    id: value.id,
    language: value.language,
    kind: value.kind,
    topic: textField(value.topic, 'card topic', 100, true),
    level: value.level,
    cue: translations(value.cue, 'card prompt', 500, true),
    answers: [...new Set(value.answers.map((answer) => textField(answer, 'accepted answer', 300, true)))],
    note: translations(value.note, 'card note', 1_500),
    example: {
      target: textField(value.example.target, 'example', 1_000),
      ...translations(value.example, 'translated example', 1_000),
    },
  };
}

function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 2000 && year <= 2200 && dayKey(new Date(year, month - 1, day, 12)) === value;
}

export function validateState(value, cards) {
  object(value, 'backup');
  if (value.version !== 1) throw new Error('This backup uses an unsupported version.');
  const defaults = createState();
  const settings = object(value.settings, 'settings');
  if (!LANGUAGES.includes(settings.language)) throw new Error('Invalid selected language.');
  const sources = object(settings.sources, 'source languages');
  for (const language of LANGUAGES) {
    if (!SOURCES.includes(sources[language])) throw new Error('Source languages must be Spanish or English.');
  }
  if (!Number.isInteger(settings.dailyGoal) || settings.dailyGoal < 1 || settings.dailyGoal > 100) throw new Error('Daily goal must be between 1 and 100.');
  if (typeof settings.reminderTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/u.test(settings.reminderTime)) throw new Error('Invalid reminder time.');
  if (typeof settings.browserReminders !== 'boolean') throw new Error('Invalid reminder setting.');
  defaults.settings = {
    language: settings.language,
    sources: Object.fromEntries(LANGUAGES.map((language) => [language, sources[language]])),
    dailyGoal: settings.dailyGoal,
    reminderTime: settings.reminderTime,
    browserReminders: settings.browserReminders,
  };
  if (!Array.isArray(value.customCards) || value.customCards.length > 500) throw new Error('A backup can contain at most 500 custom cards.');
  defaults.customCards = value.customCards.map(customCard);
  const customIds = new Set(defaults.customCards.map((card) => card.id));
  if (customIds.size !== defaults.customCards.length) throw new Error('Duplicate custom card IDs.');
  if (cards && cards.some((card) => customIds.has(card.id))) throw new Error('A custom card ID conflicts with the curriculum.');
  const progress = object(value.progress, 'progress');
  if (Object.keys(progress).length > 10_000) throw new Error('Too many progress records.');
  for (const [id, item] of Object.entries(progress)) {
    if (!validId(id)) throw new Error('Invalid progress card ID.');
    object(item, 'card progress');
    const entry = {
      due: integer(item.due, 'review date', MAX_TIMESTAMP),
      interval: integer(item.interval, 'review interval', 365),
      repetitions: integer(item.repetitions, 'repetitions'),
      lapses: integer(item.lapses, 'lapses'),
      reviews: integer(item.reviews, 'review count'),
      correct: integer(item.correct, 'correct count'),
      lastReviewed: integer(item.lastReviewed, 'last review date', MAX_TIMESTAMP),
    };
    if (entry.reviews < 1 || entry.correct + entry.lapses !== entry.reviews
      || entry.repetitions > entry.correct || entry.lastReviewed > entry.due) throw new Error('Inconsistent card progress.');
    defaults.progress[id] = entry;
  }
  const days = object(value.days, 'practice history');
  if (Object.keys(days).length > 3_660) throw new Error('A backup can contain at most ten years of daily history.');
  for (const [date, item] of Object.entries(days)) {
    if (!validDay(date)) throw new Error('Invalid practice date.');
    object(item, 'daily history');
    if (!Array.isArray(item.cards) || item.cards.length > 10_000 || !item.cards.every(validId)) throw new Error('Invalid daily cards.');
    const unique = [...new Set(item.cards)];
    const entry = {
      cards: unique,
      reviews: integer(item.reviews, 'daily review count'),
      correct: integer(item.correct, 'daily correct count'),
      goal: item.goal === undefined ? settings.dailyGoal : integer(item.goal, 'daily goal', 100),
    };
    if (entry.goal < 1 || entry.correct > entry.reviews || unique.length > entry.reviews) throw new Error('Inconsistent daily history.');
    defaults.days[date] = entry;
  }
  return defaults;
}

export function parseBackup(text, cards) {
  if (typeof text !== 'string' || text.length > 5_000_000) throw new Error('Choose a JSON backup smaller than 5 MB.');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The backup is not valid JSON.');
  }
  return validateState(value?.app === 'parola' && Object.hasOwn(value, 'state') ? value.state : value, cards);
}

export function serializeBackup(state) {
  return JSON.stringify({ app: 'parola', exportedAt: new Date().toISOString(), state: validateState(state) }, null, 2);
}
