# Acceptance evidence

## Product requirements

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| Vocabulary and grammatical structures | Dedicated and mixed practice; collection filters; personal cards | 200-card authored catalog; data and engine tests |
| Active recall | Typed answer before feedback; reveal is a miss; misses repeat once | Answer matching and scheduling tests; browser check pending |
| Practice is learning | New cards appear directly in the same recall session with explanation/examples | All eight course paths checked statically; browser check pending |
| Daily habit | Unique daily recall goal, week view and goal-based streak | Local rollover, goal snapshot and streak tests |
| Notifications | Daily calendar event with alarm; optional open-app browser reminders | Recurrence, escaping, timing, permission and deduplication tests; device delivery pending |
| Four target languages and two sources | French/German/Italian/European Portuguese; all cues/explanations translated in English and Spanish | Data tests and all eight source/target course checks |
| Requested defaults | German from English; other languages from Spanish | State and catalog tests |
| Personal persistence | Device-local progress; validated backup/restore; custom cards | Backup validation and round-trip tests; browser check pending |
| Published to personal GitHub | `alvarovillalbaa/parola` | Publication pending |
| Published to user's Vercel | Connected Vercel project | Publication pending |

## Checks performed

- `npm run check`: module syntax, static files, complete offline asset list, CSP compatibility, all eight course paths and state round trips passed.
- `npm test`: 22 focused tests passed.
- `git diff --check`: passed.
- Storage Guard: 10.1 GiB free; 34 GiB required for dependency installation/build. No dependency install or local app build was performed. This static application requires neither.

## Runtime proof boundaries

Browser verification was explicitly authorized by Alvaro. Hosted/browser results will be recorded after publication. A calendar file does not prove a real calendar's delivery, and mocked notification tests do not prove OS delivery. Installing on an actual phone and enabling its reminders remain user-device actions.
