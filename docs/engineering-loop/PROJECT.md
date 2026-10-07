# VivIntro / Nakshatra project map

> Current candidate policy (2026-10-05): liveness only; no IP analysis, portfolio-photo
> requirement or face matching. Workflow versions come from session responses, not env.
> See [NAK-60 current contract](features/nak-60-liveness-ip.md). The older photo-bound candidate guidance below is historical.


Product: VivIntro lets marriage prospects create, publish and selectively share portfolios. The repository and Linear project are named Nakshatra. This map covers the areas inspected for NAK-60, not a whole-repository audit.

## Observed stack and boundaries

- Next.js 16.3.4 App Router, React 19, TypeScript 6, Vitest and Playwright; npm lockfile controls dependencies. Consult `node_modules/next/dist/docs/` before modifying framework behavior.
- Supabase Postgres, Auth and private Storage store portfolio and normalized verification state. Forward-only SQL migrations are in `supabase/migrations`; pgTAP tests are in `supabase/tests/database`. Protected CD applies production migrations.
- Didit hosted sessions use server-only API credentials. `src/features/identity-verification/server/` owns candidate/representative session creation, signed webhooks and repositories. `scripts/identity-verification-worker.mjs` fetches decisions and deletes provider sessions; database RPCs own authoritative state transitions.
- `src/features/media/server/` stores private portfolio photos. A `portfolio_media` hero row is the primary photo and can change after verification.
- `src/features/portfolio/server/` and `src/components/templates/` consume publication and public-badge state. BrokerDesk representative verification is a separate subject type; the candidate-only scheduler excludes its queued work, while the legacy shared worker/RPC remains compatible.

## Relevant feature status

- [NAK-73 Didit recovery contract repair](features/candidate-liveness-recovery.md): shared candidate expanded-decision boundary, nullable terminal URL handling, exact metadata correlation, contract-error deferral, same-tab Start/Resume, privacy-safe support references and worker failure categories. Post-Start status outages now retain a created/checking-status recovery state without duplicate creation or fabricated link eligibility; local checks and fresh independent correction review pass, resolving NAK73-V1. No schema or env change. Matching app/worker rollout, clean hosted database CI and real application-backed Sandbox validation remain release gates.

- [Candidate-only verification worker](features/candidate-only-verification-worker.md): removes representative matching-key dependencies from the scheduled portfolio worker and filters candidate jobs before leasing. Local checks and independent review pass; additive migration and matching worker deployment remain pending.

- [Open creator onboarding and feedback](features/open-creator-onboarding.md): owner-approved replacement for the invite-only waitlist. A local one-time, multi-select feedback follow-up adds private difficulty/liked-answer arrays with a first-write-wins migration; hosted database verification and release are pending. Rahul's Production pilot-admin grant was soft-revoked, leaving only the platform account active. Publication safeguards remain separate.

- [NAK-103 signed-in UX clarity pass](features/nak-103-signed-in-ux-clarity.md): narrowly scoped dashboard, portfolio form/view, and account-settings presentation improvements; no landing-page or product-rule changes.
- [Temporary ESLint audit risk acceptance](features/eslint-glob-audit-remediation.md): user-approved exception for one exact development advisory/graph until October 9, 2026 at 00:00 New York; all other high/critical findings remain blocking.
- [Membership anonymous grants](features/membership-anonymous-grants.md): forward revoke migration verified by hosted clean replay and all 924 pgTAP assertions at 283e78b; production application remains pending CD.
- [Database-only CD](features/database-only-cd.md): production database deployment now defaults to preview-only; explicit confirmation permits application and final-history verification. The preview follow-up is local pending PR/release. Vercel deploys the application independently.
- [Disclosure migration recovery](features/disclosure-migration-recovery.md): fixes the populated-upgrade reference-prefix prerequisite; all 70 migrations confirmed applied with zero pending; additional object/advisor queries are limited by intermittent CLI authentication. Supabase CLI is upgraded locally to 2.119.0.
- [NAK-60 liveness only](features/nak-60-liveness-ip.md): current candidate policy uses photo-free preparation, exact-attempt retries and a distinct liveness-only proof. Didit supplies each session's version; no version env setting is required. Historical IP proofs retain their policy. Local checks pass; release requires the forward migration, matching app/worker deployment and Sandbox evidence.
- [NAK-60 document-free verification](features/nak-60-document-free-verification.md): integrated; local pre-production configuration rename uses `DIDIT_WORKFLOW_ID` and `DIDIT_WORKFLOW_VERSION` across app/webhook/worker. Provider Sandbox and biometric privacy gates remain open; see the feature record for the single-workflow limitation and current checks.
- [NAK-60 portfolio viewer refinement](features/nak-60-portfolio-view-refinement.md): implemented locally; responsive navigation, complete authorized gallery and post-gallery astrology placement validated in component tests.
- [NAK-101 portfolio and dashboard usability follow-up](features/nak-101-portfolio-ux-followup.md): portfolio modal, phone entry, footer, and return-to-top improvements; shared customer header now sticks on Dashboard, My brokers, and Account, and the published-owner edit action is single-line on desktop. Prepared on the follow-up branch; pending PR/release.
- [NAK-102 test publication access](features/nak-102-test-publication-access.md): a distinct, revocable personal-link exemption for the exact Rahul test account, without a Didit proof or broker eligibility. The Production grant is active after the owner unpublished the older snapshot; the public link remains blocked until Rahul reviews, consents, and republishes. See the feature record for the Production safety checks and remaining UI wording follow-up.
- [NAK-102 landing Phase 1](features/nak-102-landing-phase-1.md): focused problem-to-outcome copy and SEO refinement on the pending trust-clarity branch; preserves the hero, Guided Tour, viewer guide, and public/protected boundary. Invitation copy now accurately distinguishes a signed-in request account from creator access.
- [NAK-102 landing/first-run follow-up](features/nak-102-landing-and-first-run-followup.md): current Detailed/Complete vocabulary, expandable Trust/FAQ, and a focused invited-creator first run. Legacy Brief rendering remains a compatibility path, not a marketed publication choice.
- [Document-free product decision](../identity-verification/liveness-only-decision.md): approved direction, implementation pending.
- [Production readiness](../identity-verification/production-readiness.md): live workflow disabled pending gates; older ID-document portions need reconciliation.

## Checks and limits

- [Candidate liveness recovery](features/candidate-liveness-recovery.md): owner-only status/resume/cancel, bounded expiry and cleanup-gated replacement; local implementation and review evidence, with authoritative Supabase CI and live-provider rollout gates kept distinct.

`npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:db:local`, `npm run build`, and `npm run test:e2e` are repository commands. Focused tests run with `vitest run <path>`. Docker was unavailable during the first NAK-60 implementation pass, so local pgTAP was not established. A source inspection or mocked unit test does not certify a Didit Sandbox session, provider deletion, production deployment or jurisdiction-specific biometric compliance.
