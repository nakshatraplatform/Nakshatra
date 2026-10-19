# Landing bookshelf and signup button

Status: implemented; pre-PR evaluation on 18 October 2026. Standard risk; compact record for presentation and navigation within existing public surfaces. The frontend is isolated on `feat/nak-72-landing-bookshelf`, based on `c5613a6` (current main at preparation). Original NAK-84 work is preserved in its existing checkout. Earlier implementation evidence below refers to the original `d92275f` baseline; the pre-PR evaluation supersedes its release status.

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

Implementation-stage limits: live Google OAuth, physical touch devices and Safari are not verified here. At that stage there was no deployment, provider configuration, API/schema change, commit or push. `graphify update .` could not run because Graphify is not installed; no graph existed at task start. Unrelated NAK-84 changes are retained. The owner subsequently approved preparing a remote branch and PR; see the pre-PR evaluation below.

## Shared palette follow-up

Owner requested the existing application color combination after seeing blue-filled book covers. Covers now use the shared card surface and foreground roles, with muted-surface spines and token-derived hinge shading. The ink token is no longer used as a large cover fill. Light mode therefore retains cream covers, and dark mode follows the existing application palette. No global palette or animation changes.

Palette verification: browser inspection confirms light cover surface `rgb(255, 253, 248)` with foreground `rgb(36, 52, 67)`, and dark cover surface `rgb(27, 41, 50)` with foreground `rgb(237, 242, 239)`, matching the existing semantic tokens. Desktop cover screenshot inspected; original narrow preview size and light theme restored. CSS-only change; no additional tests added.

## Heading and wordmark follow-up

Owner requested a larger “How VivIntro works” heading using the empty space above the books, with the application name in blue and the logo lettering. The responsive heading is approximately 99px at 1440×900 (previously 56px), with its subtitle below. `vivintro-wordmark.svg` reuses the exact lettering path from the current approved horizontal logo; CSS masks color it with the shared blue action token and a lighter blue blend in dark mode. The book covers use the same wordmark. Accessible heading text remains “How VivIntro works”; no new font is downloaded. Existing desktop/laptop open-book geometry and small/short-screen fallback browser cases pass.

## Pre-PR production-engineering-loop evaluation

Scope: all bookshelf, wordmark/palette/heading, signup presentation, and affected component/browser checks in this feature. Reviewed against the existing landing contract and current main, including affected AuthForm callers, GSAP/Lenis lifecycle, native anchors, accessible reading state, theme tokens, and responsive/no-JavaScript fallback. Standard risk; self-review applies because shared authentication policy, data contracts, architecture and dependencies remain unchanged. This is not a whole-repository source audit.

Design boundaries: tour copy and markup remain in `GuidedTour`; animation lifecycle is isolated in `useBookshelfMotion`; shelf styles and SVG lettering are local assets. `SocialLoginButton` owns presentation only and delegates to the existing AuthForm provider handler. No new backend, schema, authentication providers, business rules or packages. CSS 3D reuses the existing motion stack.

Confirmed findings and resolution:

- Removed a signup background-color transition that violated the existing shared theme-switch contrast guard. The established brand-system unit guard verifies the correction; no assertion was weakened.
- Updated browser checks that still selected the replaced stacked cards or ambiguously selected both the book and chapter navigation link. They now measure the opened book, visible illustration and actual chapter navigation, retaining contrast and viewport assertions.
- Removed obsolete GSAP stubs from the content component suite; their incomplete timeline API broke the new hook and forced desktop animation in jsdom. Those content assertions now exercise the static fallback using the shared matchMedia fixture. Actual animation, cleanup on preference changes, forward/reverse scrolling and reload restoration are covered in Playwright.

Browser evaluation: 83 of 84 affected-suite cases passed in the combined desktop/tablet/mobile Chromium run. The remaining cross-route navigation case timed out while loading `/account` during concurrent build/test activity; the unchanged case passed separately in 4.1 seconds after routes were compiled. Both themes, keyboard navigation, tall/short/narrow layouts, reading geometry, no-JavaScript content and signup presentation are covered. Initial high-concurrency unit execution also hit an unrelated dashboard timeout; final bounded-worker verification is recorded below.

