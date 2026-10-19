# NAK-68 — Resend delivery operations

## Execution context

Development implemented and verified, October 18–19, 2026. Base `96538c9` (`origin/main`), branch
`feat/nak-68-resend-delivery-operations`. Critical risk; full record because this
changes incoming authentication, privileged persistence and shared send rules.
Next: human review/integration, then separately authorized staged activation. Linear NAK-68 is the approved plan.

Verified locations: `src/features/notifications/server/resend.runtime.mjs` owns
bounded provider HTTP; `resend.provider.ts` is the server-only adapter;
`relationship-notification.service.ts` and
`scripts/candidate-liveness-email-worker.mjs` own existing queue dispatch;
`src/features/broker-relationships/server/customer-invitation-email.ts` consumes
the same adapter. `production-maintenance.ts` owns scheduled ordering/health;
`retention.service.ts` owns independent bounded cleanup transactions. No existing
Resend webhook or delivery receipt store exists at this base.

## Problem and goal

Provider acceptance is not delivery. VivIntro currently cannot durably correlate
all application sends to delivery events, reject replayed events or locally stop
future sends to terminal-bounced/complained recipients. Complete the development
of the approved Phase 4 delivery operations without enabling live dispatch.

## Scope and design

Keep existing queues and business recipient authorization. Add a private delivery
registry, not another dispatch queue, around every existing application send.
The registry owns immutable recipient/message HMACs, a short fenced send lease,
provider ID, normalized outcome and timestamps. Opaque delivery-ID tags allow a
signed webhook to correlate before the provider response has been persisted.
Only locally registered sends may affect suppression; unrelated Auth/provider
traffic is acknowledged without creating delivery records. Unknown event types
are authenticated then ignored. Recipient addresses from webhooks are not used
as authority. A permanent bounce, complaint or provider suppression blocks future
application sends to that HMAC. In-flight sends already authorized before an
event cannot be recalled; subsequent preparations must block.

Use maintained Svix verification over original bytes, strict UTF-8, freshness
checks and bounded headers/body. A service-only RPC atomically deduplicates event
IDs and updates the registry/suppression. Terminal precedence is complaint >
bounce > suppression > delivered > sent > pending; failed/delayed events do not
reverse stronger outcomes. Store only allowlisted status/error categories and
identifiers/digests/timestamps; never provider text or raw payloads.

A separate server-only HMAC key hashes normalized recipient addresses and message
material. Missing configuration/database guard fails closed. Preserve Resend's
24-hour idempotency key and existing 23-hour uncertain-retry boundary. Previously
attempted unsent jobs must be quarantined at rollout because adding a correlation
tag changes the provider request body. Do not bypass existing queue leases,
consent, publication, expiry checks or privileged RPC authorization.

Reuse protected maintenance for retention and aggregate health. Health reports
counts/ages only: queue delay, repeated deferrals, worker failure, unresolved
provider results, local usage against configurable limits and bounce/complaint
rates. Local usage excludes Auth SMTP and other senders; provider dashboard
remains authoritative for account quota. Existing external health monitor handles
alert delivery; no email-based alert loop is introduced.

## Acceptance and evaluations

| ID | Requirement and rejecting example | Check |
| --- | --- | --- |
| DEL-1 | Raw-byte authentication; forged, modified, stale, missing, oversized requests never write | Signed route tests and local HTTP synthetic harness |
| DEL-2 | Atomic event dedup; sent cannot undo delivered/bounce/complaint; early webhook survives completion; unknown IDs never suppress | Real pgTAP, duplicate/concurrent SQL and route fixtures |
| DEL-3 | Every current application send checks keyed recipient suppression before HTTP; guard/config failures never send | Adapter/worker regression tests, actual local RPC integration |
| DEL-4 | Private RLS tables/service-only RPCs; no payload/address/subject/action-link storage or logs | Privilege pgTAP, minimal RPC argument assertions, diff inspection/advisors |
| DEL-5 | Bounded cleanup removes completed queue material and old receipts/registry; suppression remains | SQL retention boundary/batch tests and scheduled service tests |
| DEL-6 | Protected aggregate health exposes failure, queue age/deferrals, usage and bounce/complaint signals without PII | Health SQL and route tests; current monitor inspection |
| DEL-7 | Existing queues, Auth SMTP and BrokerDesk business behavior remain compatible | Existing unit/pgTAP checks, static/build, generated types, audit, independent review |

