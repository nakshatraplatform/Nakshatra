# NAK-73 — authoritative liveness completion

## Latest-main integration follow-up (2026-10-17)

Explicit user request: fix **NAK73-VERIFY-01**, the integration conflict found by
requested development verification. This section is the current execution state;
the detailed implementation contract and earlier checks below remain historical.

Integration target: main aeeaecc67ad88bacafa0f9ab6b140114cbc234d0 (PR109),
fetched and verified before integration. Branch remains
fix/nak-73-didit-handoff-completion; its HEAD now equals that target. Previously
reviewed feature files outside main's changed paths were byte-checked unchanged.
Original uncommitted work is retained in a named local integration backup.

Plan and acceptance:

1. Preserve the approved feature, fast-forward the isolated feature worktree to
   main and reapply it. Resolve the maintenance task map by keeping both main's
   retention/horoscopeCleanup and the feature's single identityRun promise.
2. Reconciliation runs exactly once; liveness email waits for it; unrelated
   cleanup starts independently. A rejected retention/horoscope task must neither
   suppress email nor hide the failed batch. Add regressions for both failures,
   exactly-once reconciliation and the no-lease/no-work path.
3. Verify the combined main + feature snapshot: current maintenance consumers,
   full native unit/coverage gates, lint/types/build, browser recovery and main
   readiness checks, clean local Supabase replay of all 105 migrations, pgTAP and
   regenerated public-type comparison. Obtain an independent integration review.

Implementation: the single actual conflict was resolved in
src/features/operations/server/production-maintenance.ts; seven task entries are
retained. tests/production-maintenance.test.ts now observes retention and
horoscope cleanup explicitly, asserts one factory/run and covers their failures.
Both failing cleanup tasks remain reported as deferred while other jobs complete.
Main's additional schemas, privacy controls, public RPC types and result-page
accessibility changes were retained. No SQL behavior or dependency was changed
beyond integrating existing main and the already-reviewed feature migration.

Status: **NAK73-VERIFY-01 resolved locally** against main aeeaecc. Remote main
was rechecked after verification and still matches HEAD; no unmerged index entries
remain. The following combined-snapshot evidence supersedes the earlier counts:

- Focused integration checks: six suites / 57 tests passed. Full serial coverage:
  188 files / 1,442 tests passed, aggregate thresholds and all 61 per-file feature
  gates passed. Statements 86.12%, branches 81.09%, functions 85.02%, lines 89.74%.
  Two UI tests initially exceeded their ordinary timeouts while validation jobs
  ran simultaneously; both passed in the complete serial run without changing
  tests, assertions or time limits.
- Clean isolated Supabase replay applied all 105 migrations; 58 pgTAP files /
  1,552 assertions passed. Public types regenerated from that actual stack match
  src/types/database.generated.ts exactly. Only the isolated test stack/volumes
  were stopped and removed; no linked or production database was accessed.
- Chromium: all 27 Didit journeys and 12 main readiness cases passed across
  desktop/tablet/mobile. The broad run passed 38 cases; one desktop protected-URL
  request timed out during cold compilation, then passed alone at the ordinary
  limit (4.9 seconds). Mobile WebKit: all nine Didit journeys passed. Its temporary
  harness uses installed WebKit build 2359 and loopback synthetic APIs; an initial
  temporary-config import problem was corrected outside the repository. These
  48 cases do not establish physical iPhone or hosted provider behavior.
- Lint, typecheck, production build, database fixture smoke, exception-free
  security audit and diff whitespace checks pass. Lint retains the same two main
  unused-suppression warnings; audit has zero high/critical findings.
- Fresh independent integration review found no material findings and separately
  passed three suites / 21 maintenance, retention and email tests. It inspected
  the combined source, generated-type comparison and the verification logs.
  Supporting report: /tmp/nak73-integration-independent-review.md; source
  provenance is retained in /tmp/nak73-integration-review-final.json. This is a
  separate requested integration correction, not a restart of earlier reviews.

The required linear_phoenix connection remains unavailable, so Linear sync is
pending. Graphify update was attempted but its CLI is unavailable. No commit,
push, production migration, deployment or live provider/email action performed.
The additive feature migration must precede the matching app rollout; hosted
runtime, real Didit/Resend delivery and physical-device checks remain release
checks. Earlier evidence below describes the prior base, not this combined one.

## Current follow-up: first-click handoff and visible completion (2026-10-17)

