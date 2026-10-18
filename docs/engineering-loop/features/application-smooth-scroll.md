# Application-wide smooth scrolling and frontend release evidence

> Current integration status: see `frontend-hardening-integration.md`. The earlier
> checks below apply to their recorded source. SS4 Back restoration is currently
> unresolved after integration with newer main; it also fails with native reduced
> motion, so a Lenis-specific root cause has not been established. No current
> merge/release readiness is implied by historical passes in this record.

## Contract / execution context

- User request (2026-10-17): use Lenis across landing, dashboard and all routes;
  assess the supplied frontend-production observations without treating sampled
  screenshots, licensing assumptions or heuristic warnings as certification.
- Baseline: `f86a001`, existing `fix/nak-73-liveness-completion` checkout. No new
  Linear issue/branch, push, production interaction or deployment requested.
- Risk: Significant; full record because one shared browser lifecycle affects
  every route, accessibility, navigation, dialogs and scrolling performance.
- Preserve the incumbent visual design, SSR, theme/portfolio appearance and all
  business/authentication rules. Native touch, keyboard and nested panel scrolling
  remain intentional; "everywhere" does not mean forcing inertia into controls.

## Design and planned locations

- `src/components/motion/ApplicationSmoothScroll.tsx`: one root client-side
  controller, no extra layout wrapper; official Lenis RAF, CSS and reduced-motion
  support. Conservative wheel interpolation; no GSAP ticker or extra effects.
- `src/app/layout.tsx`: retain Server Component; mount controller once for all
  routes, including published portfolios. Next/browser own history restoration.
- Observe existing body scroll locks; suspend inertia while locked/hidden and
  destroy all controller resources on unmount. Nested panels remain native.
- Dashboard and BrokerDesk existing programmatic scrolls must honor reduced motion.
- `tests/application-smooth-scroll.test.tsx`: lifecycle/configuration regressions.
- `e2e/application-smooth-scroll.spec.ts`: real library on loopback mocked app,
  public/authenticated routes, nested controls, dialog locks, route/history/anchors
  and reduced motion. No real users or external email/provider calls.

## Acceptance / evaluations (planned)

| ID | Outcome / failure to reject | Check |
| --- | --- | --- |
| SS1 | Root instance on all sampled routes, no duplicate RAF after remount | Unit lifecycle and real-browser Lenis class/wheel checks |
| SS2 | Reduced motion remains immediate, including existing programmatic scroll | Unit options, browser reduced-motion input and source/caller review |
| SS3 | Nested editor/control scrolling never moves background | Browser wheel inside panel and body-lock tests |
| SS4 | Navigation, anchors, keyboard and back restoration work without stale inertia | Browser native-history/anchor/keyboard assertions |
| SS5 | Cleanup destroys instance, observers and handlers | Unit unmount/remount tests |
| SS6 | No new hydration/overflow errors on desktop/mobile samples | Browser errors, dimensions and existing responsive suites |

## Frontend observations / release gates

Source confirms seven public sitemap entries, shared visible/JSON-LD FAQs,
noindex login/signup, a weaker account deletion dialog lifecycle and nine legacy
font binaries. Current root fonts differ from the pasted report: Geist,
Geist Mono, Playfair Display, Manrope and Tenor Sans, not Inter/Plus Jakarta Sans.
Font-license documentation is stale. Missing ownership records are not evidence
of infringement. Do not remove assets without checking references and authority.

Remaining release evidence: account deletion focus trap/initial focus/Escape/
focus restoration; authenticated/dark/error/disabled/focus contrast and 200% zoom;
physical Safari/iOS/Android touch and keyboard/screen-reader checks; throttled
production performance and actual asset rights. Smooth scrolling is an enhancement,
not a prerequisite for production or a WCAG/SEO/performance guarantee.

## Progress

- Lenis README and installed Next client/server guidance inspected. Dependency
  pinned to 1.3.27; official CSS and reduced-motion contract verified against source.
- Implemented pinned Lenis 1.3.27 once at the root, with native nested/touch
  scrolling, modal/body-lock and visibility handling, listener/instance cleanup,
  explicit navigation/key interruption and pre-anchor synchronization. Reduced
  motion bypasses/destroys Lenis entirely and responds to preference changes live.
- Browser diagnosis ruled out the suspected streamed-dimension issue: the actual
  problem was stale animated position after a native focus/scrollIntoView just
  before anchor click. Capture-phase synchronization fixes it; no expensive naive
  dimension calculation or duplicate RAF loop added.
