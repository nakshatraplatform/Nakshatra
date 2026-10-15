# NAK-106 portfolio and interest experience

## Execution context

- User-approved scope: 2026-10-14 feedback, Parts 1–5. Base: latest main `9f84f3f` (merged PR100). Branch: `fix/nak-106-portfolio-interest-polish`.
- Mode: implement/review; full record because shared presentation and a database-owned submission contract change. Risk: Critical for the forward migration, Significant for shared UI. No production mutation, merge, push or release is included in this task.
- Preserve unrelated dirty `nak-102-test-publication-access.md`. No `linear_phoenix` tool is exposed in this session; do not substitute another workspace or invent Linear approval.
- Next incomplete step: obtain authorization for a review PR/hosted database CI, then verify the preview on the affected physical iPhone. Local implementation and bounded fresh source review are complete; production release remains blocked by those external gates.

## Problem and goal

Mobile feedback shows excess space after the footer, undersized navbar artwork, sticky touch tooltips, uneven action states and redundant candidate questions. Candidate location uses an older directory instead of the current search-first picker. Build a balanced, trustworthy portfolio and an accessible form without weakening verified identity, owner approval or disclosure boundaries.

## Contract and acceptance criteria

1. AC1: Repeated scroll-to-end, viewport resizing, modal open/close and narrative expansion must not grow document height beyond rendered content. Audit root wrappers, positioned decorations and floating controls; distinguish browser reproduction from iPhone-only reports.
2. AC2: Header aligns approved horizontal artwork and >=44px pill controls at 320/375/768/1440px. Owner palette controls glass surfaces and ink; mobile sections remain keyboard accessible. Tooltip is hover-capable-pointer/keyboard-only, dismissible with Escape, never sticky after touch activation.
3. AC3: Narrative disclosure keeps stable ink with chevron/underline feedback; remove gallery's “A simple collection of everyday moments” copy. Preserve authorized photos, sections, contacts and policy links.
4. AC4: Contacting-for appears once. For son/daughter derive Parent, sibling derives Sibling, relative derives Relative. Only candidate name is mandatory in that branch; candidate email/phone/location are optional. Omitted contact data is not fabricated. Self drops stale candidate data.
5. AC5: Candidate location uses the same API-driven ZIP/PIN component as viewer location. Entirely absent location is valid; supplied partial/invalid location is rejected and removable. Viewer location remains required. Older fully supplied candidate locations remain readable/acceptable during schema-first rollout where possible.
6. AC6: Family context is mandatory, trimmed 40–600 chars, for both visitor paths. Message is optional; if supplied retain 80–600 chars. Preserve the working existing-profile OAuth and identity-prefill flow, not its superseded optional-family-context validation.
7. AC7: Bounded Viewer/Candidate/Context groups, 16/24px rhythm, consistent >=48px fields, Inter medium labels, accessible inline errors and focus first error. Use soft-red accents with AA readable text, not low-contrast pink text. Footer submit is full-width mobile and right-aligned desktop.
8. AC8: Scoped actions use consistent radii, medium weight, tinted elevation, 200ms ease-out feedback, focus-visible outline/ring, tactile 0.98 press, opacity .5/no-shadow/not-allowed disabled state, accessible spinner and disabled lock during requests. Honor reduced motion. Theme changes must retain PR100's instantaneous contrast invariant: animate motion/elevation, not independently interpolated ink/surfaces. Do not broaden to unrelated workspace actions.

## Design basis and boundaries

Redesign-preserve. DESIGN_VARIANCE 4, MOTION_INTENSITY 3, VISUAL_DENSITY 4: trust and readable forms take precedence over showy effects. Existing CSS/Tailwind, approved logo, Lucide family and owner appearance tokens remain; no component-library/dependency swap, generated photography or unrelated landing redesign. Portfolio typography stays recognizable; requested neutral Inter is restricted to the dialog controls. Pills for navbar, 12px action/input corners, 16px bounded form groups.

`VisitorInterestFields` owns conditional controls; `LocationFields` owns lookup/keyboard/cancellation; `interest.contract.ts` owns canonical API parsing and derived relation. Database RPC remains independently authoritative. Forward migration updates the existing guarded command, not a new permissive endpoint. Legacy location normalization stays distinct from the new structured shape. Owner details continues rendering missing values as Not provided. Preserve origin/rate/session/email/self-request/pilot guards and idempotency; no candidate data becomes public or enters app logs.

