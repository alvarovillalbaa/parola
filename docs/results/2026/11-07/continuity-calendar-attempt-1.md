# Cross-day continuity and calendar bytes — accepted

Both new browser identities passed once, with zero retries and all unexpected
browser/network counters zero. No Blob request failures were observed or waived.

- [Run 42352142138](https://github.com/alvarovillalbaa/parola/actions/runs/42352142138),
  job `128342355748`, workflow `410155725`: `07:38:49–07:39:24 UTC`, 7 November
  2026 (35 seconds).
- Preparation `77e68d9e6e593730a0341c19e0ed9e989d081073`, native tree
  `703114fb0e80e7209af0a68e7a727188be2b000a`.
- Activation `91eb4a1c699736a2f7c3d278a4405a16626c4e5e`, branch
  `qa/parola-continuity-20261107-1`.
- [Exact emitted report plus newline](continuity-calendar-attempt-1.json):
  114,385 bytes, SHA-256
  `e430c4c5c74d567f44b5fb71910890842213f1e5692ebd17f9653b6cfb2a8974`.
  The unique actual stdout report was saved before interpretation. JSON alone
  is 114,384 bytes / `028ed584fd50c4114094e70613492eed3ff6b8a180dcf46ae70dbfdda706d143`.

C01 used desktop 1440×1000 and Europe/Madrid. Five actual French vocabulary
answers were graded Good through the UI (`fr-v-01`–`fr-v-05`). Day A earned
five recalls against goal five. Changing the future goal to ten preserved Day
A's goal and history. The isolated Playwright clock moved from 10 November
09:00 to 11 November 09:01; running the existing minute timer updated Today
to 0/10, five due items, yesterday's five recalls, and a one-day streak. No
synthetic visibility event, internal app call, score or storage injection was
used. One actual due review advanced interval 1→3 and repetitions 1→2; Day A
remained unchanged and reload retained Today 1/10, four due and the streak.
All three recorded earned-state digests independently reproduce from these
authored transitions; the full localStorage strings are not archived.

C02 used a separate fresh context at 390×844, fixed at 18:00 Europe/Madrid.
Two actual UI downloads produced `parola-daily-practice.ics`, each 694 bytes:

- `19:05` → `DTSTART:20261110T190500`, SHA-256
  `436fde3f28925278512b06208164bd8189e6302cee68cc287adb2f1778b83b24`.
- `07:45` → `DTSTART:20261111T074500`, SHA-256
  `6e603ebf705018b8bf4ce3882a862f139bd49761da2cb78cb366a5ed256e16e4`.

Both complete originals are retained as base64 and were independently decoded:
strict UTF-8, CRLF/final CRLF, 24 physical lines, maximum 75 UTF-8 octets,
proper calendar/event/alarm nesting and property scope, daily recurrence,
five-minute duration, zero-offset display alarm, canonical URL and floating
local start times. UID remained `parola-daily-82043c00@parola.local`; reload
retained `07:45`. Settled Settings inner/client/scroll widths were all 390.
MIME is a source-declared expectation, not an independently observed Blob type.

All 68 original gzip command streams (61,729 raw / 23,565 compressed bytes)
match retained/observed sizes and SHA-256 with complete EOF and no trailing
gzip data. All 34 commands exited 0, reaped/closed with both pipe EOFs and absent
original groups. The 8,324-byte original browser marker matches its parsed
result exactly. Five clean selected-CI source guards cover all 45 native Git
mode/blob/byte/hash rows (753,350 bytes), vector
`db2d80a53b9b63333fc3ddd745be0cf7cfcaf6c61dff81d2d0f33e1e709c1b6a`.
Twenty-two complete anonymous 200 body observations (330,104 bytes) match the
eleven source paths before/after. Bodies were streamed/hash-checked, not archived.
All ten runtime files also match baseline `0bb8e46585e9fb9a679ceacd0b7611c5349ff001`;
expected deployment `dpl_AoT6kw5Z8KU1dwG4f3n2etRcCHcH` is separate Root metadata.

Node24.21.0 / Playwright1.64.1 / Chromium156.0.8078.4. Both contexts and the
browser closed; both native files disappeared, downloads directory and pending
requests/routes/jobs were empty. Eight attributed processes disappeared without
signals; reader, scratch and process cleanup passed. The temporary workflow
was disabled; fresh API readback was `disabled_manually`, updated `07:40:34 UTC`.
The five pre-existing native dirty paths still match their saved fingerprints;
the separate native checkout is not globally clean.
This is controlled-clock browser continuity and downloaded-file proof, not a
natural overnight/DST, calendar import/delivery, notification, physical-device,
or full mobile/product claim. Closed course/VM/worker scopes were not rerun.
No local browser/server/install/build, account, model, retry, source fix,
commit or branch retirement was performed by this audit.
