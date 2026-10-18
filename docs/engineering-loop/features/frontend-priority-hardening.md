# Frontend priority hardening

## Contract / execution context

2026-10-17: user requested high-priority development fixes, excluding physical
manual testing. Baseline HEAD `f86a001`; preserve the existing uncommitted Lenis
implementation. No push, deployment, account deletion or external mutation.
Significant tier: shared modal browser lifecycle; no server-side deletion,
authentication, publication or draft persistence rule changes.

## Implementation / acceptance

- Account deletion and full-screen portfolio editor share `useModalFocus`.
  Focus enters the dialog, Tab/Shift+Tab wrap, background branches are inert,
  body scrolling locks and prior focus/overflow/inert state restore on exit.
- Escape follows existing close guards: unsaved editor confirmation remains;
  account deletion cannot dismiss during an in-flight action. Closing clears
  typed DELETE. Fresh sign-in and server confirmation requirements stay intact.
- Deletion API feedback remains in the active dialog's accessible live region.
- No redesign, new animation, custom scheduler or application-wide modal rewrite.
  Existing review/relationship dialogs are not migrated speculatively.
- Font inventory documentation reflects actual root fonts and public legacy
  assets; no unproven licensing claims or asset deletion.
- Dependency gate must not be weakened or its expired exception silently extended.

## Evaluations

| Outcome | Regression / evidence |
| --- | --- |
| Modal contains keyboard/programmatic focus; cleanup restores browser state | `tests/modal-focus.test.tsx` |
| Escape cannot delete; reopening requires new typed confirmation | `tests/account-client.test.tsx` |
| Dirty editor rejects Escape until user confirms | `tests/dashboard-client.test.tsx` |
| Real browser focus/inert/keyboard and reduced-motion lock | `e2e/modal-keyboard.spec.ts` |
| Existing callers and smooth scroll remain compatible | Account/dashboard and motion unit suites, lint/typecheck |

An executable pre-fix failure was not captured for the new hook: source inspection
and the previous browser pass established the missing Escape/focus lifecycle.
The first post-change test pass exposed duplicate notices; rendering feedback
only in the currently active surface corrects that without weakening assertions.

## Blockers / release limits

`npm audit --json` still reports five high development findings inherited from
`braces <=3.0.3` / GHSA-vfj7-8cjw-p6xm. Registry latest remains 3.0.3. The existing
exception expired October 9; no safe patched package was established. Do not use
the proposed Next 14 downgrade as automatic remediation. Audit gate remains
blocking; a separate explicitly reviewed dependency remediation is required.

Local disk was approximately 355 MiB free at start; record actual checks rather
than borrowing the earlier Lenis production-build/coverage results. Physical
devices, comprehensive contrast/zoom, production performance and asset rights
remain separate evidence requirements. No production readiness claim.

## Results

### Issue and resolution ledger

| ID | Issue / cause | Resolution | Status |
| --- | --- | --- | --- |
| FH-1 | Deletion dialog and editor declared modal semantics but lacked a complete keyboard/background lifecycle | Shared focus hook: initial focus, bidirectional Tab wrap, inert sibling branches, native body scroll lock and state/focus restoration | Resolved; unit/browser checks pass |
| FH-2 | Escape could not safely close the editor; closing deletion retained typed confirmation | Route Escape through existing dirty-draft confirmation and action-busy guard; clear DELETE on close | Resolved; regression checks pass |
| FH-3 | React lint rejected assignment to a DOM property reached through a hook ref | Use imperative DOM attribute methods for inert state; preserve and restore existing attributes; no lint suppression or rule weakening | Resolved; lint passes |
| FH-4 | Inert background would hide deletion/sign-in feedback from assistive technology; first fix duplicated notices | Render notices once in the active surface, with a dialog live region during confirmation | Resolved; failure-inside-dialog test passes |
| FH-5 | Interrupted browser/reviewer execution left no final verdict | Rerun scoped real-browser checks against loopback fixtures and obtain a new fresh-context review on a fingerprinted snapshot | Resolved; 24 browser checks pass; fresh review reports no remaining material source findings |
| FH-6 | Expired exception blocked the five inherited high dev-dependency findings | Subsequent user-approved hybrid lint migration removes the Next ESLint/glob chain, retains all prior checks and removes exception acceptance | Resolved locally; see hybrid-lint-tooling.md for current tests/review; hosted CI still pending |
| FH-7 | Font licensing document incorrectly described active runtime fonts; nine unused legacy binaries were publicly distributed without confirmed rights evidence | Correct root font inventory; owner authorized removing all nine unused binaries and eight obsolete font-face declarations on 2026-10-17 | Removed locally; root font imports unchanged; live removal requires deployment. Logo/imagery provenance is separate |
| FH-R1 | New editor Escape handler also dismissed the editor from an expanded combobox input or its focusable suggestion buttons | Consume/default-prevent Escape at the popup wrapper, return focus to its input, then close suggestions; second Escape still dismisses the editor through its guard | Resolved; input/option regressions and real-browser option-focus checks pass |
| FH-T1 | Account success-message test waited only for API invocation, not its asynchronously rendered result | Await the exact visible success notice, keeping the same behavioral expectation | Resolved; not evidence of a production defect |

