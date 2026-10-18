# Accessible account entry and concise signup guidance

## Contract / execution context

2026-10-18, user-authorized implementation following the code-level accessibility
review. Standard UI behavior risk, compact record; shared account-entry consumers
and verification feedback receive a fresh-context review. Base main `d92275f`.
Isolated branch `fix/nak-74-accessible-auth-feedback`; the primary checkout's
NAK-84 coverage work and uncommitted files are out of scope and untouched.

Keep existing page styling, authentication APIs, password policy, generic
credential failures, account-enumeration protection, safe redirects, OTP paste /
autofill / cooldown, and liveness lifecycle / polling frequency unchanged. No
database, provider configuration, dependency, production or external issue changes.
The long signup paragraph mixes privacy, publishing, badge limitations and viewer
guidance. Shorten it; preserve detailed disclosures at the liveness consent and
publishing/viewer surfaces, not as signup prerequisites.

## Evaluations (planned before implementation)

| ID | Expected behavior / wrong implementation rejected | Check |
| --- | --- | --- |
| AF1 | Concise private-draft/email/liveness signup guidance; Terms/Privacy and password help remain; no change to BrokerDesk copy | Auth component + browser assertions |
| AF2 | Recovery and return/change-email transitions move focus to the relevant new step; initial page load does not steal focus | Auth component keyboard tests and real Chromium keyboard journeys |
| AF3 | Password-policy and invalid OTP feedback connects to its field, marks invalid, focuses correction; editing clears stale field errors; generic server/network failures don't accuse a particular input | Auth component negative cases, unchanged generic credential response |
| AF4 | Reset password mismatch/policy errors focus and describe the correct field; only session-invalid failures suggest a new recovery email | New reset-form component tests, browser response fixtures |
| AF5 | Background liveness reads retain unchanged status DOM; initial/manual work and actual state changes still provide feedback; errors aren't nested inside a second live region | Existing recovery tests plus delayed background/manual regression |
| AF6 | No horizontal overflow in both themes at supported viewport sizes; keyboard, loading/error/success and existing live region semantics preserved | Affected browser matrix, static checks, focused/full unit tests |

## Responsibilities / verification limits

AuthForm and ResetPasswordForm own their local field errors and focus. Do not
extract authentication-domain policy into a UI helper. The verification controller
owns whether a read is user-visible or background; no global loading component
rewrite is needed. AppRouter's route announcer does not cover same-route form
step replacement, which requires local focus management.

Actual VoiceOver/NVDA/TalkBack speech and comprehensive WCAG conformance remain
manual release evidence. DOM/browser checks cannot certify those outcomes.

## Progress

Implemented in the three existing UI owners. Signup preserves the private-draft
heading, adds concise email/liveness requirements, and retains sample/Terms/Privacy
links. Detailed verification limitations remain at consent and completion.
Field errors use stable IDs, invalid state, preserved help associations and
correction focus. Only invalid-code responses mark OTP invalid; generic sign-in,
provider and network errors remain form-level. Reset mismatches/policy errors no
longer recommend another recovery email. Explicit invalid/missing/revoked session
codes expose the safe sign-in/recovery continuation; other failures remain retryable.

Recovery/back/change-email/success steps focus their new heading; initial render
does not autofocus. OTP retains its existing input focus and autofill. Background
visibility/polling reads retain unchanged status DOM, while initial/manual reads
and real state changes still report work. Alert messages no longer sit inside a
second parent live region; the cooldown has its own bounded status text.

Regression-first unit run failed on the intended focus/error/unchanged-status
assertions before implementation. Initial failing copy assertion also left queued
mocks that caused follow-on failures; not all failures were independent defects.
Existing reset-page metadata, visibility and redirect tests are retained.

### Findings / current checks

- AF-REV-1, medium/material, confirmed introduced: starting a background read
  during explicit refresh initially cleared visible feedback prematurely. Fresh
  reviewer reproduced it; coordinator regression failed before correction in
  `/tmp/nak74-auth-overlap-red.log`. Only set loading true when needed at request
  start; latest-version completion still settles it. Final focused tests: **53
  passed**, `/tmp/nak74-auth-focused-final.log`. Reviewer independently passed 54
  tests including their original repro, plus both overlap directions, on snapshot
  `d71d6a014331dc3e888c64f8bdbc8afb332470b16fba771b06bb3168ceef5809`.
  Round 2 verdict: no remaining material findings within scope; model unknown,
  fresh context/read-only instructions and scratch tests, not technical isolation
  or cross-model approval. Maximum three rounds for this task.
