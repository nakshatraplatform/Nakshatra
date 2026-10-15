# NAK-106 — Phase 2 shared portfolio system

## Context and boundaries

User-approved Parts 6–9 extend the local Phase 1 work on
`fix/nak-106-portfolio-interest-polish`, based on merged PR100/main `9f84f3f`.
Risk: Significant, full documentation mode. Preserve Phase 1 submission and
scroll-lock fixes, unrelated NAK102 documentation, server projections, broker
consent rules and existing test thresholds. No push, merge or production SQL.
The previous phase's results are baseline evidence, not Phase 2 validation.

## Plan and decisions

1. Use Inter and Plus Jakarta Sans through two `next/font/google` loaders.
   Configure Tailwind 4 through the existing CSS-first `@theme`, not an unused
   v3 configuration file. Replace retired font references and black shadows.
2. Add reusable ChapterHeading, TrustBadge, ExpandableProse, IconDataRow,
   PortfolioNav, Pill, ProtectedDataVault and decorative BrandMotif components.
   Preserve semantic headings, accessible disclosures, touch targets, owner
   appearance and reduced-motion behavior. Display-only editorial photo wash.
3. Consume the existing typed, server-authorized PortfolioData projection, never
   raw privileged `published_data` at the client. Hobbies are comma-separated.
   Prefer structured city/region_code/country; fall back to current_location.
   Never guess an abbreviation or expose postal/street data in public copy.
4. Schema reconciliation: `access` has public/approved/broker/owner audiences;
   `restricted` and gallery exist in `visibility`, and media URLs are separately
   authorized. Use these real keys, not a fabricated access.gallery contract.
   Presentation can conceal additional data but cannot authorize disclosure.
   Preserve public family/astrology summaries when only detailed fields lock.
5. Consolidate shared semantic colors and typography across B2C/B2B presentation,
   retaining meaningful accessible status roles and owner light/dark isolation.
   The 60/30/10 rule guides visual hierarchy, not an asserted pixel percentage.
   Do not rewrite user prose, legal/consent meaning, or broker state machines.
6. Run focused regressions, unchanged coverage/lint/type/build/browser gates,
   Graphify update and bounded independent review (maximum three rounds).

## Acceptance evaluations

- Font source contains exactly two loaders; no retired font-face, serif/mono
  utility or unresolved font token remains. Headings use display; controls/body
  use Inter. Tailwind shadow utilities resolve to ink-tinted alpha channels.
- Shared components are actually consumed by the portfolio, including gallery
  headings, authorized narrative, journey, hobbies, navigation and privacy gates.
- Hobbies handle empty/duplicate/whitespace values; structured and legacy
  locations render without invented codes or private address leakage.
- Public/approved/owner presentations do not turn audience metadata into grants;
  restricted, broker-only and owner-only sections stay protected appropriately.
- Light/dark portfolio against opposite app themes, keyboard/focus, narrative
  expansion, mobile overflow/footer, glass navigation and photo wash have styled
  browser evidence. Existing schema, consent and projection tests remain green.
- Full coverage thresholds are not weakened. Unavailable local DB replay and
  physical iPhone checks remain explicit external gates from Phase 1.

## Progress

Initial audit complete: legacy font faces and six Google font loaders confirmed;
Tailwind 4 CSS-first configuration confirmed. Schema mismatch reconciled above.
Implementation and verification are recorded below. No linear_phoenix connection
is exposed; this local feature record retains context without misrouting writes.

## Implementation checkpoint and review ledger

All seven primitives are consumed by the public portfolio. Shared web fonts,
semantic component colors, tinted Tailwind elevation and editorial photo display
are implemented. The global font rule covers active BrokerDesk pages as well.
Logo selection is explicit at portfolio navbar/footer boundaries; browser review
also caught and removed the old Gallery metadata negative-margin overlap.

Browser fonts are the two self-hosted Next families. Approved logo/Google identity
artwork retain their brand colors. Existing Satori social-image routes are a
separate, server-generated-image typography path, not browser font bundles; they
are not silently relabeled as Next web fonts or changed in this presentation
refactor. No originals or verification/document images receive the photo wash.

