# NAK-106 consent-first publishing and form clarity

## Execution context

2026-10-16, based on latest main `888b70e` (PR103 merged). Work branch:
`fix/nak-106-consent-publishing-flow`. Preserve the unrelated NAK102 document.
Full record, Critical review depth because publication controls change; no
deployment, production SQL, commit/push or PR creation requested in this task.
The prior shared-system record retains historical review/verification evidence.

## Goal and approved contract

The owner requests home links on portfolio brand artwork, concise interest form
labels and aligned controls, fewer repeat publishing steps, competitor research,
and temporary removal of the account JSON download UI pending a PDF template.

1. Every portfolio logo (navigation, footer, desktop/mobile interest portal) links
   to `/` with a visible keyboard focus and the accessible name VivIntro home.
   Preserve original approved artwork, dimensions and light/dark selection.
2. Viewer/Candidate fieldsets supply context. Visible labels say Full name,
   Email address, Country, State, City and ZIP or PIN code without repeated Your.
   Keep actual form names/serialization, required/optional rules, ZIP lookup,
   location privacy disclosure, inline validation and keyboard navigation.
   Align phone/email and country/postal inputs at desktop/tablet widths; retain
   readable mobile labels and 48px controls. Do not replace labels with icons.
3. Editing continues to autosave privately, followed by Review and publish.
   Both previews remain optional and accessible. Neither preview timestamp nor
   visit flag blocks consent/publishing, including after a small edit.
   Fresh explicit consent is unchecked on every review opening; copy accurately
   describes public/protected disclosure without falsely claiming preview visits.
4. Keep authoritative completeness, shareable photo, liveness, creator account,
   saved-revision conflict checks, snapshot transaction and old-link lockout.
   Consent denial, stale revision, failed save and server refusal must not publish.
   Preview progress remains informational. Do not fabricate visits/consent.
5. Hide the account download section and remove unused UI handler/imports.
   Keep authenticated export API and privacy/data-rights services intact; no PDF
   placeholder, invented availability date or unrelated privacy-policy rewrite.

## Design and evidence basis

Preserve the established ink/gold/sage tokens, Inter/Plus Jakarta typography,
portrait artwork, dialog split-pane and mobile takeover. Design variance 3,
motion 2, density 4: clearer structure, not a visual redesign. Taste skill applies
only to portfolio chrome; its marketing heuristics do not govern the wizard.

Official competitor documentation checked October 16, 2026:
- Hinge describes Done to save and a separate optional View tab:
  https://help.hinge.co/hc/en-us/articles/360011053094-How-do-I-edit-my-profile
- Bumble describes Save and close for gender updates:
  https://support.bumble.com/hc/en-us/articles/28938787921053-Changing-your-personal-details
- Shaadi provides section-based Edit Profile, with some identity fields restricted:
  https://support.shaadi.com/support/solutions/articles/48000755435-i-want-to-edit-my-profile

Inference: preview is useful, but mandatory repeated preview visits add friction.
VivIntro retains a deliberate consent boundary because its public/protected
snapshot model differs from those products. No claims about their undisclosed
backend validation or all fields' update behavior.

## Verified source map and compatibility

- `dashboard-client.tsx`: readiness gate, modal, draft conflict handling and
  tracker. The DB progress function in `20261008100000` already permits disclosure
  without preview visits. Change UI gate/copy, not the database or consent version.
- `publish.service.ts`, `publish-readiness.service.ts`, readiness helpers and DB
  publish transaction: retain authoritative checks and exact saved-draft consent.
- PortfolioNav, PortfolioFooter, InterestRequestModal: existing VivIntroBrand
  supports href; use it rather than adding a wrapper or changing global defaults.
- VisitorInterestFields, StructuredInterestLocation, PhoneNumberField,
  LocationFields and globals.css: shared search, labels, grouping and geometry.
- AccountClient: remove UI only. Export API tests remain unchanged.

## Evaluation plan