## Implementation plan and verified paths

- Layout/navigation: `src/components/templates/PortfolioNavigation.tsx`, `PortfolioChrome.module.css`, `PortfolioBackToTop.tsx`, `CelestialUnion.tsx`, `PortfolioNarrative.tsx`, `AdaptivePortfolioMedia.tsx`; root `src/app/layout.tsx` and scoped `globals.css` rules.
- Form: `src/components/portfolio/VisitorInterestFields.tsx`, `InterestRequestModal.tsx`, `LocationFields.tsx`, `InterestField.tsx`, `PhoneNumberField.tsx`; canonical server contract/repository and owner projection.
- Schema: existing structured command in `20261013190000_structured_location_capture.sql`; create a forward migration, never edit deployed migrations or apply to production here.
- Checks: `tests/interest-details-contract.test.ts`, `tests/interest-request.test.tsx`, owner-detail tests, new pgTAP cases plus current interest suites; `e2e/interest-viewer-experience.spec.ts` and new repeated-scroll/touch/geometry/contrast cases. Standard lint/typecheck/full coverage/build/browser/database gates remain unchanged.

## Evaluation contract

| Criteria | Cases and wrong implementation rejected | Evidence |
| --- | --- | --- |
| AC1–3 | repeated page-end scroll, height changes, touch CTA then footer, keyboard tooltip, long copy; reject growing footer gap or sticky tooltip | new browser regression, responsive screenshots; iPhone Safari manual evidence if unavailable locally |
| AC4–6 | each relation, self round-trip, name-only candidate, optional invalid contact, blank/short/overlong message, whitespace context, absent/partial/complete candidate location | contract/API/component tests and pgTAP RPC cases; not only mocked UI success |
| AC7–8 | 320×568 through desktop, dark/light, pending double-click, keyboard first error/focus, spinner, reduced motion | component tests and real styled browser checks; no lowered contrast/size/scroll gates |

## Rollout and recovery

Migration-first release is separate. Old clients supplying all candidate fields and valid family context remain compatible. Older clients that omit family context will now be rejected; coordinate the app rollout to minimize that interval. New optional fields require the new SQL command before app deployment; fail closed on missing schema. Existing-profile OAuth identity and approval flows remain unchanged. Revert app changes first if necessary; retain migration and stored metadata, use a later forward correction rather than history repair. No data deletion/backfill is needed for this change. Production draft-save behavior from PR100 is outside new mutations.

## Verification and review

Initial contract regressions failed for the intended old mandatory-message/candidate-contact behavior; corrected focused contract/form checks pass43 cases, then the two additional pending/inline-email checks pass in the34-case modal file. The retained three location-component cases now exercise the real search-first picker/serialization, selected-location restore, dependent clearing and provider-failure manual fallback rather than the removed legacy candidate-directory component. Its legacy SQL normalizer remains for old complete submissions.

Three new mobile Chromium cases and the same three focused WebKit cases initially passed: repeated end scroll/viewport resize/modal close, balanced header/touch tooltip, and optional candidate controls. Inspected the WebKit footer/navbar/error screenshots. The broader run passed47/48 and exposed Escape-dismissal selector specificity; corrected both hover/focus selectors to exclude explicitly dismissed tooltips. Final rerun pending.

Owner identifies iPhone16Pro and possible modal-close correlation (uncertain; iOS version unknown). No actual iPhone Safari session or pre-fix infinite-growth reproducer has been established: bounded post-fix replay is not proof of the original device-specific cause. In addition to wrapper simplification, the interest portal now uses a reference-counted fixed-body scroll lock that restores exact prior styles and scroll position; overflow-only locking can leave the document scrollable on iOS. Two unit cases verify exact/idempotent restoration and nested locks; the browser replay now exercises402×874 with reduced-height resize and asserts saved-position/focus restoration. Original thin logo/hover tooltip/field redundancy and gallery filler are confirmed source defects.

