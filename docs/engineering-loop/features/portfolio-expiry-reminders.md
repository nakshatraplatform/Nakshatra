# NAK-66 — automatic personal portfolio expiry reminders

## Execution context

Approved October 18, 2026: implement the evaluated reminder recommendation.
Base: main d92275f; branch feat/nak-66-portfolio-expiry-reminders.
Full documentation, Critical tier: private outbox/schema, service-role workers
and external email. BrokerDesk logic, Auth SMTP, production activation and
other unfinished NAK-66 event types remain outside this increment.
Implementation and local verification are complete; independent review resolved
both findings. Next: review/commit/push when requested, coordinated deployment,
staging inbox UAT and separately authorized activation.

## Problem and goal

Existing service-only enqueue_due_full_view_expiry_reminders has no scheduler
caller. Owner reminder rendering does not load its grant; viewer rendering
does not compare the original expiry after renewal. Connect existing five-minute
maintenance and durable Resend delivery with safe stale-reminder disposition.
One viewer and one owner email per eligible personal Complete Portfolio grant
expiry period. Renewals create a new period; expiration/revocation/unpublication
and changed recipients invalidate unsent reminders. Accepted mail cannot be
recalled; links always enforce current authorization.

## Design and implementation plan

1. Forward migration preserves the existing outbox and old enqueue signature,
   bounds due-grant selection, uses exact UTC expiry-period identity and
   honors prior date-based keys during transition. No second queue/cron/provider.
2. A private canonical eligibility check verifies grant, expiry snapshot, current
   owner/viewer, approved request, verified recipient and available portfolio.
   A fenced service-only pre-send RPC rechecks the current state and binds a
   digest of the exact rendered request; only the digest persists, never the raw address/body.
   Repeated uncertain sends cannot use changed recipient/content with the same ID.
3. Expiry-only terminal skipped disposition represents obsolete work honestly;
   skip does not count as sent or create permanent failed-health alerts. Existing
   uncertain retry clocks, leases and broker/pilot isolation are preserved.
4. Maintenance enqueues once before relationship-email claims. Failure remains
   visible but old mail and unrelated jobs run. Preserve seven existing jobs,
   including the single verification-before-liveness-email dependency.
5. Bound producer/consumer work, reserve claim capacity for regular relationship
   notifications and reminders, order reminders by expiry, monitor due work and
   gaps; preserve current five-message batch until workload evidence supports more.
6. Reuse sender/Reply-To configuration and identity-bound links. Plaintext reminder
   subjects remain; give both audiences explicit UTC expiry. No sensitive details.

## Acceptance and evaluations

| ID | Requirement | Verification |
| --- | --- | --- |
| EXP-1 | At most one owner/viewer job per exact eligible grant period | Real pgTAP boundaries, repeated runs, renewal and legacy compatibility |
| EXP-2 | Revoked/expired/renewed/unpublished/unverified/changed-audience jobs never start a fresh send | SQL negative cases, worker injected-send assertions |
| EXP-3 | Concurrency and retries preserve one fenced claim and unchanged request | Lease/overlap/digest tests, real PostgreSQL concurrency |
| EXP-4 | Enqueue settles before claims; its failure never starves old mail or cleanup | Deferred-promise maintenance tests |
| EXP-5 | Obsolete work is skipped, never sent/failed; due work remains observable | SQL completion/health cases, service counters |
| EXP-6 | Batches are bounded and neither reminder nor regular mail monopolizes claims | Mixed backlog SQL fixtures and query-plan inspection |
| EXP-7 | Only privileged runtime can produce/prepare mail; existing broker/pilot behavior preserved | Role denials, existing pgTAP/service regressions |

## Verified locations and consumers

- src/features/operations/server/production-maintenance.ts: scheduled orchestration.
- src/features/notifications/server/relationship-notification.service.ts: trusted
  recipient lookup, render, prepare, shared provider and completion.
