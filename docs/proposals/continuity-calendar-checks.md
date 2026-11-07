# Cross-day continuity and calendar downloads — preparation

7 November 2026. Two new browser identities address open observations in the
[26 October receipt](../results/2026/10-26/browser-acceptance.md). They do not
repeat the accepted 16 course paths, 19 worker VM identities or three native
worker cases. Source preparation is not passing browser evidence.

The owner's standing “approve everything / you choose / keep going / do all the
work” authorizes these focused checks and bounded temporary public CI. No new
account, dependency in the app, paid plan, provider/model call, database,
notification permission or calendar-client action is included.

## C01 — earned progress across a day change

A fresh desktop profile at 1440 × 1000 uses a fixed Europe/Madrid browser clock
on an authored November date, outside a daylight-saving transition. Set goal
five through Settings and earn five French recalls graded Good through the actual app UI,
using the existing authored curriculum to answer the visible prompts. No score,
review schedule or learner state is injected.

Change the future goal to ten through Settings. The completed first day must
retain goal five, five unique recalls and its streak. While Today is open,
advance only the isolated browser clock past the next local day and the actual
24-hour review interval, then run the app's existing 60-second reminder timer.
Do not call an internal render function or synthesize a visibility event.

The UI must show zero recalls today, the future goal ten, five due items, a
one-day streak and the first day's completed activity. A new day's stored row
does not exist until its first review. Answer and grade one due
item through the UI; its next interval must be three days and its repetition
count two. The first day's saved record must remain byte-exact. Reload and
observe the earned progress, new-day record and future goal. Read-only inspection
of the disposable profile's authored state records the exact outcome; it does
not seed a passing state. Controlled time is not evidence of natural background
execution, DST behavior, multi-device synchronization or physical-device time.

## C02 — actual calendar-file bytes

A separate fresh 390 × 844 profile accepts downloads and uses a fixed browser
clock/timezone. In Settings, choose 19:05 at an authored local 18:00. Register the
native download listener before clicking the actual calendar button. Read only
the owned completed file, bounded to 16 KiB, and retain its original bytes,
length, SHA-256, filename and download outcome.

Change the time to 07:45 and download again through the same UI. Verify the first
floating local DTSTART is today, the second tomorrow, the origin-derived UID is
stable and the chosen setting survives reload. Inspect CRLF, UTF-8 line folding,
one complete event, its alarm, daily recurrence, five-minute duration, zero-minute
alarm trigger and the expected origin URL. Do not replace Blob, createObjectURL,
the anchor click, download implementation or calendar generator.

These are browser file-download observations. No calendar import, personal
calendar mutation, notification prompt, OS alert or background-push delivery is
attempted or established.

## Execution and preservation

New owned paths are `tests/browser/continuity-calendar.mjs`,
`scripts/run-continuity-calendar.mjs`, this proposal and the inactive
`continuity-calendar.workflow.yml.example`. Root pins the immutable preparation
source and separately verified READY production deployment before activation.
The preparation is published only to a candidate branch and the new QA branch;
main and the canonical production alias stay at the existing checked runtime
source during execution. At preparation, Root's filtered deployment list and
fresh detail at `07:23:11 UTC` returned production
`dpl_AoT6kw5Z8KU1dwG4f3n2etRcCHcH` READY for runtime commit
`0bb8e46585e9fb9a679ceacd0b7611c5349ff001`, canonical
`https://parola-eta.vercel.app`. Candidate tests/docs differ from that commit;
all eleven public asset responses must still match preparation bytes.
One new QA branch owns one public Ubuntu job, Node 24.21.0, CI-only Playwright
1.64.1 and a 20-minute ceiling. The app remains dependency-free and unbuilt.
Browser work is capped at 240 seconds plus 60 seconds cleanup; outer work at
1020 seconds plus 90 seconds cleanup. There is one execution per identity and
no retry, failure waiver or old-suite invocation.

The controller retains the original runner HOME and uses a scrubbed child
environment with owned cache, configuration, temporary, npm and browser paths.
It inherits bounded original command streams, full native Git/source guards,
eleven anonymous public asset hashes before/after, exact case identities and
strict PID/group, browser/context and scratch teardown from the accepted worker
packet. Both cases use the canonical public app; no local server is created.
Public response bytes, controlled browser time and provider metadata remain
separate evidence; matching asset bytes do not identify the serving deployment
by themselves.

The current native checkout at `0bb8e46585e9fb9a679ceacd0b7611c5349ff001`
has 41 tracked files and five existing dirty/untracked paths. Preserve these
exact bytes and exclude them from staging/publication:

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `.gitignore` | 60 | `f9403f1d2f4b9bed8ebfd3b6f264d11637a57e441a1b507c9d113fe06688f332` |
| `README.md` | 4243 | `b0672fc64fee59cd312574a5aea68a0abdb1fdc8ebb2697867720e76b421705e` |
| `docs/acceptance.md` | 5181 | `d6f160789f553499b1f30df871cc9f9df235ad60007438d5ffd8a91b9925cf38` |
| `.github/workflows/hosted-browser.yml` | 1415 | `3f619ac99a367f15b0a9aece332b7eaf714030994627a4042d2512eaf5babc24` |
| `tests/hosted.spec.mjs` | 15634 | `080ffa55faf23005f506d95e9658be1899005607b5fa1fde6983380a01232365` |

The CI checkout can be clean at its selected source; the native checkout is
intentionally not globally clean. Never reset, stash, switch or stage the whole
tree. The previous worker driver/controller and all public assets remain
protected inputs unless a separately documented observed failure requires a fix.

Storage Guard currently reports 17.3 GiB free against 34 GiB required. No local
browser installation, browser launch, server, build, dependency installation,
large worktree or database is allowed by this preparation. Local verification
is limited to existing-tool syntax/import inspection, source fingerprints,
documentation links and `git diff --check`. Actual cases, failures and cleanup
will be recorded separately under `docs/results/2026/11-07/`.
