# Offline-worker delivery repair and focused checks

5 November 2026. The owner’s standing “approve everything”, “you choose”,
“keep going” and “do all the work” covers this scoped repair, checks,
temporary public CI and source/Vercel publication. No paid plan, new account,
provider/model call, database, notification prompt or enrollment is proposed.
The existing learning/reminder/restore suites and hosted runner are separate.

## Product behavior

The offline promise is in the [architecture](../architecture.md). Before this
repair, `public/sw.js` awaited fetch headers indefinitely and then awaited
Cache.put, which itself consumes the body. A connection that supplies headers
but never finishes the file could therefore keep practice from opening.

Version5 keeps the same ten precached assets and cache ownership prefix.
It bounds the complete network response attempt to3000ms and one MiB of
decoded body payload, then preserves the original Response after reading a
clone to EOF. This retains URL/type/status/redirect/header semantics. It is
not a one-MiB process-memory ceiling; tee buffers and crossing-chunk overhead
remain. Failed/late work cannot publish a partial response or start a refresh.

Cache opening is independent of network delivery. Fallback reads get500ms.
Eligible complete responses still repair the cache; a synchronous waitUntil
placeholder adopts maintenance bounded to1000ms. Cache.put cannot be aborted
once dispatched, so the window bounds worker-event maintenance, not native
storage completion. Late cache opening cannot start a put after that window.
Client cancellation rejects AbortError and removes owned timers/listeners.

Same-origin GET/navigation interception, HTTP-error/redirect policy, install
precaching, old-owned-cache cleanup and notification clicks remain scoped as
before. Learner localStorage and unrelated cache namespaces are untouched.
First offline readiness still requires a successful online install/activation.
Browser scheduling can delay timers; this is not a hard real-time promise.

These choices follow [Fetch response cloning](https://fetch.spec.whatwg.org/#concept-response-clone),
[body cloning](https://fetch.spec.whatwg.org/#concept-body-clone) and
[Cache.put](https://w3c.github.io/ServiceWorker/#cache-put). Reading a clone
buffers the original stream; success must not abort that original. The first
[waitUntil](https://w3c.github.io/ServiceWorker/#dom-extendableevent-waituntil)
call is synchronous in the fetch callback. Both tee branches are cancelled
best-effort on failure without awaiting potentially stalled cancellation.

## Local worker checks

`tests/service-worker.test.mjs` executes actual worker source in a VM with
native Node Request/Response/Streams and authored fetch/cache/timer boundaries.
It does not emulate real browser storage, networking or lifecycle.

Nineteen case identities now have accepted evidence across two local runs:
the [first observation](../results/2026/11-05/worker-unit-attempt-1.json) passed
eighteen and failed one cancellation spy; the
[single corrected case](../results/2026/11-05/worker-unit-checks.json) passed
without repeating the other eighteen. No single nineteen-pass invocation is
claimed. The only fixture change observes the replacement original-body
branch after native cloning. Exact reverse hashing reproduces the old file;
all assertions and the worker source remain unchanged.

Coverage includes pass-through requests, exact install assets/cache namespace,
original response identity and bytes, deadline/abort/listener cleanup,
stalled headers/body, read failure, oversize bytes, late results, unavailable
cache, stalled/rejected cache writes, finite fallback/HTTP errors and unchanged
notification clicks. No old learning/data/reminder/restore suite was rerun.

## Three browser cases — authored, unrun

The CI-only custom driver is `tests/browser/service-worker-offline.mjs`.
Literal identities are:

| ID | Title |
| --- | --- |
| W01 | a warm service worker survives stalled navigation headers without losing earned progress |
| W02 | a warm service worker rejects a partial stalled module body and serves the complete cached module |
| W03 | an evicted file returns bounded unavailability then repairs its cache for a genuine offline reload |

W01 runs the actual published version5 worker in a fresh context. It earns one
review through the real UI, seeds unrelated storage/cache sentinels once,
verifies all ten native cache entries, then withholds only the SW-owned root
request’s headers. Cached navigation must complete in the authored2.5–7s
observation window, return complete source-exact HTML from the worker and
preserve progress/sentinels. The hold is controlled network timing, not a
natural outage or a fulfilled fake response.

W02/W03 share a separate fresh context on an owned127.0.0.1 ephemeral HTTP
server. It serves the exact eleven source resources (ten app assets plus SW).
W02 sends200 headers and the first128 module bytes, then withholds the tail.
The native worker must abort that fetch and deliver the complete cached module
within the same2.5–7s observation window. The server must observe cancellation;
its nine-second safety guard must not expire. Actual earned progress survives.

W03 evicts only the owned data-module cache entry. A stalled request must
produce the finite503 response. Healthy fetching must then repair the native
cache. Actual browser offline mode must reject an uncached worker request,
reload the warm app and offer a real recall input while preserving progress
and unrelated sentinels. This proves the loopback profile, not hosted streaming
or physical device airplane mode. No Cache/native API is replaced; an
unresponsive native Cache.put remains separate VM evidence.

The driver uses one240s work window plus60s cleanup, two fresh contexts, one
browser and one owned server. It tracks route gates, fault request identities,
sockets, handlers, pending operations and late errors. Only exact authored
fault/offline failures are classified as expected. All other page/console or
network boundary failures remain failures. No score/progress state is injected.
The one review in each context is fixture setup, not a repeated course suite.

## Execution and publication boundaries

The temporary workflow is scoped to `qa/parola-offline-20261105`, public
Ubuntu24.04, Node24.21.0, CI-only Playwright1.64.1 and a20-minute job ceiling.
The app has no dependencies or local build. The root controller checks a
published preparation SHA, full HEAD/index/working/source modes and hashes,
then eleven anonymous public asset responses before and after the browser
run. It retains bounded compressed stdout/stderr, actual cases and cleanup.
The public deployment ID is a provider-metadata pin; loopback behavior and
hosted bytes remain distinct proof.

Local Storage Guard reports18.4GiB free against34GiB required. No local
browser install/build/server is part of execution. The nineteen VM checks use
the existing Node26.8.2 installation. CI tooling is owned external runner
storage with exact source pins and teardown; its Linux system packages end
with the disposable runner. Physical devices, notifications/calendar delivery,
speech/audio, all eight course directions and full-product acceptance remain
outside these new checks.

Pre-existing `.gitignore`, `README.md`, `docs/acceptance.md`,
`.github/workflows/hosted-browser.yml` and `tests/hosted.spec.mjs` are excluded
from mutation/staging/publication. Their fingerprints must remain unchanged.
GitHub’s selected source can be clean while the native checkout intentionally
retains those five changes. No reset, stash, switch or whole-tree staging.