- src/app/api/internal/relationship-notifications/route.ts: existing operator entry.
- supabase/migrations/20260913120000_creator_publication_readiness.sql: old producer.
- supabase/migrations/20261017185604_fence_relationship_notification_delivery.sql:
  latest claim/completion/recovery and quarantine rules.
- supabase/migrations/20261017203833_schedule_retention_with_health.sql: health.
- tests/production-maintenance.test.ts, tests/relationship-notification.service.test.ts
  and supabase/tests/database/: native behavior checks.

## Security, rollout and compatibility

Keep RPC execution service-only with empty search_path and explicit revokes.
Read recipients from verified auth.users; preserve private queue RLS. No real
credentials, addresses or message payloads in logs/reports. Never bypass consent,
publication, viewer identity, existing retry quarantine or access revocation.

Migration must precede matching app. Install without enabling live dispatch.
Confirm existing protected schedule, From/Reply-To and monitor in the intended
environment; perform an authorized real-inbox test separately. Roll back the app
only with compatible skip-aware workers, or pause dispatch; do not remove proof
or queue rows. Supabase SMTP and signed delivery webhooks are separate work.

## Progress / verification

Implementation is present locally. Initial four dispatch regressions failed on
unchanged source and pass after implementation. Focused worker/maintenance checks
pass 49 tests in four suites. After review corrections, a clean replay of all 107
migrations and all 59 SQL suites / 1,628 assertions pass, including 62 new reminder
assertions. Actual simultaneous PostgreSQL sessions confirm one overlapping
enqueue adds two messages while the other adds zero; parallel claims return
distinct jobs. Type checking, lint, generated-type comparison and database
security advisors pass. Full coverage, feature gates and production build pass. Independent return
review found no new material issue and resolved both findings. No browser UI changed; real provider/inbox delivery is not proved
by injected sends or loopback database checks.

### Independent review resolution ledger

Round 1: fresh-context reviewer `/root/nak66_expiry_review`, inherited model
(identity not exposed; not cross-model), base d92275f, snapshot
`c6e292e068bfed63548916b0b4060d78ec7d78d514ec60b94a88eff68d976a3c`.
Report retained in `/tmp/nak66-expiry-independent-review.md`.

- **NAK66-R1-F1** — medium, material, confirmed, introduced; EXP-5/6.
  Claim quarantine could turn obsolete overflow beyond the 100-row skip sweep
  into permanently failed mail. A 150-row regression reproduced 50 failures;
  the forward migration now quarantines only current reminders and leaves
  obsolete overflow for subsequent bounded skip sweeps. Assertions verify zero
  claims/failures and retirement over successive sweeps. Corrected SQL suite
  passes; independent round-2 checks R2-S1/R2-P1/R2-SQL-H1 resolve this finding
  on reviewed code snapshot `48f0e7e7234674c4678c99a87a74eb3774f1431a1706ab543e7e029b7f0e36a3`.
- **NAK66-R1-F2** — medium, material, confirmed, introduced; EXP-3.
  `REMINDER_PREPARE_FAILED` was absent from supported safe recovery allowlists.
  Per-item and bulk recovery regressions failed on the prior implementation;
  the forward migration adds this pre-provider failure code to both lists,
  preserving clocks, manual-review windows and pilot exclusion. Corrected SQL
  suite verifies both recovery paths, retained first-attempt time and pilot
  exclusion; independent round-2 checks R2-S2/R2-U1/R2-SQL-H1/R2-P1 resolve
  this finding on the same reviewed code snapshot.

Existing readiness SQL fixture needed a valid 21-character publication token and
the actual publication command to create active snapshots: the reminder rule now
reuses canonical is_published_portfolio rather than trusting a raw published flag.
No authorization/publication controls were disabled. The first standalone
concurrency harness had local fixture/transaction-cleanup errors; corrected fixed
synthetic fixtures now pass and are removed from this disposable stack.
No production mutation or real email was performed.
Round-2 report: `/tmp/nak66-expiry-independent-review-round2.md`; no material
findings. The reviewer independently ran 46 focused tests in three suites and
checked source/provenance. Broader execution below is coordinator evidence.
Final documentation-only closure is checked separately; no implementation,
test, dependency or acceptance rule changed after the reviewed code snapshot.
Linear NAK-66 is the implementation context; NAK-82 holds inbox UAT, not
automated-test certification.