The strengthened WebKit replay first exposed a test timing error (click auto-scroll finishes after scrollIntoViewIfNeeded); capture the activation position at pointerdown, not before click. It then reproduced a real focus-restoration defect: Safari pointer activation need not focus buttons, so the modal now retains the trigger explicitly. Initial streamed-layout checks wait for rendered footer/fonts and exercise the hydrated menu before measuring; no footer-gap, overflow or scroll-position tolerance was relaxed.

Static PostgreSQL parser accepts seven statements and both PLpgSQL function bodies. `npm run db:smoke` passes (45 planned assertions in the extended interest suite). `npm run db:verify` is BLOCKED before local startup: Docker and Podman are unavailable; no production fallback, reset or SQL mutation was used. Hosted replay/pgTAP and physical-iPhone retest remain release gates. Prior PR100 passes do not establish this new migration's runtime correctness.

Final full coverage/build/browser/static checks and fresh review are pending. Fresh-context review required before release, maximum three rounds; parent owns changes. The existing 200ms action feedback is scoped to transform/filter/elevation; unrestricted transition-all is deliberately not used because it reintroduces PR100's evidenced contrast race. Soft-red accents use darker AA ink. Inter is self-hosted through next/font only for form controls; existing logo/photos/themes/portfolio type remain.

### Review ledger

- NAK106-R1 — medium/material, confirmed, pre-existing/in-scope AC7 gap. Existing-profile incomplete location previously stopped submission with an unassociated alert, leaving keyboard focus at the footer. Correction: remove that separate validator/serialization path; use StructuredInterestLocation, the shared flat-error selector and canonical parent parsing/first-error effect in both viewer paths. A new incomplete-existing-profile test verifies focus, data-invalid, accessible description and zero request dispatch. Corrected35-case modal suite passes. Fresh reviewer inspection of final correction pending.
- Integration checks exposed three12px button paddings (strict grid gate) and a missing Inter font mock. Use16/24px action padding and supply the actual new font export in the test mock; do not weaken the grid/test assertions. Focused shared-presentation/server-page checks pass; full rerun pending.

Full unit rerun on snapshot8075f927 passes1,315 tests/176 files: statements85.8%, branches80.42%, functions84.47%, lines89.48%; all59 feature coverage gates pass. Typecheck, zero-warning lint, exception-free production/full dependency audit and production build pass. Fresh-context review inspected the final R1 correction, found no remaining material source finding, but correctly marked release evidence blocked by missing database runtime/physical-iPhone evidence. One initial full browser attempt aborted after a local Turbopack internal panic and connection-refused failures; no app failure or pass is inferred from those aborted cases.

Final presentation-only follow-up includes reused location-picker secondary buttons in the same500-weight/tinted elevation/hover/press architecture (listbox options excluded), and applies the opaque focus ring to the email-code field too. A rendered picker-button weight/radius/touch-size assertion supplements the browser regression. The second broad browser attempt was intentionally interrupted before this correction to avoid mutating a running dev-server snapshot. Static spacing checks pass after the correction; final frozen browser/WebKit/build replay pending. Code/contract/SQL unit evidence above is retained because the follow-up changes only CSS and the added browser assertion, not runtime TS/SQL logic.

### Final correction evidence

Owner subsequently confirmed iOS26.6.2 on iPhone16Pro. Local WebKit26.5 is not that exact Safari build; physical-device confirmation remains outstanding.

The complete frozen243-case browser attempt finished234 passed,6 pre-existing device-matrix skips and3 failures of one old orb-banner assertion across all projects. The user requested an in-button spinner. Updating the assertion exposed two actual browser issues: Chromium's spinner-only busy button had no accessible name (jsdom differed), and inline colorScheme did not reset LightningCSS-generated light-dark fallback markers. Explicit pending aria-labels now cover all three primary submission variants; CSS appearance declarations on the backdrop reset compiled fallback markers. Stronger SVG checks retain visible ink, animation, theme color, accessible status, disabled/busy and failure recovery; the other two orb tests are unchanged. A rotating SVG's axis-aligned viewport box is not its layout size, so the test checks its actual24px CSS layout dimensions rather than a changing rotated bounding box. The corrected30-case affected-browser run and3-case WebKit replay passed before the additional inherited-token correction below.

