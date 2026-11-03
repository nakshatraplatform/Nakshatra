# Guest approved portfolio viewing

Risk: Critical. Base: main `c0bcb29`. User decision: Show interest must create no Auth account or application login; owner approval grants the verified visitor full published portfolio viewing for 15 days. A portfolio-scoped browser proof is authorized. Another device must verify the approved email again.

## Contract

- Email verification and proof issuance are atomic. Proofs are random, stored only as hashes, portfolio/request scoped, and never accepted as Supabase Auth credentials.
- Owner approval reviews the current published disclosure, creates a normal expiring reveal grant plus a private guest recipient binding, and queues an approval link. No private data is copied into the email.
- Refresh in the verified browser reveals the approved snapshot only after approval. Other visitors remain public. Email links convey no authority by themselves.
- All reads, private photos and horoscope documents enforce current publication eligibility, verified recipient, proof expiry, grant expiry and revocation. Existing Auth-bound grants retain their rules.
- Existing contact-only approvals are never converted automatically; a fresh owner disclosure review is required.
- Preserve fonts, colours, portfolio layout and optional fields. No new mandatory onboarding fields. Never expose owner notes or street addresses.

## Delivery

Separate database prerequisite and app PRs. Install the additive database migration first; old app approval semantics remain unchanged until the app switches to the new reviewed command. Keep both PRs Draft until CI and review pass. No production write or deployment is part of implementation.

## Evaluations

Database: code replay, replacement, five wrong attempts, expiry, wrong email/portfolio/proof, no Auth user, concurrent approval idempotency, stale review, existing grants, revoke, unpublish, verification withdrawal, private payload projection and media descriptors.

Application: HttpOnly scoped cookies, no Auth session, CSRF/body limits, generic access-code response, email URL validation, queued failure visibility, public-only metadata, refresh and new-device verification, protected media, responsive form errors and scroll recovery.

Local Docker is unavailable; migration replay and pgTAP require hosted CI. Unit/browser tests use loopback fixtures and mocked provider traffic. Require fresh independent review of the final database and app snapshots.
