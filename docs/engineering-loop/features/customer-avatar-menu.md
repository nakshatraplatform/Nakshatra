# Customer avatar menu

2026-10-18; compact record, Standard risk. Base `caf9fe7` on the existing frontend worktree. User requested an avatar-triggered dropdown after login containing Account settings and Sign out, using the supplied circular-avatar/identity treatment.

Contract: replace separate Account/sign-out header actions with one account dropdown across the shared Dashboard/My brokers/Account header. Desktop keeps Dashboard/My brokers navigation; the dropdown includes those destinations on mobile. Use account-email initials (generic person fallback if absent), existing theme tokens and the existing sign-out owner/handler. No portfolio subject photo, external demo avatar, auth policy, new dependency or backend change. The authenticated header remains outside slow data Suspense boundaries.

Design: reuse the existing native details disclosure, extended for focus leaving, outside pointer, Escape restoration and arrow navigation. Native links/buttons retain browser semantics. Header owns the dropdown and existing sign-out pending/error state; local CSS owns the responsive avatar/identity treatment. No artificial ARIA menu role without a complete menu primitive.

Evaluations (planned before implementation):
1. Avatar opens settings/sign-out, settings targets /account, current account state shown inside dropdown; unit and browser checks reject a permanently visible separate Account/sign-out action.
2. Keyboard Enter/Space, arrow access, Tab, Escape and outside click work, with focus restoration and no hidden focusable destinations; unit plus browser checks.
3. Sign-out clears the existing session before navigation, disables duplicates, retains recoverable error on failure; deferred unit checks reject early navigation or repeated requests.
4. Layout fits 320–1440px and both themes; navigation remains available while data streams and the editor still isolates the header; affected Playwright suites.

Implemented in `CustomerAppHeader.tsx` and its CSS module; no API, frame props or dependencies changed. Settings and sign-out now appear only in the account disclosure. Desktop retains two destination links, while the mobile disclosure supplies those same links. Email initials and a generic-person fallback avoid borrowing the portfolio subject's identity or sending image requests to the demo provider. Reviewed all three frame consumers and the existing sign-out handler; no material source findings remain.

Validation:
- Intended red: the new header unit assertions rejected the original separate Account/sign-out controls before implementation.
- Focused unit checks: 40 passed across header, streaming frame, server pages and brand-system suites. Pending/duplicate prevention, error retry, Escape, blur and outside dismissal are covered.
- Full lint and TypeScript passed; production build passed with loopback-only configuration (81 pages).
- Affected browser batch: 18 passed, two existing duplicate width-matrix skips, one test-only outside-click target failure. The heading is underneath the dropdown on phones, so the test now clicks the clear viewport edge. Corrected mobile test passed. After changing the sign-out font to the canonical body token, all three final avatar browser cases passed. The unchanged broader cases cover all three protected routes at 320–1440px, navigation during loading, and editor/review background isolation.
- Desktop/mobile light and dark screenshots inspected; local preview source updated without overwriting the original checkout's other work.
- Full unit coverage: all 194 files / 1,546 tests passed; repository coverage thresholds and all 61 feature coverage gates passed.

A brand-system guard caught `font-family: inherit`; the final CSS explicitly uses the shared body font token. No guard was weakened. Native disclosure is used rather than importing a second component system for a single dropdown; the supplied avatar/identity layout is adapted to the existing account data and palette. Graphify is unavailable and no graph exists. No live-account mutation, deployment or merge is authorized by this UI work.

## Theme-switch and navigation follow-up

User requested the supplied sliding sun/moon treatment, placed between Dashboard and the avatar, with My brokers held back from navigation. Standard risk, compact extension: shared ThemeSwitch presentation and accessibility change; existing theme persistence/bootstrap/cross-tab behavior remains canonical in AppThemeProvider. No broker routes, permissions or data are removed. Native button switch semantics provide the supplied interaction without a second component runtime.

Acceptance: stable “Dark mode” switch label and accurate checked state; sun at left in light mode and moon at right in dark mode; 48×28 visual track within a 48×44 hit area; keyboard, reload, storage failure and cross-tab sync preserved; thumb motion disabled for reduced motion; saved theme styling before hydration retained. Header order is Dashboard → theme → avatar on desktop; compact navigation contains Dashboard/settings/sign-out without My brokers. Existing theme/brand unit and browser tests plus header geometry checks reject a visual-only toggle or stale stored state. Implemented in the existing ThemeSwitch and app-theme CSS; no new runtime dependency. A stable Dark mode switch label and aria-checked state replace the action-button label, so affected browser/unit selectors now assert switch state explicitly. Only My brokers navigation is removed; its route and behavior remain available.

Review found a streamed-editor hydration race: theme context could change before a descendant hydrated, leaving its checked attribute stale. Each control now uses a local hydration snapshot to match server attributes before adopting current context; its click handler still reads the live preference. Root-theme CSS supplies the correct initial thumb/icon position. The real editor browser case reproduced the fault on all three Chromium projects; after correction it passes and explicitly rejects hydration warnings. No theme storage policy changed.

