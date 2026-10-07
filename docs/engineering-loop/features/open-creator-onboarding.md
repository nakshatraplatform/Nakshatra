# Open creator onboarding and feedback

Mode: full. Risk: critical (authentication, authorization, forward migration, production role change). Source: owner decision on 2026-10-04. Issue: NAK-104. Branch: `feat/nak-104-open-creator-onboarding`.

## Problem and goal

The public landing page currently sends visitors to a launch waitlist, password signup rejects uninvited addresses, and the database gives creator capability only to entitled or operator accounts. This prevents real users from completing the private-portfolio journey and giving onboarding feedback. The owner now wants self-service signup for every visitor, while only `nakshatra.platform@gmail.com` remains a pilot administrator.

## Contract

1. Any visitor may use email/password or Google to create an account. A confirmed account may create one owner-controlled, private portfolio without an invitation. A viewer following a shared link must not silently acquire a portfolio as a side effect of showing interest.
2. An unconfirmed or revoked session cannot create or mutate a portfolio. Public publication still requires a self-created portfolio, required details, disclosure consent, and current liveness/IP verification or the separately authorized, narrowly scoped test exemption. Protected access remains owner-approved.
3. Public calls to action and auth screens lead directly to signup/signin. Old waitlist and creator-invitation links lead to signup; their write endpoints do not grant access. Historical private records remain intact for audit and recovery.
4. The only active Production pilot-admin grant belongs to `nakshatra.platform@gmail.com`; Rahul's admin grant is soft-revoked, without changing his Auth account or test-publication grant. Application authorization is still database-backed, never inferred from a displayed email or UI label.
5. After completing the portfolio details, an owner can optionally submit concise onboarding feedback. It must be private, bounded, authenticated, and viewable only by the platform administrator; it must never become part of public or protected portfolio content.

## Design and rollout

- Keep `app_private.actor_can_create_portfolio` as the canonical database capability and change it to confirmed-account ownership. The existing portfolio unique owner constraint, RLS/transaction rules, and independent publication gates stay in place.
- Retire waitlist/invite writes rather than deleting historical data. Use forward-only migrations and preserve old links as safe redirects.
- Do not deploy app copy suggesting open access until the migration is applied. CI must test a clean database replay, authorization negatives, and the signup/owner journey; CD migration history must be checked before live smoke tests. Production migration history was observed at `20261001120000` on 2026-10-04, so several earlier forward migrations remain pending.
- The production admin change is separate from deployment: exact confirmed Auth identities were checked, Rahul's existing row was soft-revoked, and a query confirmed one active admin row, for the platform email, at 2026-10-04 16:44 UTC.

## Execution context

Verified at `origin/main` `ef61233`: auth routes/forms, dashboard, landing, publication services, pilot and invitation migrations, and current pgTAP fixtures. The open-signup, retired-route, feedback, and current-contract updates are implemented on `feat/nak-104-open-creator-onboarding`. Hosted database verification and release authorization remain pending.

## Evaluation

| ID | Case and expected result | Wrong implementation rejected by |
| --- | --- | --- |
| OPEN-1 | Uninvited email signup succeeds; confirmation opens a private draft. | Auth route test and clean-database pgTAP capability test |
| OPEN-2 | Unconfirmed account and revoked session cannot create. | pgTAP negative cases |
| OPEN-3 | Viewer-only OTP/OAuth does not bootstrap an owner draft. | Auth callback/verify tests |
| OPEN-4 | Old waitlist/invite endpoints cannot grant/revoke capability. | Route 410 and SQL privilege tests |
| OPEN-5 | Publication still fails before verification/consent/content. | Existing publication and self-only pgTAP suites |
| OPEN-6 | Completed owner may submit bounded private feedback; another user cannot read or submit for that portfolio. | Feedback route and pgTAP tests |
| OPEN-7 | Only the platform account is active admin in Production. | Exact-target Production read-only verification, recorded above |

## Security considerations

No client assertion, entered email, historical waitlist row, or invite token grants creator capability. Confirmed Auth identity and live session are required at the database boundary. Feedback must exclude contact fields and be rate-limited. Old private data is not deleted; any retention decision is separate. Public visitor traffic may increase Auth/email/Didit cost and abuse exposure, so monitor rate limits and provider quotas after release.

## Progress and evidence

Local lint, typecheck, production build, 932 unit assertions across 146 files (bounded to four workers), and four Chromium landing/auth browser checks passed. The first full unit run found two stale invitation expectations (corrected) plus worker startup timeouts under high parallelism. The fresh-context independent review found two feedback SQL/test issues (missing hero media in a completion fixture and a null admin-list limit); both were corrected and the return review found no remaining material defect in those paths. This is static review, not a database pass. Local clean migration replay/pgTAP could not start because neither Docker nor Podman is installed. Hosted database CI, migration-history review, and staged production rollout remain release gates. Production app/database migrations have not been deployed by this task.

PR #79 CI follow-up: the first hosted run exposed an invalid schema-qualified `NULLIF` call in the feedback RPC and a vacuous append-only audit assertion against an empty table. The migration now uses PostgreSQL's unqualified `nullif` expression, and the pgTAP test inserts a valid audit event before attempting its forbidden update. A dedicated feedback-service test covers success, malformed responses, errors, and save acknowledgements. All 936 unit tests and the per-file 80% feature coverage gate passed locally with four workers; lint and typecheck passed. A separate read-only review found no material defect in the correction. Hosted pgTAP remains the decisive database verification because local containers are unavailable; the correction is not a production deployment.

