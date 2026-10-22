# Password recovery routing and sign-out failures

## PR delivery on current main

The user requested a new remote branch and PR. Extracted only this fix into an
isolated worktree from `origin/main` `5099079`, on
`fix/nak-55-password-recovery`. NAK-55 is the verified existing Nakshatra
authentication-model issue; this follow-up does not change its closed status.
All unrelated primary-checkout edits remain untouched. Main already includes
Next.js 16.4.1 and newer UI/test fixes; the earlier checkout's failures below
are historical evidence, not assumed failures on this delivery branch.

Current-main validation on October 22, 2026:

- Lint, typecheck, production build and security audit pass. Audit reports three
  moderate affected packages, no high/critical findings and no exceptions.
- Full unit/coverage run: 207 files and 1,730 tests pass; feature coverage passes
  for 63 feature files and 21 protected boundaries.
- Recovery/save/logout regression passes in desktop, tablet and mobile Chromium
  using the real SDK against a loopback mock provider (ports 3229/54349).
- Fresh-context integration review by `/root/recovery_pr_integration_review`
  reports no material findings. Whole-source snapshot
  `26c954878dbbc42db5a18e0df41ec9d83339d60c2e6ec4df026d33b9263ace23`
  remained unchanged at review start and finish, based on
  `509907938f1fbc620193c1c868cefc8175000791`. This is the second review round;
  exact reviewer model is unknown. The reviewer independently exercised SDK
  recovery classification and logout failure/retry with mocked fetch.

Application changes are identical to the reviewed fixes; the mock provider
patch preserves newer main fixtures. This final documentation update does not
change implementation. Hosted CI and a real staging recovery-email journey
remain to be verified; local mocked tests do not prove provider configuration.

## Contract and scope

User-authorized fix, October 22, 2026. Critical authentication risk; full record
because the callback crosses the Supabase PKCE/session boundary. The reported
reset email lands on the dashboard and sign-out appears ineffective. Source
reproductions establish two weaknesses, but the hosted email template, redirect
configuration and actual failing production callback have not been inspected.

Goal: a successful PKCE exchange classified by the SDK as recovery reaches the
new-password form before its safe continuation. A failed sign-out remains
visible and retryable. Preserve session checks, password policy, ordinary
sign-in and reserved reauthentication flows. No schema, dependency, provider
configuration, production-session or email-template change is planned.

## Original implementation context and design

Base inspected: `ef0eb7da8238a442e4cac74dfe81abb2671295a6` on
`test/nak-84-coverage-hardening`, with pre-existing UI/test/document edits.
The callback and account API are initially clean and match local main. Edits
stay in these shared owners; unrelated work is preserved. No branch or Linear
issue was created during that initial implementation; PR delivery is recorded above.

- `src/app/api/auth/start/route.ts`: already supplies a nested reset-password
  continuation to `resetPasswordForEmail`; retain it.
- `src/app/api/auth/callback/route.ts`: consume SDK `data.redirectType` after a
  successful exchange. Recovery takes precedence over dashboard/bootstrap and
  reserved reauthentication; reuse the canonical origin and redirect sanitizer.
  An already supplied reset-password destination stays intact. Other safe
  destinations become post-save continuations. Recovery with no verified user
  returns to the existing failed-authentication page.
- `src/components/auth/ResetPasswordForm.tsx` and `/api/auth/password`: existing
  save-before-navigation behavior and authoritative live-session checks remain.
- `src/features/account/client/account.api.ts`: throw returned sign-out errors
  so `CustomerAppHeader`'s existing alert/retry path handles them. Supabase owns
  credential removal; do not fake success or bypass server session checks.
- `tests/auth-recovery-callback.test.ts`, `tests/account-client-api.test.ts`:
  regression cases. Existing reauth, auth-start, password, header, infrastructure
  and live-session suites protect connected consumers.
- `e2e/password-recovery.spec.ts`, `e2e/support/mock-supabase.mjs`: a loopback
  provider fixture exercises actual SDK PKCE cookies, callback, password save,
  logout failure/retry, cookie deletion and subsequent protected-route denial.

## Acceptance and evaluations

1. Recovery with missing, dashboard or another internal `next` opens reset;
   intact reset destinations are preserved. Callback tests reject the former
   direct-dashboard implementation and assert no portfolio bootstrap.
2. External destinations cannot escape the configured origin. Query
   `type=recovery` alone cannot classify an exchange. Recovery cannot issue a
   deletion/MFA proof. Missing/failed exchanges and unverifiable users fail.
3. Supabase's resolved `{error}` and thrown failures propagate. A subsequent
   successful attempt works. Header keeps its retry alert and only navigates
   after success.
