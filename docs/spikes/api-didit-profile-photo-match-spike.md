# Didit document-free profile-photo match spike

- Status: **Open — provider feasibility is a release blocker**
- Owner: Identity verification implementation
- Timebox: two engineering days plus provider response time
- Related: NAK-60, PR #59, [approved product direction](../identity-verification/liveness-only-decision.md)

## Decision question

Can VivIntro's existing hosted Didit session perform a liveness check and compare the live capture to the exact primary portfolio photo that the candidate authorized for publication, without collecting an identity document or retaining an extra face template?

## Why this needs a spike

Didit's [workflow documentation](https://docs.didit.me/reference/workflows) describes a biometric-authentication workflow that compares a live selfie with `portrait_image` supplied at session creation. Its [Face Match documentation](https://docs.didit.me/reference/face-match-11) also describes a stored reference from a previous liveness check. Neither description proves that VivIntro's current `/v3/session/` integration, account configuration, and first-time user flow can use the portfolio photo as the reference. The existing code sends document-country/type and expected legal details and the worker requires an ID module.

## Questions and evidence to collect

1. Confirm the exact `/v3/session/` request shape for first-time `portrait_image`: accepted encoding or URL, size/type limits, authentication, lifetime, and whether Didit fetches it from VivIntro. Prove that a hosted session returns liveness and face-match results without any ID module.
2. Test a consented primary photo with the same person, a different person, no detectable face, multiple faces, and low-quality images. Record only pass/fail/module metadata; do not place images, raw decisions, credentials, or session IDs in this repository or Linear.
3. Confirm workflow-version binding and the exact decision fields, warnings, thresholds, manual-review behavior, webhook ordering and retries. An overall `Approved` status alone must not pass when either required module is missing.
4. Confirm whether disabling media outputs prevents response/storage of images and whether it affects matching. Validate provider deletion and the exceptions documented in [Didit's deletion guide](https://help.didit.me/data-privacy/delete-verification-data), including queued webhooks, blocklist entries and audit logs.
5. Confirm contractual data-processing region, subprocessors, training opt-out, retention, deletion, pricing and support for the intended launch countries and age policy with the privacy owner. The sandbox itself captures real media, so use consenting test participants only.

## Repository feasibility check

- The candidate photo is a `portfolio_media` row with `media_type='hero'` and a private Storage object. `src/features/media/server/media.service.ts` permits promotion, deletion and replacement; `set_portfolio_hero` changes the hero row. A proof must bind to a specific media ID **and content version**, and a photo mutation must invalidate it atomically.
- The current verification result is candidate-scoped, lasts 365 days, and drives publication/public badges; it is not bound to any photo. `scripts/identity-verification-worker.mjs` currently requires an ID check, name and birth-date matching. The reconciliation RPC in `supabase/migrations/20260910120000_brokerdesk_representative_verification.sql` shares this rule with BrokerDesk representatives.
- The current media service downloads via an authenticated Supabase client. The candidate-owned, server-side source image should be sent to Didit only after consent; never expose a long-lived signed photo URL or write a biometric reference to application logs.

## Exit criteria and alternatives

The spike passes only with an ID-free hosted workflow, verified first-time profile-photo input, deterministic required-module decisions, tested deletion behavior, and privacy-owner acceptance. If the profile photo cannot be the reference, evaluate another Didit mode or provider behind the existing provider boundary. Do not substitute standalone liveness while continuing to display an identity or profile-match badge, and do not silently restore ID collection.

## Follow-up

Feed the evidence and provider-specific contract into the [transition plan](../plans/nak-60-document-free-verification-plan.md). Keep live verification disabled until the plan's release gates pass.

## History

- 2026-09-30: Opened after reviewing the latest main branch and current Didit documentation. No provider capability or legal jurisdiction is assumed verified.