### Final verification (October 18, 2026)

| Check | Result / evidence |
| --- | --- |
| Clean migration replay | PASS, all 107 migrations, isolated project `nak66-expiry` on loopback port 55722; `/tmp/nak66-expiry-db-replay-reviewed.log` |
| `supabase test db supabase/tests/database --db-url <isolated-loopback>` | PASS, 59 suites / 1,628 assertions; `/tmp/nak66-expiry-db-reviewed.log` |
| Real concurrent enqueue/claims | PASS, overlapping producer queues two/zero; consumers claim distinct rows; `/tmp/nak66-expiry-concurrency-reviewed.log` |
| `vitest run --coverage --maxWorkers=1` and `npm run coverage:check:features` | PASS, 194 suites / 1,545 tests; 90.23% lines, 81.76% branches; all 61 feature files pass 80% per metric; `/tmp/nak66-expiry-coverage.log` |
| `npm run lint`, `npm run typecheck`, `npm run db:smoke` | PASS; `/tmp/nak66-expiry-{lint,typecheck,smoke}-reviewed.log` |
| `npm run build` with synthetic public settings and VERCEL=1 | PASS; `/tmp/nak66-expiry-build.log`; no live backend/provider credentials |
| Generated public schema types | PASS, actual local generation matches `src/types/database.generated.ts`; `/tmp/nak66-expiry-types-reviewed.ts` |
| Application-schema SQL lint and security advisors | PASS, no application errors / security findings; four inherited unused-parameter warnings; `/tmp/nak66-expiry-schema-lint-reviewed.log`, `/tmp/nak66-expiry-advisors-reviewed.log` |
| `npm run security:audit` | PASS, no high/critical findings or exceptions; `/tmp/nak66-expiry-audit.log`; unchanged dependency manifest retained across SQL-only corrections |
| Due-producer EXPLAIN ANALYZE | Observed 4.836ms on 31 synthetic grants / one due; `/tmp/nak66-expiry-query-plan.log`; small-fixture observation only |
| Diff hygiene / current base | PASS, `git diff --check`; remote main still d92275f at handoff |
| `graphify update .` | BLOCKED, command unavailable and no repository graph exists; `/tmp/nak66-expiry-graphify.log`; not a passing graph refresh |
| Browser UI / hosted delivery / production activation | NOT RUN: no UI changed; injected sends and database integration are appropriate local checks; actual inbox, hosting, scheduler and release evidence remain separate |

Schema lint is scoped to maintained public/app_private functions. An unfiltered
pass also inspects pgTAP extension functions requiring session-local temporary
relations and produces third-party errors; those are not application errors.
The own disposable stack was stopped and its synthetic volumes removed after
verification; other projects' running containers were left untouched.

### Design assessment and scoped lessons

The database owns the shared current-reminder rule used by production, claim,
pre-send preparation and health. The server worker owns minimal stable rendering
and provider I/O; maintenance owns sequencing and partial-failure aggregation.
Existing provider, durable outbox and schedule are reused. Service-only grants,
lease fencing and retry-window policy remain intact; BrokerDesk policy is unchanged.

When adding a bounded cleanup sweep before a catch-all quarantine, test overflow
beyond the sweep limit: the 150-row fixture detects a downstream status transition
that a small revoked-grant test misses (F1). When adding a retryable worker error,
check every supported recovery allowlist as part of that same error contract;
per-item and bulk SQL tests detect stranded safe-to-retry work (F2).

Release remains pending: coordinated schema/app installation with dispatch paused,
real owner/viewer staging inbox tests, schedule/health/hosting verification and
operator authorization for activation. This record does not claim production
capacity or exhaustive delivery guarantees.
