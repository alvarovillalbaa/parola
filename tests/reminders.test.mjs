import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCalendar, maybeNotify, requestNotifications, installServiceWorker } from '../public/reminders.mjs';

function unfold(calendar) {
  return calendar.replace(/\r\n /g, '');
}

test('calendar repeats daily at a floating local time with a five-minute event and alarm', () => {
  const now = new Date(2026, 9, 20, 15, 30);
  const calendar = makeCalendar({ time: '19:05', url: 'https://parola.example/', now });
  assert.match(calendar, /DTSTART:20261020T190500\r\n/);
  assert.match(calendar, /DURATION:PT5M\r\nRRULE:FREQ=DAILY/);
  assert.match(calendar, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:PT0M/);
  assert.equal(calendar.replaceAll('\r\n', '').includes('\n'), false);
  assert.equal(calendar.endsWith('END:VCALENDAR\r\n'), true);
  assert.equal(calendar.includes('TZID'), false);
});

test('calendar starts tomorrow after the chosen time and keeps a stable reimport UID', () => {
  const first = makeCalendar({ time: '19:00', url: 'https://parola.example/', now: new Date(2026, 9, 20, 20) });
  const next = makeCalendar({ time: '08:30', url: 'https://parola.example/?source=calendar', now: new Date(2026, 10, 2, 7) });
  assert.match(first, /DTSTART:20261021T190000/);
  assert.equal(first.match(/UID:(.*)\r\n/)[1], next.match(/UID:(.*)\r\n/)[1]);
});

test('calendar escapes text and folds Unicode at UTF-8 boundaries', () => {
  const title = `Parola, français; sì\\ja\n${'é'.repeat(90)}`;
  const calendar = makeCalendar({ title, url: 'https://parola.example/?q=a,b;c', now: new Date(2026, 9, 20, 15) });
  assert.match(unfold(calendar), /SUMMARY:Parola\\, français\\; sì\\\\ja\\n/);
  assert.match(unfold(calendar), /URL:https:\/\/parola.example\/\?q=a,b;c/);
  assert.match(unfold(calendar), /DESCRIPTION:.*https:\/\/parola.example\/\?q=a\\,b\\;c/);
  for (const line of calendar.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
    assert.equal(line.includes('\ufffd'), false);
  }
  assert.ok(unfold(calendar).includes('é'.repeat(90)));
});

test('calendar rejects malformed times and unsafe or injected URLs', () => {
  for (const time of ['24:00', '9:00', '12:60', '19:00\nSUMMARY:bad']) {
    assert.throws(() => makeCalendar({ time, url: 'https://parola.example/' }), /time/i);
  }
  for (const url of ['javascript:alert(1)', '/relative', 'https://user:pass@parola.example/', 'https://parola.example/\nSUMMARY:bad']) {
    assert.throws(() => makeCalendar({ url }), /URL|credentials/);
  }
});

test('open-app reminders skip before the scheduled time and after the daily goal', async () => {
  const settings = { browserReminders: true, reminderTime: '19:00', dailyGoal: 10 };
  assert.equal((await maybeNotify(settings, 1, { now: new Date(2026, 9, 20, 18, 59) })).status, 'not-due');
  assert.equal((await maybeNotify(settings, 10, { now: new Date(2026, 9, 20, 20) })).status, 'goal-met');
  assert.equal((await maybeNotify({ ...settings, browserReminders: false }, 0)).status, 'disabled');
});

test('reminders persist only after success and do not prompt for permission', async () => {
  const originals = Object.fromEntries(['Notification', 'navigator', 'localStorage'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = new Map();
  let calls = 0;
  let prompts = 0;
  let fail = true;
  class FakeNotification {
    static permission = 'granted';
    static requestPermission() { prompts += 1; return 'granted'; }
  }
  Object.defineProperties(globalThis, {
    Notification: { configurable: true, value: FakeNotification },
    navigator: { configurable: true, value: { serviceWorker: { getRegistration: async () => ({ active: {}, showNotification: async () => { calls += 1; if (fail) throw new Error('blocked'); } }) } } },
    localStorage: { configurable: true, value: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) } },
  });
  try {
    const settings = { browserReminders: true, reminderTime: '19:00', dailyGoal: 5 };
    const options = { now: new Date(2026, 10, 23, 20) };
    assert.equal((await maybeNotify(settings, 1, options)).status, 'error');
    assert.equal(storage.size, 0);
    fail = false;
    const results = await Promise.all([maybeNotify(settings, 1, options), maybeNotify(settings, 1, options)]);
    assert.ok(results.every((result) => result.status === 'sent'));
    assert.equal(calls, 2);
    assert.equal(storage.get('parola.reminder.lastDay'), '2026-11-23');
    assert.equal((await maybeNotify(settings, 1, options)).status, 'already-sent');
    assert.equal(prompts, 0);
    FakeNotification.permission = 'denied';
    assert.equal((await maybeNotify(settings, 1, { now: new Date(2026, 10, 24, 20) })).status, 'denied');
    assert.equal(storage.get('parola.reminder.lastDay'), '2026-11-23');
    const permission = await requestNotifications();
    assert.equal(permission.status, 'denied');
    assert.match(permission.message, /while Parola is open/);
    assert.equal(prompts, 0);
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('offline installation reports registration and first-install failures', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    assert.equal(await installServiceWorker(), null);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: { register: async () => { throw new Error('Registration failed'); } } } });
    await assert.rejects(installServiceWorker(), /Registration failed/);
    const worker = new EventTarget();
    worker.state = 'installing';
    const registration = { installing: worker };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: { register: async () => registration } } });
    const installed = installServiceWorker();
    await Promise.resolve();
    worker.state = 'activated';
    worker.dispatchEvent(new Event('statechange'));
    assert.equal(await installed, registration);
    worker.state = 'redundant';
    await assert.rejects(installServiceWorker(), /Offline installation failed/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  }
});
