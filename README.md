# Parola

A little language, every day. A personal app for learning vocabulary and grammatical structures through active recall.

## Practice

- French, German, Italian, and European Portuguese. Learn from Spanish or English; German starts from English, the rest from Spanish.
- 200 original beginner prompts: 32 vocabulary items and 18 grammar structures per language, with bilingual explanations and examples.
- Type an answer before seeing it. Accents matter; an accent-only miss gets a specific hint. Answers accept case, spacing, apostrophe, and final punctuation variations.
- Due reviews come before new material. Mixed sessions alternate words and structures where available. Missed items return once in the same session.
- Successful reviews space out over days. Extra practice cannot inflate the spaced-learning stage. Misses bring a card back sooner.
- Daily goals, a seven-day activity view, streaks, custom cards, device speech, JSON backup and restore.

The collection is a starter course. Add personal words and structures as you encounter them. Progress is stored in this browser; it does not automatically sync between devices. Export a backup before clearing site data or moving devices.

## Daily reminders and offline use

In Settings, pick a local practice time and download the recurring calendar event. Import it into your calendar and enable calendar alerts for daily reminders while Parola is closed. Your calendar controls delivery; some calendars can duplicate re-imported events.

Optional browser reminders need permission and an open app. Background tabs may be throttled. Parola does not claim to provide background web push.

After the first successful online visit and service-worker activation, the app shell and full collection are available offline. Install from your browser’s menu, or Safari → Share → Add to Home Screen. Audio depends on the voices available on the device.

## Development

Static HTML, CSS, and native ES modules in `public/`. Node 22+ is sufficient for checks. There are no package dependencies, credentials, account setup, or build step.

```sh
npm run check
npm test
git diff --check
```

Serve `public/` using any static server for development. Run the workspace Storage Guard before any future dependency install or app build; this version needs neither. Do not store personal progress backups in Git.

Vercel uses the Other framework preset, no install/build command, and `public` as the output directory. The GitHub-connected project deploys from `main`. See [architecture](docs/architecture.md) and [acceptance evidence](docs/acceptance.md).

## Source map

- `public/app.mjs`: app views, practice interaction, safe rendering, device persistence.
- `public/engine.mjs`: spaced recall, statistics, backup schema and validation.
- `public/data.mjs`: original bilingual beginner collection.
- `public/reminders.mjs`: calendar events and optional open-app notifications.
- `public/sw.js`: offline shell and notification click handling.
- `tests/`: focused behavior and curriculum tests.

MIT licensed.
