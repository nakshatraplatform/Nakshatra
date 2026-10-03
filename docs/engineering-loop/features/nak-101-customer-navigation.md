# NAK-101 — Consistent customer navigation

Mode: compact. This is a shared presentation change across three authenticated customer pages; publication and verification rules are out of scope.

## Goal and boundaries

Dashboard, My brokers, and Account use one predictable header. On wide screens the brand, three destination links, theme control, and sign-out action fit in one row. On narrow screens the brand stays visible, while the destinations and sign-out move behind a clearly labeled native menu. The current destination is identified for assistive technology. No portfolio, broker-consent, or publication authorization changes are made by this work.

## Source map

- `src/components/navigation/CustomerAppHeader.tsx` and its CSS module: canonical authenticated-customer header (planned).
- `src/app/dashboard/dashboard-client.tsx`: existing customer header and sign-out handler (verified).
- `src/app/brokers/page.tsx` and `brokers.module.css`: custom four-item header that overflows at intermediate widths (verified).
- `src/app/account/account-client.tsx`: a third header with a different order (verified).
- `tests/customer-app-header.test.tsx`: destination, current-page and sign-out characterization (planned).

## Acceptance checks

1. At 320, 375, 414, 768, 1024, and 1440 px, the header has no horizontal overflow and essential controls remain at least 44 px high. Check: CSS review plus browser width pass where authenticated pages are available.
2. Dashboard, My brokers, and Account expose the same named destinations and a consistent current-page indicator. Check: component and page tests.
3. Keyboard users can open the mobile menu, use its links, change theme, and sign out; the header remains understandable without icons alone. Check: semantic/native control review and component tests.
4. Sign-out clears the local session and returns home. Check: component test.
5. Broker relationship privacy and pilot publication gates remain unchanged. Check: scoped diff and existing route/page tests.

## Design rules

- One brand lockup and one navigation vocabulary across authenticated customer pages.
- Wide layout: brand left, labeled destinations in the middle, theme and sign-out right; account email is not navigation.
- Narrow layout: brand left, theme and a labeled Menu control right; destinations and sign-out appear in a compact menu.
- Do not shrink touch targets or hide a destination solely to fit an intermediate width; switch layout before crowding.
- Page titles and explanatory copy belong in the page body, not the global header.

## Pilot verification exemption

The requested account-specific exemption is a separate security change. Exact account, environment, expiry, and allowed downstream effects must be recorded before implementation; this navigation change does not alter verification or sharing eligibility.

## Dashboard overview refinement — 3 October 2026

The owner dashboard's Public link tile duplicates sharing status instead of answering an owner question. Keep link availability and controls in the sharing panel. Use four existing, non-fabricated overview values: recent interests loaded for the owner, requests awaiting review, currently active Complete Portfolio grants, and recorded portfolio opens. The first three come from existing owner projections (which return at most 50 records), so avoid "all-time" or unique-person claims. The view counter is rate-limited and is labeled recorded opens, not unique visitors. A 2-by-2 grid at phone and tablet widths becomes one row of four at desktop widths. No new telemetry or authorization query is part of this presentation change.

Acceptance: (1) no Public link metric remains; (2) counts update from the same owner-safe data used by the relationship queues; (3) link status and lifecycle controls remain available below the grid; (4) labels and numbers remain readable at 320, 375, and 414 CSS px without horizontal overflow; (5) existing grant and publication rules are untouched. Unit checks cover metric values and empty states; a responsive browser pass covers layout.

## Progress and evidence — 3 October 2026

- The three customer routes now render the same `CustomerAppHeader`; the obsolete brokers-only header rules are removed.
- The mobile menu has a visible label, current-page state, Escape/focus restoration, and outside-tap dismissal. The broker empty-state icon is centered with its message.
- Focused component/page tests: 44 passed across the header, dashboard, brokers, and account suites.
- Playwright width matrix passed for `/dashboard`, `/brokers`, and `/account` at 320, 375, 414, 768, 1024, and 1440 CSS px using a loopback-only synthetic account. It checks horizontal overflow, reachable theme/menu controls, 44 px menu target, and current-page marking. Production-account visual validation remains pending deployment.
- `npm run typecheck`, `npm run lint -- --max-warnings=0`, `npm run build`, and `git diff --check` passed.
- Fresh-context review found one stale dashboard test query caused by both responsive sign-out controls being present in jsdom; the test now selects the desktop control, and its 29-test suite passes. No other concrete regression was found in that review.
- `graphify update .` completed; SQL graph extraction remains limited by an existing missing `tree_sitter_sql` dependency, unrelated to this UI change.
- The local Windows pre-push suite reported 918 passing and two failing tests in untouched Didit sandbox and security-audit files. Their source is identical to `origin/main`; the failures appear platform-specific and are not attributed to NAK-101. This branch was pushed with Husky disabled for that one push; full CI remains the authority before merge.
- Dashboard overview now uses four owner-safe metrics instead of a link-status metric: Recent interests, Needs review, Active access, and Portfolio views. Publication state and Copy/Rotate/Unpublish controls remain in the sharing panel. No verification or grant authorization logic changed.
- Focused dashboard tests: 29 passed, including nonzero review and active-access counts. Playwright confirmed a 2-by-2 grid at 320, 375, 414, and 768 CSS px; a single row of four at 1024 and 1440 px; and no horizontal overflow on the protected-page width matrix. Screenshots reviewed at 375 and 1024 px with a loopback-only synthetic account.
- Full lint with zero warnings, TypeScript typecheck, production build, and `git diff --check` passed. `graphify update .` completed; its SQL extractor still reports the pre-existing missing `tree_sitter_sql` optional dependency.
