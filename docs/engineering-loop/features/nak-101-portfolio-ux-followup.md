# Portfolio mobile and desktop usability follow-up

Mode: compact. Risk: significant for the shared portfolio viewer and contact input contract; no change to publication or contact authorization. Source: the owner's October 3 screenshots and current `feat/nak-101-responsive-navigation` worktree.

## Goal and design

Keep one legible, responsive portfolio with a dismissible gallery, predictable actions, and internationally clear contact entry. Existing protected contact values remain a single stored phone string; the editor splits country calling code and national number only at the input boundary, without a data migration. The public viewer's single sticky header action leads to the existing verified-email interest flow; owner previews do not imply that they can express interest.

## Acceptance checks

1. On mobile and desktop, gallery photos open above the page; a visible Close button, Escape, and a pointer/touch tap on any empty backdrop area close the viewer. Tapping the image or navigation controls does not close it. Focus returns to the opener.
2. Protected-contact and viewer interest forms show a narrow country-code field beside the phone-number field at 320, 375, 414 px and desktop. Existing stored international numbers render without data loss, and submission still sends the same single phone string to the existing API.
3. Desktop footer policy links stay grouped without an orphan last link; mobile footer remains readable. Header destinations have consistent spacing and public-only Show interest stays distinct from section navigation.
4. After scrolling down, a keyboard-reachable Back to top control appears without covering the interest action or photo viewer. Reduced-motion users are not forced through smooth scrolling.

Planned evidence: focused component tests, form and viewer interaction tests, lint/typecheck, responsive Playwright pass, and diff review. No Production SQL is required for the UI-only change. The live authenticated browser is reference evidence, not a place to modify Production data.

## Implementation and verification

- Gallery viewer now portals above the sticky header, has a visible Close control, handles empty-backdrop clicks/taps and Escape, traps focus among its controls, and restores focus to the opening photo. Desktop and Pixel 7 Playwright regression tests pass.
- Protected contact and interest-request phone entry now render adjacent calling-code and national-number inputs while preserving the existing single-string save/API contract. Existing Indian, North American, and explicitly separated international numbers have parsing tests. Unfamiliar legacy contiguous numbers remain unmodified rather than being guessed.
- Public introductions keep one sticky Show interest header action that points to the existing interest section; owner previews do not show it. Footer help/policy links are grouped; a Back to top control appears only after scrolling. Desktop and mobile Playwright checks pass.
- Local verification: lint, typecheck, production build, 65 focused unit tests, and four desktop/mobile browser cases pass. Full unit suite before final phone regression tests: 939 passed, two pre-existing Windows-specific failures in `didit-photo-match-sandbox.test.ts` and `security-audit.test.ts`, unrelated to changed files. Graphify AST graph updated.
- Fresh read-only review found two issues and both were corrected: unfamiliar international phone prefixes now cannot inherit an old calling code, and footer identity display uses the right CSS specificity to stack on mobile. Regression tests cover both.

## Dashboard navigation follow-up (October 3)

Mode: compact. Risk: standard, shared customer header on Dashboard, My brokers, and Account. The owner's screenshots show that the header disappears on scroll and that the desktop Portfolio details action wraps awkwardly. The dashboard already has four activity cards, share state, previews, and introduction/access flows; do not add another metric or duplicate CTA without a distinct user need.

Acceptance: (1) customer header remains visible at the top after scrolling each protected page, without causing horizontal overflow or sitting above dashboard dialogs; (2) the desktop edit action reads as a single line, while the existing full-width mobile alignment remains; (3) sign-out, mobile menu, and the current-page indication continue to work. The likely CSS cause is the dashboard shell's hidden overflow creating a non-scrolling sticky container. Evaluate with the authenticated Playwright width matrix, focused header/dashboard component tests, lint and typecheck.

Implementation: `CustomerAppHeader.module.css` makes the shared header sticky. `globals.css` overrides the later shared `overflow-x: hidden` token rule with `overflow: clip` for Dashboard and Account, so the page—not an inert shell—owns scrolling. `dashboard-client.tsx` removes the main stacking context to let its fixed editor overlay the sticky header, and renames the concise action to “Edit portfolio”; mobile still uses the established full-width rule. No dashboard card or metric was added: existing activity, access, readiness, preview, and verification areas cover the current pilot workflow. A future state-specific “next step” prompt is preferable to another general widget once verification policy is settled.

Evaluation: the authenticated Playwright width matrix passed at 320, 375, 414, 768, 1024, and 1440 px across Dashboard, My brokers, and Account; a desktop/mobile scroll test passed on all three pages and confirmed the editor overlays the sticky header. The short empty broker fixture was extended in-test solely to exercise scrolling. `tests/customer-app-header.test.tsx` and `tests/dashboard-client.test.tsx`: 36 passed. Lint, typecheck, production build, and `git diff --check` passed. Full unit suite: 941 passed, with the same two unrelated Windows-specific Didit journal and security-audit subprocess failures seen before this follow-up. Fresh read-only review found no concrete regression; it did not independently rerun the reported checks. Changes are prepared on the follow-up branch and remain unreleased.

Pre-push check on the follow-up branch: lint, typecheck, and production build pass; the full unit suite again reports 941/943 passing, with the same two Windows-specific failures. A parallel desktop/mobile Playwright run passed 40 cases, skipped 2, and exposed an ambiguous `Country` test locator plus two load-sensitive 30-second timeouts. The locator now uses an exact label; all three affected scenarios passed in a serial rerun (5 passed, 1 project-specific skip). The code change was not broadened to work around the parallel timeout. Production still requires the usual CI and manual release checks.
