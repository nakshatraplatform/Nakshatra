# NAK-66: publication and request receipts

## Contract — critical risk / full record

Original base: main 0587acc; integrated main 0c2e9d2 for PR preparation.
Reuse the private notification outbox and Resend delivery
ledger; no second scheduler, per-route provider call, or public send endpoint.
First publication queues one owner confirmation. Each successful interest
submission queues a requester receipt in addition to the existing owner email.
Receipts describe historical actions, not current permission or inbox delivery.
Only authenticated database-resolved recipients are used. No private profile
fields or bearer links enter these messages. Publication dedup survives outbox
retention; historical publications do not receive retrospective messages.

## Design and boundaries

Forward-only migration adds two outbox types and extends every existing consumer,
recovery and health allowlist without changing leases, quotas or permissions.
A private portfolio-keyed marker (cascading on portfolio deletion) records first
publication independently of retained mail. Existing issued/published portfolios
are marked without mail. Atomic triggers run inside the guarded business RPCs.
The GitHub watchdog checks main regardless of the dispatcher enable flag; missing
credentials fail visibly. It never dispatches work or activates the DB schedule.

## Evaluations

- MAIL-1: real-role publication and interest RPCs enqueue correct recipients;
  failed transactions enqueue nothing (reject a post-response-only producer).
- MAIL-2: updates, unpublish/republish and outbox pruning do not resend first
  publication (reject queue-retention-dependent deduplication).
- MAIL-3: unprivileged callers cannot write markers/outbox or enqueue arbitrary
  recipients; service claims and completion/recovery include both new types.
- MAIL-4: renderer uses authoritative email, privacy-minimal copy and existing
  tracked transport; receipt is not approval. Provider failure remains retryable
  according to existing policy.
- MAIL-5: watchdog cannot silently skip a disabled/misconfigured dispatcher.
- Gates: focused unit tests, clean local migration/pgTAP, local mocked-provider
  integration, lint/typecheck/coverage/build, generated public-type check and
  fresh independent review. Real inbox UAT is separate, not simulated success.

## Rollout and recovery

Pause dispatch during schema/app transition; deploy additive schema then matching
app. Do not roll back the renderer while new types remain claimable. Configure
Resend/server/health credentials and validate protected health before authorized
activation. Shared maintenance also deletes retained/account/provider data:
activation needs explicit operational approval. Held historical work must be
reviewed individually, not bulk-reset. Auth mail remains Supabase Auth's path.

## Execution context / evidence

Implementation complete locally; activation and inbox UAT pending. No production
writes, sends, activation or queue resets. Runtime read-only inspection found scheduler disabled, no successful run,
18 overdue queued and two unresolved items (aggregate). Source paths: notification
service, new migration, production-health workflow and their tests. Real inbox
UAT remains NAK-82; other NAK-66 lifecycle events are outside this increment.

## Verification — October 22, 2026 (local)

- Regression first: both new renderer cases failed on the base enum, then passed.
- Lint, typecheck, fixture smoke, diff whitespace check and production build with
  synthetic public configuration passed. No private production configuration used.
- Full unit coverage: 208 suites / 1,733 tests; 89.31% lines, 81.77% branches;
  all 63 feature files and 21 protected-boundary coverage gates passed.
- Clean replay and all 64 pgTAP suites / 1,836 assertions passed in disposable
  loopback stack `nak66-mail-completion`, including 29 new real-role assertions.
  Initial local setup omitted configured Storage buckets; corrected to match the
  project before clean replay. The expiry test now counts expiry claims explicitly
  because normal publication mail is also legitimately claimable.
- Four real local Supabase/HTTP delivery tests with mocked Resend passed again
  after clean reset. These validate transport/receipts, not actual inbox delivery.
- Regenerated public types compare exactly; only private schema objects added.
- Database lint: no errors; four unchanged unused-parameter warnings in existing
  publication/renewal/BrokerDesk functions. Security audit: no high/critical,
  three affected packages at lower severity and no exceptions.
- Fresh-context independent review round 1: no material findings on manifest
  `d04565903f44f3a8541ce5ca70438790abd28acb64ed28c364795ec57e1207d8`.
  Reviewer independently ran 29 SQL and 20 focused unit checks, inspected all six
  runtime consumer allowlists, and verified start/end provenance. Model identifier
  unavailable; no cross-model claim. Read-only instructions plus hash checks,
  not enforced filesystem isolation. Historical-data migration backfill was
  source-reviewed, not tested against a populated pre-migration production clone.
- Parent removed an accidental transitive YAML import in the workflow regression
  test, matching existing structural workflow tests without another dependency.
  Final affected checks and documentation review are recorded in the handoff.
- Graphify graph and executable unavailable; no graph refresh claimed.

## Remaining release gates

Not deployed. Pause dispatch during schema/app compatibility transition,
deploy protected CD migration and matching application, authorize shared scheduler
activation after queue review, configure actual runtime credentials, then verify
owner/requester inboxes and signed delivery events. Browser journeys and real
provider sends were not run in this backend-only increment. No claim that all
NAK-66 lifecycle work or production delivery is finished.

## PR integration verification — October 24, 2026

- Integrated main `0c2e9d2`; the only merge conflict was the project-map entry.
  Both the email and landing entries are retained. Application email logic,
  SQL content and its tests remain unchanged from the reviewed implementation.
- Renamed the unpublished migration to
  `20261024044101_transactional_email_completion.sql`, after the latest migration
  on main. Its content hash exactly matches the round-2 reviewed migration.
  This keeps normal protected CD forward-only without `--include-all`.
- Lint, typecheck, fixture smoke and synthetic-configuration production build
  passed on the integrated branch. Full bounded-worker coverage rerun passed:
  213 suites / 1,778 tests; 89.16% lines, 81.78% branches; all 63 feature-file
  and 21 protected-boundary gates passed. An initial unrestricted run failed
  one existing `IntersectionObserver` fixture; its isolated rerun and the full
  bounded rerun passed without changing the test or application.
- Current dependency audit is **failed**: high-severity `zod` and `undici`
  advisories are now reported. `package-lock.json` is byte-identical to main;
  these dependencies are not introduced by this increment. No exception or
  audit bypass was added. Dependency remediation is required before merge.
- Fresh integrated clean database replay is **blocked** because local Docker
  commands do not respond. The earlier 64-suite / 1,836-assertion replay and
  four mocked-provider integration checks are historical evidence; hosted CI
  must verify the renamed migration alongside the newly merged migrations.
- Production remains unactivated: latest protected health reports email
  configuration incomplete, scheduler disabled and no successful worker run.
  Vercel runtime settings must be picked up by a production redeployment.
  Actual inbox delivery and stale-message review remain separate release gates.
- Fresh-context independent integration review (round 3 of 3) found no material
  code findings on manifest
  `f71657e921bce97dc00a64b1c9d128af4823442b3f27f873f417832531f07804`.
  Reviewer verified provenance, main lockfile equality, unchanged SQL content,
  all six consumers and integration compatibility; no provider calls or test
  reruns. Model identifier unavailable. Merge/release remain blocked by the
  audit, integrated database gate and production/UAT requirements above.
  This final review-result addition is documentation only.
