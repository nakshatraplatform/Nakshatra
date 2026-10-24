# NAK-89 — Privacy-safe Next.js monitoring

## Execution context

### Current remediation — October 24, 2026

#### Follow-up NAK89-V1 — verification catch classification

Publication requested after local verification. Main's current rules require a
pull request plus the quality/browser, database and secret-scan checks; no
approving review is required. Publish the existing conventional fix branch and
merge only after required checks pass. This does not activate worker DSN settings
or establish deployed source-map/alert delivery evidence.

Fresh verification found a remaining confirmed P2: legacy status setup and retry
catches map unexpected internal errors to 400 before the monitoring wrapper sees
them. The mapping exists at base `5249adf`; this is incomplete remediation, not
an introduced HTTP regression. User authorized the fix. Significant integration
scope remains; no production mutation or UI/domain changes.

Acceptance: actual status POST/DELETE and retry POST handlers return a safe 503
and exactly one scrubbed Sentry event for an internal client-initialization
failure, with the response's diagnostic reference. Preserve genuine validation,
same-origin, body-size and known verification-session responses; client failures
must not produce Sentry errors. Only typed request-security/session errors are
handled locally; other errors reach the existing shared wrapper. Add real SDK /
actual-client configuration regressions before correcting the catches, then run
affected tests, full coverage/static/build gates and independent correction review.
Earlier completion/review results below describe the preceding snapshot.

Initial correction evidence: the three actual-client configuration regressions
failed with 400 rather than 503 before the fix; all nine expected-client-failure
controls passed. The catches now distinguish typed request-security/session
errors and rethrow everything else to `verificationResponse`. Its existing
scrubbed capture remains the single owner of reporting unexpected errors.
Status POST/DELETE and retry POST each now produce one safe event and matching
`X-Request-Id`. Focused 27 tests pass, including unchanged known-session statuses
and management-token recovery, plus rejection of arbitrary errors carrying
provider-controlled `code`/`status`. No dependencies, schema, production
configuration or UI changed.

NAK89-V1 is **resolved** on final packet `nak89-v1-final-bx9p78cq`, manifest
SHA256 `72bf019acfbc436154be948313b8a420152a76fca033d5d434ba2479496c0a01`.
All 1,224 runtime/test/config/source bytes match the final review packet;
subsequent feature-record edits only record final evidence. Fresh-context
reviewer (model unknown) independently passed 189 tests/17 files, nine additional
semantic probes using the actual session-error class and all 12 final
configuration/security controls. Original four reviewer reproductions are green;
unexpected Error, lookalike code/status object, plain object and string each
produce exactly one safe correlated event. Known statuses, management URLs and
`Retry-After` remain. Final verdict: no material findings.

Final full unit/coverage gate: **217 files / 1,815 tests passed**, all 63 feature
and 21 protected-boundary coverage floors passed. Lint and production build
passed; build used only placeholder public Supabase settings with Sentry upload
disabled. An initial build caught two missing test-only type annotations; fixed.
An initial full run had one focus assertion timeout in unchanged
`dashboard-client.test.tsx` while build ran concurrently. The original isolated
case and subsequent full run passed without assertion/timeout changes. No
dashboard source changed. Standalone final typecheck passed. Regression coverage
lives in `tests/verification-configuration-errors.test.ts` and
`tests/identity-verification-routes.test.ts`.

Graphify update attempted again; command unavailable. No new migration or browser
UI behavior; prior browser evidence remains historical, not rerun for this API
correction. Deployment/provider delivery/source-map/alert-recipient evidence
remains separate. Work stays uncommitted/unpushed on the same remediation branch.

Narrow lesson: a response-status-only reporting wrapper cannot detect internal
errors misclassified as client failures by inner catches. Test actual route
boundaries with a failing real adapter, and keep expected-client-error controls.

#### Initial remediation evidence (preceding NAK89-V1 correction)

Significant integration; full documentation retained. User authorized the five
audit corrections. Working on `fix/nak-89-sentry-operational-coverage`, based on
`5249adf` (latest main; merged PR127). Existing unrelated checkouts remain untouched.
Next 16.4.1 and Sentry 11.8.0 remain pinned. Linear NAK-89 holds the approved plan.

