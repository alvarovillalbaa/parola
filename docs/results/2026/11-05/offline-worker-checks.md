# Offline delivery repair accepted

5 November 2026. [Open Parola](https://parola-eta.vercel.app).
The worker now bounds the complete network attempt, including its body,
and keeps cache repair outside foreground response delivery. Learner progress
and unrelated cache/storage namespaces remain untouched.

The [three-case runtime run42026560754](https://github.com/alvarovillalbaa/parola/actions/runs/42026560754),
job127242115587, passed **12:22:26–12:23:19 UTC**. Activation
`3ece5001a97122b8b1caec95f89856ee11e48bc0` checked out
`8367b6140a6285109b6ef98a9ecf696b67f9a40e`, worker SHA
`e0ad2a9d057b9dc06740f51bc198abd1e615d282fac837feb74095fe3b3dea34`.
Node24.21.0 / Playwright1.64.1 / Chromium156.0.8078.4.

- W01 used the actual public version5 worker. With one SW-owned root request’s
  headers withheld, cached navigation returned complete source-exact HTML
  in3098ms. The actual earned review and once-seeded unrelated localStorage
  and cache sentinels survived. This is controlled timing, not a natural outage.
- W02 used an owned loopback server with the exact checked source. It supplied
 200 headers and128 module bytes, then held the tail. The worker aborted that
  native fetch and returned all37,283 cached module bytes in3077ms; the actual
  app rendered and earned progress stayed unchanged. The server observed one
  cancellation and its nine-second safety guard did not expire.
- W03 evicted only the owned data cache entry, then observed the finite503
  response in3005ms. A healthy fetch repaired the native cache with all64,822
  source-exact data bytes. Genuine browser-offline mode rejected an uncached
  worker request, reloaded the warm app and offered a real recall input.
  Earned progress and both unrelated sentinels remained byte-exact.

The [receipt](offline-worker-checks.json) retains complete compressed command
streams, actual cases, source vectors and cleanup. All68 streams were decoded
and their sizes/hashes verified. All34 commands exited0/reaped with complete
EOF and absent groups. Five full39-file HEAD/index/mode/working/ignored guards
(526,205 bytes) matched in the clean CI checkout. Twenty-two anonymous public
asset responses (eleven before/eleven after) matched source, including SW.

Two fresh contexts, one browser and the owned server closed. No socket,
request handler, route gate, pending operation or attributed browser process
remained; eight owned processes disappeared without signals, and scratch
removal passed. Unexpected page/console/network errors were zero. Three scoped
abort failures, nine browser-offline observations and one intentional503
console message remain explicitly classified in the receipt.

The separate [nineteen VM case identities](worker-unit-checks.md) were accepted
as18 initial passes plus one corrected-spy-only pass on existing Node26.8.2.
No single nineteen-pass invocation occurred; the failed observation and exact
fixture reversal remain preserved. These VM checks cover never-settling
cache writes; no browser test pretends native Cache.put was made to hang.
An already-started native write cannot be cancelled by the maintenance timer.

Five pre-existing native changes remain excluded and byte-preserved:
`.gitignore`, `README.md`, `docs/acceptance.md`,
`.github/workflows/hosted-browser.yml`, `tests/hosted.spec.mjs`.
Only explicitly owned paths are staged/published. The clean selected CI/Git
source must not be described as a globally clean native worktree. The old
untracked manual hosted workflow is preserved and was not activated.

The tracked temporary worker workflow is retired after terminal execution.
Actual runtime/HTTP evidence belongs to the preparation/deployment above
(`dpl_ACBxh63LC8EkU7gMCPhuSZXGBoB4`); later documentation-only publication is
verified separately and is not a rerun. Existing learning/restore/reminder
suites were not repeated. Physical devices, natural network outages, calendar
delivery, speech/audio and full-product/portfolio acceptance remain open.
No local browser/server/install/build/database, paid plan, account or model call.
