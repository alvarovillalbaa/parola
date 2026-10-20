const LAST_REMINDER_KEY = 'parola.reminder.lastDay';
const DEFAULT_TITLE = 'Parola · a little language, every day';
const OPEN_APP_MESSAGE = 'Browser reminders work while Parola is open. Import the calendar reminder for alerts when the app is closed; your calendar controls those alerts.';
let notifiedDay = '';
let pendingReminder = null;

function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseTime(time) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new TypeError('Choose a reminder time in HH:MM format.');
  }
  return time.split(':').map(Number);
}

function calendarText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

// Calendar lines are limited by UTF-8 octets, so never split a Unicode character.
function foldLine(line) {
  const encoder = new TextEncoder();
  const lines = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      lines.push(current);
      current = ' ';
      bytes = 1;
    }
    current += character;
    bytes += size;
  }
  lines.push(current);
  return lines.join('\r\n');
}

function stableId(origin) {
  let hash = 2166136261;
  for (const character of origin) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `parola-daily-${(hash >>> 0).toString(16)}@parola.local`;
}

/** A floating local-time event follows the calendar's local time, including DST. */
export function makeCalendar({ time = '19:00', url = globalThis.location?.origin, now = new Date(), title = DEFAULT_TITLE } = {}) {
  const [hours, minutes] = parseTime(time);
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new TypeError('The reminder date is invalid.');
  if (typeof url !== 'string' || /[\u0000-\u0020\u007f]/.test(url)) {
    throw new TypeError('The reminder needs an absolute HTTP or HTTPS URL without whitespace.');
  }
  let destination;
  try {
    destination = new URL(url);
  } catch {
    throw new TypeError('The reminder needs an absolute HTTP or HTTPS URL.');
  }
  if (!['https:', 'http:'].includes(destination.protocol) || destination.username || destination.password) {
    throw new TypeError('The reminder needs an HTTP or HTTPS URL without credentials.');
  }
  const start = new Date(date);
  start.setHours(hours, minutes, 0, 0);
  if (start < date) start.setDate(start.getDate() + 1);
  const startText = `${localDay(start).replaceAll('-', '')}T${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`;
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const description = `Five minutes of vocabulary and grammatical structures. Recall first, then check.\nOpen Parola: ${destination.href}\nYour calendar controls this recurring reminder and its alerts.`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Parola//Daily practice//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Parola',
    'BEGIN:VEVENT',
    `UID:${stableId(destination.origin)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${startText}`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${calendarText(title)}`,
    `DESCRIPTION:${calendarText(description)}`,
    `URL:${destination.href}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${calendarText(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(foldLine).join('\r\n') + '\r\n';
}

export async function installServiceWorker() {
  if (!globalThis.navigator?.serviceWorker) return null;
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  if (registration.active) return registration;
  const worker = registration.installing || registration.waiting;
  if (!worker) throw new Error('Offline installation did not start.');
  await new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', checkState);
      if (error) reject(error);
      else resolve();
    };
    const checkState = () => {
      if (worker.state === 'activated') finish();
      if (worker.state === 'redundant') finish(new Error('Offline installation failed.'));
    };
    const timeout = setTimeout(() => finish(new Error('Offline installation did not finish.')), 15_000);
    worker.addEventListener('statechange', checkState);
    checkState();
  });
  return registration;
}

export async function requestNotifications() {
  if (!globalThis.Notification) return { status: 'unsupported', message: `This browser does not support notifications. ${OPEN_APP_MESSAGE}` };
  try {
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission === 'granted') return { status: 'granted', message: OPEN_APP_MESSAGE };
    if (permission === 'denied') return { status: 'denied', message: `Notifications are blocked. Change permission in your browser settings to enable them. ${OPEN_APP_MESSAGE}` };
    return { status: 'default', message: `Notification permission was not granted. ${OPEN_APP_MESSAGE}` };
  } catch {
    return { status: 'error', message: `Notifications could not be enabled. ${OPEN_APP_MESSAGE}` };
  }
}

async function showNotification(title, body) {
  if (!globalThis.Notification) return { status: 'unsupported', message: `This browser does not support notifications. ${OPEN_APP_MESSAGE}` };
  if (Notification.permission !== 'granted') return { status: Notification.permission, message: `Enable browser notifications first. ${OPEN_APP_MESSAGE}` };
  const options = { body, icon: '/icon.svg', badge: '/icon.svg', tag: 'parola-daily-practice', data: { url: '/' } };
  try {
    const registration = await globalThis.navigator?.serviceWorker?.getRegistration('/');
    if (registration?.active) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    return { status: 'sent', message: `Notification sent. ${OPEN_APP_MESSAGE}` };
  } catch {
    return { status: 'error', message: `The browser could not show a notification. Try the calendar reminder. ${OPEN_APP_MESSAGE}` };
  }
}

export function sendTestNotification() {
  return showNotification('A little language, every day.', 'Your Parola reminder is ready. Five minutes is a good start.');
}

/** Called by the open app; this never requests permission or claims background push. */
export async function maybeNotify(settings, todayCount, { now = new Date() } = {}) {
  if (!settings?.browserReminders) return { status: 'disabled', message: 'Browser reminders are off.' };
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) return { status: 'error', message: 'The reminder date is invalid.' };
  let hours;
  let minutes;
  try {
    [hours, minutes] = parseTime(settings.reminderTime || '19:00');
  } catch (error) {
    return { status: 'error', message: error.message };
  }
  const goal = Number(settings.dailyGoal) > 0 ? Number(settings.dailyGoal) : 10;
  if (Number(todayCount) >= goal) return { status: 'goal-met', message: 'Your daily goal is already complete.' };
  if (date.getHours() * 60 + date.getMinutes() < hours * 60 + minutes) return { status: 'not-due', message: 'Your reminder time has not arrived.' };
  const day = localDay(date);
  let lastDay;
  try {
    lastDay = globalThis.localStorage?.getItem(LAST_REMINDER_KEY);
  } catch {
    return { status: 'error', message: 'Browser reminders need local storage to avoid duplicate alerts. You can use the calendar reminder instead.' };
  }
  if (lastDay === day || notifiedDay === day) return { status: 'already-sent', message: 'Today’s reminder has already been sent.' };
  if (pendingReminder) return pendingReminder;
  pendingReminder = (async () => {
    const send = async () => {
      try {
        if (globalThis.localStorage?.getItem(LAST_REMINDER_KEY) === day || notifiedDay === day) {
          return { status: 'already-sent', message: 'Today’s reminder has already been sent.' };
        }
      } catch {
        return { status: 'error', message: 'Browser reminders need local storage to avoid duplicate alerts. You can use the calendar reminder instead.' };
      }
      const remaining = Math.max(1, Math.ceil(goal - (Number(todayCount) || 0)));
      const result = await showNotification('A little language, every day.', `${remaining} more recall${remaining === 1 ? '' : 's'} to reach your daily goal. Open Parola for a little practice.`);
      if (result.status === 'sent') {
        notifiedDay = day;
        try {
          globalThis.localStorage?.setItem(LAST_REMINDER_KEY, day);
        } catch {
          // The in-memory guard still prevents repeated alerts during this visit.
        }
      }
      return result;
    };
    // Supporting browsers serialize tabs so both cannot send before storage is updated.
    if (globalThis.navigator?.locks?.request) return navigator.locks.request('parola-daily-reminder', send);
    return send();
  })();
  try {
    return await pendingReminder;
  } finally {
    pendingReminder = null;
  }
}
