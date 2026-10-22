# NAK-89 — Privacy-safe Next.js monitoring

## Execution context

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
