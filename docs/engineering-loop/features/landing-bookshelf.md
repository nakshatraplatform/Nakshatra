# Landing bookshelf and signup button

Status: implemented and locally verified, 18 October 2026. Standard risk; compact record for presentation and navigation within existing public surfaces. Working checkout starts at `d92275f` with unrelated NAK-84 edits, which are preserved.

## Contract

The owner requested four books for “How VivIntro works”: a full-viewport shelf, scroll-driven opening, readable detail, closing and progression to the next book, with click access. Preserve current four-step personal-sharing content and the 15-day disclosure boundary. Use existing GSAP/Lenis; no second scroll controller, WebGL runtime or authentication provider is required for this presentation.

The supplied social signup reference uses compact outlined buttons and monochrome icons. Google is the only implemented social provider. Apply that design to signup and retain existing email/password, pending/error handling and safe Google redirect. Twitch/X require a separate provider decision/configuration; do not ship nonfunctional buttons.

Hairline adopt/create skills were installed globally. StringTune and ThreeUI were inspected as references. ThreeUI's live browser preview failed SSL loading; its public description of opening editorial volumes was readable. The bookshelf is an original implementation of the requested behavior, not a verified reproduction of a particular ThreeUI asset.

## Evaluations

1. At desktop/laptop sizes the section occupies the viewport; all four books open in forward order and reverse on upward scroll. Each has a stationary reading interval. Reject a one-shot entrance or an unrelated stacked-card effect. Check Playwright scroll/geometry and visual review.
2. Each step can be reached by click, keyboard and existing step hash; leaving the section restores ordinary page scrolling. Check navigation and reload at a step hash.
3. Small/short viewports and reduced motion retain all content, anchors and no horizontal overflow; resize/preference changes clear animation state. Check responsive/reduced-motion browser cases.
4. Signup renders the supplied Google outline/icon treatment, calls the existing auth method, disables during pending work and shows provider errors. Existing password/OTP behavior remains. Check auth component tests and local signup screenshot.
5. Public text remains in server HTML and is readable without JavaScript. Check source/SSR and fallback browser state.

Planned changes: `GuidedTour.tsx`, colocated motion/style files; signup social button component; relevant component/browser tests. No API, database, provider configuration or production mutations.

## Evidence

Baseline: inspected current tour in browser, source, current landing feature records and MVP contract. Existing tests assert sticky cards; those assertions must change with the explicitly requested bookshelf interaction. Functional browser tests will be added alongside implementation because 3D layout cannot be characterized in jsdom.

Implementation: `GuidedTour.tsx` retains the four-step content and delegates its scroll timeline to `useBookshelfMotion.ts`. `GuidedTour.module.css` owns the shelf and static fallback. The scene is full-width and `100svh`, within a `620svh` scroll track. CSS perspective, hinged covers and page edges provide 3D depth without a model download. Existing GSAP and Lenis are reused. Old unused stacked-card styles were removed. `SocialLoginButton.tsx` applies the supplied Google SVG and compact outline treatment only on signup.

Stable fragment markers sit outside the sticky scene, while unenhanced article IDs preserve native/no-JavaScript anchors. Timeline refresh synchronizes the visible chapter with React accessibility/navigation state; a repeated reload test exposed that GSAP can restore its pose while suppressing timeline callbacks. All listeners, animation state and markers clean up when motion/viewport eligibility changes.

Verified so far: 17 focused component tests, final TypeScript and strict targeted lint. Full repository lint and a production build passed during implementation; the final fragment/accessibility correction was made after that build. Visual review covered shelf/reading poses, light/dark signup and mobile content. The design detector returned no findings. Public copy/schema remain unchanged and the new no-JavaScript browser case checks all four native chapter links.

Browser evidence: 45 browser cases pass across desktop/tablet/mobile Chromium emulation, plus nine repeated reload/preference checks. The 45 include forward/reverse wheel progression, keyboard chapter access, full-viewport geometry, mobile/short-screen fallback, both themes, no-JavaScript native anchors and signup presentation. Earlier runs exposed the corrected reload/accessibility race; two screenshot writes also failed because the host disk filled. This task's disposable build output was removed to recover space. Chromium mobile emulation scales injected wheel input by device pixel ratio; the test now converts input distances while retaining forward/reverse assertions.

Limits: live Google OAuth, physical touch devices and Safari are not verified here. No deployment, provider configuration, API/schema change, commit or push. `graphify update .` could not run because Graphify is not installed; no graph existed at task start. Unrelated NAK-84 changes are retained. The next action is owner review of the local preview, with release handled separately.

## Shared palette follow-up

Owner requested the existing application color combination after seeing blue-filled book covers. Covers now use the shared card surface and foreground roles, with muted-surface spines and token-derived hinge shading. The ink token is no longer used as a large cover fill. Light mode therefore retains cream covers, and dark mode follows the existing application palette. No global palette or animation changes.

Palette verification: browser inspection confirms light cover surface `rgb(255, 253, 248)` with foreground `rgb(36, 52, 67)`, and dark cover surface `rgb(27, 41, 50)` with foreground `rgb(237, 242, 239)`, matching the existing semantic tokens. Desktop cover screenshot inspected; original narrow preview size and light theme restored. CSS-only change; no additional tests added.

## Heading and wordmark follow-up

Owner requested a larger “How VivIntro works” heading using the empty space above the books, with the application name in blue and the logo lettering. The responsive heading is approximately 99px at 1440×900 (previously 56px), with its subtitle below. `vivintro-wordmark.svg` reuses the exact lettering path from the current approved horizontal logo; CSS masks color it with the shared blue action token and a lighter blue blend in dark mode. The book covers use the same wordmark. Accessible heading text remains “How VivIntro works”; no new font is downloaded. Existing desktop/laptop open-book geometry and small/short-screen fallback browser cases pass.
