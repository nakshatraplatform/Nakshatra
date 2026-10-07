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

## Gallery lightbox close follow-up (2026-10-05)

The owner identified the wide, white “Close” pill in the photo lightbox as visually intrusive on mobile and desktop. Replace it with a compact 44-pixel X control at the safe-area-aware upper-right edge of the dark overlay, with an accessible label and restrained hover/press/focus states. Keep Escape, backdrop close, arrow-key navigation, focus return to the opening photo, and the existing Dashboard link outside the lightbox. Closing a photo returns to the gallery; navigation to the dashboard remains a separate action in the preview header. This is a local UI change, not a media-authorization change.
