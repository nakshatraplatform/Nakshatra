# NAK-78 — Authenticated Broker Introduction Access

## Execution context

- Risk: Critical — authentication, authorization, disclosure, response writes and migration.
- Branch: `feat/nak-78-authenticated-broker-introduction-access`.
- Base: squash-merged NAK-77 checkpoint `fd858ba`; NAK-78 is delivered as a separate, NAK-78-only PR.
- Current source: the previous one-recipient device-pass flow is implemented in
  `broker-introduction.service.ts` and `20260919170000_broker_introduction_lifecycle.sql`.
- User decision superseding the earlier MVP contract: both participants must
  own published, currently Didit-verified VivIntro portfolios before a broker
  creates an Introduction.

## Goal

Make a broker Introduction a bilateral, two-customer, agency-local transaction.
WhatsApp may carry one opaque URL, but only either selected signed-in portfolio
owner can view the other participant's pinned Broker Standard Profile and
respond independently.

## Contract

1. The broker selects a source and recipient from customer relationships in the
   same agency. Both relationships, mandates, publications and Didit identity
   verifications must be current.
2. Source and recipient must be different canonical candidates controlled by
   different owner accounts. A broker cannot use a raw email, label or URL
   parameter to select either participant.
3. A new Introduction stores both customer relationships and both immutable
   portfolio versions. The browser receives only opaque references and safe
   display names.
4. The Introduction URL contains no bearer secret. Reading and responding require
   a current VivIntro session whose user owns either participant candidate.
5. Forwarding or modifying the URL returns the same neutral unavailable response;
   there is no Detailed fallback and no cross-customer membership disclosure.
6. The version-pinned Broker Standard Profile remains the only pre-interest
   disclosure. Protected Contact, financial data and owner-private fields remain
   excluded.
7. Pausing, terminating, expiring, unpublishing or losing verification on either
   participant fails closed. Renewal never revives a revoked Introduction.
8. Both responses remain independent, immutable and auditable. Contact release after mutual
   interest is explicitly out of scope for NAK-78.
9. Existing unexpired device-pass Introductions are revoked during migration;
   they are not silently upgraded to an identity-bound recipient.
10. Both customer dashboards show active Introductions and link to the secured
    view. Another broker or customer cannot see that cross-agency list.

## Non-goals

- No contact release or broker-choice resolution. NAK-78 records both responses
  but does not execute the mutual-interest release workflow.
- No linked-family authority, guest recipient, email-only recipient or public fallback.
- No pair deduplication across agencies; each agency retains independent lineage.
- Within one agency, an unordered customer pair has at most one active
  Introduction; reversed duplicates are rejected under the same pair lock.
- No payments, custom questionnaires or broker-to-broker visibility.

## Evaluations

| ID | Case | Expected evidence |
| --- | --- | --- |
| AC-1 | Broker creates A → B | Both are same-agency, active, published and Didit-verified; pinned Broker Standard only |
| AC-2 | Broker selects incomplete/unverified/foreign/self recipient | Neutral rejection and no Introduction row |
| AC-3 | A or B opens while signed in | Each sees the other customer's pinned Broker Standard; protected contact is absent |
| AC-4 | C, signed-out viewer or modified URL opens | Sign-in or neutral unavailable; no profile data or participant oracle |
| AC-5 | A and B respond | Two independent immutable responses with actor attribution |
| AC-6 | Either relationship pauses/terminates | Introduction and access fail closed and never revive |
| AC-7 | Dashboards for A and B | The same Introduction appears for both with the appropriate opposite-customer label |
| AC-8 | Legacy device-pass row | Revoked/scrubbed during migration rather than converted |

## Compatibility and recovery

- This intentionally replaces the pilot device-pass contract for new
  Introductions. Historical rows remain for audit but active legacy access is
  revoked.
- Rollback may restore application routes but must never restore scrubbed bearer
  credentials or broaden access. A new broker Introduction is required.
- The migration and pgTAP suite must pass in CI before merge; local PostgreSQL is
  unavailable without Docker/Podman on this host.

## Progress and evidence

- Contract reconciled with the latest product decision.
- Graph query and current-source inspection identified the existing token,
  repository, route, broker panel and dashboard boundaries.
- Bilateral schema, dynamic eligibility, authenticated read/response routes,
  customer dashboard projection and retired device-pass downgrade path are implemented.
- Broker detail exposes every eligible customer dynamically and shows both
  independent responses. Customer dashboards resolve the same Introduction to
  the opposite pinned Broker Standard Profile.
- Verification completed: lint, TypeScript, `db:smoke`, 793 unit tests with
  coverage gates, production build, and `git diff --check` pass.
- A dedicated 27-assertion pgTAP suite covers bilateral pinning, shared-owner and cross-agency
  rejection, unrelated-user denial, response independence and pause revocation.
  Runtime pgTAP remains CI-bound because Docker/Podman is unavailable locally.
- Fresh-context review found and verified fixes for PostgreSQL pair
  canonicalization and same-owner authorization. Its final bounded re-review
  found no remaining material issue in those paths.
- Graphify AST knowledge graph updated after implementation with no LLM/API use.