The public resolver continues to return its authorized snapshot, not raw private
published_data. Legacy access metadata can conceal additional presentation but
cannot expand the server's publication preset, expose contact, or act as a grant.

Fresh-context review round1 (model unknown) on source9290d5d3 returned four
material findings; provenance was current before/after. Maximum three rounds.

| ID | Finding and origin | Correction | Resolution evidence |
| --- | --- | --- | --- |
| NAK106-P2-R1 | Introduced tablet3-column reset with2children | Two-column tablet breakpoint | Original failing tablet gate now passes in targeted Chromium/tablet8-case rerun |
| NAK106-P2-R2 | Introduced inverse-token contrast on demo/tour/horoscope hover | Canvas foreground on ink surfaces; ink hover on canvas; also corrected broker customer action foreground/background pair found in parent sweep | New real demo/tour and authenticated document-route browser contrast cases pass in targeted8-case run; structural inverse-pair gate added |
| NAK106-P2-R3 | Introduced implicit transition-property:all theme race | Constrain global motion properties; remove independently interpolated theme color/surface transitions and Tailwind color-transition utilities | First-changed-frame real theme-button regression passes in targeted8-case browser run; static transition-property gate |
| NAK106-P2-R4 | Pre-existing raw Georgia declaration missed by global sweep | Normalize CSS font families, including no-space minified fallbacks | Hardened full CSS family gate passes in focused94-unit run |

Initial full run:1,339 unit passes and two obsolete literal-color-class failures;
103 browser passes,4 existing matrix skips,1 confirmed tablet failure. Those
results are historical, not a final green suite. Dashboard assertions now check
equivalent semantic tokens, including both negative preview-reset assertions;
no behavioral expectation, coverage threshold or timeout was reduced. Focused
94-unit and8-browser correction checks pass. Initial build/lint/typecheck/audit
(zero affected packages)/DB fixture smoke passed before review corrections.
The final corrected validation and review results follow.

## Current handoff — 2026-10-15

Parts 6–9 are implemented locally, preserving the Phase 1 form/scroll-lock changes
and merged PR100/main fixes. Tailwind 4 uses the existing CSS-first `@theme`; no
unused v3 `tailwind.config.ts` was introduced. Production source remained frozen
after round 2 (`c8982e86`). The final code/test review snapshot is
`7682751a34f355f95bd8fa669ab3541d266b5ef3a9169d4f674433d657088d50`.
Subsequent edits are verification-only updates to this record, the Phase 1 record
and the PROJECT index; they do not change acceptance criteria or runtime code.

### Final verification

- Full serial unit/coverage: **1,342 passed in 178 files**. Statements 85.85%,
  branches 80.71%, functions 84.55%, lines 89.49%; all unchanged thresholds pass.
  All **59** per-feature mapper/service/contract coverage gates also pass.
- Final production build, standalone typecheck and zero-warning lint passed.
  The later changes are test selectors/expectations and verification-only docs,
  not production code. Final production/full dependency audit passed with zero
  affected packages and no exceptions; dependencies were unchanged.
- Browser evidence is deliberately not described as one green full-suite run.
  The initial 255-case run reached its 900-second command budget: 126 passed,
  5 existing skips and 124 unfinished (including the interrupted in-flight case).
  A report-derived explicit 124-case continuation finished with 121 passed,
  1 existing skip and two test-assumption failures described below.
- The corrected two-file, three-project replay passed **16 cases, 2 existing
  skips**. Reconciliation by test ID across the three reports verifies all 255
  original cases: **249 unique passes, 6 existing device-matrix skips**, no
  unfinished, failing or flaky case. No assertion, contrast threshold, per-test
  timeout or retry policy was weakened; only the continuation command's overall
  runtime budget was increased. Exact unfinished-case selection was verified
  with Playwright `--list` before execution.
