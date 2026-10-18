# VivIntro / Nakshatra project map

- [Accessible account entry](features/auth-accessibility-feedback.md): concise
  signup guidance, same-route recovery focus, field-associated password/code
  errors, truthful recovery advice and quiet background liveness reads. Isolated
  follow-up to NAK-74; current validation and manual screen-reader limits are in
  the feature record. No authentication/domain/API or database-policy changes.
- [NAK-84 test coverage hardening](features/nak-84-test-coverage-hardening.md):
  continues the completed NAK-17 baseline in risk order. The authenticated
  theme E2E hydration race is stabilized and passes repeated no-retry plus all
  three viewport projects. Direct repository/client coverage now covers access,
  identity webhooks, horoscope storage, MFA, authentication, account, location,
  consent and identity-recovery routes. Import-safe workers are instrumented and
  18 high-risk boundaries have per-file regression floors. Current evidence and
  remaining UI/provider-boundary work are recorded in the feature file.

- [Frontend integration with main](features/frontend-hardening-integration.md):
  October 18 integration with main `46540e5` preserves onboarding/Didit/security
  work alongside component loading and hybrid lint. Six conflicts resolved;
  skip-focus regression fixed and independently reviewed. Final local checks:
  1,529 unit tests, 61 coverage gates, 159 browser cases plus corrected 27-case
  loading rerun, production build and 27 repeated production history cases pass.
  Hosted CI/Preview and real-provider/physical-device checks remain separate.

- [Component loading and navigation](features/component-loading-navigation.md):
  removes root-wide loading on ready public pages; authenticated customer
  headers and preview navigation stay outside their data waits. Existing orbs
  and safe regional retry are reused; ordinary internal navigation is audited
  without changing provider/fresh-auth handoffs. October 18 rerun: 1,464 unit
  tests, 59 coverage gates, 90 affected browser cases and 27 repeated
  production-mode history cases passed. Earlier Back-restoration blocker is
  resolved in these tested conditions, not a universal browser guarantee.

- [Hybrid lint tooling](features/hybrid-lint-tooling.md): Oxlint owns native Next checks; official React/TypeScript/accessibility plugins stay on ESLint. Retired glob dependency chain and temporary exception removed; strict audit and anti-reintroduction guards added. Current verification is recorded in the feature record.

- [Frontend priority hardening](features/frontend-priority-hardening.md): account/editor keyboard and focus lifecycle, safe popup Escape handling and corrected font inventory. The historical dependency blocker is replaced by hybrid lint tooling; latest-main integration validation is recorded separately. No release approval implied.

> Current candidate policy (2026-10-05): liveness only; no IP analysis, portfolio-photo
> requirement or face matching. Workflow versions come from session responses, not env.
> See [NAK-60 current contract](features/nak-60-liveness-ip.md). The older photo-bound candidate guidance below is historical.


Product: VivIntro lets marriage prospects create, publish and selectively share portfolios. The repository and Linear project are named Nakshatra. This map covers the areas inspected for NAK-60, not a whole-repository audit.

## Observed stack and boundaries

- Next.js 16.3.8 App Router observed locally (package range ^16.3.4), React 19, TypeScript 6, Vitest and Playwright; npm lockfile controls dependencies. Consult `node_modules/next/dist/docs/` before modifying framework behavior.
- Supabase Postgres, Auth and private Storage store portfolio and normalized verification state. Forward-only SQL migrations are in `supabase/migrations`; pgTAP tests are in `supabase/tests/database`. Protected CD applies production migrations.
- Didit hosted sessions use server-only API credentials. `src/features/identity-verification/server/` owns candidate/representative session creation, signed webhooks and repositories. `scripts/identity-verification-worker.mjs` fetches decisions and deletes provider sessions; database RPCs own authoritative state transitions.
- `src/features/media/server/` stores private portfolio photos. A `portfolio_media` hero row is the primary photo and can change after verification.
- `src/features/portfolio/server/` and `src/components/templates/` consume publication and public-badge state. BrokerDesk representative verification is a separate subject type; the candidate-only scheduler excludes its queued work, while the legacy shared worker/RPC remains compatible.

## Relevant feature status

