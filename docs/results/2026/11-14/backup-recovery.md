# Public backup and recovery accepted

All four new desktop/narrow Chrome journeys pass on their first invocation at
source `365c96cf11abd094b9f351d12be15dd70535642c`,
[run43631286776](https://github.com/alvarovillalbaa/parola/actions/runs/43631286776).
The [normalized original reports](backup-recovery.json) retain every identity,
stream hash, download hash, served-asset binding and native preservation limit.
No application repair was needed; `public/`, dependencies and package scripts
remain unchanged. The five pre-existing dirty paths are preserved, not included
in this publication.

| Identity | Actual browser result |
| --- | --- |
| B01 desktop | An actual 1,780-byte JSON download retains two authored progress records, preferences and one personal card. After changing preferences/removing the card, file selection preserves current data until confirmation. Confirmed restore and reload return the exact exported state; restored markup renders as text. |
| B02 narrow | Escape and the dialog close control cancel the pending restore. Persisted state stays exact after both cancellation and reload. |
| B03 desktop | Malformed JSON, an unsupported version and inconsistent progress are refused without an open confirmation or a persistent change; every reload retains the original valid state. |
| B04 narrow | An actual 43-byte recovery download exactly preserves unreadable storage. Recovery mode does not overwrite it during preference changes or file selection. Confirming the valid downloaded backup clears the warning, restores the exact state and survives reload. |

The two original download files were byte-verified and removed from browser
temporary storage after copying. Four contexts were created/closed, no page
errors were reported, and no process referenced the owned runner root after
the driver exited. That root was removed. All 51 tracked source inputs match
before/after. Twenty public asset observations bind ten unchanged runtime
files before/after; these are binding checks, not twenty additional scenarios.
Extracted stream/download hashes match; the artifact ZIP digest is unverified.

All four screenshots were inspected. [Desktop restored card](backup-recovery/B01-desktop.png),
[narrow cancelled settings](backup-recovery/B02-narrow.png),
[desktop refusal recovery](backup-recovery/B03-desktop.png) and
[narrow restored practice](backup-recovery/B04-narrow.png) retain the actual
rendered outcomes. The authored [backup](backup-recovery/B01-backup.json) and
[damaged original](backup-recovery/B04-original-recovery.json) are fixtures,
not personal learner data.

Temporary workflow418567367 is disabled_manually and its active file is removed.
Its exact source remains in Git history. Publication uses a temporary isolated
Git index; the native checkout stays at b0362d30 with the same five dirty files
and original status. The broad older dirty hosted workflow was not published
or run. Only explicitly owned source/evidence/instruction paths change.

Earlier course, worker, VM and continuity/calendar packets remain closed and
were not repeated. These four cases use authored seeded history; they do not
establish newly earned practice, natural overnight/DST, cross-device automatic
sync, physical devices, phone installation or OS/calendar alert delivery. No
account, model/provider, database, notification permission, paid service, local
install/build/browser or production data was used. The full portfolio goal is
active and unfinished; this closes the scoped public persistence-browser gap.