## Security, rollout and recovery

New functions use explicit service-role authorization, empty search paths and
revoked public/anon/authenticated execution. Private tables have no direct API
role access and RLS. No arbitrary-recipient public send endpoint. Incoming
webhooks need no user cookies; only validated signatures authenticate them.
Bodies and credentials never reach logs or public error responses.

Migration first with dispatch paused; install matching app and independent
`EMAIL_RECIPIENT_HMAC_KEY` plus `RESEND_WEBHOOK_SECRET`. Preserve HMAC key across
releases: rotating it requires a planned suppression migration, not deletion.
Review quarantined legacy uncertain jobs; never blindly replay beyond provider
idempotency lifetime. Test signed webhooks/inboxes and monitor before activation.
Rollback requires pausing dispatch or retaining guarded compatible workers;
rolling back to an unguarded sender would bypass suppression.

Retain minimal webhook receipts 30 days, delivery registry 90 days, completed
queue rows 90 days and terminal message material at most 30 days. Suppression
hashes remain until an authorized support review; no automatic unsuppression.
No encrypted accountless delivery store exists in this scope: remove expired
existing queue material; do not create a second delivery transport.

## Progress and verification

Implementation is present. The original suppression regression failed on base
(sender contacted Resend despite suppression) and passes after guard installation.
The first full run passed 197 suites / 1,641 tests and 61 feature gates; the first
clean database run passed 60 suites / 1,691 assertions. Four real loopback HTTP /
PostgREST integration scenarios pass, including concurrent transactions. These
are intermediate results; final checks below must include subsequent recovery
corrections.

Self-review found that deterministic unbound failures must remain recoverable
inside the original retry horizon. A regression reproduced expired preparation
after a credential rejection; corrected preparation preserves immutable hashes
and the first-attempt fence while allowing an authorized recovered job. Missing
sender configuration now returns before reserving a digest. An uncertain guard
completion needs per-item duplicate-risk review; bulk recovery cannot release it.

Real provider/inbox delivery, production configuration/migration,
scheduler execution and production monitoring are separate release evidence.

### Review resolution ledger (round 1)

Fresh-context reviewer `/root/nak68_delivery_review`, inherited GPT-6 family
(exact model unavailable, not a human/cross-model review), reviewed base `96538c9`
and dirty snapshot `2d9a4b5b743de8a56c69d8775c43e7b75b654ea4af2a9082c29a90a00ad904ed`.
Report `/tmp/nak68-review-r1.md`; independently executed 144 unit tests and 69 SQL
assertions and reproduced two introduced findings. Both confirmed in scope:

- NAK68-R1-F1 (P2, DEL-6): accepted -> signed failed was absent from health.
  Added SQL reproducer failed (healthy true/missing count). Correction counts
  recent received provider failures still in failed state; aggregate becomes
  unhealthy. Late failures remain visible, while stronger delivered outcomes
  clear the signal and obsolete transient error category. Same 24-hour window
  as bounce/complaint monitoring; GitHub alert remains open for operator review.
- NAK68-R1-F2 (P3, DEL-1): UTF-8 decoding stripped an added BOM before signature
  verification. The raw mutation regression failed with 202/one write. Decoder
  now preserves the BOM during authentication; signed malformed JSON receives
  400 and never writes. Demonstrated prior impact was normalization only, not
  semantic JSON forgery. Signature timestamp/rotation checks remain delegated
  to Svix.

New direct webhook database-transport tests exercise cancellation and default
bounds instead of reducing the 90% protected function-coverage gate. Corrected checks and independent return review passed as recorded below.


### Final verification and handoff

Code/test snapshot `fbe3ba3c885a402d720afddb1d23c2db8b4e4a96bd6d5117ec81f06b0740a811`
(base `96538c9` plus tracked/untracked development) was independently re-reviewed.
Round 2 `/tmp/nak68-review-r2.md`: **no material findings**. F1/F2 are resolved by
fresh original reproductions, 148 focused unit tests, 112 SQL assertions and
100% route coverage, not by edits alone. Only this verification record and a trailing blank line at SQL EOF changed
subsequently; executable SQL, implementation, requirements, tests and dependencies
stayed fixed. The EOF cleanup was detected by checking the complete staged diff,
including newly added files.

