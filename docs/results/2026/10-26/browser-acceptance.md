# Production browser acceptance — 2026-10-26

Observed [Parola production](https://parola-eta.vercel.app/) in connected Chrome through the Browser skill. The previous browser-connection blocker is resolved. This is interactive browser evidence, separate from the prepared, unpublished hosted workflow.

## Passed

- Initial preferences: German from English; French, Italian and European Portuguese from Spanish.
- All eight source/target directions: a real vocabulary answer and a grammar answer for each, with the prompt matched against the authored curriculum, answer hidden before submission, correct feedback, and grading through the UI. This covers 16 course paths, not every authored card.
- A full mixed French session: 11 attempts, 10 correct, 10 unique daily recalls, including a revealed miss returned once for another try. The session summary and daily-goal completion were observed.
- Visible progress survived a page reload: 14 French items and four each in German, Italian and Portuguese; 26 unique daily recalls. Later mobile practice added one further French item.
- At a settled 390 × 844 viewport, Today and the recall view had `clientWidth = scrollWidth = innerWidth = 390`. A typed mobile vocabulary answer received correct feedback and was graded.
- Mobile collection search for `café` matched the vocabulary and grammar entries; the Grammar filter displayed 18 items.
- Original language/source preferences were restored, and the temporary viewport override was cleared.

The browser had displayed zero learned items at the start. QA practice now remains in that browser. No existing progress was reset, no personal cards were created or deleted, and no private browser stores were read.

## Evidence

- [Recorded browser checks](browser-checks.json), including tested card IDs and limitations.
- [Desktop recall feedback](desktop-recall.png).
- [Completed daily session](desktop-session.png).
- [Mobile Today](mobile-today.png).
- [Mobile recall feedback](mobile-recall.png).

GitHub main was independently checked as `e3476a1`; Vercel reported production deployment `dpl_DPeKPDXrTEC1FVARXKKnABg615rj` as READY. Browser checks targeted the production alias. No runtime source or deployment settings changed in this follow-up.

## Still unverified

- Offline reload and practice: the connected browser API exposes no offline network override. A source/service-worker check would not substitute for exercising the app while offline.
- Backup download/restore, custom-card round trips and cross-day scheduling were not exercised in this browser session.
- The calendar button displayed its export confirmation, but the browser download listener timed out after ten seconds. File bytes and calendar-client delivery remain unverified.
- OS notifications and installation/reminders on a personal phone were not exercised. Browser extension warnings appeared in captured logs; no application error was observed in the inspected log sample, which is not an exhaustive client-error audit.

The prepared manual GitHub Actions workflow remains unpublished and undispatched pending the explicit CI-change approval required by the supplied AGENTS instructions. It can cover isolated offline and backup checks; calendar-client and personal-device delivery remain separate.

## Local checks

`git diff --check` passed. The JSON receipt parsed successfully and contained all 16 distinct language/source/kind combinations. No dependencies, app builds or local servers were needed.
