# Acceptance evidence

## Product requirements

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| Vocabulary and grammatical structures | Dedicated and mixed practice; collection filters; personal cards | 200-card authored catalog; data and engine tests |
| Active recall | Typed answer before feedback; reveal is a miss; misses repeat once | Answer matching, scheduling, app event-flow and retry tests; browser check pending |
| Practice is learning | New cards appear directly in the same recall session with explanation/examples | All eight course paths checked statically; browser check pending |
| Daily habit | Unique daily recall goal, week view and goal-based streak | Local rollover, goal snapshot and streak tests |
| Notifications | Daily calendar event with alarm; optional open-app browser reminders | Recurrence, escaping, timing, permission and deduplication tests; device delivery pending |
| Four target languages and two sources | French/German/Italian/European Portuguese; all cues/explanations translated in English and Spanish | Data tests and all eight source/target course checks |
| Requested defaults | German from English; other languages from Spanish | State and catalog tests |
| Personal persistence | Device-local progress; validated backup/restore; custom cards | Backup validation, state round-trip, corrupt-data and app restore tests; browser check pending |
| Published to personal GitHub | [`alvarovillalbaa/parola`](https://github.com/alvarovillalbaa/parola) | Main commit independently read through GitHub API |
| Published to user's Vercel | [Production app](https://parola-eta.vercel.app) | Git-sourced READY production deployment; all ten public assets returned HTTP 200 and matched source |

## Checks performed

- `npm run check`: module syntax, static files, complete offline asset list, CSP compatibility, all eight course paths and state round trips passed.
- `npm test`: 31 focused tests passed, including eight app event-flow tests using a minimal DOM fixture. These check JavaScript wiring, not browser rendering.
- `git diff --check`: passed.
- Storage Guard: 10.1 GiB free; 34 GiB required for dependency installation/build. No dependency install or local app build was performed. This static application requires neither.

## Runtime proof boundaries

Browser verification was explicitly authorized by Alvaro. Computer-use inventory currently reports no connected browsers and a native pipe startup failure; both Chrome and in-app browser creation are unavailable. Alvaro is connecting a browser. Interactive desktop/mobile and real offline checks remain pending. A calendar file does not prove a real calendar's delivery, and mocked notification tests do not prove OS delivery. Installing on an actual phone and enabling its reminders remain user-device actions.

Initial production deployment `dpl_2CssvBKT7AEsrmSoR73KiouRLRW3` served commit `af3062d6485b2474eea57ef15101f20e1c7d56a3`. Public module MIME types, CSP, worker cache header, and exact hosted/source content were checked. Vercel runtime error/fatal logs contained no records for the release; static client-side errors require browser observation and are not covered by those logs.

The refined application at commit `67c405ae7cc6674fd0ff14a565e253fed6f2aff8` automatically deployed from GitHub main as `dpl_HVodU5Qnbn7tCDTNXD4XuVp2Vdvm` (READY, production). All ten public assets were fetched again and matched the local committed source. Exact byte sizes, SHA-256 hashes, MIME types and verification boundaries are in [the deployment receipt](deployment-verification.json).
