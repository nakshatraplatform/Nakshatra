# B2C pilot invitations and candidate-owned consent

Mode: full. Status: invitation and self-created-pilot restriction implemented locally, unshipped; representative-created candidate consent deferred.

## Problem and goal

The launch waitlist deliberately does not grant creator access. An operator needs a clear, mobile-usable way to invite a named email so that person may join using Google or email/password. For portfolios drafted by a parent or other representative, an accountless Didit liveness link proves only the photo check; it is not durable, account-bound consent to publish the candidate's portfolio.

## Scope and decisions

- Only a verified account in `app_private.pilot_administrators` may issue, list, replace, or revoke creator invitations. The requested `nakshatra.platform@gmail.com` address is an intended operator identity, **not** a hard-coded authorization bypass. Provision that already-confirmed Auth account with the existing `npm run pilot:admin` workflow after production owner review.
- A 32-byte random capability is placed in `/invite/<opaque-token>`; the database stores only its SHA-256 hash. The private invite record stores a normalized delivery email, its hash, issuer, seven-day expiry, and acceptance/revocation timestamps. Only the exact verified Supabase Auth email may consume the link. Acceptance and entitlement grant happen in one database transaction; repeated acceptance by the same account is harmless.
- Password signup validates the unconsumed invitation before asking Supabase to create an account. Google may authenticate first, but the subsequent acceptance RPC independently checks the verified email and never grants access from a client assertion. A visitor without an invitation still uses the waitlist.
- A replacement invite revokes an earlier unaccepted link. Revocation also removes an active creator entitlement. Neither action deletes a portfolio or gives a waitlist row creator access.
- Resend API acceptance is not delivery proof. If email dispatch fails, the authenticated operator receives the new private link for secure manual handoff. No email or other PII is embedded in URLs.
- `docs/pilot-access-lifecycle-plan.md` remains the active launch contract; this implements its deferred single-use invitation requirement without reactivating historical waitlist approval.

## Initial pilot decision: self-created portfolios only

The candidate signs into their own invited account, selects “I am creating my own portfolio,” completes their own verification, and publishes only after the existing publication checks. Parents may assist in person, but the product does not offer them a delegated creator or verification path. Existing representative drafts remain private; they are not deleted or silently converted. The dashboard hides share/copy/rotate until the saved and published data declare `self` and verification is current. The database publication transaction and direct-write trigger reject non-self portfolios; public, approved, interest, and view RPCs reject suppressed links. Delegated verification invitation creation, start, and retry are blocked at API/database boundaries.

This is an explicit self-declaration and account-ownership gate, **not proof that the account holder is the person pictured**. The current Didit flow still matches a selfie to the primary photo. Removing photo comparison in favor of liveness-only will require a separate verification-contract change and a decision about what the product can truthfully label “authenticated.” Device/IP analysis can be an abuse signal, not candidate identity proof. Keep public sharing blocked until those rules and the database migration are tested in a disposable environment.

## Candidate-owned consent: deferred representative slice

This is not interchangeable with the creator invitation above. The parent may own the editing account, but the candidate must have a distinct verified account for durable consent. Do not call a parent-controlled checkbox or accountless Didit invitation candidate consent.

1. Add a private candidate-approval invitation bound to candidate email hash, candidate record, parent-owned portfolio, opaque single-use token, and expiry. The parent may draft but cannot approve for the candidate.
2. Let the candidate sign in with Google or verified email. Require the exact verified email to claim the invitation. Show the candidate the exact saved draft snapshot, photo/visibility choices, and public/protected split before approval.
3. Store an immutable approval of a canonical content/version hash, candidate account ID, consent-policy version, timestamp, and audited IP-neutral event. A parent edit that changes shareable or protected content requires fresh candidate approval before the updated version can publish. The approval must not authorize an arbitrary later draft.
4. Enforce the approval in the database publication transaction and any other path that can activate a public snapshot. A candidate revocation must immediately deactivate public and approved snapshots and revoke active protected-access grants, while retaining a private audit trail.
5. Bind the Didit liveness attempt and approved primary photo to the same candidate record and show a distinct UI state for “photo/liveness verified” versus “candidate approved this portfolio.” Do not display a generic “identity verified” claim from liveness alone.
6. In a future representative launch, restore a “for my child/relative” journey with candidate invitation, pending review, requested changes, approved, and revoked states. No representative-created portfolio should be released until this database gate and end-to-end tests exist.

