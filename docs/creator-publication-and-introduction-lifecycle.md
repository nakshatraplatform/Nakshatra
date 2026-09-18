# Creator publication and introduction lifecycle

## Creator journey

The dashboard presents one resumable journey:

`Basics → Portfolio details → Preview → Ready to publish → Verification → Payment → Disclosure → Published`

- Draft answers are saved automatically after a short idle period and can still be saved manually.
- `last_editor_section` is persisted independently from portfolio content so a returning creator resumes where they stopped.
- Basics unlock an early public Introduction preview. Previewing does not publish or create a public entitlement.
- The canonical completion calculation is shared by the dashboard and the server readiness validator. PostgreSQL independently enforces the same seven-item minimum: first and last name, an adult date of birth, current location, profession or role, a brief personal introduction, and one shareable primary photo. Cultural background, family, lifestyle, match preferences, and astrology are optional enrichment.
- Editing draft content, shareable media, or the horoscope invalidates a prior disclosure confirmation.

Didit and payment UI remain unavailable until those integrations are configured. Their states are nevertheless server-authoritative; the client cannot mark either step complete.

## Publication invariants

A publication transition succeeds only when all of the following are current for the same portfolio:

1. Required portfolio content and a shareable primary photo are present.
2. The candidate has a current successful identity verification.
3. A selected plan has an active paid entitlement whose expiry is in the future.
4. The owner confirmed `publication-disclosure-v1` for the exact current draft fingerprint.

The application service checks these rules for clear user feedback. A database trigger repeats them so direct client calls and future integration mistakes fail closed.

### Payment integration contract

The future payment webhook must call `record_portfolio_payment_event` with the service role only after its provider signature has been verified. It must supply:

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
2. Configure and validate Didit callbacks.
3. Connect pricing UI to `select_plan` without charging.
4. Start payment only after readiness reports `verificationStatus: verified`.
5. Connect the verified payment webhook to the idempotent payment command.
6. Configure a notification delivery worker and a recurring expiry-reminder scheduler.
7. Exercise the full pgTAP suite and end-to-end happy/failure paths before enabling production publishing.