- Initial scaffold tests observed the intended missing-controller failure.
  Review LS-R1 confirmed resize+same-position scrollTo did not stop old inertia;
  explicit interruption now has actual-library regression coverage. LS-R2 keyboard
  concern was covered by cancellation and real browser End-to-bottom stability.
- Final focused unit tests: 10 passed (lifecycle/preference + actual Lenis inertia).
  Full unit/coverage suite: 163 files / 1,133 tests and 56 feature coverage gates passed; see
  `/tmp/nak-lenis-final-coverage.log`. Typecheck/lint passed; only the two existing
  unused ESLint suppression warnings remain. Default Turbopack production build
  passed (`/tmp/nak-lenis-build.log`); diff whitespace check passed.
- Browser correction verification: 21 passed across desktop, tablet and mobile
  Chromium emulation, covering root public/authenticated routes, native editor
  scroll/background locking, wheel/keyboard/history/anchors, reduced motion,
  sticky tour geometry and login text/placeholder contrast in both themes.
  Three additional End-key interruption/live-motion-preference checks passed.
  Initial broader run had timing/fixture assumptions and the above implementation
  defects; it is not recorded as passing. Existing geometry assertions now poll
  for the deliberately animated anchor's final position, retaining their bounds.
- Browser server used the repository's loopback Supabase fixtures. A temporary
  Playwright adapter used webpack dev mode after local Turbopack cache compaction
  exhausted disk; only reproducible `.next`/`.next-e2e` caches were removed.
  No user data removed. Final desktop Light and 375px mobile Dark screenshots
  were inspected; this is viewport emulation, not physical-device validation.
- Fresh-context corrective review: no material findings at snapshot
  `c04359a66b618c33e1b80f0e573d03aaea2916dca2cdd6edd483fb6304b225fa`.
  Reviewer independently ran 10 focused tests; browser evidence was supplied by
  coordinator. Exact reviewer model unavailable. Only documentation changed after
  that snapshot. No commit, push, deployment or Linear modification performed.
- Mechanical design detector returned no warnings on scoped targets during the
  implementation pass; this is not an accessibility or visual certification.
- Graphify executable/graph unavailable; graph update could not run.

## Supplied observation review / production frontend work

| Area | Confirmed current evidence | Remaining action |
| --- | --- | --- |
| Responsive layout | Current local public/authenticated samples have no horizontal overflow; desktop Light/mobile Dark inspected | Test real iOS Safari/Android, 200% zoom, long data, all authenticated/error states |
| Contrast | Current browser login input text/placeholder checks pass 4.5:1 in both themes | The pasted exact ratios were not reproduced; measure all text, alpha/gradient, focus, error and disabled states; no global WCAG score |
| Dialogs | Account deletion has dialog semantics but no focus lifecycle; current full-screen editor also does not close on Escape in browser | Unify safe initial focus, Tab containment, Escape, background inertness and return focus; preserve dirty-draft/destructive guards |
| Loading/motion | Installed thinking-orbs explicitly renders a static frame under reduced motion | Missing wrapper CSS alone is not evidence of a motion defect; test loading/error recovery under throttled conditions |
| SEO | Seven public sitemap URLs; source canonical/description, one landing h1, ten shared visible/JSON-LD FAQs (not eleven in pasted report), login/signup noindex | Verify deployed HTTP/indexing separately; clean duplicate signup brand title as minor copy task; no ranking/AEO guarantee |
| Fonts/licensing | Current root fonts differ from pasted claim; nine legacy binaries remain public and declared via font-face but no family use found | Obtain rights/provenance or remove unused distributions and obsolete declarations after approval; reconcile font-licensing.md, ornate logo and imagery records |
| Detector | Scoped current-target scan returned no warnings; PortfolioImage named in pasted report is not present in this checkout | Prior 11-warning count/false-positive claim is not freshly reproducible here; validate findings, never equate stylistic hits with launch defects |
| Performance | Default production build passes; no CSS/visual redesign, extra GSAP ticker or layout wrapper added | Measure throttled production LCP/INP/CLS and scrolling on target hardware; no lab/field performance pass claimed |
| Dependency gate | Production-only npm audit reports zero vulnerabilities | Repository security:audit fails because existing risk exception expired; do not silently extend it or claim CI release-ready |

The release checklist is an assessment, not authorization to redesign surfaces,
remove assets, modify privacy/deletion behavior or deploy the application.
