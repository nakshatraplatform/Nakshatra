# PR #110 — theme browser fixture and required navigation

## Contract and diagnosis

October 17, 2026. Standard, test-only correction on PR head `af6405f`.
User requests fixing browser CI without design, validation or safeguard changes.
No merge, deployment, production data or database change authorized.

Reproduced `e2e/app-theme.spec.ts` authenticated-themed-controls failure in local
Chromium before editing: Attach horoscope never appears after Astrology navigation.
The error snapshot shows Basics 0/10 and actionable required-field errors. The
test's intentionally empty `themeTestCookie` account cannot jump past required
Basics. This is the intended new guard, not a color regression or missing upload.

## Correction / evaluations

Keep empty-account dashboard assertions and dark editor screenshot. Explicitly
assert that empty Basics blocks the attempted Astrology jump, reports/focuses the
missing first name, and does not expose the attachment control. For the optional-
section styling phase only, switch to the existing complete published-owner
loopback cookie and navigate through the real UI. Assert Astrology was reached,
no validation summary exists, and retain both original exact color assertions,
overflow checks and attachment screenshot.

Do not replace the global empty-account fixture, force section state, mock the
validator, skip coverage, extend timeouts or alter production components/styles.
A wrong implementation removing forward validation must fail the new negative
control. A design regression must still fail the original CSS checks. A valid
complete account must reach the optional section on desktop, tablet and mobile.

Run the targeted case in all three existing Playwright projects, the full theme
file and onboarding responsive regressions, native lint/type/pre-push checks.
Prior 1,440 unit tests concern unchanged app code, not a claim of a new browser
pass. Hosted CI remains authoritative. Keep production migration/deployment order
unchanged; this test-only fix needs no further database deployment.

Targeted red/green: original test reproduced the hosted failure locally in
Chromium; error context showed Basics 0/10 and the required-field summary.
Corrected test passes in chromium, tablet-chromium and mobile-chromium (3/3),
including both original CSS assertions and the new blocked-navigation/focus
control. Existing dev-server ECONNRESET teardown logs occurred in this run;
the passing assertions are not a claim of production-log cleanliness.

Fresh-context read-only review inspected the isolated final test snapshot, the
two session cookies and mock data, responsive navigation handlers and original
assertions. No material findings: cookie replacement has the same name/domain/
path, full navigation selects the complete fixture, and both navigation controls
still exercise the real required-field gate. Reviewer did not independently run
browser/static checks. Test SHA256 at review:
`7FEAF357558701497ED6E44A3F4844421722D3613447121BB20E26656A0D9A66`.
Graphify update completed with no topology changes; SQL extraction dependency is
unavailable (no SQL changed in this correction).

Full affected browser run: `npx playwright test e2e/app-theme.spec.ts
e2e/onboarding-foundations.spec.ts --workers=2`, with loopback ports 3187/54387,
passed: 56 passed, 4 existing project-conditional skips (mobile-only cases on
desktop/tablet), 0 failures, 4.8 minutes. Coverage includes all three projects
and onboarding at 320, 390, 768, 1024 and 1440 pixels in light and dark themes.
`npx eslint e2e/app-theme.spec.ts --max-warnings=0` and `git diff --check` passed.
