# NAK-74 — Production readiness remediation

Date: October 17, 2026. Tier: Critical; full evaluation record.
Issue: https://linear.app/phoenix-works/issue/NAK-74/establish-vivintro-public-launch-security-privacy-and-legal-readiness
Branch: `security/nak-74-production-readiness-fixes`.
Integration base: `origin/main` at `d99e14ca7dc73adc1397fdc162b977ff0666ae7f`.

## Approved contract and scope

Implement the eight owner-selected readiness findings. Preserve personal
portfolio publication, retained interest submissions and account-bound 15-day
sharing behavior. BrokerDesk feature development, broader DEEP findings, legal
operator decisions, payments and unrelated local work are excluded.
No production database/deployment/provider-mail replay is authorized by this
local implementation record. Completion of code is distinct from release proof.

## Architecture and invariants

1. **READY-OPS-01:** BEFORE DELETE on every identity attempt captures unpurged
   provider correlation into a private queue without subject/account foreign keys.
   Candidate/Auth deletion cannot discard pending cleanup. Only worker service RPCs
   can claim/finish, with SKIP LOCKED, bounded batch size and fresh-token leases.
   Workers validate session/workflow/version/vendor binding before purge, request
   no face-embedding retention, and require matching explicit deletion evidence.
   Missing/ambiguous discovery, 404, retained embeddings and transport failures
   preserve work. Successful completion removes now-unneeded correlation. Legacy
   records without sufficient binding need provider/operator reconciliation.
2. **READY-APP-01:** remove approved-viewer Storage SELECT policies for protected
   originals/horoscopes. User-session RPCs still authorize descriptors; a separate
   server-only service client signs only those returned paths at <=300 seconds and
   remaining grant duration. Horoscope writes also enforce the owning account/portfolio namespace, and the
   resolver rejects preexisting foreign descriptors. Owner and public-derivative policies remain. Old
   bearer URLs and saved copies are not immediately recalled by revocation.
3. **READY-LIVE-01 / READY-OPS-05:** durable first-attempt time fences automatic
   relationship-mail retries at 23 hours, before Resend's 24-hour retention. Aged
   unattempted events are quarantined after 24 hours. Pilot mail is excluded.
   Single-message recovery preserves its original first-attempt clock unless an
   explicit duplicate-risk acknowledgement permits resetting it; bulk recovery
   cannot reset the horizon or release stale intent. Obsolete messages can be
   durably suppressed without being marked sent. Grant rendering rejects expiry
   and revocation. Database retry-window closure during dispatch is authoritative.
4. **READY-LIVE-02:** private, enabled-only maintenance POST shares the existing
   workers and independently executes bounded queue batches. A database global
   lease prevents overlapping scheduled batches; per-record leases also fence
   GitHub recovery workers. Finite provider/database requests and batch deadline
   bound execution. One task failure cannot starve the other queues. A dormant
   named Supabase Cron/pg_net job with Vault credential targets only the fixed
   production URL. Provider-owned pg_net queue grants cannot be revoked by the migration role,
   so dispatch never queues the permanent secret: action-scoped HMACs expire after
   60 seconds and a private nonce ledger prevents replay. Vault secrets stay private. Protected health GET detects missed successes after 15 minutes,
   failed batches and queue age/quarantine. Independent monitoring activation and
   observed scheduled cadence remain release evidence, not inferred from code.
5. **READY-LIVE-03:** guarded administrator script preserves existing rules/checks
   while requiring approval and main-only privileged environments. Database CI was
   already required and is retained. Current account lacks administration rights;
   GitHub rejected the write, so live settings have not been tightened.
6. **READY-OPS-02:** deletion CLI fails nonzero after a deferred failure, even if
   retry state was persisted. A subprocess test reproduces a synthetic Storage 503.
7. **READY-OPS-04 conditional:** all Docker stages use Node 24 LTS; local locked
   file dependency is copied before npm install. This resolves the source runtime
   mismatch; it is not evidence that Vercel had a runtime defect.

## Feature evaluations

| Criterion | Failure reproduction / regression | Release boundary |
| --- | --- | --- |
| Cleanup survives irreversible cascades | pgTAP creates a live candidate attempt, deletes candidate/Auth, proves independent queue survives, retries/fences/completes; provider worker rejects foreign binding and unconfirmed purge | Matching migration and worker deployment, historical provider reconciliation |
| Viewer cannot choose protected TTL | Distinct requester/signer service tests; pgTAP denies direct viewer SELECT; real synthetic Storage upload/sign/read/revoke/expiry proof | Deployed policy and app rollout; preexisting long URLs assessed separately |
| Safe notification retries | pgTAP 23h first attempt, stale intent, pilot isolation, manual review, suppression, bulk fence; service completion tests | Per-record disposition of the ten old messages; no blind replay |
| Regular work and missing-run detection | pgTAP dormant/active lease, stale-token rejection, health missing-success; route/task isolation tests | Vault/host secret activation, independent monitor, 30-minute cadence and alert/recovery proof |
| Repository gate enforcement | Ruleset-preservation test and guarded external configuration preview | Administrator applies and verifies live main/environment settings |
| Deletion failures observable | Actual CLI subprocess with synthetic local HTTP Storage failure exits nonzero | Hosted job detects nonzero result |
| Supported container runtime | Source stages and runtime compatibility check | Full image build/start evidence |