- NAK106-R2 — medium/material, confirmed, origin unknown, AC7/AC8. Fresh reviewer traced root-computed UI/workspace aliases retaining the app theme after the backdrop changed appearance. New real-browser regression failed with pale rgb(237,242,239) picker labels where owner-light required rgb(36,52,67). Correction keeps one unchanged shared palette definition but evaluates UI/workspace tokens at both :root and the interest backdrop, not only :root. The same opposite-theme label/surface test now passes in all3 projects, including owner-dark/app-light. Final adjacent theme-suite replay and reviewer freshness check pending. No portfolio palette definitions are overridden.

The full unit/coverage rerun after explicit pending labels passes1,315 tests/176 files (85.8% statements,80.43% branches,84.47% functions,89.48% lines). Static shared-presentation3 cases pass after the shared-token correction. Final build/theme/browser replay and fresh review completion are the next checks; actual DB replay/pgTAP/type generation remain blocked locally, not passed. No migration has been deployed. No source changes are intended after the next snapshot; verification-only updates may append results without changing this contract.

## Current handoff — 2026-10-14

The preceding verification paragraphs preserve the chronological correction history, not outstanding local failures. Final production source snapshot: `e4cf6181c2809f8856e26869c4378c268c6af5e833a355f0c42785ec45184050` (round3b packet in local Temp); the only subsequent tracked-file changes are this verification record and its PROJECT index entry. No runtime code, SQL, tests, dependency or acceptance-criteria change follows that review.

- Full unit/coverage:1,315 passed;59 unchanged per-feature coverage gates passed. Final source TS behavior includes explicit pending labels; later correction is CSS-only, covered by the existing strict3-case presentation gate and final browser replay.
- Final affected browser replay: `playwright test e2e/app-theme.spec.ts e2e/loading-feedback.spec.ts e2e/landing-interest-audit.spec.ts e2e/portfolio-interest-polish.spec.ts --workers=1 --retries=0`:56 passed,4 pre-existing matrix skips. This supplements the earlier234 broad-run passes and resolves its3 outdated-loading assertions; it is not represented as a fresh complete243-case pass after the last correction.
- Final WebKit:3 passed on an unchanged-source rerun. First final attempt had2 passes and a development navigation destroying the font-readiness context before the footer checks. Preserve that infrastructure/test-readiness flake; no assertions or timeouts were weakened. Native iPhone16Pro/iOS26.6.2 remains unverified.
- Final zero-warning lint and production build passed; build includes successful TypeScript validation. Dependency production/full audit passed with0 affected packages/no exceptions; dependencies unchanged since that audit.
- DB fixture smoke passed, including45 planned assertions; SQL and PLpgSQL syntax parsed. Actual clean migration replay, pgTAP and generated-type drift verification remain BLOCKED without Docker/Podman, requiring hosted CI or another authorized isolated database environment. No production fallback was used.
- Three bounded fresh-context review rounds completed, exact model unknown; no cross-model claim. R1 and R2 resolved, no unresolved material source finding. Reviewer verdict remains blocked on external validation, not production approval. Human/domain release review and coordinated schema-first rollout remain required.
- Preserve PR100/main fixes and the unrelated dirty NAK102 document. Nothing committed, pushed, merged or deployed for NAK106.

Reusable lessons: a reused form branch must enter the same canonical validation/focus boundary, not an early-return alert path; browser accessibility trees must verify spinner-only busy-button names rather than relying on jsdom; compiled light-dark tokens and their aliases must resolve at the portal appearance boundary. Regressions above detect each condition. Fixed-body locking is a mitigation validated by replay, not a proven diagnosis of the original native-iPhone blank-space report.

## Phase 2 continuation — 2026-10-15

[The shared portfolio system record](nak-106-shared-portfolio-system.md) is the
current Parts 6–9 implementation and verification context. Its user-approved
two-font browser typography and shared semantic presentation supersede this
phase's earlier typography-preservation design note. The form, authorization,
scroll-lock and migration contracts above remain unchanged. Current combined
evidence: 1,342 unit passes, 59 feature coverage gates, 249 distinct browser
passes with 6 existing matrix skips (reconciled continuation/correction runs),
and 4 focused WebKit passes. Database runtime and physical-iPhone release gates
remain open; nothing has been pushed or deployed.