- Final focused WebKit replay: **4 passed**, including the new shared-system
  regression and the retained footer/scroll, navbar/tooltip and candidate-form
  checks. This is local WebKit evidence, not physical iPhone Safari evidence.
- The earlier overlapping coverage/browser attempts were interrupted after local
  timing failures under concurrent build/lint/test load. They are not passes.
  Serial coverage and the fully reconciled browser evidence above supersede
  those attempts without increasing individual test timeouts.
- DB fixture smoke passes with the Phase 1 45-assertion plan. Actual clean
  migration replay, pgTAP and generated-type drift remain unavailable locally
  without Docker/Podman. Phase 2 adds no SQL; the existing Phase 1 forward
  migration remains a separate schema-first release step, never applied here.
- Final `graphify update .` completed without LLM/API use; no further code-graph
  topology change was needed. CSS is unsupported by that extractor and the SQL
  grammar is unavailable, so this is not claimed as CSS/SQL validation. The
  independent CSS parser/browser checks and separate database gates still apply.

### Final test corrections and bounded review

The mobile replay exposed two test assumptions, not a new production-source
change. The liveness test still selected the retired `.portfolio-verified-badge`
class. Both its positive assertion and the fictional-demo negative assertion now
use the real TrustBadge accessible label; visible text, the narrow disclaimer
and responsive overflow checks remain. The new inverse-tour test assumed the
decorative illustration was visible at phone width, although unchanged main CSS
hides `.tourVisual` at 620px and below. The test now explicitly checks that
responsive visibility contract and still checks >=4.5 contrast in both themes at
every tested width, including the computed mobile tokens.

Three bounded fresh-context review rounds are complete, exact model unknown.
Round 2 independently rechecked geometry at 375/721/834/900/901/1440px, theme
foreground/background pairs, first-frame theme switching, reduced motion and
all 19 CSS files. R1–R4 are resolved. Round 3 compared complete manifests and
confirmed exactly the two test-file corrections above, unchanged production
source/dependencies/contract/NAK102, and no relaxed checks. Provenance checks
passed before and after review. No unresolved material source finding remains;
the review budget is exhausted, not reset by the narrow correction replay.

Reviewer verdict remains blocked on external release validation, not source
corrections. Human/domain release review, hosted database checks and physical
iPhone 16 Pro/iOS 26.6.2 confirmation remain required. The original device-only
blank-space cause is not proven by bounded local replay. No commit, push, merge,
production migration or deployment was performed. The unrelated dirty NAK102
document is preserved unchanged.

Reusable lessons: component extraction must migrate negative assertions too;
otherwise a retired CSS selector can make absence tests vacuous. Visibility
tests must reflect established responsive behavior while retaining contrast
thresholds. Theme ink and canvas should switch together rather than independently
interpolate. Audience metadata remains a defensive display gate, never a grant.

## PR publication authorization — 2026-10-15

The user has now requested PR creation, authorizing a commit and push of the
reviewed NAK-106 branch. Exclude the unrelated NAK102 document. This supersedes
the earlier local-only publication boundary, not the production deployment gate.
Latest fetched main remains `9f84f3f`; production source/tests match the final
reviewed implementation, with only publication/verification documentation added.

The production database workflow is manual and main-only (`cd.yml` checks
`github.ref == 'refs/heads/main'`). Therefore running it on current main cannot
apply the new migration still present only in this feature branch. Before merge,
agree a separate migration-first release route or hold the automatic app rollout
while the newly merged migration is applied and verified. Neither route is
authorized or executed by PR creation. Do not dispatch production CD from this
branch or claim that existing-main deployment applies this new SQL.

Publish as a draft while hosted CI/database checks, device confirmation and
rollout coordination remain outstanding. Keep the actual PR URL/status in the
subsequent handoff once GitHub creation is confirmed. Browser-controller startup
and the GitHub connector are currently unavailable; Git SSH access works.

## Post-merge portrait artwork and presentation follow-up — 2026-10-15

### Current increment: split accent, responsive dialogs and sharing completeness