GHSA-vfj7-8cjw-p6xm lists no patched versions:
https://github.com/advisories/GHSA-vfj7-8cjw-p6xm (checked 2026-10-17).
Do not remove Next lint rules, renew the expired exception, or fabricate a patched
version merely to pass the gate. These are not interchangeable with remediation.

Confirmed frontend source findings are resolved. FH-6 was blocking at the initial
hardening snapshot and is now resolved by the subsequent hybrid lint migration.
See that feature record for current evidence; this is not blanket frontend
accessibility or production certification.

### Review history

- Round 1: fresh-context reviewer reported FH-R1; 60 focused tests passed.
  Snapshot `65d03efd58add2bc0cb9af2820b36019a577f43429b8817a7ee8fb3fda9386da`.
- Round 2: input-only correction passed but reviewer identified the option-focused
  continuation of FH-R1 and the asynchronous assertion FH-T1. Both reported
  independently of implementation conversation; shared source was read-only by
  instruction, not filesystem-isolated. Actual model unavailable.
  Snapshot `26221f3873607f57ea223e29d7c2609c1a22a64de82cdd6cde24b7a3241c5457`.
- Initial browser pass: 20/21; tablet assertion raced the hydration effect.
  Preserve the hidden-overflow requirement and poll it rather than treating
  server-rendered dialog visibility as proof effects have run. Interrupted dev
  server PID 58483 was stopped; no data or source caches were removed this turn.
- Pre-fix reproductions: `/tmp/nak-hardening-escape-before.log` and
  `/tmp/nak-hardening-option-escape-before.log`. Missing editor after first Escape
  was the intended failure, not a changed requirement.
- Round 3: reviewer independently passed 66 focused tests across four suites;
  no unresolved material source findings. Final inspected snapshot:
  `df8cee94826ed0197305e06657d065e8cdc306c16d2789fb754eda1f8fea8c56`.
  An intervening test-only correction scoped both unit/browser option selectors
  to Languages suggestions (native section-select options are unrelated) and used
  the actual mobile navigation selector. Reviewer inspected these corrections.
  Provenance checked current after all checks; only this result documentation
  changed afterward. Three review rounds used; no recursive review.

### Final verification (2026-10-17)

- `npm run lint`: passed, with two pre-existing unused-suppression warnings in
  OpenGraph image files; no rule disabled to obtain a pass.
- `npm run typecheck`: passed.
- `npm run test:unit:coverage`: 164 files / 1,141 tests passed; all 56 feature
  coverage gates passed. Statements 85.82%, branches 79.12%, functions 84.92%,
  lines 89.36%. Log: `/tmp/nak-frontend-hardening-coverage-complete.log`.
- Default Turbopack `npm run build`: passed after the final production-code
  correction. Log: `/tmp/nak-frontend-hardening-build-complete.log`.
