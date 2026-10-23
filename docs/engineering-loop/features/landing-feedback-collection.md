# Landing feedback collection

## Contract

The landing page invites creators, viewers, and family helpers to share their experience. Until permissioned quotes exist, it displays no testimonials or fabricated social proof. The form is public so a recipient does not need to create an account. It collects a role, a bounded experience, optional improvement, and optional contact information only when the visitor asks to be contacted about a possible testimonial. Contact permission is not permission to publish; a separate review and approval is required before any quote is added to marketing content.

## Security and data lifecycle

- The server accepts same-origin, bounded JSON only. The service-role key stays server-side. Direct table access and the RPC are unavailable to browser roles.
- A honeypot filters simple bots. The database atomically caps submissions at three per hashed network hint per day, using the existing HMAC network-hint scheme. No raw IP is saved in feedback. The cap fails closed when the configured HMAC key, database, or service key is unavailable.
- Submissions live in `app_private.landing_feedback_submissions`. They are not in portfolio rows, visitor views, account exports, public APIs, or analytics.
- The existing retention job calls `purge_landing_feedback()` after the main cleanup routine. This removes submissions older than 180 days from the live database. Provider backup retention follows the Privacy Policy.
- Reviewers use approved database administration access to read submissions. A public quote requires a second, separately recorded approval; no automatic publication path is provided.

## Release order and checks

1. Review and apply `20261023120000_landing_feedback_collection.sql` with the existing production database deployment process. Verify migration history and its pgTAP suite. Do not deploy the form first.
2. Deploy the app change, including the updated retention worker, only after the database migration succeeds.
3. Verify a real submission, bounded rejection, private storage, retention-worker execution, and the form in light and dark modes on mobile and desktop. Do not submit invented testimonial text to production.

No migration or app deployment is performed by this local change.