The next user request supersedes the monochrome-only accent rule: retain Inter /
Plus Jakarta Sans and the existing cream/ink surfaces, with a restrained,
contrast-tested warm gold for portfolio metadata and chapter markers. Preserve
the local restored orbits and all prior follow-up fixes. Existing NAK102 edits
remain unrelated. No push, deployment or production database action is authorized.

Mode: full contract extension; Critical because the user explicitly approved a
separate forward migration to block already distributed URLs for incomplete
published profiles. Prepare but do not apply it. Reuse the canonical database
publication checklist at the shared personal-link perimeter, preserving existing
ownership, verification, snapshot and expiry checks. Do not mutate publication
flags, snapshots, drafts or grants. Valid published snapshots remain accessible
during incomplete draft edits. Fresh-context additional review and database
runtime checks are release gates; a dry run alone does not establish enforcement.

Acceptance / evaluations:

1. Hero eyebrow (12px / 600 / .2em) and metadata (500) use accessible warm gold;
   the name and chapter titles stay ink. Chapter markers use the same gold.
   Test both owner themes, including opposite app themes, normal-text >=4.5:1,
   phone/768px/desktop widths. Reject same-color ink/gold and washed-out gold.
2. At >=768px interest dialog has context/next-steps sidebar and a form pane;
   below that it remains single-column. Keep a bounded, independently scrolling
   form, theme-scoped surfaces, visible close control and desktop right-aligned
   submission. Include choice, details, OTP/error/loading and success, keyboard
   trap/restoration and short laptop screens. Preserve field semantics and OTP
   verification, never duplicate IDs/controls or add sensitive candidate data.
3. Mobile publishing review is edge-to-edge viewport takeover with compact
   header, spacious independently scrolling checklist and pinned action region;
   safe-area padding, 44px targets, no last-row obstruction. Desktop remains
   bounded. Complete rows use semantic success, incomplete dashed indicators;
   text conveys state too. Preserve preview fingerprint, consent and server gates.
4. Every dashboard share/copy action requires the current canonical completion
   check of **published_data**, not merely is_published or the editable draft.
   Null/malformed/legacy published answers and missing shareable hero fail closed;
   a complete unpublished draft cannot unlock an incomplete live snapshot. A
   complete published snapshot is not invalidated by incomplete unsaved draft
   edits or draft review flags. The server page must not supply its share URL
   for incomplete published data. Show "Update Profile to Resume Sharing" and
   route to editing/review. Verify positive, missing new location/address fields,
   optional address line 2, photo, verification, expiry, refresh and recovery cases.
5. Old tokens for incomplete canonical published snapshots fail closed across
   public/approved portfolio RPCs, horoscope, interest, link lifecycle and storage
   predicates that already consume the shared personal publication gate. No raw
   canonical JSON is exposed to anonymous viewers. Malformed legacy dates fail
   closed rather than raising a public error. Existing signed media URLs retain
   their previously issued TTL; this migration cannot revoke a downloaded image.
   Validate transactional pgTAP negatives and successful reviewed republication.
   Roll out the independently reviewed migration before releasing UI changes;
   preview affected counts without personal data, verify history and re-run a dry
   run afterwards. Emergency rollback requires a separately reviewed predicate
   restoration, not editing applied migrations or relaxing unrelated gates.

Delivery constraint verified in `.github/workflows/cd.yml`: production CD is
main-only and checks out the dispatched SHA. Therefore a migration-first release
requires a **migration-only reviewed PR merged first**, then CD preview/apply /
history verification, then the application PR. Alternatively an explicitly
approved frontend deployment hold is required. Do not tell the operator to run
the feature branch through this main-only workflow. No PR split, merge, SQL
execution or deployment is performed by this local implementation increment.

Design basis: extend the existing canonical readiness module and semantic color
tokens; no parallel checklist, new UI framework or duplicated form submission
logic. Keep dialog lifecycle ownership in current components. Existing public /
approved projections intentionally omit private fields and must not be sent to
the owner-completeness helper. Raw canonical published data stays owner-scoped.
Validate unit/coverage, lint/type/build, affected responsive Chromium/WebKit and
fresh review; record actual results separately from this planned matrix.