The runtime-neutral privacy module is shared with native Node workers;
operational reporting accepts only explicit static labels/codes and UUID
request references. Raw logs, personal data, replay, attachments and arbitrary
context remain excluded. SDK delivery failures must not fail business operations.

| ID | Remediation acceptance / wrong implementation rejected | Evaluation |
| --- | --- | --- |
| FIX1 | Unexpected handled verification/API failures produce one safe error event, while expected 4xx and successes produce none; background dispatch failures retain a request reference | Real SDK route wrapper + transport, existing API tests and private sentinels |
| FIX2 | Node workers initialize the shared policy and await bounded flushing on success/failure; maintenance reports each deferred task without raw rejected reasons | Native Node subprocess/SDK transport, worker/maintenance tests and workflow configuration checks |
| FIX3 | Distinct unsupported artifact paths remain distinct and match their debug-image references without exposing their source paths | Frame/debug-ID collision regression plus built app check; hosted authenticated symbolication remains a deployment gate |
| FIX4 | Important dashboard, Didit and Resend operations retain approved logical names in real streamed spans, including concurrent calls | Real SDK span envelopes + affected service tests; no SQL, URL parameters or arbitrary labels |
| FIX5 | Local production sampling cannot be overridden by incoming sampled flags or hostile sampling baggage | Deterministic real SDK trace tests with both sampled and unsampled parents; development keeps full local sampling |

Baseline audit: 44 targeted tests passed, including probes confirming a handled
503 with zero captured errors, distinct-path collisions and 30/30 forced incoming
sampled spans. Production ingestion exists; standard Next chunk identities survive
the current browser filter. Older production mapping problems are observed, but
their exact cause is unconfirmed. No production mutation or real personal data
tests are authorized. No database schema changes are planned.

Implemented the five corrections through `sentry.runtime.mjs`,
`operation-contract.mjs`, `operations.mjs` and `scripts/observed-worker.mjs`.
Existing TypeScript privacy/config modules moved to native `.mjs` so workers use
the same boundary without importing Next framework initialization. Promoted the
already locked Node SDK to an explicit dependency; no resolved versions changed.

Regression-first evidence: four initial remediation cases failed on the original
policy (missing handled error, artifact collision, inherited sampling). The
independent review exposed the separate OTel request path and a stalled native
socket. Removing each correction reproduces wrong sampling and worker subprocess
timeouts, including a stalled environment proxy. Final focused regressions pass.

#### Independent review / resolution ledger

Significant work uses a fresh-context reviewer, actual model identity unknown.
Review packets are isolated complete source copies with SHA256 manifests and the
full dirty diff. Earlier rounds are retained as history; final readiness depends
on the final corrected packet. No cross-model claim is made.

| ID | Severity / classification / origin | Evidence and disposition | Resolution check |
| --- | --- | --- | --- |
| NAK89-R1 | P1; confirmed; original sampling defect incompletely corrected in round 1; resolved | Next's remote OTel parent clones the sampling scope. `src/lib/observability/sentry.runtime.mjs:117` refreshes randomness on that actual scope; the existing core hook remains. | Real Next SDK + OTel propagator subprocess tests reject parent/baggage forcing in both directions; selected span reports local rate 0.1. Final round 3 confirmed resolution. |
| NAK89-R2 | P2; confirmed; introduced by native monitoring lifecycle; resolved | SDK close timeout leaves stalled native sockets alive. `scripts/observed-worker.mjs:14` owns direct sockets; absolute 1.5s deadline destroys them and `agent:false` excludes proxy CONNECT sockets. | Subprocesses naturally exit with original job result for missing config, success/failure, no response headers, unfinished response body and stalled environment proxy. Negative controls without deadline/direct socket time out at 6s. Final round 3 confirmed resolution, including a separate local HTTPS handshake stall. |

