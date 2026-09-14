# Pilot Access Lifecycle Implementation Plan

## 2026-09-12 superseding waitlist decision

The self-service pilot application and approval model below is retained as historical context but is no longer the active launch contract. Until public launch:

- `/pilot-access` is a verified-contact launch waitlist, not a creator-access application.
- A waitlist entry never grants creator capability and administrators cannot approve one into access.
- Public B2C password signup is closed; existing creators may continue signing in. BrokerDesk onboarding remains separately authorized.
- The administrator waitlist surface is read-only.
- A Nakshatra application administrator automatically has creator capability. Supabase project ownership is not used as application authorization.
- Future signup invitations must be single-use and bound to the exact verified recipient email; that invitation-delivery package remains deferred.

Migration `20260912150000_waitlist_and_admin_creator_access.sql` enforces the capability changes and revokes the former authenticated review command.

## Historical decision

Nakshatra authorization is capability-based. A Supabase Auth account proves identity, but it does not grant portfolio-creation or administration rights.

The pilot distinguishes four user experiences:

- Viewer: authenticated or link-based participation without creator rights.
- Applicant: verified account with a pending, approved, declined, or revoked pilot request.
- Creator: verified account with an active B2C creator entitlement.
- Pilot administrator: separately provisioned operator allowed to review pilot requests.

These capabilities may overlap. For example, an administrator may also be a creator, and a creator may act as a viewer. UI labels must not be used as authorization evidence.

## Pilot sequence

1. A visitor requests access using passwordless Supabase email OTP or Google OAuth.
2. Only after Supabase confirms the account email may the user submit their name, optional E.164 phone number, and the versioned pilot-contact consent.
3. The database stores the request in `app_private`; clients cannot enumerate or mutate the table directly.
4. A separately provisioned pilot administrator reviews the request.
5. Approval atomically:
   - rechecks that the current verified email matches the email hash captured at submission;
   - marks the request approved;
   - grants the existing hashed-email creator entitlement;
   - appends an immutable audit event; and
   - queues an approval notification in a durable outbox.
6. The user signs in and receives creator capability. Didit remains mandatory before publication.
7. Decline or revocation never removes viewer access or user-owned history. Revocation removes creator mutation/publication capability.

## Security and privacy invariants

- Never accept a form email as verified identity. Derive it from `auth.users` for the live Supabase session.
- Normalize email only by trimming and lowercasing. Do not apply provider-specific alias rules.
- Bind pre-approved invitations and creator entitlements to the exact normalized email hash.
- Recheck the submitted email hash during approval. An email change requires a new verified request.
- Keep applicant name and phone in `app_private`; expose the minimum projection only to a pilot administrator.
- Do not reuse BrokerDesk organization roles as platform-administrator authority.
- Require a live, non-revoked session at every authenticated database command.
- Use same-origin checks, bounded request bodies, server validation, rate limits, database validation, idempotency keys, and transaction-level advisory locks.
- Store no raw email in the request, entitlement, audit, idempotency, or notification-outbox tables. Notification workers resolve the current verified email by user ID immediately before delivery.
- Keep audit events append-only. Never store free-form request PII in audit details.
- Notification failure must not roll back approval. Workers retry from the durable outbox.
- All database functions start revoked and receive only the minimum explicit grants.

## Delivery sequence

### Increment 1 — database authority (implemented on NAK-70)

- Private applicant, administrator, idempotency, audit, and notification-outbox tables.
- Applicant state, submit, admin list, review, admin provisioning, notification claim, and notification completion commands.
- Atomic approval-to-entitlement transaction.
- pgTAP authorization, transition, idempotency, email-binding, audit, and outbox coverage.

### Increment 2 — verified applicant experience (implemented on NAK-70)

- `/pilot-access` passwordless entry and verified-details screen.
- Dedicated `pilot_access_otp` auth purpose and callback destination.
- Applicant API contracts and role-aware dashboard state.
- Pending, approved, declined, and revoked messages without account enumeration.

### Increment 3 — administrator experience (implemented on NAK-70)

- Protected `/admin/pilot-access` request queue.
- Server-side administrator authorization on every read and mutation.
- Approve, decline, and revoke confirmations with idempotent commands.
- Operator provisioning/revocation CLI; no self-promotion path.

### Increment 4 — notification delivery

- Scheduled worker that leases outbox rows, resolves the verified recipient at send time, delivers templated email, and records only safe error codes.
- Retry/backoff, terminal failure, operational alerting, and delivery tests.

Provider-neutral outbox storage and leasing commands are implemented. Actual delivery intentionally remains pending until a production transactional-email provider and verified sender domain are selected; approval itself does not depend on delivery succeeding.

### Increment 5 — consent and Didit lifecycle

- Versioned adult, candidate, and identity-processing consent before Didit.
- Provider-independent verification attempt state machine with one active attempt, idempotent webhooks, guided retry categories, cooldown, and manual review.
- Every public portfolio remains gated on a current successful identity verification.

### Increment 6 — pilot rehearsal

- Invite forwarding and changed-email tests.
- Applicant/creator/viewer/admin end-to-end tests.
- Didit success, retry, hard-failure, duplicate-webhook, timeout, and provider-outage tests.
- Three synthetic accounts, then five named pilot participants and a 48-hour stability gate.

## Explicitly deferred

- Payment and plan entitlements.
- Public marketplace/discovery.
- BrokerDesk introduction UI in the B2C pilot.
- Free publicly shareable portfolios.

The product-release sequence remains free build and preview, plan selection, consent and identity verification, payment, final disclosure review, then explicit publication. Plan duration begins at first successful publication.