- Playwright modal keyboard and application smooth-scroll suites: 24 passed
  across desktop/tablet/mobile Chromium emulation, using local fixtures and the
  temporary webpack adapter described in the smooth-scroll feature record.
  Log: `/tmp/nak-frontend-hardening-browser-verified.log`. Final run used one
  worker to avoid concurrent compile/build contention. Earlier mixed-run results
  (22/24, including compile timeout and mobile-selector fixture error) are not
  represented as passes. Physical devices and screen readers were not tested.
- `npm audit --omit=dev --json`: zero production dependency findings.
- `npm run security:audit`: **failed**, expired exception; FH-6 remains open.
- `git diff --check`: passed. No Graphify graph/executable available.
- During the hardening verification above, no database/API business rules,
  environment variables, production configuration, account records or assets were
  changed/deleted. In the subsequent owner-approved cleanup, nine unused font
  assets and their declarations were removed; that validation is recorded below.
  No commit/push/deployment.

### Owner-approved font cleanup and braces investigation

Scope: remove only verified-unused legacy fonts; research dependency solutions,
not replace lint tooling or renew a security exception without approval.
Standard-risk cleanup; self-review plus references/build checks. All removed
binaries were tracked and unchanged before deletion and remain recoverable in Git.

Current registry checks (2026-10-17): braces latest 3.0.3, micromatch latest 4.0.8;
Next ESLint plugin stable 16.4.2 and canary 16.5.0-canary.16 both retain fast-glob
3.3.1. Updating these versions alone does not remove the affected dependency.

- The advisory remains active and lists no patched release:
  https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- Maintainer closed the patch request while disputing the advisory; do not assume
  an imminent fix or treat the dispute as withdrawal:
  https://github.com/micromatch/braces/issues/84
- Local installed plugin imports fast-glob only in `dist/utils/get-root-dirs.js`.
  It runs glob expansion when `settings.next.rootDir` is configured. Our current
  ESLint config does not configure rootDir; `ESLint.calculateConfigForFile` for
  `src/app/page.tsx` also returned no effective `settings.next`. This lowers the observed reachability
  here; it does not remove the package/advisory or automatically authorize a waiver.

Options requiring a separate decision:

1. **Temporary operational unblock:** explicitly review and approve another
   narrowly scoped, expiring development-only acceptance based on reachability.
   This accepts risk, not a dependency fix. Existing gate remains unchanged.
2. **Remove the dependency:** evaluate an upstream-supported replacement or a
   pinned, reviewed Next ESLint plugin fork replacing its glob dependency while
   preserving all Next/React/accessibility rules. Compatibility fixtures and a
   clean-install audit must prove the vulnerable chain is actually absent.
   This is a tooling change with maintenance cost, not an npm override shortcut.
3. **Reviewed braces backport/fork:** possible engineering work, not a published
   official fix. Verify recursion guards and compatibility independently; ordinary
   patch-package with version 3.0.3 still remains flagged by package audit. Never
   invent a patched version or relabel a package to hide the finding.

Recommendation: a scoped reachability/risk decision is the smallest temporary
unblock; if zero exceptions is required, evaluate dependency removal with rule
parity tests. Do not downgrade Next.js, disable Next lint rules, blindly substitute
glob libraries, or apply an unreviewed internet patch to obtain green CI.

Cleanup verification: no legacy family names or `/fonts/` references remain in
`src` or `public`; nine explicit tracked, unchanged binary targets removed and
66 dead CSS lines removed. Default production build passed
(`/tmp/nak-unused-font-cleanup-build.log`); whitespace check passed. The current
runtime font imports were not changed. No dependency versions, audit exception,
lint rules or CI settings changed during this investigation. The earlier frontend
review/build results remain historical; this CSS/asset-only cleanup was validated
separately, not represented as a rerun of all earlier browser/unit checks.

### Reusable lesson

Modal Escape handling must respect nested popovers from every reachable focus
target, not only their input. Keep editor-level input/option regressions and a
real Tab-to-option browser check. A shared modal hook's passing isolated tests
do not establish compatibility with its actual embedded controls.