4. New password must save successfully before navigation. Existing password
   route and form tests retain authorization, validation and failure coverage.
5. Static checks, affected tests, broader repository gates and a fresh-context
   review establish local evidence. Real provider email/cookie/logout behavior
   remains a separate staging release check.

## Historical validation before rebasing onto current main

Behavioral red/green approach. Before source edits, the new callback/account
tests ran: 8 intended failures, 12 passes. Failures reproduce direct-dashboard
and direct-continuation routing, recovery reaching a reserved flow, missing-user
routing, and silently swallowed returned sign-out errors.

Implemented both fixes. The SDK returns `redirectType` at runtime but omits it
from its public `AuthTokenResponse` type; an `in` guard safely narrows that field
without casting away validation. The browser regression exercises that runtime
contract. Initial typecheck/build caught direct access; the guard corrects it.

- Focused auth/account/form tests: 9 files, 87 passing tests.
- Browser recovery/save/logout journey: all 3 Chromium projects pass. The first
  attempt needed the test to reopen the native account menu after the disabled
  button lost focus; production menu behavior is unchanged.
- Lint passes with one existing warning in ignored `tmp/bookshelf.playwright.config.ts`.
- Typecheck passes after the SDK field guard.
- Broad coverage run: 1,566 passing, 5 failing tests across 4 files plus one
  unhandled error. Account/router, landing timeline mock, CSS-token, and streamed
  dashboard fixture failures also reproduce in an isolated copy with both auth
  production changes reversed to their exact HEAD hashes: 5 failures, 110 passes,
  one unhandled error. These failures predate this fix. Coverage gate did not
  execute because tests failed. No thresholds or tests are weakened.
- Production build passes. Scoped Oxlint/ESLint and diff hygiene pass.
- Security audit fails on the unchanged installed Next.js 16.3.8 dependency.
  npm reports critical advisories including GHSA-2464-fhr4-w9xw and
  GHSA-673q-mjm6-r5xr, with a fix available. No dependency files changed; this is
  a separate release blocker, not a demonstrated exploit in this application.
- Graphify update unavailable: `graphify` is not on PATH; no existing graph is
  present. No installation performed.

Commands run on October 22, 2026:

```sh
npm run lint
npm run typecheck
npm run build
npm run security:audit
npm run test:unit:coverage -- --maxWorkers=1
./node_modules/.bin/vitest run tests/auth-recovery-callback.test.ts tests/account-client-api.test.ts tests/account-reauth-callback.test.ts tests/auth-start-route.test.ts tests/auth-verification-routes.test.ts tests/customer-app-header.test.tsx tests/api-user.test.ts tests/supabase-infrastructure.test.ts tests/reset-password-form.test.tsx --maxWorkers=1
E2E_APP_PORT=3228 E2E_SUPABASE_PORT=54348 ./node_modules/.bin/playwright test e2e/password-recovery.spec.ts --workers=1
```

The coverage npm script runs Vitest before forwarding extra arguments to its
following feature-gate command; that run used Vitest's normal worker settings.
The isolated baseline reran the four failing suites with `--maxWorkers=1`.

Fresh-context review: `/root/recovery_fix_review`, exact model unknown, one of
three allowed rounds used. Read-only instructions on the shared filesystem;
whole-source provenance passed at start and finish for snapshot
`7928a9d9fdd06568e514772524193d67d554a4141d0f0aae03bb18299e8694d0`,
base `ef0eb7da8238a442e4cac74dfe81abb2671295a6`. No material findings.
Reviewer traced callback/reset/live-session/logout consumers and independently
exercised the installed SDK in memory: recovery marking/classification, retained
credentials on a returned logout error, removal on successful retry. Browser
and suite results above were coordinator evidence. This final record-only
update does not change tested implementation or acceptance requirements.

The separate baseline test/dependency failures were resolved on current main,
as confirmed by the delivery checks above. The real hosted recovery journey
remains a release check.

## Rollout and remaining evidence

Application-only deployment; rollback is reverting these application changes.
Before release, test an actual staging recovery email in the requesting browser:
open link, reach reset, save, sign out, then sign in with the new password. Also
test expired/reused links and a failed logout followed by retry. Inspect the
hosted template's redirect and allowlist if email skips the callback entirely.
Never capture full email URLs, auth codes, passwords or tokens in reports.

Lesson: passing reset initiation tests does not prove callback continuation;
resolved SDK error objects need explicit handling by shared callers.

Status: implemented, locally validated on current main and independently reviewed;
prepared for PR delivery. No deployment or production mutation performed.