Main is now `d551bbf` (PR #101). The user requests a typography/color omission
check across pages and restoration of the signature design behind the portrait
in light and dark. This is a new, Standard-risk, bounded presentation follow-up,
not a reopening of the completed Phase 1/2 review or permission to publish.
Preserve the merged fonts, palette, photo, responsive layout and privacy rules.
No schema, migration, production deployment or data mutation is required.

The two original orbit spans were removed when BrandMotif was introduced; their
theme-aware CSS remains. Restore both within a clipped, noninteractive decorative
layer, keeping the faint arch motif and photo separate. Acceptance: both rings
are visible in both portfolio themes, bounded at phone/tablet/desktop widths,
cannot intercept interaction, and cannot enlarge the document after scrolling.
A missing-ring implementation must fail a template regression before correction.

Audit browser typography/palette source and representative rendered public,
authenticated and BrokerDesk screens in both app themes, including opposite
owner/app themes. Record actual routes and limits rather than claiming every
authenticated/error/data state was visited. Server-generated social-card images
are separate from browser typography. Preserve the unrelated NAK102 document.
The initial browser audit reproduced a standalone `/verification/result` action
at 1.07:1: the shared override used undefined `--product-action` outside its
workspace wrappers, invalidating the background. Add canonical semantic-token
fallbacks to primary and secondary actions without changing scoped consumers.
Landing example initials also incorrectly used display typography; use Inter.
The hero template regression first failed for missing decoration in both themes,
then passed after restoration. Initial focused validation: 40 tests pass.

This now materially changes shared presentation rules (Standard with mandatory
fresh review). Confirm primary/secondary defaults and hover/focus contrast inside
and outside wrappers; retain the theme-first-frame tests and all contrast limits.
No new shared abstraction is needed: the existing CSS tokens, orbit geometry,
BrandMotif and page components own these responsibilities. Rollback is a normal
application revert, with no database or data recovery action.

The loopback browser mock gains two read-only, schema-shaped empty BrokerDesk
projections; tests explicitly require dashboard/customer headings so a generic
error page cannot masquerade as successful route coverage. This does not replace
production authentication or RPC authorization. Redirecting invite links wait for
the actual signup destination. Both app themes are explicitly asserted.

Fresh-context review round 1 (model unknown), snapshot
`c617e13683b2ec0e850ef41008f0d7276734643b14a0df5a4237946480d38421`,
confirmed NAK106-PF-R1: undefined `--workspace-navy-strong` and
`--workspace-surface-soft` in error/404 hover and preview-banner consumers.
Pre-existing at `d551bbf`; corrected to `--ui-action-hover` and
`--workspace-surface-muted`. The new whole-source shared-token check rejects
unresolved ui/workspace/product references. Browser checks exercise actual
standalone, 404 and error controls in both themes, including desktop hover.
Resolution remains pending final passing verification and return review.
The reviewer withdrew a suspected legacy site-button hover issue because it
has no active source consumer; do not turn it into speculative cleanup.

Test-only corrections: the BrokerDesk heading is "People you represent", not
"Customers". The preview preparation requires existing blur derivatives for
hero photos too; the mock now supplies those metadata paths, without replacing
real preview preparation or authorization. Earlier broad-run test failures are
retained as history, not counted as green runs or permission to weaken checks.

Next: finish responsive Chromium/WebKit checks and static/build validation,
return the corrected snapshot for bounded review, and record actual coverage
and limitations. Nothing will be pushed by this request.

### Follow-up verification receipt

Production and test source is complete locally on
`fix/nak-106-hero-artwork-followup`, based on merged PR #101 (`d551bbf`).
The original two intersecting orbits are restored behind the unchanged portrait
in both themes; the arch motif remains at its existing subtle opacity. The
decorative layer is bounded, hidden from assistive technology and noninteractive.

Verified on 15 October 2026 using Node 26:

- Full Vitest coverage: **1,345 tests / 178 files passed**, statements 85.85%,
  branches 80.71%, functions 84.55%, lines 89.49%; unchanged global thresholds.
- All **59 feature coverage gates passed** (`check-feature-coverage.mjs`).
- Full ESLint and TypeScript checks passed; final changed-test ESLint replay
  passed. Next 16.3.8 production build passed, including its TypeScript check.
- Chromium: **114 distinct final cases verified** across desktop/tablet/mobile,
  reconciled rather than one green whole-matrix invocation. The last broad run
  passed 110/111; its sole failure was a strict locator matching a hidden streamed
  preview copy. The correction requires exactly one **visible** preview banner;
  the complete standalone/error/404/preview test then passed in all three projects.
  The original combined portrait test was subsequently split by theme, preserving
  all three widths, screenshots, assertions and the 30-second limit. All six final
  Chromium portrait cases passed. Those replace three old combined cases in the
  final 114-case manifest; the other 108 cases retain their passing evidence.
- WebKit: **all six final tests passed** in one fresh run. The initial combined
  six-snapshot test reached every image but exceeded 30 seconds; independent
  light/dark cases now fit the unchanged timeout. The other four tests remain
  unchanged. This is local Safari-engine coverage, not a physical-device claim.
- `db:smoke`, `git diff --check` and `graphify update .` passed. Graphify has no
  CSS extractor/SQL grammar here; CSS parser and rendered checks are separate.

The source inventory covers 39 page entries; rendered font/flat-surface contrast
and width checks cover the 26 explicit routes in `presentation-followup.spec.ts`
in both app themes at the three configured Chromium viewports. Additional
portfolio, approved horoscope, owner preview, error and 404 paths have focused
checks. Hero screenshots were inspected at 320/768/1440px in light and dark;
legal/account/BrokerDesk rendered samples were also inspected. The new action
test checks both themes for error/404/standalone focus and desktop hover; preview
banner coverage uses the fixture's final dark app theme, not every owner/app
combination. Gradients/photos, disabled/translucent text and decorative SVGs are
excluded from the flat-background contrast calculation, not falsely certified.
Privileged admin views, real verification/provider states, every populated
BrokerDesk state and physical iPhone 16 Pro/iOS 26.6.2 remain outside this replay.
Server-generated social-card raster fonts and approved logo artwork remain the
documented browser-font exceptions. No further evidenced browser-font/palette
omission was found within the inspected scope.

Expected error-boundary fixture logs remain visible. Some screenshot captures
also produced development hydration notices showing Playwright's injected
`caret-color: transparent`; this is not claimed as a clean hydration audit or
treated as evidence to alter production rendering. No threshold, valid assertion,
authorization rule or production photo-preparation step was relaxed.

Fresh review round 2, snapshot
`1dc092db6362c5c25b8a8f0496b6f595dca67d63b6d6638b96fe05af1c49a0dc`,
confirmed R1's canonical-token correction and found no additional material source
finding. R1 is now resolved by the passing real hover/focus and preview replay.
Only the visible-banner assertion and independent theme test cases changed since
that source review; final bounded correction review follows. The unrelated
NAK102 document retains SHA256
`70427AFB1F6B15FC5A45F374AB3934CCDED3F2D235F2ECBCA256F50AF8A24DF4`.

Reusable lesson: a shared action cannot assume it always lives inside a product
shell; canonical fallbacks and a standalone rendered consumer catch invalid
custom-property backgrounds. A global definition check catches retired aliases,
but cannot alone prove that a token resolves at every consumer boundary.

Final fresh-context round 3 (model unknown), snapshot
`527bb7766493b4c24e8700e7127bdd7948447e5ecaf2f8b1c3143f17533d3e8e`,
returned **no material findings**. Before/after provenance checks passed.
Comparison against round 2 confirmed only the two documented test corrections
and the two progress documents changed; production source and mock were
unchanged. The reviewer confirmed the same assertions/timeouts and resolved R1.
Three follow-up review rounds are complete; no unresolved material finding
remains within this scope. Test executions are coordinator evidence, not claimed
as independently rerun by the reviewer. This final receipt and the project-map
historical-status correction are documentation-only additions after that review.

No commit, push, PR, merge, migration or deployment was performed for this
follow-up. This change adds no SQL. Hosted CI and an authorized release remain
separate from the local implementation and verification.

## Split accent, responsive review and old-link enforcement — 2026-10-15

This receipt follows the current-increment contract above and supersedes the
previous follow-up's **no new SQL** statement only for this newly approved work.
Risk is Critical. All changes remain local on
`fix/nak-106-hero-artwork-followup`; no commit/push/PR/merge/deployment or
production SQL application has occurred.

Implemented:

- Accessible warm gold lives in semantic platform/owner palette tokens. Hero
  eyebrow and profession/location plus ChapterHeading markers use it; names and
  titles stay ink/Jakarta. The portrait artwork and previous token fixes remain.
- `InterestRequestModal` has a >=768px 1:1.5 context/form split, with public-only
  name/summary, next steps and privacy copy. Choice, details, OTP and success keep
  their existing lifecycle and bounded scroll areas. Phone remains single-pane;
  desktop submission is auto-width/right-aligned. No protected data is added.
- Mobile dashboard review uses an edge-to-edge 100dvh flex takeover, compact
  accessible header, independent content scroll, safe-area-aware action region
  outside the scroller, and distinct complete/incomplete checklist indicators.
  Preview fingerprints, consent text and publication gates are unchanged.
- `isProfileFullyComplete` reuses canonical readiness against the owner's
  **published_data**, not a draft or reduced public projection. Dashboard server
  URL serialization, copy/share handlers and rendered controls fail closed for
  incomplete snapshots; recovery prompts editing/review/republication. Valid live
  data is not invalidated by unfinished draft edits or draft preview/consent flags.
- Separate migration
  `20261015180000_require_complete_published_portfolios.sql` adds a private
  published-snapshot checker using the current SQL publication checklist and
  current shareable hero visibility choices. The personal-link gate is narrowed,
  preserving existing ownership, verification, snapshot and expiry checks.
  Verification-badge and approval-email reads also use the shared perimeter.
  No drafts, snapshots, flags, approvals or stored data are rewritten. Invalid
  legacy dates fail closed. Existing signed capabilities retain their issued TTL
  (public photos up to one hour; protected capabilities capped at five minutes)
  and downloaded files cannot be revoked by this migration.

Evaluation results on the reviewed runtime source:

- `vitest run --coverage --maxWorkers=1`: **1,350 tests / 178 files passed**;
  statements 85.83%, branches 80.71%, functions 84.52%, lines 89.48%. All original
  thresholds retained. `node scripts/check-feature-coverage.mjs`: **59 gates
  passed**. Earlier two-worker execution hit two existing 5-second autosave test
  timeouts; both passed in isolation (1.01s combined), then passed in the full
  single-worker run. No assertions or timeouts were weakened.
- ESLint `--max-warnings=0`, `tsc --noEmit`, and Next 16.3.8 production build:
  **passed**. Build used loopback Supabase/app URLs, not production services.
- Playwright with `CI=true --workers=1 --retries=0`: **63 cases passed** across
  desktop/tablet/mobile Chromium for `dashboard-clarity`,
  `portfolio-interest-polish`, `shared-brand-system`, and
  `split-accent-publishing`. WebKit config: **11 cases passed**. Covers both
  owner themes/opposite app themes, readable gold, split panes through OTP and
  success, narrow/full-screen review, pinned actions, old-share lockout/recovery,
  consent, touch navbar, optional candidate questions and bounded footer replay.
  The initial combined two-theme matrix exceeded the unchanged 30-second case
  budget; independent theme cases retain every viewport/assertion and the same
  timeout. Screenshots of both OTP themes, gold hero and mobile review were
  visually inspected. This is local engine evidence, not a physical-iPhone test
  or a rerun of the entire 357-case default browser inventory.
- `node scripts/check-db-fixtures.mjs`: **passed**, including 24 new snapshot
  assertions and the extended 38-assertion public-perimeter fixture. Actual
  `node scripts/verify-local-db.mjs`: **blocked** because Docker and Podman are
  unavailable. No migration chain or pgTAP runtime pass is claimed.
- `git diff --check`: passed. `graphify update .`: AST graph refreshed without
  API usage; CSS is unsupported and SQL extraction lacks tree_sitter_sql, so this
  is not CSS/SQL validation. Unrelated NAK102 document retains SHA256
  `70427AFB1F6B15FC5A45F374AB3934CCDED3F2D235F2ECBCA256F50AF8A24DF4`.

Independent review (fresh context, model unknown, read-only instruction with
before/after provenance checks, no hardware isolation):

1. `/root/split_publishing_review`, snapshot
   `eb7ca9e67d28cee13b52a44924a73ba7e751cc053be7128946294dd5c560aa0d`:
   no confirmed material source defect; release blocked on database runtime.
   **NAK106-SPLIT-G1**: introduced, confirmed low/nonmaterial test gap; the new
   horoscope denial had no approved positive control.
2. Snapshot
   `843cc9f77499e908426986ba9d60c1dcaa3aba886b7f8e2929e9ed142bd2089c`:
   reviewer confirmed G1 **statically corrected, execution pending**. The public
   perimeter fixture now creates a published horoscope, proves the bound approved
   viewer can resolve it/read protected media, removes a required published
   address, and asserts both denials plus approved-data/email/RLS lockout.
   No new material finding. Runtime source/migration unchanged from round 1;
   only that fixture and the main-only rollout contract changed.

Tests/build/browser results are coordinator evidence, not independent reruns.
The current two-document receipt is a post-review progress update; runtime code
and tests remain at the second reviewed snapshot. Final receipt review follows.

Remaining release gates: run the complete migration chain and pgTAP suite in
authorized database CI/sandbox, review aggregate affected-profile counts and all
pending migrations, then use migration-only main delivery / explicit CD preview,
apply and history verification before releasing the UI (or an approved frontend
hold). Recheck a known complete link, an incomplete legacy link, an existing
approval and a reviewed republish. Do not treat a successful dry run or old PR
checks as evidence for this new migration. Production remains unchanged.

Final review receipt: round 3/3 examined snapshot
`0a424f42f9cc86068e3ef07e351f3eb7f3cf84bcd72ddf318852e0ee8f8cb651`.
Before/after provenance and diff hygiene passed. The reviewer verified only the
two progress documents changed since round 2; runtime, migration, tests,
dependencies and unrelated NAK102 edits were unchanged. No new material finding;
G1 remains statically corrected / execution pending. The review budget is complete
and database runtime remains the release blocker. This receipt and the matching
project-map review count are documentation-only additions after that review.

## PR delivery split — 2026-10-15

The user authorized committing, pushing and preparing PRs for the remaining local
NAK-106 work. The receipts above describe their pre-delivery snapshots; no new
runtime changes were made while preparing delivery.

- Database-only branch: `fix/nak-106-published-completeness`, based on main
  `d551bbf`, commit `960ab27`. Includes the completeness migration and four SQL
  test files; no frontend changes.
- UI branch: `fix/nak-106-hero-artwork-followup`, independently based on the same
  main. Includes portrait artwork, typography/token follow-ups, split interest
  dialog, mobile publishing review, published-snapshot share lockout and their
  tests/evidence. Does not include the migration or SQL test changes.
- Both PRs must target `main` so the existing required CI workflow runs. Wait for
  all checks, especially clean migration replay and pgTAP on the database PR.
  Local database execution remains unverified because Docker/Podman is absent.
- Release order: merge the database-only PR, inspect production migration preview,
  explicitly apply and verify migration history, then merge/deploy the UI PR.
  The main-only production workflow cannot deploy this feature branch directly.
  No production SQL, deployment, or merge is authorized by PR preparation.
- Unrelated NAK102 document edits remain excluded and unchanged.
