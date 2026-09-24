# NAK-70 — landing layout and motion

Source of truth: [NAK-70](https://linear.app/phoenix-works/issue/NAK-70/resolve-vivintro-landing-page-motion-and-responsive-layout-findings). Compact production-loop record; Standard risk because this changes presentation within the existing landing boundary. Base: `origin/main` at `82f3417`.

## Contract and current locations

The landing tour must keep linked headings below the sticky header; every card must remain readable in a short desktop viewport; the floating hero callout must not cover the preview label; frequently used navigation feedback must be immediate. Mobile layouts, focus cues, and reduced-motion behavior must remain usable. No data, API, routing, or security boundary changes are required.

Verified locations: `GuidedTour.tsx` owns tour anchors and active-step state; `LandingExperience.tsx` owns the hero preview and sample CTA; `LandingExperience.module.css` owns the layout, motion, and breakpoints; `LandingSectionRail.tsx` is currently unmounted but shares the module's navigation feedback styles. `e2e/landing-layout.spec.ts` exercises the rendered experience.

The sample CTA finding was already resolved on main: it reads “View a sample introduction” and opens `/demo`, a working fictional portfolio. The implementation leaves that correct behavior in place and adds browser coverage so it does not regress.

## Design and evaluation

| Criterion | Failure observed on main | Correction and check |
| --- | --- | --- |
| Tour anchor clears header | Step 04 heading began at 76px below a 78px sticky header | Give cards a 96px anchor offset; Chrome checks the heading clears the header at 1440, 390, and 320px. |
| Tour readable in short desktop viewports | A 633px card remained sticky at 1440×600. Follow-up review found the first 752px card still clipped at 1440×800. | Use a centered single-column, nonsticky tour through 860px viewport height; Chrome checks Step 01 and Step 04 details at 600, 800, 850, and 860px heights and 861px and 1440px widths. At 861 and 900px heights, it checks sticky cards fit the viewport at both widths. |
| Hero label unobstructed | Callout rectangle intersected “Detailed Introduction” at desktop and mobile sizes | Reserve space above the preview card in both base and mobile layouts; Chrome checks rectangle nonintersection at 1440, 390, and 320px. |
| Frequent navigation responds immediately | Tour indicator had two 180ms transitions | Remove section-rail and tour-nav indicator delays; Chrome checks the tour indicator has zero transition and keyboard focus retains an outline. |
| Sample promise is accurate | Already corrected on main | Chrome follows the CTA to the fictional `/demo` page. |
| Reduced motion remains usable | Existing CSS unstacked the tour | Chrome checks the card remains nonsticky and navigation feedback instant with reduced motion. |

The new browser tests were run before the fix and failed on the first four issues for the expected layout and transition reasons. After the fix, all 15 instances passed across the repository's desktop, tablet, and mobile Chrome projects. Light and Dark screenshots at short desktop and mobile widths were visually inspected; no horizontal overflow was measured.

A follow-up review reproduced a remaining short-viewport gap: at 1440×800, the first sticky card ended at 850px and its “Changes saved” detail never fully entered the viewport before the next card covered it. The revised breakpoint and browser coverage address this case while preserving sticky cards on taller desktops. On the corrected worktree, TypeScript checking and lint passed (the same two unrelated Open Graph warnings remain), and all 18 focused browser checks passed across desktop, tablet, and mobile Chrome projects.

Repository checks on the changed worktree: `npm run lint` passed with two unrelated, existing unused-disable warnings in Open Graph image files; `npm run typecheck` passed; `npm run test:unit:coverage` passed with 804 tests and the feature coverage gate; the production build passed with nonproduction Supabase placeholders; the full browser suite passed with 70 checks and two existing skips. No authenticated workflow or external service was changed.

The repository's `graphify update .` step could not run because the Graphify executable is not installed in this environment; no `graphify-out/graph.json` exists in this worktree.

The change is deliberately limited to the landing CSS module and a focused browser test. It uses the existing CSS Module and breakpoints; no new animation or state abstraction was introduced.