## Current validation

- Clean isolated migration replay succeeds, including all four new migrations.
- Full pgTAP after the two reviewer corrections: **54 files, 1,447 checks passed**.
  The final signed-dispatch version passes **54 files / 1,453 checks**, including
  replay fencing and permanent-secret absence from dispatch headers. This includes revised fixture
  first-attempt timestamps; no retry, role or authorization assertions were weakened.
- Focused initial service/worker tests: 35 passed. Maintenance/CLI: 7 passed.
- Real Storage proof passed against isolated PostgreSQL 17.6.1.121, GoTrue 2.194.0,
  Storage 1.67.23 and PostgREST 14.10. Approved user descriptor exists; direct
  download and 86,400-second signing fail; trusted three-second URL retrieves real
  synthetic bytes; revoked descriptor/new signing fail; existing bearer still
  works briefly, then expires. **No deployed Storage exercise or real-user data.**
- Generated public database types match the clean local schema.
- First full unit run: 1,380 passed, two server-page tests failed because the new
  trusted signing factory lacked a test boundary mock. Corrected test setup;
  final full rerun **183 files / 1,382 tests passed**, with 59 configured feature
  gates passing. Coverage: 85.83% statements, 80.61% branches, 84.74% functions,
  89.46% lines. This first run is not passing coverage evidence.
- Final lint exits zero with two existing unused image-disable warnings; fixture
  warnings corrected. Typecheck and optimized default Turbopack build pass. Initial
  build failed because dependencies were symlinked outside Turbopack's root; an
  APFS clone of the identical locked dependencies resolves this local setup issue.
- Targeted browser coverage: 45 passed, six existing skips across desktop, tablet
  and mobile Chrome (theme/public sharing/privacy). The first bundled-browser
  attempt failed because that Playwright browser revision is absent; it is not a
  passing run. No assertions were weakened; installed Chrome was used for the rerun.
- Node 24.22.0 Alpine runtime constructs the locked Supabase client successfully
  with native WebSocket present. Full Docker image build/start remains unexecuted
  due local disk pressure; do not promote the runtime probe to an image-build pass.
- Dependency audit reports zero affected packages/no exceptions. TruffleHog 3.97.9
  scans the changed-file snapshot without network verification: zero detected
  verified or unverified secrets. Re-scan after final corrections remains required.
- GitHub live controls attempt: ruleset PUT rejected HTTP 404; independently read
  permissions confirm admin=false, maintain=false, push=true. No environment
  update followed. Required database CI remains present, approval count remains 0.

## Independent review and resolution ledger

Round one: fresh-context read-only data/security and operations reviewers, both on
`/tmp/nak74-review-manifest.json`. No claim of a different model. Reviewers used
isolated rollback-only SQL and inspected source/callers rather than trusting the
reported test results. Initial reports are retained in the parent review record.

- **NAK74-FIX-REV-01 P1**, confirmed, pre-existing: owner-writable horoscope
  descriptor could name a foreign owner's object; the trusted signer would sign
  it. Reviewer reproduced foreign INSERT and viewer resolution. Corrected with a
  write trigger plus fail-closed existing-row resolution. Five role-aware pgTAP
  checks cover foreign insert/update, historical poisoned row, and valid access.
- **NAK74-FIX-REV-02 P2**, confirmed, introduced: recent known-safe final error
  allowed unacknowledged singular recovery to clear the original first-attempt
  clock, even after earlier uncertainty. Preserve the clock unless explicit risk
  acknowledgement. Three pgTAP checks prove recovery retains the original clock
  and cannot later cross its horizon.
- **NAK74-FIX-SELF-03 P2**, confirmed during integration inspection, introduced:
  pg_net's default client SELECT grants covered dispatch headers containing the
  Vault-derived credential. The initial grant-revocation approach was ineffective because the provider
  owns that table; regression checks caught the failure. Replaced static bearer
  dispatch with a 60-second action-scoped MAC plus durable one-use nonce ledger.
  The permanent secret never enters the queue. Tests cover nonce replay, absent
  bearer/secret in dispatch headers, tampering, expiry, future timestamps and route
  scope. Vault grants were independently checked as already denied. No production credentials were printed. This is an implementation deviation from the initial
  static-bearer scheduler plan, recorded in Linear before rollout.

Round two reviewer return and final source-hash freshness check pending.
Final application rerun after the HMAC change is in progress; earlier passing
application/coverage results remain historical for those corrected paths. Required
human release authorization remains separate from agent review.