| Criterion | Checks and plausible incorrect implementation rejected |
| --- | --- |
| Home links | Component/browser assertions on navbar/footer/both portal placements, correct href/name/theme/focus; reject anchor-to-top or inaccessible decorative link |
| Field clarity/alignment | Actual location/interest tests plus desktop/tablet/mobile browser bounds; reject label wrapping offset, short email stretched to phone height, lost keyboard or payload |
| Consent-only preview policy | Dashboard tests publish with both visit flags false and no preview timestamp, consent initially unchecked, reopening resets consent, changed draft repeats confirmation; reject fabricated visits or automatic publication |
| Publication invariants | Existing stale-draft/media/save/verification/account/incomplete/legacy-link and server rejection tests; reject replacing readiness with is_published or ignoring failed responses |
| Download removed | Account UI asserts absent and no export call; API/service tests still cover authorized download and failures |

Behavioral red/green where feasible, followed by focused tests, full coverage with
unchanged feature gates, lint/typecheck/build, affected three-project browser
checks and independent fresh-context review. No SQL change planned. Local SQL
runtime remains unavailable without Docker/PostgreSQL; do not claim a new DB run.

## Progress and next step

Implemented on dirty main-based source. Added regression tests first: consent
without preview visits and absent download both failed against the original UI
for the intended reasons. After implementation, focused five-file verification
passes 144 tests, including stale save/media races and server refusal/retry.

Initial six-case browser run: desktop/mobile passed; tablet alignment expectation
incorrectly assumed two columns despite the established 768–1023px stacked
viewer-field layout. Revised the test to assert equal x/width, vertical order,
equal control heights there; keep two-column y alignment elsewhere and country/
postal y alignment at every two-column location breakpoint. This corrects the
test's layout contract, not a threshold. Five-file/three-project browser replay
and full static/coverage/build checks are pending. No production service is used
by these loopback mock browser tests.

The required checklist and consent precede optional previews in the review scroll
area. Repeat consent stays unchecked each time. The original v2 disclosure policy
(public name/status versus approval-protected details) is unchanged; copy no
longer falsely asserts that optional previews were visited. No migration needed.

Fresh-context review pending. Source writers pause for its immutable snapshot;
actual evidence and limitations will be appended after review.

## Review and correction ledger

Round 1, fresh-context `/root/consent_publishing_review`, unknown exact models,
instruction-based read-only shared checkout. Snapshot
`4b04fc5411cf09362bc204e9d9dc320b1a4c9a67eff26a0ea93495d0eae2cb5d`
passed provenance before/after. Source verdict changes required; three confirmed
introduced findings, with no other material source findings identified.

| ID | Finding | Correction and current evidence |
| --- | --- | --- |
| NAK106-R1-F01 | Disabled initial publish target does not receive keyboard focus | Added browser initial-focus/Tab checks; observed intended failure (activeElement outside dialog). Focus a stable heading; trap handles non-tabstop/escaped focus in either direction and remains available while publishing removes footer controls. Corrected replay pending. |
| NAK106-R1-F02 | Short Country selector also matches Country calling code | Exact combobox within named location group; theme/contrast assertion unchanged. Replay pending. |
| NAK106-R1-F03 | Tablet geometry compares national-number subinput against whole email | Compare whole phone composite for x/width; retain individual input height, stacked order and desktop row alignment thresholds. Replay pending. |

Broader original run: 62 passes, 4 failures (F02 in all three projects and F03 on
tablet). These are retained failures, not a claimed green run. Typecheck and diff
hygiene pass. The new focus regression then failed separately before the source
fix. Required correction review and final checks remain pending; budget is three
review rounds maximum. No production SQL, source gate or test threshold relaxed.

## Final implementation and verification, October 16

Round 2 independently inspected snapshot
`c0de9949c7fa73f41560b682b01d4f027055f86f1cf5df6b06b09889b7a1eac7`,
with start/finish provenance passing and the exact four-file correction delta.
All three stable findings are resolved: the inspected corrections plus the
coordinator's passing 36-case replay establish the resolution. No unresolved
material source finding. The only later production-file change removes trailing
whitespace left by ref removal; no runtime semantics changed after that review.
This section and the project-map reconciliation are evidence-only updates.

