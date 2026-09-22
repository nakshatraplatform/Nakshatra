# NAK-77 — Customer Broker Consent Controls

## Execution context

- Risk: Critical — customer consent, authorization, revocation and database migration.
- Source snapshot: `origin/main` at `6df0c59` after NAK-76 merged.
- Branch: `feat/nak-77-customer-broker-consent-controls`.
- Current step: merged through PR #63 as `fd858ba`; required CI checks passed.
- Canonical locations:
  - `public.resolve_customer_broker_relationships()` — customer-only relationship projection.
  - `app_private.broker_client_mandates` — time-bound broker authority.
  - `app_private.broker_introductions` and related passes/events — issued broker disclosures.
  - `src/app/brokers/` — existing customer “My brokers” surface.
  - `src/features/broker-relationships/` — existing relationship DAL and contracts.

## Problem

Customers can see all of their broker relationships, but cannot pause, terminate,
or renew consent. A stopped mandate already fails closed during Broker Standard
resolution, yet there is no customer command that performs the state transition,
revokes issued disclosure capabilities, and records the action atomically.

## Goal

Give the portfolio owner a small, reassuring “My brokers” control surface while
keeping consent enforcement in one database transaction. A broker sees only its
own resulting relationship state and never learns about another agency.

## Contract

1. `pause` sets an active relationship to `paused`, revokes every current
   mandate, and permanently revokes every unexpired Introduction issued by that
   relationship. Previous links never revive automatically.
2. `renew` records fresh `broker-representation-v2` consent, creates a new
   one-year mandate, and activates an active, paused, or expired relationship.
   It does not revive previously revoked Introductions.
3. `terminate` is final for that relationship: it sets `terminated`, ends the
   relationship, revokes mandates, Introductions and passes, and requires a new
   broker invitation for any future relationship.
4. Only the canonical portfolio owner may act. A valid opaque relationship
   reference identifies a possible record but grants no authority.
5. Repeated same-state pause/terminate requests are idempotent. Invalid,
   cross-customer, or forbidden transitions return a neutral unavailable result
   without writing.
6. Each successful state change appends a tenant-scoped audit event containing
   only safe opaque references and counts—never another broker identity or
   portfolio data.
7. The UI explains the effect before confirmation, prevents duplicate requests,
   reports failures without optimistic false success, and refreshes from the
   server after success.

## Non-goals

- No broker package semantics, payments, linked-family authority, pair workflow,
  broker-to-broker visibility, or automatic contact release.
- No scheduled renewal worker or proactive reminder in this increment.
- No PR for this branch until the user chooses a later combined checkpoint.

## Design basis

- Extend the established database-first command/DAL/route/client pattern.
- Use one purpose-built SQL command so relationship, mandate, Introduction,
  pass, event, and audit writes commit or roll back together.
- Keep the server-rendered page and add one narrow Client Component for actions.
- Preserve the existing opaque `bcr_…` URL/body reference and derive customer,
  agency, and candidate identity from the authenticated database session.

## Evaluations

| ID | Criterion and representative case | Expected result | Evidence |
| --- | --- | --- | --- |
| AC-1 | Owner pauses an active relationship with active mandate and links | Relationship paused; mandates, links and passes revoked atomically | pgTAP database test |
| AC-2 | Owner renews paused/expired relationship | Fresh one-year v2 mandate; relationship active; old links remain revoked | pgTAP database test |
| AC-3 | Owner terminates relationship | Final terminated state and immediate revocation | pgTAP database test |
| AC-4 | Different customer submits the opaque reference | Neutral unavailable; no row changes | pgTAP negative test |
| AC-5 | Customer uses the UI/API | Confirmed action reaches validated service; refresh follows success | route, service and component tests |
| AC-6 | Broker reads after another broker relationship changes | No cross-tenant identity or relationship is disclosed | existing isolation tests plus new projection assertions |

Plausible wrong implementations rejected by these checks include authorizing by
relationship reference alone, revoking a mandate but leaving an active pass,
renewing old Introduction links, mutating a terminated relationship, or updating
the interface before the transaction succeeds.

## Compatibility, rollout and recovery

- This is additive: existing relationship projection fields remain compatible;
  new consent fields/actions are added.
- Existing mandates remain valid until the owner acts or their current end time.
- Rollback may remove the new route/UI and command only after confirming no
  caller depends on it. Do not restore revoked mandates or disclosure passes;
  that would expand access without renewed consent.

## Progress and evidence

- Contract and source map established.
- Added the owner-only `manage_customer_broker_consent` database command with
  idempotency, relationship locking, mandate changes, disclosure-pass revocation,
  tenant-scoped audit events, and neutral cross-customer failure.
- Extended the customer-only relationship projection with server-derived action
  availability. No organization or candidate identifiers leave the database.
- Added a same-origin, authenticated, rate-limited API command and the narrow
  customer action component on `/brokers`; added a dashboard shortcut.
- Added pgTAP cases for wrong-owner denial, pause, renewal, termination, audit,
  pre-consent state rejection, relationship-scoped race prevention, and the
  rule that old Introduction links do not revive (24 assertions).
- Independent critical review found and drove fixes for responded-link revival,
  premature renewal from intake states, and a pause/create race. Re-review found
  no remaining blockers.
- PR CI exposed two verification gaps and both were corrected: the pgTAP fixture
  now records `claimed_at` before `consented_at`, matching the existing database
  constraint, and the consent error paths now have explicit safe-response and
  unavailable-service coverage.
- The next runtime pgTAP run exposed an invalid `pg_catalog.greatest(...)`
  qualification in the atomic pause/terminate update. PostgreSQL implements
  `GREATEST`/`LEAST` as conditional expressions rather than ordinary catalog
  functions. The migration now uses valid `greatest(...)` syntax, and
  `db:smoke` rejects future schema-qualified uses before CI.
- Verification completed:
  - `npm run lint -- --max-warnings=0`
  - `npm run typecheck`
  - full source coverage — 134 files, 793 tests passed; statements 85.14%,
    branches 78.07%, functions 84.56%, lines 88.72%
  - `npm run coverage:check:features` — 52 feature files passed at 80% per metric
  - `npm run db:smoke`
  - focused NAK-77 tests — 5 files, 12 tests passed
  - `npm run build` — passed with non-secret build-time Supabase placeholders
- Runtime migration replay and the pgTAP suite passed in PR CI before merge.
  Local database execution remains unavailable on hosts without Docker/Podman.