## Rollout, recovery and unresolved evidence

Follow [production maintenance runbook](../../operations/production-maintenance.md).
Apply compatible application/migrations together; activate only after secret and
hosting checks. No automatic historical resend. Keep NAK-74 In Progress until
production conditions are met. Do not close findings based solely on a green local
suite. Previously lost provider references cannot be reconstructed by this trigger.
No rollback may reintroduce browser-controlled protected signing.

## Reusable lessons

- Storage SELECT is also permission to mint capabilities through the installed
  SDK; app TTL checks are insufficient when clients retain signing authority.
  Keep the real Storage negative test and session/trusted-signer separation tests.
- FK cascades are part of the cleanup threat model. Independent purge obligations
  must survive account erasure; a job FK is not durable provider deletion evidence.
- Provider acceptance can be uncertain. Persist the first send clock independently
  of lease/retry counters and stop before provider deduplication retention ends.
- Empty queues prove neither scheduler cadence nor historical purge. Check elapsed
  time since successful work and test an absent scheduler with an independent alert.


## Final defensive path validation correction

Round-two data review established **NAK74-FIX-REV-03 P1**, confirmed and
introduced: an owner-prefixed stored photo name could contain URL-normalization
segments. A service-role signing URL could therefore address a different object
than the raw authorized descriptor. The installed SDK/WHATWG Request path behavior
was independently reproduced without contacting a provider.

The correction permits only canonical generated object names at both boundaries:
photo/thumbnail/blur writes and horoscope writes reject noncanonical names; the
server refuses all noncanonical historical photo/horoscope descriptors before
signing. Literal or encoded dot/separator forms, backslashes, query/fragment
characters and empty segments fail closed. Existing valid generated paths keep
working. Noncanonical historical attachments require a safe reupload rather than
normalizing a possibly foreign path. Four role-aware SQL checks and seven
service cases cover writes and historical signing. Final reviewer return and
post-correction gates are pending; this section does not close that finding yet.

The data review tool then stopped with a cybersecurity-content flag. That failed
turn is not a completed final review. The available independent operations
reviewer will inspect the final defensive correction and full manifest in the
third/final permitted review round. No production service was contacted.


## Final accepted local evidence — October 17

Third/final independent reviewer return: no new material findings in the requested
personal-portfolio correction. The retry clock and canonical-path corrections are
resolved on the final runtime source. The reviewer independently passed 41 focused
application cases, 39 page/service cases, and the 54-assertion role-aware sharing
SQL file, and matched all 38 source/document hashes in the final fixture manifest.
The author independently rechecked all hashes before this evidence-only addition.

- Full unit/coverage: **183 files, 1,390 tests passed**; 59 feature gates passed.
  Statements 85.87%, branches 80.69%, functions 84.76%, lines 89.48%.
- Clean migration replay plus full database suite: **54 files, 1,457 assertions
  passed**. Public generated types match fresh local introspection.
- Final typecheck, default optimized Turbopack build, fixture checker and diff
  whitespace check pass. Lint exits zero with the two pre-existing unused image
  disable warnings recorded above.
- After canonical-path correction: **18 additional sharing-flow browser cases
  passed** across desktop/tablet/mobile installed Chrome. Earlier 45 passes/six
  existing skips remain applicable to theme/privacy behavior.
- Real synthetic Storage proof passed; actual PostgreSQL-to-Node HMAC values match
  without placing a permanent credential in headers. SQL proof rolled back.
- Audit zero affected packages/no exceptions. Final changed-file secret scan is
  rerun before commit; earlier two scans reported zero detected secrets.
- Latest remote main was fetched again and remains the integration base d99e14c.
  Graphify executable and graph are unavailable in this worktree; no graph update
  or topology coverage is claimed.

Scope limit from final review: the unchanged BrokerDesk signer of historical
immutable manifests does not share this canonical-name guard. Broader BrokerDesk
hardening remains a separate pre-existing risk; do not describe this change as
covering every trusted signer or declaring the entire application production-ready.

Local evidence logs/manifests are retained under
`~/.codex/reports/nak74-production-fixes-2026-10-17/`; no production credentials or
startup environment dumps are included. Final runtime sources are unchanged after
review; only this evidence documentation and durable Linear progress are updated.

### Observation disposition

Code corrections for OPS-01, APP-01 (personal sharing), OPS-02 and OPS-05 are
implemented and locally verified. LIVE-01/LIVE-02 have implemented scheduler,
quarantine and health/watchdog support but require deployment, activation, stale
message disposition and observed cadence/alert proof. LIVE-03 is blocked on
repository administration permission. Conditional OPS-04 has a supported runtime
and successful Node24 SDK probe; full image build/start remains unexecuted under
local disk constraints. Production cleanup history, provider purge evidence and
previously issued bearer capabilities remain separate operational limits.

NAK-74 stays **In Progress**. No production data migration, real-provider cleanup,
notification replay, primary schedule activation, deployment or merge occurred.