Passed against the corrected implementation:

- Full coverage command `npm run test:unit:coverage -- --maxWorkers=2`:
  **1,354 tests / 178 files**, statements 85.75%, branches 80.59%, functions
  84.60%, lines 89.39%. All **59** unchanged per-feature gates pass. The extra
  worker argument reached the npm feature-check wrapper rather than Vitest and
  emitted a warning; this successful run used the default Vitest pool, not a
  claimed two-worker run. No test/coverage threshold was modified.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run db:smoke`, and
  `git diff --check` pass. Build compiles and generates all 81 static pages.
- Corrected Chromium replay: **36/36** in consent-form-clarity, dashboard-clarity,
  landing-interest-audit across the three configured projects. Subsequent replay
  of interest-viewer-experience and portfolio-interest-polish: **30/30** across
  those projects. All **66 unique affected cases** therefore pass in two green
  runs; this is not a claim of one successful 66-case invocation. Retain the
  original four failures and initial focus red-state evidence above.
- Targeted WebKit: **8/8** in consent-form-clarity and portfolio-interest-polish,
  using an ignored temporary config with iPhone13 viewport/device settings,
  the installed WebKit2336 engine, and the unchanged local mock/web servers.
  Scratch config was removed afterward; screenshots remain under ignored
  playwright-report/nak106-webkit-results. No permanent CI/project alteration.
- Browser checks verify actual theme/artwork, label/input geometry, optional
  previews, fresh consent, server refusal, initial focus/reverse Tab, portrait
  decoration, bounded scrolling, touch tooltip and conditional candidate fields.
  Desktop/mobile screenshots were visually inspected, not just asserted.
- `graphify update .` refreshed the code AST without API/LLM use. CSS is not
  supported and the SQL grammar is absent; this is not CSS/SQL validation.
- No change under migrations, CI, server publication/account services or API
  routes. Unrelated NAK102 SHA256 remains
  `70427AFB1F6B15FC5A45F374AB3934CCDED3F2D235F2ECBCA256F50AF8A24DF4`.

Actual changed responsibilities: portfolio chrome/modal brand hrefs; shared brand
focus style; concise viewer/location labels and context grouping; optional phone
sublabel visibility preserving accessible names and editor defaults; location
grid alignment; dashboard consent/readiness/copy/focus; account UI download
removal; corresponding component/browser regressions and project documentation.
No dependencies, generated database types or protected-data projections changed.

## Remaining limits and rollout

- No hosted CI run, commit, push, PR creation, merge, deployment or production
  mutation in this task. These are local verified changes on a main-based branch.
- No new migration is needed: the database already accepts disclosure without
  preview-visit markers. Existing migration deployment history is not audited
  here; do not infer that all historical migrations are applied in Production.
- Real Supabase/provider flows and physical iPhone16Pro/iOS26.6.2 were not
  exercised. WebKit simulation is not a real-device pass. SQL replay unavailable
  locally; no SQL changed, and static fixture smoke is not a substitute.
- Normal future PR checks, user review of both appearances, and a physical-device
  save/review/consent test remain release steps. Rolling back this UI restores
  forced previews but requires no schema/data rollback.
- Export API remains available for authenticated data access; a downloadable PDF
  template and a future portfolio download UX are explicitly deferred.

Scoped lesson: changing a prerequisite can disable the control previously used
as a modal's focus anchor. Test the default no-prerequisite path's automatic
focus and reverse Tab, not just a manually clicked consent/submission path.

Final bounded round 3 is complete: `no_material_findings`, all stable IDs remain
resolved. Snapshot
`fc7054014619476fa615eaafe85cd335114ab14774dec10b4b55f2d8425cdda7`
passed start/finish provenance. Reviewer independently verified that the final
delta is exactly the two documentation files and one whitespace-only dashboard
line; restoring that line reproduces the round-2 source hash. No fourth review
round is needed. This result receipt is documentation-only after review; runtime
source, tests, requirements and check configuration are unchanged.
