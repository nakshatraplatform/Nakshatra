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