- [NAK-66 personal expiry reminders](features/portfolio-expiry-reminders.md): bounded due-grant producer, current-state/digest-fenced pre-send checks, honest skipped disposition and balanced existing outbox claims. Scheduled generation precedes relationship mail without starving independent queues. Local implementation, clean migration replay, full unit/database verification and independent review are complete; production activation and real inbox UAT remain pending. BrokerDesk stays outside this increment.

- [Application-wide Lenis scrolling and frontend evidence](features/application-smooth-scroll.md): root progressive enhancement with native touch/nested/reduced-motion fallback, dialog locks and keyboard/navigation interruption. Locally validated with production build, coverage and Chromium fixtures; broader physical-device/a11y/performance/asset-rights evidence remains separate. The dependency-audit blocker was resolved by hybrid lint tooling. No deployment performed.
- [Onboarding foundations](features/onboarding-foundations.md): local increments
  on merged PR108/main `fc7f55c` fix multi-word name typing, routine refresh
  closing the editor and Basics-only progress labeling. Adds actionable errors,
  forward-navigation/publication checks, saved self-created Account names and
  removal of address/narrative minimum requirements with a forward migration.
  Family/Astrology remain optional; incomplete private saves and all publication
  safeguards remain. [Dropdown inventory and feedback ledger](features/onboarding-options-and-feedback.md)
  separates proposals from implementation. Responsive Chromium covers five widths
  and both themes. Database execution/deployment and release remain pending.
  [Options and save efficiency](features/onboarding-options-and-save-efficiency.md)
  adds familiar stable-value dropdowns, bounded Other recovery, currency/count
  confirmations, debounced/coalesced saves and serialized resume-position writes.

- [NAK-107 consumer touchpoint polish](features/nak-107-touchpoint-polish.md):
  extracted from the paused PDF branch onto main `d99e14c`. Includes separate-tab
  portfolio logo links, warm display terminology, full-name public-only WhatsApp
  summaries and consistent tab titles. Preserves the existing design and all
  publication/access safeguards. PDF development is deferred; this branch has
  no PDF feature, dependencies or schema changes and needs no database deployment.
  Extraction verification passes 1,383 unit tests, 59 coverage gates, 66 browser
  cases, lint/typecheck/build and fresh review. Hosted CI remains pending.

- [NAK-74 expanded readiness fixes](features/nak-74-expanded-readiness-fixes.md): stable anonymous quota keys, common database interest quota, reserved/CAS horoscope uploads with independent durable object cleanup, account-modal keyboard lifecycle, skip targets, photo confirmation, deletion timing copy, protected-route noindex, and scheduled per-class retention health. Integrated fetched main `fc7f55c` after initial work on `d1e08f8`. OPS-VERIFY-01 duplicate-message erasure is corrected, including legacy partial scrubs and real account-deletion preparation. Fresh checks pass 1,412 unit tests/61 gates and two scoped independent reviews; focused Supabase 63 assertions and independent PostgreSQL 24 checks pass. Docker recovery cleared the remaining database gate: full clean Supabase replay, 57 suites/1,534 assertions, DB lint and exact generated public-type comparison pass; security advisors return no issues. Production build and 48 distinct browser cases pass across the initial batch and two unchanged isolated reruns; first-run timing/teardown failures remain documented. Production migration, scheduler activation and actual backlog cleanup are separate release steps. Email authentication/DMARC excluded.


- [NAK-106 consent-first publishing follow-up](features/nak-106-consent-publishing-followup.md): implemented locally on latest main `888b70e`. Portfolio logo home links, concise/aligned interest fields, consent-driven publication with optional previews, and account JSON download UI removal. Full 1,354-test coverage/59 feature gates, lint/type/build, 66 affected Chromium cases across two runs and eight WebKit cases pass. Independent correction review resolved focus/selector defects. Completeness, liveness, account, stale-revision and protected-access safeguards remain. No schema/API change, commit/push or production action; physical iPhone and future hosted CI remain release checks.
- [NAK-106 welcoming introduction journey](features/nak-106-welcoming-introduction-journey.md): revised landing copy within the existing structure/themes, familiar consumer terms, optional message disclosure, page-session answer retention, and safe sign-in/password-recovery continuation. Required fields and publication/access eligibility remain unchanged. Full 1,367-test coverage/59 feature gates, lint/type/build, and 89 browser cases pass across the broad batch and corrected-case rechecks; initial fresh-context source review found no material issues and final delta review is recorded with the delivery. No waitlist, migration, commit/push or release action; real-provider/physical-device checks remain separate.