| Check on final code | Result and evidence |
| --- | --- |
| Full unit coverage | PASS, 197 suites / 1,646 tests; 89.47% lines, 81.83% branches, 86.43% functions, 85.97% statements; `/tmp/nak68-coverage-reviewed.log` |
| Feature/protected gates | PASS, 61 feature files + 21 protected boundaries; delivery runtime 100% each metric, webhook route 100% each metric; `/tmp/nak68-coverage-verified-gates.log` |
| Clean migration replay | PASS, 108 migrations on disposable project `nak68-delivery`, loopback 55822; `/tmp/nak68-db-replay-corrected.log` |
| Full pgTAP | PASS, 60 suites / 1,715 assertions, including 80 delivery and 32 liveness-completion/retention; `/tmp/nak68-db-reviewed.log` |
| Committed HTTP/DB integration | PASS, four scenarios with real local PostgREST/transactions and simulated provider sends; `/tmp/nak68-email-reviewed.log` |
| Production Next ingress | PASS, actual compiled Next server + local DB: valid/duplicate 202, forged/BOM tamper 401; no-store present; `/tmp/nak68-next-smoke-reviewed.log` |
| Production build | PASS with synthetic/local public settings and no real provider credentials; `/tmp/nak68-build-reviewed.log` |
| Static + fixture checks | PASS, lint/typecheck/db:smoke/diff hygiene; `/tmp/nak68-{lint,typecheck,db-smoke}-reviewed.log` |
| Public generated types | PASS, actual generation from corrected local DB matches committed schema types; `/tmp/nak68-database-final.ts` |
| Application SQL lint/advisors | PASS, no errors/security findings; four inherited unused-parameter warnings; `/tmp/nak68-sql-{lint,advisors}-reviewed.log` |
| Dependency audit | PASS, zero high/critical findings and no exceptions after adding locked Svix 2.8.0; `/tmp/nak68-audit.log` |
| Secret detection | PASS, changed files scanned offline with repository-configured TruffleHog 3.97.0, no findings; `/tmp/nak68-secret-scan.log` (final documentation scan recorded separately) |
| Graphify update | BLOCKED: command unavailable, repository has no existing graph; `/tmp/nak68-graphify.log` |
| Browser UI/full hosted CI | NOT RUN: no UI change; backend boundaries tested above; hosted CI remains integration evidence |
| Live provider/inbox/scheduler/production | NOT RUN and not activated; separate release prerequisites |

Two harness timing issues are recorded without weakening checks: one pgTAP run
overlapped the end of local Storage provisioning and saw a transient missing
photo MIME setting; unchanged full rerun after reset completion passed. The first
production ingress harness compared Cache-Control text exactly; Next adds safe
cache directives, so the corrected check tests for the required no-store token.
A premature coverage-gate invocation ran before summary generation; the completed
coverage report and gate above passed. Neither was treated as a product fix.

Actual changed responsibilities: new forward SQL migration, private registry,
suppression/receipt retention/health RPCs and generated types; shared guarded
runtime + server adapter, Resend correlation tags, signed webhook parser/route;
existing liveness/relationship consumers and bounded fallback transport;
maintenance retention/health, fallback-worker HMAC propagation and CI local
integration; native unit/SQL/HTTP tests, protected coverage gates and operator
runbooks. Existing Auth SMTP/templates and BrokerDesk product policy are unchanged.

Design assessment: business queues/callers retain recipient authorization and
retry ownership; the shared guard owns keyed delivery metadata and provider
binding; one transactional RPC owns deduplication/precedence/suppression; existing
maintenance owns bounded cleanup and aggregate alerting. No replacement queue,
public generic-send endpoint or parallel scheduler was introduced.

Scoped lessons with regressions: authenticate the exact raw representation before
JSON parsing—default TextDecoder BOM removal is normalization (F2 test). A queue's
accepted/sent status cannot stand in for provider delivery health; test accepted
->signed failed and stronger later outcomes at the actual SQL boundary (F1 test).

Development is ready for review/integration, not released. Configure independent
stable HMAC/signing secrets, coordinate paused-dispatch migration/app installation,
review quarantined legacy attempts, register webhook events, then run authorized
staging inbox/suppression/scheduler/alert checks before activation. Keep provider
account quota monitoring and Auth SMTP testing separate from local application
counts. See `docs/resend-api-integration.md` for the operator procedure.
