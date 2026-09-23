# NAK-80 — Durable Broker Introduction notifications

## Execution context

- Risk: Critical — database migration, service-role worker, external email,
  customer relationship metadata and cross-tenant privacy.
- Documentation mode: Full because the change spans transactionally generated
  jobs, a privileged worker and an external provider boundary.
- Branch: `feat/nak-80-broker-introduction-notifications` from merged NAK-79
  revision `7cad88b`.
- Current source of truth: [VivIntroDesk MVP contract](../../vivintrodesk-mvp-contract.md),
  the bilateral Introduction in `app_private.broker_introductions`, and the
  existing provider-neutral `app_private.notification_outbox`.
- Next incomplete step: complete repository-wide validation and fresh review on
  the final source snapshot. Local Supabase replay/pgTAP remains unavailable
  without Docker and is a required hosted-CI gate.

### Code locations

| Path | Role | Intended change | State at `7cad88b` |
| --- | --- | --- | --- |
| `supabase/migrations/20260925120000_mutual_interest_complete_access.sql` | Read | Preserve bilateral response, consent, revocation and 30-day access rules | Verified |
| `supabase/migrations/20260926120000_broker_introduction_notifications.sql` | Database | Add broker notification events, lifecycle scheduling and fenced worker completion/recovery | Implemented |
| `src/features/notifications/server/relationship-notification.service.ts` | Worker | Render neutral authenticated-link messages, revalidate recipients and honor retryability | Implemented |
| `src/features/notifications/server/resend.provider.ts` | Provider adapter | Reuse unchanged; no live provider call in automated tests | Verified |
| `src/app/api/internal/relationship-notifications/route.ts` | Worker boundary | Reuse existing concealed service-only entry point | Verified |
| `tests/relationship-notification.service.test.ts` | Unit/contract | Cover every Broker Introduction message and failure disposition | Implemented |
| `supabase/tests/database/authenticated_broker_introduction_access.test.sql` | Database | Prove recipients, deduplication, isolation, fencing and recovery | Implemented |
| `src/types/database.generated.ts` | Shared contract | Add the new claim/completion/recovery RPC shapes | Implemented |

## Problem and goal

Broker Introduction state is database-authoritative, but its lifecycle does not
currently create durable email work. Customers may miss a new Introduction or
mutual access, and the broker may miss a response. Sending directly from a
request would make business state depend on Resend availability.

NAK-80 will transactionally enqueue minimal notification facts and deliver them
through the existing outbox. Email remains informational: a recipient must sign
in, and the database re-authorizes every view and response.

## Change contract

### Included

1. When a broker marks an Introduction shared, enqueue one notification for
   each selected customer.
2. When either customer records a response, notify only the broker account that
   created the Introduction. The email does not contain the decision.
3. When mutual interest starts, notify both customers that pinned Complete
   Portfolio access, including Protected Contact, is available for 30 days.
4. When an Introduction is revoked, its unanswered response window expires, or
   its mutual Complete access expires, notify both affected customers.
5. Reuse one private outbox, stable deduplication keys, fenced claims, bounded
   retries and the existing Resend idempotency key.
6. Permit a service-role operator to requeue terminal relationship-notification
   failures after provider configuration or an outage is corrected.
7. Keep message payloads free of names, email addresses, responses, portfolio
   fields, Protected Contact, financial data and biometric data.

### Non-goals

- Resend domain activation, credentials, live sending or inbox-delivery proof.
- WhatsApp, SMS, push notifications, open/click tracking or marketing email.
- Didit workflow activation. The product decision is liveness/biometric facial
  verification without an ID-document module; NAK-80 uses neutral “verified”
  wording and stores no identity evidence. Provider configuration and its live
  privacy rehearsal remain a separate release gate.
- A broker task system, notification preferences or cross-broker visibility.

### Invariants

- An outbox row or URL never grants portfolio access.
- Only the two stored candidate owners receive customer notifications; only the
  Introduction creator receives broker response notifications.
- Notification production occurs in the same database transaction as its audit
  event, and duplicate events/retries do not create duplicate messages.
- No cross-tenant recipient discovery is exposed through a public API.
- Provider failure never rolls back an Introduction state change.
- Personal VivIntro interest/grant notifications retain their existing behavior.

## Security and privacy