Round 1 independently passed 144 tests/15 files and required both corrections.
Round 2 independently passed 149 tests/15 files; R1 resolved, R2's direct stalls
fixed but proxy case remained. Both 1,223-file manifests matched before/after.
Final round 3: **no material findings**, both findings resolved; independently
passed 150 tests/15 files and an additional loopback HTTPS handshake-stall probe.
All 1,223 source hashes matched at start/finish. Final packet
`nak89-review-r3-jyqpo0a3`, supplied base `5249adf`, manifest SHA256
`cdfa11e7069154f14474f253b43fd29e500a70298b4cfcee7104e69c4884bbaa`.
The later edits to this feature record only record final check/review results;
runtime, tests, dependencies and configuration still match that reviewed packet.

#### Current verification / release boundaries

- Final full unit/coverage run: **216 files / 1,796 tests passed**; all 63 feature
  and 21 protected-boundary gates passed. Final 14 focused regression cases pass,
  including the proxy/missing-configuration tests.
- Lint and typecheck passed. Production build passed with isolated placeholder public Supabase
  URL/key and Sentry upload disabled. Initial build exposed a test-only missing
  `NODE_ENV` type requirement, corrected without changing runtime behavior.
- Dependency audit passed with zero affected packages; fixture smoke passed.
  No schema change; database migrations/production data were not exercised.
- Browser regression: **17 Chromium cases passed, 2 device-conditional skips**
  across theme and candidate liveness recovery tests, one worker, unchanged
  timeouts/assertions. Full tablet/mobile browser matrix was not rerun.
  Production static output contained no public `.map` files with upload disabled.
