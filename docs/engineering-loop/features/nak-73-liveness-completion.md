# NAK-73 — authoritative liveness completion

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

### Deployment prerequisites and remaining gates (current)

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