Final checks: 24 focused unit tests passed; full lint and typecheck passed; 62 browser cases passed across desktop/tablet/mobile Chromium with four existing duplicate-matrix skips. Covers persistence, cross-tab changes, blocked storage, saved pose before hydration, streamed editor state, contrast on the first changed frame, modal focus, header order and 320px layout. Earlier run: 53 passed / three hydration failures / four skips, superseded by the corrected run. Full coverage passed: 194 files / 1,546 tests, all repository thresholds, and all 61 feature gates. Production build passed with loopback-only configuration (81 pages). No unresolved material in-scope findings.

The host filled its disk before initial edits; only this task's disposable build output was cleared. Screenshots were retained under ignored tmp/theme-slider, and the existing local preview was updated without overwriting unrelated test-hardening edits.


## Integration with current main

Integrated main `5e7389c` after PR 117 reported conflicts. Preserved the merged auth accessibility improvements and expanded NAK-84 coverage gates. The single theme-test conflict was an older workaround that reset to Light before editor navigation; the hydration fix now permits retaining Dark and checking the actual saved state.

Integration checks passed: 195 unit files / 1,586 tests with coverage (85.84% statements, 81.70% branches, 86.37% functions, 89.37% lines); all 61 feature files and 18 protected boundaries pass their gates. Full lint, typecheck and production build passed. The focused combined browser batch passed all 18 cases across desktop/tablet/mobile: theme/header persistence, authenticated editor, signup presentation and auth recovery/accessibility. An initial two-case failure came from Playwright hiding input carets while streamed account inputs were hydrating, rather than application attributes; screenshots now preserve carets and the full hydration-warning assertion remains intact. No application workaround or assertion suppression was added for that test interference.

## Account name and responsive shelf follow-up

Requested: show the signed-in user's first and last name instead of “Your account”; enable the shelf animation on phone/tablet/short viewports as well as desktop. Standard risk, compact continuation. Header identity uses the existing Account settings rule (validated self-created portfolio name, otherwise explicit account metadata), never a relative's or inferred provider name. A small streamed identity region must not suspend the header/navigation. Missing names fall back to email/Account; settings/sign-out behavior remains unchanged. Saving account names refreshes the displayed identity.

Shelf acceptance: all viewport sizes with motion enabled have the same four-book opening/closing progression, native scrolling, chapter selection, reverse navigation and exit. Narrow layouts center a readable single page while its cover swings away; wider screens retain the two-page illustration spread. Short viewports retain a viewport-height scene with independently scrollable paper content. Reduced motion and disabled JavaScript retain static content. Tests must cover 320px through desktop, short landscape, actual touch scrolling, reload/resize, all four chapters, and long account names.

Implementation: `account-header-profile.ts` is a server-only, authenticated owner-filtered read that projects existing canonical self-profile/account metadata into name parts. Only those name parts reach the client. Header identity consumes the promise inside small Suspense regions, preserving interactive navigation and sign-out while loading or on a read failure. The shared frame's Dashboard, Account and Brokers callers provide the promise. Account save refreshes the server-backed header; long labels truncate in the trigger and wrap in the menu. Unit checks cover identity failures, a relative's profile, long/Unicode names and refresh after save.

Review: no identity inference, authentication policy, privileged client, database write, new package or live-account mutation was introduced. The extra bounded owner lookup is intentionally independent of slower page-content loading. Async server-page unit tests now await React's streamed identity work; their existing unsaved-editor, error-recovery and privacy assertions remain intact. Graphify remains unavailable and no graph exists. The original local preview received only the applicable source patch, preserving unrelated changes.

Final local validation:
- Full lint and TypeScript passed. Production build passed with loopback-only public configuration (81 generated pages).
- Full unit coverage passed: 196 files / 1,593 tests; 85.66% statements, 81.61% branches, 86.23% functions, 89.21% lines. All 61 feature-file and 18 protected-boundary gates passed.
- The 72-case affected browser matrix produced 70 passes, one expected desktop touch-only skip, and one obsolete mobile illustration assertion. The corrected contrast test checks visible paper text at every size and the illustration on two-page layouts; it passed on all three projects. All 71 applicable cases therefore have passing evidence. Native touch, keyboard selection, all chapters, short landscape, resize/reload, reduced motion, no JavaScript, both themes, and account identity on all three customer routes are covered. Mobile screenshots of the name/menu and shelf/reading poses were inspected.
- Earlier failures: disk exhaustion blocked the initial browser run; clearing only this task's generated cache restored execution. Responsive checks exposed and corrected stale shelf spacing/chapter state on resize. Streaming identity exposed un-awaited React act scopes in server-page unit tests; those scopes are now awaited without removing assertions.

Delivery: PR 117 was merged while this follow-up was in progress. Local main was fast-forwarded to `96538c9`; the identical source base was carried onto `fix/nak-72-account-name-mobile-bookshelf` for a separate follow-up PR. No deployed-environment or physical-device verification is claimed; browser evidence uses Chromium desktop/tablet/mobile emulation. No unresolved material in-scope findings remain in the inspected paths.