- Browser: **39 passed** across desktop/tablet/mobile Chromium (new auth flows in
  both themes and existing candidate recovery), `/tmp/nak74-auth-browser-final.log`.
  First run's new tests used a global alert locator that also matched Next's
  route announcer; corrected to the application main, without suppressing alerts.
  Initial dependency symlink failed Turbopack filesystem containment; replaced by
  isolated APFS-cloned dependencies. These were environment/test setup defects.
- Lint/typecheck passed: `/tmp/nak74-auth-lint-final.log`,
  `/tmp/nak74-auth-types-final.log`.
- Full suite and production build attempts were interrupted by **ENOSPC**; no
  full-suite/build pass attached to those runs. Removed only the task worktree's
  regenerable failed `.next` output (230 MB), not source or other task data.
- Batched desktop-light/mobile-dark inspection found the existing negative signup
  help margin lets keyboard focus outlines cover help text. Add a measured
  six-pixel clearance regression and remove that negative margin; this is bounded
  readability hardening, not a visual redesign. Confirmation pass pending.

### Final validation — 2026-10-18

Spacing regression failed with measured zero-pixel clearance before correction,
`/tmp/nak74-auth-focus-spacing-red.log`. All **12 auth browser cases** pass after
the margin correction across both themes and all three viewport projects,
`/tmp/nak74-auth-browser-spacing-final.log`. Earlier 27 candidate recovery cases
remain applicable: no further verification runtime changes, and the CSS class
has no candidate recovery consumer. Desktop-light/mobile-dark screenshots were
inspected together and confirmed once after correction. No visual redesign.

Round 3 (last allocated round), snapshot
`4b4b092599e4fbb747642825104574db76f0e1905a21c0c8c8768a15a7a9f785`:
fresh-context reviewer found no remaining material findings, independently checked
CSS scope / geometry assertion / unchanged runtime and source freshness. Reviewer
inspected reported browser results but did not independently run browsers or the
whole suite. AF-REV-1 remains resolved. Only results documentation followed review.

| Check | Final result |
| --- | --- |
| Full coverage | **193 files / 1,541 tests passed**, maxWorkers=1; statements 86.71%, branches 81.78%, functions 85.75%, lines 90.35%; `/tmp/nak74-auth-coverage-final.log` |
| Feature coverage | All **61 gates passed**, `/tmp/nak74-auth-feature-gates-final.log` |
| Focused regressions | **53 passed**; independent reviewer also passed original repro and both overlap orders |
| Browser | 39 broad cases passed before spacing-only correction; final 12 auth cases passed afterward, as scoped above |
| Lint / typecheck | Passed, `/tmp/nak74-auth-lint-final.log`, `/tmp/nak74-auth-types-final.log`; production build repeats type validation |
| Production build | **Passed in supported Vercel mode (`VERCEL=1`)** with synthetic public configuration, `/tmp/nak74-auth-build-vercel-final.log`; no deployment. Default standalone-packaging attempt hit ENOSPC, not claimed as passed |
| Dependency audit | Zero affected packages, no exceptions; `/tmp/nak74-auth-audit-final.log` |
| Source integrity | Whitespace passes; final reviewed runtime/tests preserved; main checkout / NAK-84 work untouched |

After stopping the owned browser servers, also removed the task worktree's ignored
regenerable `.next-e2e` cache to run broad validation sequentially with available
disk space. Screenshots/source remain. Earlier symlink replacement during a unit
run invalidated that run (duplicate React copies); the final isolated dependency
run above supersedes it, not the historical failure evidence.

AF1–AF6 pass within the stated local source/DOM/Chromium evidence. Actual
VoiceOver/NVDA/TalkBack speech, live email/provider delivery, hosted CI and deployment
are not established. No whole-application WCAG conformance claim. No commit, push,
remote write or migration was performed. Changes remain on the isolated local
branch/worktree for the user's review and later delivery.
