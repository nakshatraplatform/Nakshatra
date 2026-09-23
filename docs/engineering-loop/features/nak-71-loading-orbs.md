# NAK-71 — Orbs for meaningful portfolio waits

Source of truth: [NAK-71](https://linear.app/phoenix-works/issue/NAK-71/add-engaging-accessible-orbs-feedback-to-portfolio-loading-flows). This is a compact feature record for a bounded UI change. Base: `origin/main` at `82f3417`.

## Contract and design

Users should see an active visual cue and a truthful description while the dashboard, portfolio previews, shared Introduction, or publish request is pending. Do not imply a percentage or completion before the request resolves. Keep draft details out of loading text.

`PortfolioLoadingStatus` owns the presentation and uses the application theme from `AppThemeProvider`; `thinking-orbs` does not recognize VivIntro's `data-app-theme` attribute on its own. The canvas is decorative to assistive technology because the adjacent `role="status"` text carries the meaning. The library's reduced-motion behavior freezes to a representative frame. Route-level `loading.tsx` files remain server components that render the small client presentation boundary; publish state remains owned by the dashboard.

The design uses the existing light/dark ink and restrained teal/gold palette. It leaves quick button feedback and skeleton structure in place where they still orient the user. It adds no API, persistence, authentication, or production environment changes.

## Evaluation

| Criterion | Check and result |
| --- | --- |
| Waiting route and publish states explain what is happening | Source review of dashboard, preview, approved preview, shared link, and publish modal; component status-text test passed. |
| Orb matches VivIntro theme without hydration mismatch | Theme-provider integration test passed; production build passed with nonproduction Supabase placeholders. |
| Narrow and reduced-motion presentation stays legible | Chrome visual check at 320×700 Dark and 1440×900 Light with reduced motion; no horizontal overflow. |
| Error or completion ends the publish wait | Publish `finally` clears the state; unexpected failure shows retry copy; request failure retains existing handler. Source review completed. |

Validation: `npm run lint` (pass with two unrelated existing warnings), `npm run typecheck` (pass), `npm run test:unit` (806 pass), and `npm run build` (pass with placeholder Supabase URL and publishable key). The first build attempt without those required variables failed during route configuration, before the placeholder build passed.

## Changed locations

- `src/components/loading/PortfolioLoadingStatus.tsx`: themed, accessible shared indicator.
- `src/app/dashboard/loading.tsx`, `src/app/edit/loading.tsx`, `src/app/preview/loading.tsx`, `src/app/approved-preview/loading.tsx`, `src/app/p/[token]/loading.tsx`: route waits. Edit inherits the dashboard fallback.
- `src/app/dashboard/dashboard-client.tsx`: publish progress and unexpected-error recovery.
- `tests/portfolio-loading-status.test.tsx`: status and theme behavior.
- `package.json` and `package-lock.json`: locked `thinking-orbs` dependency.

The visual check used a temporary local page removed before handoff. Browser evidence covers component presentation, not an authenticated end-to-end publish transaction; that requires test-account access and a ready-to-publish portfolio in a preview environment.
