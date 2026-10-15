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