Approved scope: fix the lost first-click Didit handoff, show submitted/confirmed
feedback and an accessible one-time completion dialog, and promptly dispatch the
durable confirmation email after authoritative approval. Base: main fc7f55c;
branch: fix/nak-73-didit-handoff-completion. Critical integration/authorization
boundary; full documentation and a fresh independent review are required.

Implementation plan:

1. Retain the newly created attempt's pending handoff until the latest eligible
   status read accepts it. Navigate once; never open cancelled/replaced attempts
   or auto-open an unrelated existing attempt on dashboard mount.
2. Recheck a returning result automatically with bounded attempts, visibility,
   server-backoff and cooldown guards. Display submitted/processing separately
   from the stored verified result. Never trust callback status parameters.
3. Present a native accessible completion dialog once per attempt/browser
   session, including honest queued/accepted/failed email feedback. Keep existing
   verified dashboard presentation quiet after dismissal. Restore focus and
   scrolling; respect reduced motion and preserve unsaved portfolio edits.
4. Reuse the existing leased email outbox through a narrowly scoped service-only
   owner/session/current-attempt claim. Schedule a bounded attempt after the
   result response using Next.js after; failures never invalidate the proof.
   Preserve background recovery, stable delivery IDs and retry deadlines.
5. Order maintenance's liveness email task after reconciliation while keeping
   unrelated queues independent, including when provider reconciliation fails.

Acceptance/evaluation contract:

| ID | Observable requirement | Evaluation |
| --- | --- | --- |
| FLOW-1 | A superseded status read cannot lose the new attempt's handoff | Reproduced component race; browser handoff regression |
| FLOW-2 | Replacement, cancellation, outage and stale reads retain fail-closed recovery | Component/route regressions |
| FLOW-3 | Only authoritative verification opens one accessible completion dialog | Component and desktop/mobile browser checks, forged callback negative case |
| FLOW-4 | Returning pending results retry boundedly and honor cooldown/backoff | Fake-clock tests; browser pending-to-confirmed journey |
| MAIL-1 | Owner dispatch can claim only that owner's current verified attempt | Real pgTAP ownership/session/stale-attempt/lease tests |
| MAIL-2 | Response completion and proof survive email errors; sends retain stable IDs | Route/worker tests; existing completion SQL suite |
| MAIL-3 | A maintenance batch sends newly queued proof emails after reconciliation | Deferred-promise ordering and failure-isolation tests |

Execution context: controller and API under src/features/identity-verification/
client; result route/service under the corresponding server directory;
scripts/candidate-liveness-email-worker.mjs; production-maintenance.ts; existing
candidate_liveness_completion database suite. No BrokerDesk policy changes,
provider sessions, production migrations, schedule activation or live emails.
The required linear_phoenix connection is unavailable in this session; durable
Linear synchronization remains pending, rather than using another connection.

Status: implementation complete locally; final verification and independent
correction review are recorded below. This section supersedes the historical
pending gates below for this follow-up, without claiming a production release.

### Implemented behavior and boundaries

- Start retains the new attempt's handoff through overlapping status reads and
  temporary status outages. Only the latest matching eligible status may open
  Didit; replacement/cancellation/cleanup invalidates that pending intent.
- Return processing makes up to four automatic canonical result checks within
  two minutes, at least 15 seconds apart and subject to visibility, interaction
  cooldown, worker backoff and policy-error guards. Further recovery stays
  available through the existing controls and durable background worker.
- A verified result opens a native dialog once per attempt in browser session
  storage, with a mounted fallback when storage is unavailable. Email feedback
  distinguishes queued, accepted, failed and unknown; accepted is not delivered.
  The dialog owns focus/Escape, restores scrolling and respects reduced motion.
- Owner-result confirmation schedules a single scoped email attempt after the
  response. A separate email intent handles a proof confirmed by another worker
  after an earlier pending lookup; it does not consume the provider retry budget.
  The privileged database claim rechecks current owner, live/nonexpired session,
  exact current liveness-only proof, recipient and existing leased outbox rules.
- Maintenance waits for reconciliation before claiming liveness emails; provider
  configuration/fetch failures still allow independent queues to run.
- Dashboard server readiness refreshes when its verified proof state disagrees
  with the authoritative controller, preserving completion/expiry updates and
  unsaved answers while avoiding navigation races for transient states.

