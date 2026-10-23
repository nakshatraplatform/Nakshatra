# Editor actions and touch sign-out

October 22, 2026. Base: main `cc817c9` (#129). Standard, compact increment:
editor presentation/actions and account-menu focus handling only. Authentication
provider, session scope, authorization, validation and publication rules unchanged.

## Contract and evaluation plan

- EA1: header title with quiet saved status beneath; adjacent Preview, existing
  dashboard ThemeSwitch and Dashboard exit. Preview keeps its save/basics gate;
  exit retains dirty-input confirmation. Verify responsive bounds, focus and theme.
- EA2: footer Back, Save & review, Continue; last section omits Continue and makes
  Save & review primary. Save privately before validated review; never publish or
  accept consent automatically. Remove duplicate in-content draft tools. Verify
  incomplete-save retention, no-op writes, API failure/retry and consent suites.
- EA3: constrain native DOB input to its field on narrow screens, including
  WebKit inner sizing; retain dates, age validation and native picker. Verify
  input/fieldset bounds across widths and inspect screenshots; physical iOS pending.
- EA4: lock note says “Private · Shared with your approval”; retain never-public
  notices and accessible per-field privacy descriptions. Verify form tests.
- EA5: summary blur without relatedTarget must not collapse the account menu
  before a touch click. Retain outside-pointer/keyboard dismissal, pending,
  duplicate-click protection, local-session clearing and recoverable failure.
  Regression: null-target blur followed by Sign out; browser failure/retry and
  protected-route return tests. Provider/inbox/production tests are out of scope.

Section navigation markup/styles/behaviour are explicitly unchanged. Family and
Astrology stay optional; no new required fields, SQL, dependencies or portfolio
template changes. Rollback is app-only. No production writes or merge authorized.

## Locations and status

Verified: dashboard-client.tsx owns save/review/navigation; BlueprintForm.tsx owns
field presentation/privacy copy; globals.css owns scoped editor layout;
CustomerAppHeader.tsx owns menu lifecycle. Existing ThemeSwitch is reused without
new state. Regression checks: customer-app-header, dashboard-client, blueprint-form;
browser dashboard-clarity, onboarding-foundations, portfolio-editor-layout,
modal-keyboard, consent-form-clarity and password-recovery.

Implemented EA1–EA5 in the four runtime files above. Existing save serialization,
revision fencing, no-op suppression and deferred refresh own all saving; the new
explicit footer action saves once, then uses validation and versioned review.
No extra dropdown/data reads, session APIs or publication transitions were added.
Runtime section-navigation markup/CSS and portfolio template files are unchanged.

## Verification and review

- Null-relatedTarget blur regression failed before the menu correction, then
  passed. All 148 affected unit cases pass (dashboard, Blueprint, customer header,
  account client API), including incomplete drafts, newer edits during slow saves,
  no-op writes, errors, failed save retention and consent/version boundaries.
- 15 mobile-Chromium browser cases pass: responsive bounds (including seven
  viewport/zoom sizes), date containment, focus/reduced motion, consent/server
  refusal and real SDK logout failure/retry/cookie clearing/protected-route denial.
- 20 further Chromium cases pass: every section at 320/390/768/1024/1440px in both
  themes, typed selections, field errors, optional sections, manual location,
  avatar/keyboard controls, review isolation and retained OTP/consent safeguards.
  An HMR diagnostic occurred during this run while the save helper was simplified;
  assertions passed. A clean final-code rerun subsequently passed all five
  selected Chromium cases: both 390px themes/all sections, seven viewport/zoom
  bounds, consent/server refusal and SDK sign-out failure/retry. No runtime edits
  or HMR occurred during that rerun.
- WebKit diagnostic: avatar tests passed. Initial logout retry failed because
  the loopback fixture's OPTIONS response omitted `x-supabase-api-version`, which
  the installed SDK sends. Trace confirmed preflight refusal, not a swallowed
  application success. Added only that header to the loopback fixture. Logout
  failure/retry and both layout/date scenarios then passed (7.0s/13.3s/22.8s).
  The scratch WebKit config allows 60s overall multi-width scenarios; assertion
  deadlines remain unchanged. The initial 30s run had two scenario timeouts while
  build/coverage ran concurrently. Maintained CI configuration/deadlines unchanged.
- Typecheck and lint pass without warnings; optimized build passes (83 pages),
  with loopback public configuration and Sentry delivery disabled. Diff check passes.
- First full coverage attempt: 1,755 passed, three failures under concurrent
  build/browser work (two test timeouts and an ESLint child-process timeout).
  It produced no coverage summary, so the subsequent feature gate was not a pass.
  Serial rerun passed all **1,758 tests** with no failed/skipped cases; statements
  85.86%, branches 81.88%, functions 86.12%, lines 89.37%. The feature gate then
  passed for 63 feature files and 21 protected boundaries. No thresholds or
  deadlines changed. Command: `npx vitest run --coverage --maxWorkers=1
  --reporter=json --outputFile=C:/Users/Lenovo/AppData/Local/Temp/editor-actions-full-unit-serial.json`,
  followed by `npm run coverage:check:features`.

Fresh-context source review, exact model unavailable, no material findings:
`/root/editor_actions_review` inspected EA1–EA5 and tests in an isolated snapshot.
All 1,187 source paths matched packet
`3aeca4d2e8caa61bc4bcd49b333a12b2a350ed66d7c17643b8009bec4a14e11b`.
Return review verified the sole loopback fixture delta and unchanged runtime/unit
hashes against `a7c2d068188de2b19066f02eb6b2a298b7f82ec75a5ff0b0b18a51cf031f7262`;
no material findings. Reviewer ran no tests; execution evidence above is the
coordinator's. Later documentation-only updates do not change reviewed runtime.

AST graph refreshed; CSS/document semantics are not established by that update.
Screenshot inspection: narrow light header/footer and 390px dark final section;
no overlap or clipped actions, dashboard theme control reused. Real-phone Safari,
assistive technology and production/provider verification remain manual gates.

Status: implemented and verified locally, not committed/pushed/released. No
database deployment needed. Reviewed runtime hashes verified unchanged after
the final checks. Next: app PR/hosted CI and real-phone preview review before
merge/deployment. No production data was changed.
