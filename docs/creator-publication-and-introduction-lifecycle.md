# Creator publication and introduction lifecycle

> **Shared readiness boundary:** A published portfolio that satisfies this
> lifecycle becomes eligible for broker selection only when its candidate also
> has current Didit verification and an active same-agency broker relationship
> and mandate. Broker Introductions then use the pinned Broker Standard
> projection; personal links continue to use the B2C disclosure flow. See
> [`vivintrodesk-mvp-contract.md`](./vivintrodesk-mvp-contract.md).

## Creator journey

The dashboard presents one resumable journey:

`Sign up → Confirm account → Private portfolio draft → Preview → Complete required details → Photo & liveness check → Disclosure → Published → Optional onboarding feedback`

- Draft answers are saved automatically after a short idle period and can still be saved manually.
- `last_editor_section` is persisted independently from portfolio content so a returning creator resumes where they stopped.
- Basics unlock an early public Introduction preview. Previewing does not publish or create a public entitlement.
- The canonical completion calculation is shared by the dashboard and the server readiness validator. PostgreSQL independently enforces the same seven-item minimum: first and last name, an adult date of birth, current location, profession or role, a brief personal introduction, and one shareable primary photo. Cultural background, family, lifestyle, match preferences, and astrology are optional enrichment.
- Editing draft content, shareable media, or the horoscope invalidates a prior disclosure confirmation.

The B2C candidate check uses Didit's version-pinned biometric workflow: a live
camera capture must pass passive liveness and match the portfolio's current
primary photo. It does not request an identity document and must not be
described as proof of legal identity or profile accuracy. Changing or deleting
the matched primary photo invalidates the proof and requires a new check.

Billing remains deferred. Any confirmed account can create its own private
portfolio without a waitlist or invitation. Creator eligibility is separate
from publication readiness: required content, current photo-bound liveness,
and disclosure consent remain mandatory, except for a separately authorized
account-specific test exemption. The system does not create a payment event or
paid entitlement. Plan selection, payment-method collection, and the proposed
one-month trial remain future work.

## Publication invariants

A publication transition succeeds only when all of the following are current for the same portfolio:

1. Required portfolio content and a shareable primary photo are present.
2. The candidate has a current successful identity verification.
3. The authenticated, confirmed owner created the portfolio for themself.
   Creator signup is open; this does not grant operator access or allow a
   viewer to see protected details without owner approval.
4. The owner confirmed `publication-disclosure-v1` for the exact current draft fingerprint.

The application service checks these rules for clear user feedback. A database trigger repeats them so direct client calls and future integration mistakes fail closed.

### Deferred payment integration contract

This contract is intentionally dormant for the pilot and must not obstruct
portfolio testing or publication. Before billing is enabled, its product rules
must be revised for the planned one-month free trial and explicit plan/payment
method selection. The future payment webhook must call
`record_portfolio_payment_event` with the service role only after its provider
signature has been verified. It must supply:

- the authenticated portfolio ID and selected plan code;
- the provider and unique event ID;
- a SHA-256 hash of the verified raw callback body;
- normalized status, provider payment reference, and entitlement expiry.

The command rejects payment start before identity verification, detects event-ID payload conflicts, treats exact retries as duplicates, and prevents late pending/failed callbacks from downgrading an already-paid event. Refund and cancellation events remove disclosure eligibility.

## Introduction lifecycle

Existing database-authorized commands remain the only way to approve/reject an introduction or renew/revoke Complete Portfolio access. The requester portfolio link is derived from the authenticated requester user ID; submitted URLs are never trusted. Broker attribution is projected from organization and representative foreign keys when B2B is active, while direct introductions retain a `direct` source.

Every relationship audit event now writes a deduplicated notification job:

- new introduction → portfolio owner;
- Complete Portfolio access approved, declined, renewed, or revoked → sender;
- Complete Portfolio access expiring within 24 hours → sender and portfolio owner.

Run `enqueue_due_full_view_expiry_reminders()` from a service-role scheduler. Delivery workers claim jobs through `claim_notification_outbox_v2()` and finish them through the existing `complete_notification_outbox()` command. The v2 claim includes only stable IDs and safe event context; the delivery worker resolves the recipient email with server credentials and renders the final provider template. Provider setup is an infrastructure prerequisite, not a client capability.

## Operational rollout

1. Apply migration `20260913120000_creator_publication_readiness.sql`.
2. Configure the dedicated candidate photo-match workflow and validate signed
   Didit callbacks plus the recovery worker.
3. Confirm that current photo-bound verification, disclosure, self-ownership,
   and required content are all enforced server-side after open signup.
4. Keep plan selection and payment routes deferred until the trial and billing
   design is approved.
5. Configure a notification delivery worker and a recurring expiry-reminder scheduler.
6. Exercise the full pgTAP suite and end-to-end happy/failure paths before enabling production publishing.