- [NAK-74 personal sharing disclosures](features/nak-74-personal-sharing-disclosures.md): privacy/terms clarification for creating, publishing, sharing and managing personal portfolios, with retention, provider and browser-storage explanations. Owner confirmed initial markets India/US (primarily Indians in India and abroad), named founders and shared grievance contacts. Operator location is omitted from public copy; address/governing-law publication is explicitly deferred for this increment. BrokerDesk and future paid/refund terms are deferred. Retention durations and authorization are unchanged; broader launch/legal/production evidence remains open.

- [NAK-106 portfolio and interest polish](features/nak-106-portfolio-interest-polish.md): merged as part of PR #101, including bounded mobile scrolling, glass navigation, calm disclosure/actions and the conditional ZIP/PIN candidate form. Candidate contacts/location and message are optional; family context remains required. Its forward-only RPC migration is separate from application deployment; production application status is not verified by the presentation follow-up. Historical validation, three bounded reviews and physical-iPhone limits remain in the record. See the shared-system record below for the current local post-merge follow-up.
- [NAK-106 shared portfolio system](features/nak-106-shared-portfolio-system.md): PR101/102 presentation and PR103 database completeness work are merged; latest inspected main is `888b70e`. PR103 fixture correction `4d33209` passed hosted database CI before merge. Historical browser/fixture evidence remains in its feature record; current consent-first usability follow-up is linked above. Production migration application is separate and not asserted by this local follow-up; unrelated NAK102 edits remain preserved.

- [Shared presentation audit refactor](features/shared-presentation-audit-refactor.md): platform tokens, explicit editor colors, portfolio cascade cleanup, grid spacing/weights, tinted elevation, dashboard state clarity/accessibility and aligned skeleton. Follow-ups cover editor comboboxes, narrative/contact/gallery accessibility, landing readability/contrast and portal artwork theme isolation. Local implementation verified with unit, build and responsive/theme checks plus independent review; not deployed. Autosave API400 diagnosis remains a separate pre-push task.

- [NAK-105 interest and viewer experience](features/interest-viewer-experience.md): draft PR97 integrates main/PR96 (`ebed0a0`) while retaining compact icon navigation, non-obstructing floating Top, discoverable link actions, exact-ID retained owner submission details/history, required canonical visitor/candidate fields and guarded owned-profile reuse. Photo Storage authorization excludes hidden/owner-only media. The authorized fifth fresh review found one integrated browser-test mismatch; coordinator supplied the newly required registered email without weakening validation, and the corrected case passed across all three projects. Combined-source checks: 1,253 unit tests, 57 coverage gates, production build/lint/typecheck/audit, and 189 browser cases (6 intentional skips). [Evidence ledger](features/interest-viewer-review.md) preserves immutable review provenance and distinguishes these checks from blocked actual migration replay, pgTAP, Storage RLS and generated-type verification. No merge/release/deployment claim; the weaker old RPC is retired, requiring coordinated database/app rollout.

- [NAK-71 application-wide loading feedback](features/nak-71-loading-orbs.md): `src/components/loading/LoadingStatus.tsx` owns themed, accessible page/compact feedback; `PageLoading` supplies streamed fallbacks and `PortfolioImage` owns photo load/error state. Actual async owners control visibility across auth, portfolio, liveness, account and BrokerDesk; idle human steps retain actionable instructions. Integrated with main `f46ccf1`, three-round fresh review completed, remote follow-up branch `fix/nak-71-loading-feedback`; release is separate.