Created: client/liveness-completion-dialog.tsx and its CSS module; migration
20261018021337_candidate_liveness_owner_email_dispatch.sql; its owner-email
pgTAP suite; candidate-completion-dispatch-route and liveness-completion-dialog
unit suites. Changed: dashboard controller and parent; result page/route/service;
shared recovery route; existing email worker and maintenance orchestrator;
regenerated public database types; corresponding component/service/worker,
maintenance, return-page and browser regressions. All paths are within existing
src/features/identity-verification, src/app, scripts, tests, e2e and supabase
boundaries. No dependency changes or alternate proof evaluator were introduced.

### Verification evidence — 2026-10-17

- Final full unit/coverage run: 187 files / 1,434 tests passed; aggregate
  thresholds and all 59 per-file feature gates passed.
- Chromium: 27 cases passed across desktop, tablet and mobile, including the
  deliberately overlapped first-click read, delayed and background-confirmed
  results, forged signed-out callback, outage/cancellation recovery and native
  dialog keyboard/deduplication checks. Tablet dialog tested in Dark; mobile
  reduced-motion dialog tested at 320px with no document overflow.
- Mobile WebKit: all nine equivalent journeys passed after fixing FLOW-02.
  Uses installed WebKit build 2359 with the existing Playwright harness and
  synthetic APIs; this is not a physical iPhone or actual hosted Didit test.
- A clean isolated Supabase stack applied all 102 migrations, including the new
  owner-email claim. All 55 pgTAP files / 1,475 assertions passed. A real pair of
  simultaneous local PostgreSQL connections also confirmed owner and scheduler
  claims skip each other's active email lease: one attempt per recipient, with
  the other user's job still independently claimable.
- Public database types were regenerated from that actual local stack; only the
  new public owner-email RPC was added. Local synthetic stack/volumes were
  stopped and removed after tests; production/linked projects were not changed.
- Lint passes with the same two base unused-suppression warnings; typecheck,
  production build, db:smoke, diff whitespace and security audit pass. Audit:
  zero high/critical findings, zero exceptions. A first build hit local ENOSPC;
  only this worktree's reproducible failed output was removed before retry.
- Fresh-context review (same inherited model, not claimed cross-model) found
  FLOW-01; correction review freshly passed nine suites / 149 tests and inspected
  the changed parent consumer. Final source provenance and reviewer disposition
  are retained in /tmp/nak73-flow-review-final.md and its final manifest. These
  scratch paths are supporting session evidence; this record retains the result.
- Graphify graph is absent; requested graphify update was attempted but its CLI
  is unavailable. No graph or unrelated primary-checkout state was modified.

### Findings and resolution ledger

- **NAK73-FLOW-01, medium, confirmed/introduced, resolved:** a pending automatic
  lookup consumed the same counter as queued-email dispatch, so a later verified
  GET showed success but missed prompt delivery. Fresh reviewer reproducer failed
  before correction. Separate per-attempt email intent fixes it; component and
  all browser-device background-proof regressions pass. Durable outbox authority,
  leases, provider backoff and stable delivery IDs are unchanged.
- **NAK73-FLOW-02, medium, confirmed/pre-existing, resolved:** the base dashboard
  refreshed for every verification state (base line 200), and mobile WebKit's
  route-refresh fallback could override Didit navigation. Two WebKit journeys
  failed, and a new parent regression observed unwanted idle refreshes before
  correction. Restrict refresh to differing authoritative/server proof states;
  both newly added parent tests, the unsaved-draft regression, and all nine
  WebKit journeys pass. Reviewed as an affected consumer of FLOW-1.
- Verification-only corrections: the policy-backoff test now updates the mocked
  GET atomically with the mocked result commit, matching canonical storage; the
  first contradictory mock is not treated as a product defect. The brand gate
  rejected hardcoded dialog shadow/font values; existing semantic tokens now
  satisfy that gate. Neither acceptance criteria nor thresholds were weakened.
- Reusable lesson: integration navigation tests need the actual parent readiness
  callback and an additional browser engine; controller-only URL mocks missed
  route refresh racing a same-tab external navigation. Retained parent and
  mobile WebKit reproductions detect this failure without live provider traffic.

### Rollout and remaining release checks

1. Apply 20261018021337_candidate_liveness_owner_email_dispatch.sql through
   protected database CD before deploying this app/worker revision. The existing
   scheduled claim RPC and outbox are preserved; this is forward-only and needs
   no data reset. Roll back the application if necessary; retain the additive
   migration rather than deleting outbox records or bypassing lease fencing.
