# NAK-60 portfolio viewer refinement

Status: implemented locally on `feat/nak-60-liveness-integration`; deployment validation pending.

## Problem

The full portfolio viewer excluded the primary portrait from the Gallery count, hid all header navigation at tablet and mobile widths, and placed Astrology at the end of the detailed portfolio. This made the authorized portfolio appear incomplete and left mobile viewers without quick navigation.

## Decisions and invariants

- Gallery represents every photo already authorized by the server projection, including the primary portrait used in the hero.
- No client-side change expands data access. Public, owner and approved-access projections remain authoritative.
- Astrology follows Gallery in every presentation mode.
- The private public introduction continues to hide Astrology values. It shows only a protected-section explanation and the existing interest action.
- Mobile navigation remains visible, horizontally scrollable and uses 44-pixel tap targets.

### 2 October 2026 pilot-readability override

The preceding mobile-navigation decision is superseded by pilot feedback: on phone widths, a three-row header obscures the portfolio and the gallery lightbox's Close control. The phone header is now one row with VivIntro branding and Show interest; section links remain on wider screens. This is a presentation change only and does not change server disclosure rules, gallery authorization, or the Gallery → Astrology content order.

Acceptance checks for this increment:

- At 320, 375, and 414 px, the phone header is one row, the lightbox Close control is visible and tappable, and the page has no horizontal overflow.
- The hero says “A Marriage Introduction”; age/community appear as concise facts only when present in the authorized projection, and profession is secondary copy.
- The section heading is “Astrology” (rather than the less direct “Cultural alignment”) wherever that chapter appears.
- Lightbox Escape, backdrop click, focus containment, and focus return work; protected photos remain unavailable.
- Mobile Show interest remains reachable after the header scrolls away without duplicating the CTA on the first screen or covering the final page content. Desktop section links remain available.

Implementation on `fix/nak-60-b2c-profile-readability` from merged `main` `b5cfea5` changes `CelestialUnion.tsx`, `AdaptivePortfolioMedia.tsx`, `MobileInterestAction.tsx`, `globals.css`, `tests/templates.test.tsx`, and `e2e/critical-paths.spec.ts`. Focused component/service tests pass 30/30. The Chromium critical-path suite passes 23 tests across desktop and mobile (one desktop-only skip), including the 320/375/414 px header, overflow, sticky action, lightbox, and browser-Back checks. This increment remains local and is not deployed.

Final local checks for this increment: `npm run lint`, `npm run typecheck`, and `npm run build` pass. The production build used placeholder build-time Supabase public configuration; it does not establish that production credentials or live integrations are healthy.

## Implementation

- `src/components/templates/CelestialUnion.tsx`
  - Include the primary portrait in the adaptive Gallery.
  - Order Astrology immediately after Gallery.
  - Add Astrology to the quick navigation.
  - Preserve a redacted Astrology placeholder in the private public view.
- `src/app/globals.css`
  - Keep the quick navigation visible below 980 pixels.
  - Use a two-row, horizontally scrollable header below 720 pixels.
  - Offset anchored sections for the sticky mobile header.
- `tests/templates.test.tsx`
  - Cover complete Gallery counts, section order, navigation and private-view redaction.

## Acceptance criteria

- The Gallery count and controls include every authorized portfolio photo, including the hero portrait.
- Mobile and tablet viewers can reach Overview, Gallery, Astrology and Details from the header when those sections exist.
- Astrology appears directly after Gallery for owner preview, approved access and public portfolio modes.
- A private public introduction does not reveal protected Astrology values.
- Existing server-side authorization and protected-media presentation rules are unchanged.

## Validation

- Focused component/service tests: 30 passed across `tests/templates.test.tsx`, `tests/portfolio-view-disclosure.test.tsx` and `tests/public-portfolio.service.test.ts`.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npx next build --webpack`: passed with placeholder build-time environment values.
- Mobile browser check at 412 by 924 pixels: header navigation is visible and usable.
- `npm run test:unit`: 827 of 828 passed. The remaining pre-existing Windows-only failure is `tests/didit-photo-match-sandbox.test.ts` asserting owner-only POSIX file permissions for the external sandbox journal (`DIDIT_SANDBOX_JOURNAL_INVALID`).