- Actual development signals confirmed in Sentry: native verification CLI
  [NAKSHATRA-5](https://vivintro.sentry.io/issues/NAKSHATRA-5) and handled Next API
  [NAKSHATRA-6](https://vivintro.sentry.io/issues/NAKSHATRA-6). The API reference
  matched `X-Request-Id`; private query sentinel was absent, and original local
  TypeScript frames survived. Worker check deliberately omitted provider/DB
  credentials and failed before external business I/O. These confirm ingestion,
  not successful provider jobs or production source-map upload.
- Temporary development route removed and server stopped. Graphify update
  attempted; CLI unavailable and no preexisting graph found.
- GitHub worker public DSN variable, authenticated production source mapping,
  deployed browser/Edge delivery and alert-recipient inbox evidence remain
  rollout checks. No production configuration, customer data, deployment,
  publication or new Sentry monitors changed. This does not collect all logs.
- Local implementation and required review are complete on
  `fix/nak-89-sentry-operational-coverage`; not committed, pushed or deployed.
  Latest fetched `origin/main` remains the supplied base `5249adf`.

Reusable lesson (Sentry 11.8): test both core and Next OTel remote-parent sampling;
`continueTrace` alone misses remapped scopes. Test actual subprocess exit against
stalled sockets/proxies; an in-memory transport and SDK flush timeout cannot prove
natural process termination. Keep these regressions when upgrading the SDK.

## Historical initial implementation and PR evidence

October 21, 2026. Branch `feat/nak-89-sentry-monitoring`, base `d88f14e`
(`origin/main` at setup). Linear NAK-89 is the durable plan. Significant risk;
full record because the SDK introduces an external telemetry boundary. SDK
11.8.0 installed; implementation and final correction checks complete locally. No deployment. Production source-map verification requires a private
build token.

## Problem and goal

Codex authentication enables investigation but does not instrument the app.
Configure the existing `vivintro/nakshatra` Sentry project for browser, Node and
Edge errors and sampled traces without transmitting private portfolio content.
The user's public DSN is in ignored `.env.local`; no private token was supplied.

## Scope and design constraints

Use the Next.js 16 App Router instrumentation conventions and the maintained
Sentry SDK. One shared options/privacy module owns policy for all three runtimes.
Keep current error UI and Next headers/output settings. No auth, database,
provider workflow, worker, alert, production-environment or deployment changes.
Replay, free-form logs, metrics and attachments are outside this initial setup.

Telemetry uses allowlisted diagnostic fields. Error messages are redacted by
default because provider errors can contain customer input; error class, source
frames and trace correlation remain. A fixed synthetic verification message is
permitted. Unknown URL segments become placeholders; query/fragment values,
DOM breadcrumbs, user identity, cookies, bodies, locals and arbitrary context
are excluded. Strip envelope sampling-context names too, not just event data.
This is intentionally less detailed than raw error collection. Sentry still sees
technical transport/network metadata; it is not an anonymity guarantee.

## Code locations

Implemented: `src/lib/observability/sentry.ts` owns common runtime options and
filtering; `src/instrumentation*.ts` and `sentry.*.config.ts` initialize SDKs;
App Router error boundaries capture React failures. `next.config.ts` wraps
existing settings for private source maps and exact DSN-origin CSP.
`tests/sentry*.test.*` cover privacy, configuration and hooks; existing
`tests/security-headers.test.ts` and `tests/server-pages.test.tsx` protect callers.
`docs/observability/sentry.md` explains rollout and real-world limits.

## Acceptance and evaluation contract

| ID | Criterion / plausible wrong implementation | Check / expected result |
| --- | --- | --- |
| AC1 | Framework boot and request/render errors reach configured SDK; plugin login alone is insufficient | Hook tests and real local app synthetic failure; Sentry issue confirmed |
| AC2 | All runtimes share privacy policy; query/PII or envelope DSC leaks are forbidden | Sentinel event/span/envelope tests, real SDK transport probe |
| AC3 | Missing/malformed DSN sends nothing; env and release identify Vercel preview/production | Config tests, build, explicit env examples |
| AC4 | Browser CSP permits only configured HTTPS Sentry ingest origin and existing headers remain | Existing and new header/config tests plus browser delivery |
| AC5 | Source-map build token stays server/build-only; no publicly exposed production maps | Build configuration tests; actual authenticated upload remains pending token |
| AC6 | No temporary verification trigger ships | Final diff inspection; remove local synthetic route after verification |
| AC7 | Required checks and independent fresh review finish on final code | Lint, typecheck, focused/unit coverage, build, reviewer findings ledger |

## Verification and rollout

Behavioral change. Tests will use synthetic content and local transports; no
customer data or production mutations. Docs/integration scaffolding is not
claimed as regression-first proof. Privacy tests will include negative controls
that reject the unfiltered payload. Actual Sentry verification must execute a
real application path, not a standalone capture script. Source-map uploads need
a separately configured build-only token; no upload success is implied.

To roll back before deployment, omit public DSN; to stop a deployed browser SDK,
remove it and rebuild/redeploy. Deleting Vercel env alone does not change an
already-built browser bundle. Removing the SDK requires reverting its lockfile,
Next wrapper and hooks together. No migration or stored-data rollback applies.

## Current results and remaining work

- Sentry MCP org/project read verified; SDK dependency install passed. Production
  and full dependency audit: zero affected packages, no high/critical findings.
- Real local application verification through actual framework initialization:
  [server NAKSHATRA-1](https://vivintro.sentry.io/issues/NAKSHATRA-1), error
  `VivIntro Sentry verification error`, Node platform, TS route frame line 2:37;
  [browser NAKSHATRA-2](https://vivintro.sentry.io/issues/NAKSHATRA-2), same error,
  JavaScript platform, generated dev chunk frame. Two distinct traces confirmed
  through Sentry MCP. Browser egress contained no synthetic private query sentinel.
  These live events predate the SR-1 envelope validation correction; current SDK
  envelope propagation is additionally verified by the corrected transport test.
- Temporary server and browser trigger files removed, development server stopped.
- Initial full suite: 204 files / 1,694 tests passed; coverage passed (61 feature
  files, 21 protected boundaries). Final correction rerun: 204 files / **1,695 tests passed**, all 61 feature and 21
  protected-boundary coverage gates passed.
- Initial production build failed on stale generated dev types after temporary
  routes were removed. Cleared only this worktree's `.next/dev` cache. A subsequent
  build required the isolated checkout's missing Supabase public configuration;
  build passed with nonproduction placeholder URL/key. No real credentials or
  database calls were used. Final post-correction build passed using the same placeholder public configuration.
- Chromium theme/loading: 10 passed, 2 project-conditional skips, 1 test timeout
  while build ran concurrently. Unchanged timed-out public-route case passed
  twice alone under its original 30-second timeout (8.7s and 3.4s). No assertion or
  timeout weakened. Full cross-browser/device coverage was not run.
- `graphify update .` attempted: command not installed. No preexisting graph found;
  this is a tooling limitation, not a completed graph update.
- Static production `.next/static` inspection found no public `.map` files with
  upload disabled. Authenticated upload and browser original-source resolution
  remain unverified until `SENTRY_AUTH_TOKEN` is configured and a built deployment
  is tested.
- GitHub/background workers, handled operational error capture, provider internals,
  uptime/cron checks, alert delivery, retention/DPA decisions and production rollout:
  separate work; this setup cannot establish complete end-to-end observability.


## Review findings and lessons

Fresh-context automated reviewer inspected an isolated source copy with a
manifest and dependency symlink; no cross-model or human review is claimed.
Reviewer runtime writes were prohibited; probes ran locally with in-memory
transports, no production systems. Three-round review budget.

**SR-1 P1, introduced, confirmed:** `beforeEnvelope` initially forwarded inbound
DSC public-key/sample fields without validating values. A valid tracing context
with hostile baggage could bypass event/body data filtering. Corrected policy
gets the public key from the configured DSN, accepts only 32-hex trace IDs,
literal boolean flags and numeric sample rates between 0 and 1. An actual SDK
`continueTrace` / `startSpan` regression now requires a real streamed span and
DSC header. The same regression against the earlier isolated runtime fails on
its leaked sentinel public key; corrected runtime passes. Round 2 independently
verified the runtime correction; round 3 independently verified the strengthened test and reran the negative
control. SR-1 closed; no remaining material code finding reported.

Reusable lesson: event filters alone do not cover SDK envelope metadata. A
tracing regression must supply both valid incoming trace-header and baggage
trace IDs; otherwise the SDK may omit DSC and hide the faulty path. Test the
real serialized boundary and demonstrate the negative control.


## Final handoff — October 21

- Final `npm run lint`, `npm run typecheck`, `npm run test:unit:coverage`,
  `npm run security:audit`, placeholder-configured `npm run build` and
  `git diff --check`: passed. Build did not contact a real database.
- Final source comparison with reviewed round 3: runtime, config and tests
  identical; only this evidence document changed after review.
- Actual files changed: package manifest/lock, `.env.example`, Next configuration,
  instrumentation hooks and runtime configs, shared `sentry-config.ts`/`sentry.ts`,
  existing error boundary and privacy notice, new global error fallback, three
  Sentry test files, this record, project map and observability runbook.
- No DB/schema changes, SQL checks not applicable. Edge initialization is covered
  by hook tests; a deployed Edge invocation was not exercised.
- Branch remains local and uncommitted; no push, PR or deployment performed.
- Production gates: set the public DSN and a private upload token in the intended
  Vercel scopes, publish reviewed code, verify uploaded source maps/original
  browser frames and alert delivery. Do not mark production monitoring complete
  or close NAK-89's rollout gate before those checks.


## PR preparation — October 22

- Fast-forwarded this unpublished branch to latest `origin/main` `a113a62` and
  restored the Sentry change. Resolved the project-map insertion conflict by
  retaining both entries. Preserved main's pinned Next.js 16.4.1 and its database,
  dashboard and prototype changes. No Sentry runtime logic changed during integration.
- `npm ci`, lint, typecheck, fixture smoke, all **1,717 tests** in 206 files,
  coverage gates (63 feature files, 21 protected boundaries), and production build
  with nonproduction placeholder public Supabase configuration passed.
- Audit policy passes: zero high/critical findings. Three moderate warnings now
  affect existing Vitest development packages (all locked at 4.1.11 on main too);
  no dependency workaround or exception was added for this PR.
- User reports both Sentry variables configured in Vercel. The private token is
  not present locally and has not been inspected. Authenticated map upload,
  production ingestion and readable browser source frames still require testing
  after the Sentry code is deployed.
- Integrated Chromium theme/loading regression passed: **11 passed, 2
  viewport-conditional skips**, using one worker and unchanged assertions/timeouts.
- Next.js 16.4 normalizes its generated AGENTS.md section heading from H1 to H2;
  retain that generated documentation change to avoid a permanently dirty tree.
- Branch prepared for publication; GitHub CI/Preview acceptance is separate from
  these local checks. PR creation does not authorize merging or production deployment.