## Acceptance and evaluation contract

| ID | Expected behavior | Evidence |
| --- | --- | --- |
| INV-1 | Non-admin cannot list or issue invitations; verified admin can issue/revoke. | API tests, database role tests required |
| INV-2 | Opaque, single-use, seven-day link contains no email; mismatched, expired, replaced, or revoked link cannot grant entitlement. | Route tests; pgTAP required before migration deployment |
| INV-3 | Invited email can sign up by password+OTP or Google, then accept and enter a private draft. Uninvited B2C password signup remains closed. | Auth route tests; deployed smoke tests required |
| INV-4 | Email delivery failure leaves a clear secure-manual-handoff path; accepted != delivered. | API test; provider delivery check required |
| SELF-1 | A representative-owned draft cannot publish through application, RPC, or direct table update. | Unit tests pass; pgTAP pending |
| SELF-2 | Existing suppressed links cannot return public/protected data, accept interest, or record views; share/rotate is unavailable without current verification. | Unit tests pass; pgTAP and deployed smoke pending |
| SELF-3 | Candidate verification invitation cannot be created or used during self-only pilot. | Route tests pass; pgTAP pending |
| CND-1 | Candidate account, not parent account, approves a pinned portfolio content version. | Pending implementation and database/E2E tests |
| CND-2 | Parent cannot publish new or changed candidate content without matching current candidate approval; revocation removes live access. | Pending implementation and database/E2E tests |

## Files and boundaries

- `supabase/migrations/20261003120000_b2c_admin_creator_invitations.sql`: private invitations, administrator commands, service-only pre-signup check, exact-email acceptance.
- `src/app/dashboard/dashboard-client.tsx`, `src/app/admin/pilot-access/pilot-access-admin-client.tsx`: discoverable pilot-operations entry and invitation/waitlist dashboard.
- `src/app/api/admin/creator-invitations/route.ts`: same-origin, live-session, rate-limited issuance and email delivery.
- `src/app/invite/[token]/page.tsx`, `src/app/api/pilot-invitations/accept/route.ts`: invitation continuation after authentication.
- `src/app/api/auth/start/route.ts`, `src/app/signup/page.tsx`, `src/components/auth/AuthForm.tsx`: password/Google path gating.
- Candidate slice will affect `src/features/portfolio/server/publish.service.ts`, `supabase` publication/snapshot and access-grant functions, candidate dashboard journey, and Didit binding. Do not rely on a UI-only publish check.
- `supabase/migrations/20261003130000_b2c_self_created_pilot.sql`: the self-only publication and public-access gate, delegated-verification restriction, and shared published/media predicates used by existing approved-data and Storage policies.
- `src/components/portfolio/BlueprintForm.tsx`, `src/features/portfolio/server/dashboard.service.ts`, `src/features/portfolio/server/publish.service.ts`: form guidance and application-level rejection.

## Validation and release hold

- TypeScript, full ESLint, focused route/component tests (118/118), and a production build with local placeholder Supabase configuration passed on 2026-10-03. The initial build without Supabase configuration failed at page-data collection, as expected for the required environment settings. Database migration, pgTAP authorization tests, browser OAuth/password journeys, SMTP delivery, and production admin provisioning remain unverified.
- Independent read-only review found that suppressing the public RPC alone left legacy representative media and approved-data policies open. The migration now gates `is_published_portfolio` and `is_public_portfolio_media_path`; a legacy published-path pgTAP regression fixture was added. The reviewer found no remaining high source-level issue in the corrected migration, but the database and Storage-policy test has not run.
- No production database migration, Vercel deployment, or live administrator grant has been made from this checkout.
- Parent/representative publication remains outside the candidate-owned-consent acceptance contract until the next security slice is implemented and tested.
- To provision the requested operator, first sign in to VivIntro as `nakshatra.platform@gmail.com` with Google so Supabase has a confirmed account. A trusted operator with production service credentials then runs `npm run pilot:admin -- grant nakshatra.platform@gmail.com` in the correct production environment. Do not paste the service-role key into chat or the browser.
- Latest full unit suite: 891/893 passed. The two failures remain Windows-specific Didit Sandbox journal and security-audit CLI tests, unrelated to this pilot restriction. Focused TypeScript and ESLint passed. Database suite could not run: Supabase/Postgres CLI is unavailable on this machine. The migration and pgTAP tests require review and execution against a disposable local/staging database before production deployment.