The trigger is private and derives recipients from locked canonical
Introduction relationships rather than caller input. Claim, completion and
recovery RPCs require `service_role`; browser roles receive no table access.
Email contains a neutral description and an authenticated application link,
never profile data or the other participant's response. Resend secrets remain
server-only. Automated tests inject the provider and make no network calls.

## Acceptance criteria and evaluations

| ID | Case | Required result and detecting evidence |
| --- | --- | --- |
| AC-1 | Shared event | Exactly two customer jobs with safe payloads; pgTAP rejects missing/extra recipients |
| AC-2 | Customer response | Exactly one creator job; message omits response and profile data; pgTAP + unit template test |
| AC-3 | Mutual access | Exactly two customer jobs link to the authenticated Introduction and state 30-day access without embedding contacts |
| AC-4 | Revocation/expiry | Both customers receive the appropriate terminal state; repeated maintenance is idempotent |
| AC-5 | Worker retry | Retryable failure is delayed and bounded; non-retryable failure is terminal; recovery RPC requeues only owned failed jobs |
| AC-6 | Trust boundary | Anonymous/authenticated roles cannot claim, complete or recover jobs; customer/broker links are re-authorized by existing routes |
| AC-7 | Compatibility | Existing personal relationship notifications continue through the same worker and unchanged provider adapter |
| AC-8 | Verification wording | New messages are neutral about provider method and do not claim ID-document verification |
| AC-9 | Repository gates | Focused tests, coverage, lint, types, DB smoke, build and audit pass; migration replay/pgTAP pass locally or remain an explicit hosted-CI gate |
| AC-10 | Review | Fresh independent review has no unresolved material finding on the final snapshot |

Validation mode is behavioral red/green. Plausible wrong implementations include
notifying every agency member, leaking a response in email, sending one customer
the other customer's data, duplicating jobs on retries, retrying a permanent
configuration error forever, or treating email acceptance as authorization.

## Compatibility, rollout and recovery

The migration is additive. Deploy the database before the application worker so
new job types and RPC projections exist before claiming them. Keep the
relationship-notification scheduler disabled until Resend sender/domain and
credentials are configured and an authorized real-inbox rehearsal passes.
Failed jobs remain durable and can be requeued with a service-role recovery
command after correction. The bulk command excludes timeout,
provider-unavailable, invalid-response and idempotency-conflict outcomes because
the provider may already have accepted those messages. A separate single-job
command returns `manual_review_required` unless an operator explicitly
acknowledges duplicate-delivery risk after checking provider evidence. This
keeps uncertain failures recoverable without silently replaying them outside
Resend's idempotency window. Rollback may stop the worker without removing
queued facts; do not drop or reinterpret customer consent or Introduction state.

## Progress

- Implemented: transactional Broker Introduction jobs, safe payloads, current
  recipient revalidation, neutral Resend templates, attempt-and-lease-fenced
  completion, bounded retry, deterministic recovery and explicit manual
  disposition for uncertain provider outcomes.
- Regression coverage: unit tests cover all new message types, privacy wording,
  recipient staleness, retry classification and a fenced completion. pgTAP adds
  recipient, deduplication, expiry, privilege, stale-attempt, expired-lease and
  recovery assertions to the existing bilateral Introduction suite.
- Review resolution:
  - `NAK80-REV-001` resolved by dropping and recreating the claim RPC when its
    table return shape changes.
  - `NAK80-REV-002` and `NAK80-REV-003` resolved by attempt/lease fencing and
    matching RPC/pgTAP signatures with stale-attempt and expired-lease cases.
  - `NAK80-REV-004` resolved by validating the completion disposition before a
    worker run counts provider acceptance or failure.
  - `NAK80-REV-005` resolved by a single-job recovery RPC that requires explicit
    duplicate-risk acknowledgement for uncertain transport outcomes.
- Hosted-CI correction: the first clean migration replay rejected the
  schema-qualified special form `pg_catalog.extract(epoch from ...)`. The
  migration now uses PostgreSQL's valid `extract(epoch from ...)` syntax, and
  the database smoke check rejects future schema-qualified uses of
  `EXTRACT`, `GREATEST`, or `LEAST` before push.
- Status: Implemented and locally verified. PR #66 is open; its corrected clean
  migration replay and pgTAP run remain the final database gate. No production
  configuration or live notification delivery was performed.