- [NAK-105 published portfolio experience and customer validation](features/published-portfolio-experience.md): grouped link actions, quiet completed liveness presentation, responsive viewer navigation/footer, lighter initial resources and canonical customer-form corrections. Integrated with main `888e935`; 1,228 unit tests and 57 feature-coverage gates pass, with full responsive checks plus corrected-case reruns recorded in the feature. Final fresh review has no material findings; prepared for a draft feedback PR, with hosted CI pending. Simulated mobile LCP remains around 3.1s against a 2.5s target; no deployment or legal certification. Primary intended audiences: India/USA; operating jurisdiction remains unknown.

- [NAK-105 dashboard and geography clarity](features/dashboard-geography-clarity.md): direct unpublished-owner editing, explicit active-link sharing, one next-step journey, revision-bound remembered preview openings, canonical current-residence IDs and grouped field order. The authorized review extension resolved inspected stale-tab and manual-country findings. Latest-main integration retains NAK-73 authoritative liveness refresh on the single panel; bounded integration review and hosted database/CI checks are pending. Schema-first protected deployment precedes the dependent app merge. No bypass is added.

- [NAK-72 product evidence on the landing page](features/nak-72-evidence-led-landing.md): reconciles the October 3 content draft with the merged open-signup, single-Introduction and liveness-only contracts; preserves NAK-102's approved hero/layout while making disclosure examples, FAQ/schema and access explanations concrete.
  October 12 integration onto main `fdc948a` passes exception-free audit, 1,195
  unit tests, 57 coverage gates, 82 browser cases, lint/typecheck/build and fresh
  review. Hosted CI, PR/merge and deployment remain separate from local evidence.

- [NAK-73 Didit recovery contract repair](features/candidate-liveness-recovery.md): shared candidate expanded-decision boundary, nullable terminal URL handling, exact metadata correlation, contract-error deferral, same-tab Start/Resume, privacy-safe support references and worker failure categories. Post-Start status outages now retain a created/checking-status recovery state without duplicate creation or fabricated link eligibility; local checks and fresh independent correction review pass, resolving NAK73-V1. No schema or env change. Matching app/worker rollout, clean hosted database CI and real application-backed Sandbox validation remain release gates.

- [Candidate-only verification worker](features/candidate-only-verification-worker.md): removes representative matching-key dependencies from the scheduled portfolio worker and filters candidate jobs before leasing. Local checks and independent review pass; additive migration and matching worker deployment remain pending.

- [Open creator onboarding and feedback](features/open-creator-onboarding.md): owner-approved replacement for the invite-only waitlist. A local one-time, multi-select feedback follow-up adds private difficulty/liked-answer arrays with a first-write-wins migration; hosted database verification and release are pending. Rahul's Production pilot-admin grant was soft-revoked, leaving only the platform account active. Publication safeguards remain separate.

