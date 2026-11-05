# Focused worker VM cases accepted across two invocations

5 November 2026. Nineteen new worker case identities have accepted evidence:
eighteen in the first invocation and the single corrected fixture in the
second. **No single nineteen-pass invocation is claimed**, and no existing
learning/data/reminder/restore suite was rerun.

Existing Node26.8.2 executed actual `public/sw.js` in a VM with native
Request/Response/Streams and authored fetch/cache/timer boundaries. Worker
source stayed6,307 bytes at
`e0ad2a9d057b9dc06740f51bc198abd1e615d282fac837feb74095fe3b3dea34`.

The [first observation](worker-unit-attempt-1.json) records19 cases,18 passes
and one failure. The original combined stdout/stderr was not archived; the
receipt is explicitly a structured observation of the completed tool result,
not a complete raw-stream capture. The failed spy wrapped the original body
before Response.clone replaced its tee branch, so it observed zero calls on
the wrong stream.

The [second receipt](worker-unit-checks.json) retains the completed command’s
combined output, before/after source hashes and exact fixture reversal. Only
the oversized-body case executed and passed. The native clone is now wrapped
to observe the replacement original body; the cancellation, aborted fetch,
no-cache-write, complete fallback and one-MiB-plus-one-byte assertions remain.
Reversing this one observation change reproduces whole test-file SHA
`ef49ed259bac741e54ff89388810295923281ebdb7a8abeebf8c4c0d18dfded7`;
the corrected file is
`c558a9e40c412c9d629de2edaa62452729427f7c99c266ad4805946f8ef29f86`.

The new coverage includes whole-body delivery and original metadata, network
and cache deadlines, cancellation/listener/timer cleanup, late results,
stalled/error/oversized bodies, cache-open/read/write failure, immutable cache
ownership, pass-through and unchanged notification-click behavior.

These VM results prove neither real storage/networking nor browser lifecycle,
offline reload or physical-device behavior. The separate three-case
[browser result](offline-worker-checks.md) now records its own accepted
public/loopback/native-offline observations.
No local install, build, server, browser, database, account or model action.
