# Accountless interest and contact sharing

Risk: Critical. Base: `origin/main` at `4459b6d` (2026-10-30). Full feature record because this changes authentication, disclosure, email delivery, and database state.

## Contract

1. A new visitor confirms an email without creating a Supabase Auth user or session. A successful code submission stores one interest request atomically; an invalid, expired, replayed, or rate-limited code stores none.
2. An owner confirms the current published contact disclosure and the verified recipient address. New approval queues only those chosen contact fields for durable email delivery; it creates no full portfolio grant. A changed published revision blocks approval.
3. Existing approved private-detail grants keep their scheduled expiry and existing read permissions. No new grant may be created by the old approval command after cutover.
4. Contact email delivery is bounded, idempotent, retryable, and suppressed when the request/portfolio is no longer eligible before sending. Private fields never enter audit metadata or public APIs.
5. Guest verification, contact approval, and delivery fail closed when required configuration or storage is unavailable. The owner and visitor receive truthful, recoverable errors.

## Design and rollout

Use a service-only challenge table with a keyed code digest, ten-minute expiry, five attempts, and per-network plus per-email quotas. The final verification RPC validates the saved form, consumes the challenge, and inserts the interest in one transaction. It reuses canonical structured-location and pilot-publication checks and serializes on the target portfolio before duplicate/quota checks.

Use a separate service-only contact outbox because the existing relationship outbox requires an Auth user recipient. The reviewed decision command locks the portfolio and request in established order, compares the published revision, captures only `approved_portfolio_snapshots.data.contact`, and queues the verified email. A worker claims with a lease, rechecks current eligibility, and dispatches through tracked Resend delivery. Never reuse the Supabase Auth magic-link template for guest codes.

Deploy the additive database foundation first without changing existing signed-in approvals. Prepare the app against this contract, then deploy a separate database cutover that rejects the old grant-producing approval command. Only after the cutover deploy the app calling the contact-only command. This may briefly pause approvals; it must not issue a new full grant after the cutover. Guest requests cannot use the old grant command because they have no requester Auth user. Owner login, portfolio publication, B2B access, and active legacy grants remain under their existing contracts. No mandatory onboarding field or portfolio design changes.

## Evaluation

| Criterion | A wrong implementation to catch | Planned evidence |
| --- | --- | --- |
| No Auth account/session | Reusing `signInWithOtp` | Route test plus browser response/cookie check |
| Atomic verification | Consuming code before failed insert or accepting replay | pgTAP invalid/expired/replay/duplicate/concurrent tests |
| Contact-only approval | Old command creates `reveal_grants` | pgTAP direct and reviewed command tests |
| Review binding | Draft or changed publication leaks contacts | pgTAP stale revision and no-contact cases |
| Durable email | Approved state with lost/duplicate email | Worker claim, retry, idempotency and suppression tests |
| Compatibility | Existing grant expires early | pgTAP active legacy grant read/expiry case |

Current environment has no Docker binary. Local SQL replay is blocked; hosted CI and an independent review are required before release. No production database write is authorized by this record.
