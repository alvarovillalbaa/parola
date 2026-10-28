# Backup restore ownership

28 October 2026. The all-project delivery goal remains active.

The connected [Langsome brief](https://app.notion.com/p/3fda1ee8bd068036999bf6fd8a154fd7)
was read in full from its returned 20 October snapshot. Parola is its existing
implementation: vocabulary and grammar, active recall, a daily habit, four
target languages and English/Spanish prompts with the requested defaults.
No duplicate language-learning application was created. Current personal GitHub
main and the public Vercel alias were verified at baseline
`510cd2d2eaec68430c4ccbb32af38f81da534fc9`, production
`dpl_Dj5KE8cVny9dTfSeSVjE22gRuWRQ` (READY).

## Repaired behavior

Restore previously awaited each selected file without owning the result.
An older read could replace a newer candidate, erase its validation result,
or reopen confirmation after it had been dismissed. Progress is not replaced
until the confirmation action, so a misleading candidate could lead to
replacing progress with the wrong backup.

Each file selection now invalidates prior reads and clears the previous
candidate. Only the current read may parse, present a candidate or report an
error. Closing or canceling the dialog, in-app/hash navigation, document
departure, opening the shared delete dialog and cross-tab progress changes
invalidate the candidate and any pending read. Confirmation requires the
dialog to remain open and captures the candidate before clearing it.
The native cancel event invalidates pending state; native dialog closure
remains the browser's action. The [HTML Standard's closing steps](https://html.spec.whatwg.org/multipage/interactive-elements.html#close-the-dialog)
return when a dialog is already closed and queue the close event. There is no
asynchronous close-event cleanup that could invalidate a later read.

The backup format, validation, learning engine and local-storage key are
unchanged. The service-worker shell cache advances from v3 to v4 for the
updated application source. This does not establish a successful offline
browser update or native-file restore.

## Verification and publication

The original eight focused app-event tests passed before editing. The repaired
source passes **44 of 44** focused app-event tests, preserving those eight and
adding 36 restore cases. The same new test file with exact committed baseline
app/data/engine source passes **9 and fails 35**. Neither comparison has skips,
cancellations or TODOs; both ran with Node **26.8.2**. Cases exercise actual
application handlers and validated backup content with deferred file reads.
Dialog methods/cancel default behavior are fixtures, not native browser proof.

The cases cover both completion orders, stale success/read error/malformed
content, invalid/empty/oversized selections, cancellation, navigation/hash/page
departure, cross-tab valid/unreadable progress, shared deletion confirmation,
reselecting A after B, and applying only the displayed candidate explicitly.
Independent source review found no blocker. `git diff --check` passed.

Repository syntax/static-asset/offline-manifest/CSP checks and all eight
course-path source checks passed with 200 cards using Node **24.21.0**. These
are source checks, not browser, notification or device acceptance.

Checked app SHA256:
`1146087cddde0b62c07ec5f98aae2b6f4ac118cad35f9f3e2739b1c1884a18b6`.
Checked test SHA256:
`8441a734e8375b06e601894e785e57cdd5a980922058a0b7cc898f37748fce4e`.
Source and hosted publication evidence will follow delivery.

Pre-existing changes to `.gitignore`, README and acceptance documentation, plus
the untracked hosted-browser workflow and runner, were fingerprinted before
editing. They are outside this change and will not be staged or published.
No dependency, build/server/browser, backend/provider/model, schema/Auth,
notification prompt or CI execution is part of this source repair. Existing
offline, backup/file-chooser, calendar-alert and device-notification acceptance
gates remain separate.