2. Vercel's result route now needs existing server-only RESEND_API_KEY and
   RESEND_FROM_EMAIL (optional RESEND_REPLY_TO_EMAIL), in addition to existing
   Supabase/Didit server configuration. Supabase Auth SMTP settings alone do not
   configure application notification delivery. Keep the same email configuration
   on the fallback worker. Missing mail config never removes a verified proof.
3. Verify deployed completion -> stored proof -> dialog -> provider acceptance ->
   inbox using an authorized real Didit sandbox account and Resend recipient.
   Physical-device QR/camera return, hosted runtime after-response execution and
   delivery are separate release checks; local synthetic tests cannot prove them.
4. Keep scheduled reconciliation/email recovery enabled and healthy for users
   who close the return page. Existing scheduler activation/health follow-ups are
   not replaced by this request-driven fast path; cron timing is not guaranteed.

No commit, push, live provider session/email, production migration or deployment
was performed in this follow-up. Required linear_phoenix remains unavailable;
this approved plan/progress is durable here pending synchronization through that
specific connection.

## Contract and scope

Critical: private database migration, provider integration and transactional email.
Follow-up to NAK-73 recovery. New sessions use the configured liveness-only
workflow; existing attempts keep their recorded workflow ID/version. Do not
relax liveness-only validation, approval deadlines, cancellation fencing,
publication authorization or representative checks.

An authenticated owner must see the stored result on the return page and
dashboard. Browser callback parameters are never approval evidence. Approval
refreshes publication readiness without discarding unsaved editor changes.
Persist a deduplicated confirmation-email job atomically with a new verified
proof; sending mail must not roll back or gate verification. Retry boundedly
with a stable Resend idempotency key; distinguish accepted from delivered.
Expose safe processing diagnostics, not provider payloads or bearer links.

## Implementation sequence

1. Regression tests for completion UI and dashboard synchronization.
2. Authenticated return page using existing owner status controls; signed-out
   visitors get a safe sign-in/dashboard action, not inferred approval.
   A bounded owner-requested result lookup uses the existing worker evaluator
   and a dedicated service-only lease RPC. Database ownership, live session,
   exact current attempt, expiry, leases and retry backoff are rechecked. This
   avoids relying only on GitHub cron for a user returning from Didit.
3. Additive private completion outbox, service-only leased claim/completion,
   atomic enqueue from the existing authoritative proof update.
4. Existing candidate worker dispatches bounded email jobs independently of
   provider deferrals using the existing Resend adapter contract.
5. Safe processing diagnostics and distinct decision-policy reasons.
6. Focused UI/provider/worker/SQL tests, static gates, clean migration tests,
   independent review; record remaining release gates explicitly.

## Evaluations and wrong implementations rejected

- Repeated status reads must not create sessions or duplicate notifications.
- A forged `status=Approved` callback must not verify or email anyone.
- Anonymous/cross-owner access cannot read private results or claim mail work.
- Stale leases cannot complete another delivery; transient mail failures retain
  the proof and retry the same message, with no retry beyond idempotency bounds.
- Missing/extra provider checks fail closed with an operational diagnostic;
  configuration changes never reinterpret an older attempt.
- Dashboard completion must refresh server readiness, not flip a client-only
  publication authorization flag.

## Release and recovery

Deploy migration before matching worker/app. Supply existing RESEND_API_KEY,
RESEND_FROM_EMAIL and optional RESEND_REPLY_TO_EMAIL to the isolated worker.
Use the real sandbox to verify complete -> stored proof -> UI -> accepted email;
inbox delivery remains a separate real-provider check. No production reset,
remote migration, key change or deployment is part of local implementation.
Do not promise an exact GitHub scheduled-worker dispatch time.

## Execution context / progress

- Base main: 59dcc0b3044ef7633393b21d3f2c2d5c646bcd74.
- Local branch: fix/nak-73-liveness-completion.
- Existing authority: complete_identity_verification_reconciliation updates
  attempts and subjects; get_current_candidate_liveness_verification is owner
  authorized. Dashboard currently retains stale publication readiness; result
  page is static. No completion email currently enqueued.
- Local validation and independent review are recorded below. No production mutation performed.

### Local implementation and verification — 2026-10-08

- Implemented owner-authorized immediate result checking, authenticated return
  controls, server publication-readiness refresh without discarding editor state,
  safe processing diagnostics and transactional confirmation-email enqueue.