- [NAK-103 signed-in UX clarity pass](features/nak-103-signed-in-ux-clarity.md): narrowly scoped dashboard, portfolio form/view, and account-settings presentation improvements; no landing-page or product-rule changes.
- [Historical ESLint audit risk acceptance](features/eslint-glob-audit-remediation.md): superseded by hybrid lint tooling. The retired vulnerable dependency chain and expired exception are removed; all high/critical findings now block without exceptions.
- [CI browser-job isolation](features/ci-browser-job-isolation.md): separate validation/browser budgets, exact browser-download cache and always-run fail-closed aggregate preserving the existing required check name. Local syntax/gate checks and fresh review pass; hosted full E2E and cache behavior remain pending.
- [Membership anonymous grants](features/membership-anonymous-grants.md): forward revoke migration verified by hosted clean replay and all 924 pgTAP assertions at 283e78b; production application remains pending CD.
- [Database-only CD](features/database-only-cd.md): production database deployment now defaults to preview-only; explicit confirmation permits application and final-history verification. The preview follow-up is local pending PR/release. Vercel deploys the application independently.
- [Disclosure migration recovery](features/disclosure-migration-recovery.md): fixes the populated-upgrade reference-prefix prerequisite; all 70 migrations confirmed applied with zero pending; additional object/advisor queries are limited by intermittent CLI authentication. Supabase CLI is upgraded locally to 2.119.0.
- [NAK-60 liveness only](features/nak-60-liveness-ip.md): current candidate policy uses photo-free preparation, exact-attempt retries and a distinct liveness-only proof. Didit supplies each session's version; no version env setting is required. Historical IP proofs retain their policy. Local checks pass; release requires the forward migration, matching app/worker deployment and Sandbox evidence.
- [NAK-60 document-free verification](features/nak-60-document-free-verification.md): integrated; local pre-production configuration rename uses `DIDIT_WORKFLOW_ID` and `DIDIT_WORKFLOW_VERSION` across app/webhook/worker. Provider Sandbox and biometric privacy gates remain open; see the feature record for the single-workflow limitation and current checks.
- [NAK-60 portfolio viewer refinement](features/nak-60-portfolio-view-refinement.md): implemented locally; responsive navigation, complete authorized gallery and post-gallery astrology placement validated in component tests.
- [NAK-101 portfolio and dashboard usability follow-up](features/nak-101-portfolio-ux-followup.md): portfolio modal, phone entry, footer, and return-to-top improvements; shared customer header now sticks on Dashboard, My brokers, and Account, and the published-owner edit action is single-line on desktop. Prepared on the follow-up branch; pending PR/release.
- [NAK-102 test publication access](features/nak-102-test-publication-access.md): historical, distinct and revocable personal-link exemption; the owner subsequently requested revocation of all accounts' bypasses. The existing feature record reports all Production grants revoked. Actual Didit liveness, consent and protected-viewer safeguards remain required.
- [NAK-102 landing Phase 1](features/nak-102-landing-phase-1.md): focused problem-to-outcome copy and SEO refinement on the pending trust-clarity branch; preserves the hero, Guided Tour, viewer guide, and public/protected boundary. Invitation copy now accurately distinguishes a signed-in request account from creator access.
- [NAK-102 landing/first-run follow-up](features/nak-102-landing-and-first-run-followup.md): current Detailed/Complete vocabulary, expandable Trust/FAQ, and a focused invited-creator first run. Legacy Brief rendering remains a compatibility path, not a marketed publication choice.
- [Document-free product decision](../identity-verification/liveness-only-decision.md): approved direction, implementation pending.
- [Production readiness](../identity-verification/production-readiness.md): live workflow disabled pending gates; older ID-document portions need reconciliation.

## Checks and limits

- [NAK-73 liveness completion](features/nak-73-liveness-completion.md): current
  2026-10-17 follow-up fixes first-click handoff through overlapping status reads
  and Safari parent-refresh races, adds a one-time accessible completion dialog,
  bounded return checks and owner-scoped durable after-response confirmation mail.
  Latest-main integration now preserves PR109 retention/horoscope jobs alongside
  the single reconciliation-before-email promise; NAK73-VERIFY-01 is resolved
  locally against main aeeaecc. Combined validation passes 1,442 unit tests,
  61 coverage gates, 48 browser cases (including one ordinary-limit retry),
  all 105 migrations / 1,552 SQL assertions, types/build/audit and independent
  integration review. Earlier lease-contention evidence remains in the feature.
  New migration must precede matching app rollout; hosted runtime, real provider
  delivery, physical-device and Linear synchronization checks remain separate.

- [Candidate liveness recovery](features/candidate-liveness-recovery.md): owner-only status/resume/cancel, bounded expiry and cleanup-gated replacement; local implementation and review evidence, with authoritative Supabase CI and live-provider rollout gates kept distinct.

`npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:db:local`, `npm run build`, and `npm run test:e2e` are repository commands. Focused tests run with `vitest run <path>`. Docker was unavailable during the first NAK-60 implementation pass, so local pgTAP was not established. A source inspection or mocked unit test does not certify a Didit Sandbox session, provider deletion, production deployment or jurisdiction-specific biometric compliance.


## NAK-74 production remediation (October 17, 2026)

Critical work on `security/nak-74-production-readiness-fixes` is recorded in
[the feature evaluation](features/nak-74-production-readiness-fixes.md) and
[activation runbook](../operations/production-maintenance.md). Independent provider
cleanup, server-only protected signing, durable email retry fences and dormant
maintenance/health scheduling require coordinated migration/application rollout.
Do not infer production closure from local tests. Repository controls need an
administrator; the connected account has push but not admin access.