Final-source validation:

- `npx vitest run --coverage --maxWorkers=2`: all 194 files / 1,546 tests passed. Statements 85.73%, branches 81.49%, functions 84.64%, lines 89.38%; repository thresholds pass.
- `npm run coverage:check:features`: all 61 mapper/service/contract files meet the 80% per-metric gate.
- `npm run lint`, `npm run typecheck`, `git diff --check`: passed.
- `npm run security:audit`: passed with zero affected packages; `npm run db:smoke`: passed.
- Five affected Playwright suites with two workers: 83 passed initially, one account-navigation timeout passed on its unchanged rerun; all 84 distinct cases now have passing evidence.
- Final `npm run build` with loopback-only public configuration: passed; 81 pages generated.

No known material in-scope review finding remains. The initial dashboard timeout did not recur with bounded Vitest workers; no timeout setting or unrelated dashboard code was changed.

Limits: live Google OAuth, physical devices, Safari and local database integration tests are not verified by this UI change. Hosted CI runs the wider browser/database matrix after PR creation. Graphify could not be updated because it is unavailable and no graph exists. No deployment or merge is included.


## CI regression follow-up (18 October 2026)

Standard-risk test maintenance on `810721b`; no application/runtime change. The supplied CI log is from `afd6b5f`. Its quality job (audit, lint, unit coverage and build) passed, while the aggregate required check failed because browser jobs failed. The same quality and database jobs also passed on `810721b`.

Confirmed causes: the critical signup path retained the old “Continue with Google” selector after the requested “Sign up with Google” copy change; the visual text audit counted the fully clipped accessible wordmark label against its blue mask background; two chapter checks could click before the static tour became its enhanced shelf. The downloaded failing CI trace shows navigation still at `/` after the purported step click and the shelf in a different reading pose, consistent with the layout changing during click preparation.

Corrections preserve the feature contract: assert the exact signup label while retaining login/continuation labels; omit only fully clipped `inset(50%)` text from painted-text calculations and explicitly assert the complete accessible tour heading on all four landing routes; await shelf enhancement and font readiness before desktop geometry/illustration interactions. Mobile static, no-JavaScript, contrast thresholds and actual active-chapter assertions remain intact. No retries, timeouts, CI gates or production styling were weakened.

Validation in progress: the signup and contrast faults reproduced locally in CI's Chromium headless-shell version. Both timing cases passed locally before changes, so their failure evidence is the hosted trace, not a claimed local reproduction. All 21 targeted cases passed across desktop/tablet/mobile with retries disabled after corrections; lint and typecheck passed. Full browser matrix and remote update follow below.


Final local evidence: all 27 stability cases passed without retries (three repetitions of the two timing checks plus the portfolio metadata check, on each Chromium viewport). The full local matrix reached 84 passes, then was blocked by host disk exhaustion; it is not counted as a full pass. One earlier portfolio metadata failure was caused by the local alternate port conflicting with that existing test's fixed 3100 URL; it passed unchanged on the CI-default port in all nine repetitions. Only this task's generated build cache and downloaded artifact archive were cleared. Hosted CI remains the full-matrix gate. No application code changed, so the existing passing production build/unit coverage evidence still applies; pre-push hooks rerun fixture, type and unit checks.

## Responsive animation follow-up — October 19, 2026

The earlier small-screen and short-screen static fallback is superseded by the user's request for the same animation at every viewport size. Motion is enabled whenever reduced motion is not requested. The existing four-book timeline remains the single animation owner. Phones show a centered reading page with the hinged cover swinging aside; desktop retains the illustration spread. The scene remains one viewport tall, and overflowing paper uses native scrolling, including the existing Lenis native-scroll exclusion. Chapter navigation, reverse scrolling, exit, no-JavaScript content and reduced-motion content remain available.

A resize evaluation exposed stale desktop shelf offsets and loss of the current reading chapter. Refresh now recalculates the resting shelf pose and width changes preserve an active chapter without snapping for browser-chrome height changes. Browser regression checks cover both open and closed resize states plus native touch gestures. See the current account-name/responsive-shelf evaluation record in `customer-avatar-menu.md` for final shared validation.