- Approval remains the existing canonical reconciliation transaction: attempts
  record provider correlation/results; subjects hold the current proof. Only
  after that transaction commits may the UI report completion or email dispatch.
- New private `candidate_liveness_email_outbox` holds only the recipient, proof
  attempt, leased delivery state and provider message ID—not biometric evidence.
- Full unit/coverage run: 160 files / 1,120 tests passed; per-file feature coverage
  passed for all 56 covered files. Additional dashboard refresh/draft-preservation
  regression passed in the dashboard suite (see current local test output).
- Playwright recovery/completion: 15 passed across desktop, tablet and mobile.
- Supplemental native PostgreSQL 14 clean replay: 87 migrations passed; 105
  focused pgTAP assertions passed. Synthetic Auth/Storage fixtures mean this is
  **not** authoritative Supabase CI evidence or a real contention test.
- Security audit passes under the repository's existing development-only
  GHSA-vfj7-8cjw-p6xm exception, expiring 2026-10-09 00:00 New York. The advisory
  is not fixed by this work; production high/critical findings: none.
- Lint/typecheck and production build pass; two pre-existing unused ESLint
  suppression warnings remain. `db:smoke` and `git diff --check` pass.
- Fresh-context review inspected owner/session authorization, lease/expiry
  fencing, strict decision policy, outbox/idempotency, UI and server readiness;
  no material defect found. Final provenance passed on snapshot
  `ed57db33f66b2248d377fb9726832aa3d0467607c2b10d0c5b876cc0b1d08aa0`,
  including the shared schema filename correction and added parent regression.
  External report: `/tmp/nak73-completion-review-report.md`. Only this progress
  record changed subsequently; implementation and tests remain reviewed.

### Final-review correction — NAK73-FINAL-01

- Subsequent review found that immediate result checking constructed its worker
  after taking the database lease. A missing Didit API key therefore returned
  an incorrect request-security `400` and held the lease until expiry.
- Worker construction/configuration validation now precedes the privileged
  claim, after owner/current-attempt checks. Missing configuration returns safe
  `503 IDENTITY_VERIFICATION_RECOVERY_UNAVAILABLE`, with no claim or provider I/O.
- Added a route regression using the real worker factory (not its mock), covering
  both active and awaiting-result states. Observed failing `400` before the fix;
  all seven affected suites now pass: 84 tests. Typecheck and lint pass, with the
  same two pre-existing unused-suppression warnings. Diff whitespace check passes.
- Lesson: integration configuration tests must exercise actual factory setup,
  and local configuration must be validated before acquiring external-work leases.
- Prior independent-review provenance above does not cover this correction.
  Self-review confirms ordering and unchanged canonical approval rules; independent
  correction review remains pending because the three-round automated review
  budget has been reached. No release-readiness claim is made.
- Earlier full coverage/build/browser evidence applies to the earlier snapshot;
  those checks were not rerun for this narrow service-ordering correction.

### Deployment prerequisites and remaining gates (2026-10-08 historical)

- Apply `20261008050441_candidate_liveness_completion_notifications.sql` through
  protected CD before deploying this app/worker revision. Never rerun old
  migrations to reset verification attempts.
- Vercel requires existing `SUPABASE_SERVICE_ROLE_KEY` for the protected
  immediate-result route; secrets remain server-only. Existing Didit app/worker
  credentials must target the dedicated liveness-only workflow.
- The isolated GitHub worker needs `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and
  optionally `RESEND_REPLY_TO_EMAIL`. Missing email configuration does not
  invalidate the proof, but produces a failed email job and worker alert.
- Authoritative clean Supabase migrations/pgTAP and generated public-type diff
  remain pending: local Docker unavailable; new RPC declarations are reflected
  manually from SQL contracts, not represented as successfully regenerated.
- Actual concurrent database connections, real Didit webhook/retrieval and
  completion -> dashboard -> Resend acceptance/inbox must be tested before
  release readiness. Browser tests use loopback APIs and cannot prove delivery.
- Older sessions retain their original workflow/version and deadline. Changing
  the Didit workflow does not retroactively fix those sessions. Never force
  approval, clear uncertain cleanup, or resend an uncertain message beyond the
  provider idempotency window. Failed mail jobs need operator diagnosis; no
  automatic permanent-error reset is added.
- Local disk filled during build; only reproducible `.next`/`.next-e2e` outputs
  were removed and checks retried. No source or user data was removed.
- No commit, push, remote migration, deployment or real-provider request made.
