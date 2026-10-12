# NAK-71 — Orbs for meaningful portfolio waits

Source of truth: [NAK-71](https://linear.app/phoenix-works/issue/NAK-71/add-engaging-accessible-orbs-feedback-to-portfolio-loading-flows). This is a compact feature record for a bounded UI change. Base: `origin/main` at `82f3417`.

## Contract and design

Users should see an active visual cue and a truthful description while the dashboard, portfolio previews, shared Introduction, or publish request is pending. Do not imply a percentage or completion before the request resolves. Keep draft details out of loading text.

`PortfolioLoadingStatus` owns the presentation and uses the application theme from `AppThemeProvider`; `thinking-orbs` does not recognize VivIntro's `data-app-theme` attribute on its own. The canvas is decorative to assistive technology because the adjacent `role="status"` text carries the meaning. The library's reduced-motion behavior freezes to a representative frame. Route-level `loading.tsx` files remain server components that render the small client presentation boundary; publish state remains owned by the dashboard.

The design uses the existing light/dark ink and restrained teal/gold palette. It leaves quick button feedback and skeleton structure in place where they still orient the user. It adds no API, persistence, authentication, or production environment changes.

## Evaluation

| Criterion | Check and result |
| --- | --- |
| Waiting route and publish states explain what is happening | Source review of dashboard, preview, approved preview, shared link, and publish modal; component status-text test passed. |
| Orb matches VivIntro theme without hydration mismatch | Theme-provider integration test passed; production build passed with nonproduction Supabase placeholders. |
| Narrow and reduced-motion presentation stays legible | Chrome visual check at 320×700 Dark and 1440×900 Light with reduced motion; no horizontal overflow. |
| Error or completion ends the publish wait | Dashboard integration tests hold a publish request pending, verify truthful status and disabled repeat submission, then confirm the status clears on success. A rejected request restores an enabled retry action with an error message. Existing API-failure and disclosure-confirmation tests remain in place. |

Validation: `npm run lint` (pass with two unrelated existing warnings), `npm run typecheck` (pass), `npm run test:unit` (806 pass), and `npm run build` (pass with placeholder Supabase URL and publishable key). The first build attempt without those required variables failed during route configuration, before the placeholder build passed.

## Changed locations

- `src/components/loading/PortfolioLoadingStatus.tsx`: themed, accessible shared indicator.
- `src/app/dashboard/loading.tsx`, `src/app/edit/loading.tsx`, `src/app/preview/loading.tsx`, `src/app/approved-preview/loading.tsx`, `src/app/p/[token]/loading.tsx`: route waits. Edit inherits the dashboard fallback.
- `src/app/dashboard/dashboard-client.tsx`: publish progress and unexpected-error recovery.
- `tests/portfolio-loading-status.test.tsx`: status and theme behavior.
- `package.json` and `package-lock.json`: locked `thinking-orbs` dependency.

The visual check used a temporary local page removed before handoff. Browser evidence covers component presentation, not an authenticated end-to-end publish transaction; that requires test-account access and a ready-to-publish portfolio in a preview environment.

Follow-up verification rebased the branch onto `origin/main` after NAK-70 merged and added focused dashboard tests for pending, successful, and unexpected-failure publish states. On this revision, lint and typecheck passed, 808 unit tests and the feature coverage gate passed, and a production build passed with nonproduction Supabase placeholders. These tests use mocked portfolio API responses and do not replace the authenticated preview transaction. The Vercel preview currently stops at a team-access gate for the available browser account; no live publish request was made.

## October 12 follow-up — application-wide loading feedback

Risk: Significant (shared presentation across customer, authentication and broker clients). Base: latest `origin/main`, `888e935`; isolated branch `fix/nak-71-loading-feedback`. Original shipped NAK-71 scope and evidence above remain historical.

### Problem and inspected coverage

The installed Thinking Orbs 0.3.2 API is valid; the previous integration has only a large portfolio-specific status and five route fallbacks. Most operations provide text alone, and root/auth Suspense boundaries have no useful general fallback. The fix is integration and presentation, not an unproven library rewrite. Direct source inspection replaces Graphify because this checkout has neither a graph nor the executable.

| Scenario | Owning state / implementation decision |
| --- | --- |
| First streamed page load and route navigation | Root `loading.tsx` with branded `PageLoading`; existing contextual portfolio fallbacks retained. Auth Suspense gets an explicit fallback. Cannot show UI before the browser receives HTML. |
| Sign-in, signup, Google handoff, OTP send/resend/verify, password recovery/reset | Existing auth pending actions; compact status, ends on failure or hands off to navigation. No animation while typing or waiting for inbox arrival. |
| Portfolio creation/autosave, preview progress, review and publishing | Existing draft/review/publish state; add feedback in visible editor and review footers, preserve full publish status. Track preview preparation through the actual request. |
| Photo and horoscope uploads, metadata updates/deletion | Owner tracks actual pending operations, compact status in the media section, retry/error cleanup. |
| Shared/protected portfolio resolution, interest submission, access verification | Route shell and local pending status; preserve owner-selected appearance in portaled interest forms. Approval is never implied before response. |
| Interest decisions, grant creation, renewal/revocation, link renewal/rotation/unpublish | Existing action state, compact status near dashboard actions and modal footer. |
| Liveness initial/explicit status reads, start/resume/cancel/final result | Track in-flight status reads safely; existing pending actions. Confirmed asynchronous result preparation can show processing feedback; terminal failure/delay shows recovery text. No loader for an idle unfinished camera session or queued confirmation email that does not block continuation. |
| Account names, export, sessions, reauthentication/deletion/cancellation, sign-out | Existing action state, compact status near action and decorative orb for action buttons. No policy or API changes. |
| Pilot/waitlist request, invitation exchange/acceptance, customer/team joining | Stage and pending states; loaders stop on sign-in instructions, consent prompts, accepted result or unavailable state. |
| Broker onboarding/representative verification/MFA | Existing pending/stage state, feedback in form actions. Business review and authenticator input remain actionable human waits. |
| Broker customers/team management, introductions/notices/recipient responses | Existing pending actions, local status; avoid duplicating an active status into several rows. |
| Optional onboarding feedback and admin feedback retrieval | Submission and authorized admin load. Hidden eligibility prefetch stays unobtrusive because the dashboard remains usable. |
| Portfolio visible media | Hero, featured gallery and opened lightbox loads need bounded loading/error feedback; decorative thumbnails and protected photo placeholders retain their existing presentation. |
| Instant local changes/background bookkeeping | No orb for theme changes, accordion/section toggles, typing, clipboard-only commands, offscreen media or hidden analytics. These do not block the requested task. |

### Contract and implementation plan

1. Canonical `LoadingStatus`/`LoadingOrb` owns constrained canvas sizes, teal/gold presentation, accessible operation text and optional owner-appearance override. Existing `PortfolioLoadingStatus` delegates for compatibility. No fake progress, minimum delay or global fetch interceptor.
2. Add streamed branded fallback and explicit auth Suspense fallback; keep ready landing content and metadata available.
3. Integrate compact feedback with each existing async owner above; introduce local state only for real operations that currently lack it. Success/failure must clear busy state; no changes to payloads, authorization, disclosure, retries, worker cadence or verification outcome.
4. Add behavioral pending/success/failure checks and real browser canvas, appearance, reduced-motion and narrow-screen checks with local service fixtures. Run lint, typecheck, audit, unit coverage, production build and affected browser tests.
5. Obtain a fresh read-only reviewer on the stable source; resolve material findings and record exact results. No production mutation, push or release in this request.

### Follow-up evaluations

| Criterion | Representative check / plausible wrong implementation |
| --- | --- |
| Status is visible for actual pending work, gone after error/success | Deferred auth/interest/dashboard/broker requests; would reject an always-on orb or missing error cleanup. |
| Real library paints without overflow and stops moving under reduced motion | Browser reads canvas pixels at light/dark/320px and compares reduced-motion frames; would reject mock-only validation or a CSS-stretched canvas. |
| Owner appearance stays independent of app theme | Shared interest dialog with opposite app theme; would reject tint following app rather than portfolio. |
| Initial load/navigation has a truthful shell | Delayed local service response and browser route load; would reject a blank Suspense fallback or artificially delayed ready landing. |
| Human waits, terminal states and nonblocking email never imply active approval | Liveness state projection tests plus inspection; would reject indefinite animation over recovery instructions. |
| Async state is concurrency/error safe | Aborted/stale liveness reads and media failures; would reject a stale request clearing a newer indicator or spinner left on after rejection. |

### Implementation and integrated validation — October 12

Implemented the canonical `LoadingStatus`/`LoadingOrb`, branded `PageLoading`, and lifecycle-owned `PortfolioImage`. Portfolio compatibility callers delegate to the shared indicator. The scenario inventory above is integrated across auth, portfolio editor/review/media, liveness, sharing/access, account actions, invitations and BrokerDesk. Counters protect concurrent preview/media requests; rejected introduction, invitation and MFA reads recover instead of leaving a permanent wait. Owner appearance overrides the application theme in shared portfolio dialogs. No database, API payload, disclosure policy, worker cadence or new dependency changes.

The branch was integrated with latest `origin/main` at `f46ccf1` (NAK-105 portfolio changes). Both latest-main verified-panel behavior/outage recovery and loading feedback were preserved when resolving liveness source/test conflicts. The user subsequently authorized committing and pushing `fix/nak-71-loading-feedback`; PR creation and deployment remain outside this request.

Validation:

- `npm run lint`: passed on final application source, with the same two unrelated unused-disable warnings in Open Graph image files.
- `npm run typecheck`: passed on the integrated source; final `npm run build` also completed TypeScript checking after the last onboarding correction.
- `npm exec -- vitest run --coverage --maxWorkers=4`: 1,237 tests / 168 files passed on the integrated snapshot before the final two-file onboarding announcement correction; `npm run coverage:check:features` passed all 57 mapper/service/contract gates. Those gated files did not change in the final correction.
- Final onboarding correction: 6 repository tests passed; fresh reviewer independently ran 7 onboarding tests, including the unchanged reproducer that failed before the correction. Git push hooks rerun the complete unit suite and typecheck on the committed source; remote-push result is recorded in Linear after completion.
- `npm run test:e2e -- e2e/loading-feedback.spec.ts e2e/app-theme.spec.ts e2e/published-portfolio-experience.spec.ts --workers=2`: 47 passed, 4 intentional device-specific skips. Covers actual painted canvas pixels, exact 32px dimensions, reduced-motion static frames, pending-to-error recovery, owner-appearance override, existing mobile/header and NAK-105 portfolio regressions. Dark pending sign-in screenshot visually inspected.
- `npm run security:audit`: production high/critical and full audit passed, zero affected packages, no exceptions. Integration/final corrections changed no dependencies or audit configuration.
- Production build with nonproduction Supabase URL/publishable-key placeholders: passed after final onboarding correction, including static generation of 80 pages.
- `git diff --check`: passed. No live service or production mutation was used for validation.

Earlier attempts remain failure history: initial default-concurrency validation encountered disk exhaustion; resources were bounded and checks rerun. A refresh-transition assertion was changed to wait for completed refresh. The first preserved browser run had 26 passes / 9 failures / 4 skips because alert selectors matched Next's route announcer and `main` matched the hidden streamed shell. Corrected selectors retain exact application error expectations and require one visible main; the integrated rerun passed. The interrupted session's lost temporary logs are not current passing evidence.

### Independent review and resolution ledger

Fresh-context reviewer `/root/nak71_loading_review`; exact runtime model unknown. Instruction-based read-only isolation, scratch copies for tests, no recursive delegation. Three rounds, with source/index freshness verified before and after each. Review snapshots: initial `9693c45f78578c45918fdd20a2588cbd1d9f599d813b8ba52dbbfc377be7ace5`, integrated round 2 `72e1af3ed1093bd478e4b0553e5ad860319757a0c7c9b74a16c94d2dd8e408a0`, final source round 3 `561918f6c6f15532ab9b448b08c1f8bfb314a58d974bc51e61713b682fae52a3`. Final verdict: no remaining material findings in the inspected scope. This results-only record was updated afterward; implementation/test source remains the reviewed source.

| ID | Classification / origin / impact | Resolution and checks |
| --- | --- | --- |
| R1, P2 | Confirmed expanded-scope omission in pre-existing overview/retry preview requests: no pending feedback and enabled retry during work. | Shared `markPreviewed` owns a counter and releases it in `finally`, including rejection; existing preview queue shares the counter. Deferred overview rejection test and independent correction tests passed. |
| R2, P2 | Confirmed introduced accessibility regression: removal of enclosing live regions dropped terminal/actionable announcements in invitations, MFA and onboarding. | Persistent concise terminal status regions separate pending animation from human instructions. Wizard-step, email-handoff and hosted-verification regions added. Repository transition assertions passed; independent email-handoff reproducer failed in round 2 and passed unchanged in round 3. |
| R3, P2 | Confirmed introduced presentation/accessibility omission: deletion/reauth status rendered behind the modal. | Render operation text inside the confirmation dialog and suppress obscured page status; deferred deletion test and independent correction tests passed. |

Limitations: fixture-backed browser checks do not establish live Supabase/Didit/email availability. Actual screen-reader speech, delayed server-first-load timing and every gallery/broker pending layout were not exhaustively exercised; lifecycle/streaming coverage includes source inspection and representative behavioral tests. Root loading cannot paint before HTML reaches the browser. Graphify is unavailable and no checkout graph exists, so direct inspection was used. No deployment or PR creation performed.

Execution context: implementation and three-round review complete on integrated base `f46ccf1`; next commit the reviewed source, run required Git hooks, push the authorized branch, and record the actual remote commit/results in NAK-71 while preserving its original shipped Done history.