Before the corrected PR could rerun, `main` advanced to `15ef7fa` with NAK-60 candidate liveness/IP checks. The PR branch merged that commit and reconciled five overlapping files: open signup and creator-account wording remain, while the new liveness/IP language and checks are retained. Old invitation administration remains retired. An independent integration review identified an outdated feedback choice and contract phrase; both now describe liveness/IP checks. Against the merged snapshot, 958 unit tests, the feature coverage gate, lint, typecheck, database-fixture smoke check, and production build passed locally. Hosted pgTAP remains pending before merge/release.

## Feedback multi-select follow-up (2026-10-05)

Risk: critical because this extends a private production table and its security-definer RPCs. Source: owner request to allow multiple hardest steps and add a multiple-choice “what did you like” question. This is local, uncommitted follow-up work; it has not been deployed.

The initial multi-select draft kept saved answers editable, but the later one-time feedback decision below supersedes that behavior. “Hardest steps” requires one or more selections, with “Nothing stood out” exclusive. “What did you like” is optional so users are never forced to choose a positive response. Both controls use keyboard-operable native disclosure elements with checkboxes. Feedback remains private and absent from portfolio views.

The additive migration `20261006220000_creator_feedback_multiple_choices.sql` backfills existing single-step answers into `hardest_steps`, adds `liked_aspects`, keeps the original RPC callable for older app instances, introduces a bounded v2 submission RPC, and updates owner/admin read projections. The API also normalizes the old single-choice browser request during rollout. The existing account export includes the new table columns automatically. The app must be deployed only after this migration succeeds; deploying the new app first would make feedback submission unavailable. Existing feedback rows remain intact. Under the current one-time contract, the legacy RPC accepts a first submission but cannot update a prior response.

| ID | Acceptance case | Check |
| --- | --- | --- |
| FB-1 | Owner can select multiple difficulties and optional liked aspects in one submission. | Component, route, and service tests |
| FB-2 | “Nothing stood out” cannot coexist with another difficulty; duplicate/unknown choices are refused at API and database boundaries. | Schema tests and pgTAP |
| FB-3 | Prior feedback is backfilled, owner-only reads and export include new answers, and old clients can make a first submission. | Migration and pgTAP |
| FB-4 | Administrator sees the selections but ordinary users and anonymous visitors cannot enumerate feedback. | Admin UI inspection and pgTAP |

Prior multi-select snapshot: focused feedback tests (14 cases), full unit suite (962 tests across 149 files), lint, typecheck, fixture smoke, and a production build passed locally. Fresh-context independent review found and prompted fixes for an old-browser request incompatibility and an in-flight save status race. Those results precede the one-time contract change below; database pgTAP could not run locally because Docker/Podman is unavailable. Current source: `src/components/feedback/CreatorOnboardingFeedback.tsx`, `src/features/feedback/onboarding-feedback-options.ts`, `src/features/feedback/server/onboarding-feedback.service.ts`, `src/app/api/portfolio/onboarding-feedback/route.ts`, `src/app/admin/onboarding-feedback/onboarding-feedback-admin-client.tsx`, the new migration, and their matching Vitest/pgTAP tests.

## One-time feedback decision (2026-10-05)

The owner clarified that onboarding feedback must be a one-time response, not an editable form or a recurring weekly prompt. After the first successful save, replace the form with a brief acknowledgement for that visit; on subsequent dashboard visits, render no feedback section. Existing responses also count as completed. Keep future surveys out of this implementation until there is a distinct question, timing, and opt-out/eligibility policy.

The database must reject a second submission, including from an old browser tab or concurrent request; the UI alone is not authoritative. Preserve the owner/admin read and account-export rules. A duplicate response returns a specific conflict rather than an unavailable-service error. The forward migration from the multi-select follow-up is still local/unapplied, so its submission functions can be revised before release.

| ID | Acceptance case | Wrong implementation rejected by |
| --- | --- | --- |
| FB-5 | New owner sees form; successful submit shows acknowledgement, then no prompt on revisit. | Component test for initial, success, and saved GET states |
| FB-6 | Repeat/parallel/legacy submissions do not overwrite saved feedback. | Route conflict test and pgTAP first-write-wins assertions |
| FB-7 | Lightbox close is compact on desktop/mobile, returns to gallery, and retains click/Escape/focus behavior. | Template interaction test plus responsive visual review |

## Guided draft-to-publication follow-up (2026-10-06)

The owner observed that saved drafts, form sections, previews, and liveness were individually present but did not form a clear next-action sequence. This UI-only follow-up does not change publication eligibility, Didit integration, payment status, protected-viewer rules, or database contracts.

The dashboard now identifies a saved draft, shows required-detail progress and the next incomplete answer, and resumes editing in that section. The mobile section selector is anchored outside the scrollable form body. The final form section points to the review, which retains both public and protected previews. Review provides an action to return to missing details or go to the separate liveness check; the save response's existing candidate ID makes that section available in the same visit as a first draft save. The publication disclosure appears only when required details, both preview links opened in the current review, creator-account status, and verification/test exemption are ready. Didit camera/IP consent remains separate and must be given at the liveness step. Publication remains server-authorized and is not made available by these UI changes alone.

Acceptance: an interrupted draft remains private and resumable; a returning creator sees a specific next answer; section navigation remains visible while mobile form fields scroll; an incomplete review links back to editing; an otherwise complete but unverified review links to the liveness check without showing publication consent; a fully ready review still requires explicit publication consent after opening both previews. The pending Didit lifecycle must be tested separately before claiming end-to-end verification success.

Verification: 967 Vitest cases across 149 files passed on the final code, including 49 focused editor/dashboard cases. Changed-file ESLint, TypeScript, production build, and diff whitespace checks passed. An independent read-only review found standalone-form, preview-progress, mobile-scroll, and focus issues; all were corrected and covered in the focused tests. A live responsive/device pass and Didit provider end-to-end pass remain pending.
