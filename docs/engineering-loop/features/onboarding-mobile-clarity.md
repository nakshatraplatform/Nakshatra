# Onboarding mobile clarity

## Draft app PR preparation (October 22)

Integrated latest main `0587acc` (password-recovery PR #128), without conflicts.
The prior three-round review and local results below remain snapshot-specific;
final integrated checks and hosted CI must pass before release. User authorized
committing/pushing this increment and a Draft PR, not merging or production writes.

Implementation checklist:

- [x] Keep typed multi-select answers in private draft state before Add.
- [x] Correct field paths/focus, legacy origin recovery and latest-save errors.
- [x] Share UI/API closed-choice and range checks; preserve owner-stored legacy answers.
- [x] Keep blank sibling count unanswered, totals 0–20 and detailed records at most 10.
- [x] Use shared email/phone syntax and actionable numeric errors.
- [x] Remove repeated field descriptions; retain essential privacy/provider notices.
- [x] Group related answers and simplify appearance/contact section.
- [x] Persistent bottom Back/Continue, final Review, secondary draft tools and clear Dashboard exit.
- [x] Preserve portfolio renderers, fonts, colours and all publication/access guards.
- [x] Keep incomplete private drafts; Family/Astrology optional; no new mandatory fields.
- [x] Retain debounced, serialized saves; no added read for normal choices, at most one owner-scoped legacy lookup.
- [ ] Hosted CI passes on the final PR commit, without weakened/skipped checks.
- [ ] Mobile preview review and physical-phone/keyboard testing; remain Draft until approved.

Deferred: Unicode/single-name policy, expanded residence countries, marital
eligibility changes, new mandatory fields and large field-specification refactor.
No PDF feature, SQL migration, dependency, CI or production configuration changes.
Release order: green CI + mobile preview approval, then ready/review/merge this app
PR, verify Vercel production deployment, smoke-test. No database deployment for
this increment. Rollback is an app rollback; stored values/read schemas unchanged.

## Current increment: field integrity (October 22)

Full/significant shared UI/API authoring contract increment on fetched main
`5099079`; prior local presentation work preserved, with named Git stash backup.
Production-engineering loop: implement, regression-test, fresh-context review.

- FI1: custom multi-select text is part of the private draft while typing, not
  only after Add; navigation, Escape and saves cannot silently drop it. Retain
  the existing two-second save debounce, limits and duplicate handling.
- FI2: stable error paths for sibling count, family origins, custom Other inputs,
  ranges and email/phone controls; preserve inputs and correct focus.
  Explicit edits to the visible paternal origin also replace an existing legacy
  ancestral-origin alias, including clearing it; merely opening a draft does not.
- FI3: server rejects new unsupported dropdown/range values. Preserve unchanged
  legacy values only by comparing with the authenticated owner's stored draft,
  not a browser-supplied baseline. Normal valid choices require no extra read;
  exceptional historical values require at most one owner-scoped lookup per save.
  Indexless contact/sibling arrays retain at most the stored occurrence count of
  each historical choice, allowing deletion/reordering but not extra copies.
- FI4: blank sibling count stays unanswered, invalid/fractional counts show errors
  rather than silent clamping. Align total count with the existing backend 0–20
  bounds; at most 10 optional detailed sibling records, no silent count rewrite.
  Keep destructive confirmation. This aligns an existing constraint, not a new
  mandatory answer or database schema expansion.
- FI5: improve existing labels, filter non-community choices from specific-community
  suggestions, retain optional sections and existing historical option strings.
  No new required fields, contact prerequisites, eligibility, supported-country,
  Unicode/single-name policy, portfolio renderers, SQL or production writes.
- Checks: rendered field regression tests, shared/server authoring tests, API error
  propagation, browser persistence/forward blocking, existing consent and layout
  suites, type/lint/build, independent review. Earlier passing runs are historical.

### Current implementation and evidence

Authoring quality rules live in `authoring-choices.ts`, separate from broad
historical read schemas. Blueprint and Dashboard use the same rules; draft/publish
API failures carry stable field paths. The server obtains any legacy baseline
from the authenticated owner's repository, never from request data. The database
transaction, authorization, publication consent/review, liveness, geography,
private-contact visibility and photo guards remain unchanged. No SQL changes.
Self-described religion, community, diet and qualification stay bounded free text;
closed lists reject newly invented values without rewriting old saved answers.

Multi-select pending text updates the existing draft state before Add, retaining
the two-second debounce, in-flight serialization and revision/no-op protections.
Typed entries share existing list/count/length limits. Other inputs, origin aliases,
count and range controls have stable focus targets. Email uses shared syntax plus
the UI's existing 254-character authoring maximum; phone blur uses the existing
7–20-digit rule (syntax only, not ownership verification). External phone errors
stay associated without duplicating the interest form's summary announcement.
No OTP or Show interest authentication contract changed.

Fresh-context Codex review (model identifier unavailable), three rounds:

- FI-R1: ancestry alias incorrectly remapped to Current location, and old aliases
  survived explicit clearing. Reproduced; corrected mapping and explicit-edit
  alias synchronization, including a no-mutation-on-open check. Closed by reviewer.
- FI-R2: legacy contact relationships rejected after deletion shifted indexes.
  Reproduced; bounded per-array occurrence matching allows movement, rejects new
  unknown values/additional legacy copies. Closed by reviewer.
- FI-R3: rendered errors used initial props while Continue used latest saved data.
  Reproduced with save-clear-restore income; render and navigation now advance
  together after successful saves. Closed by reviewer.

Final reviewed source snapshot: `4636949c121afb8a24d0d01cbbbfd59d94620a07b4170562441a131aafda594e`;
verdict no material findings in reviewed paths; independent final 61 tests passed.
After that review, a message-only correction makes invalid sibling counts ask for
a whole number from 0 to 20 rather than characters/raw schema wording. Three tests
failed first, then all 64 focused tests passed; this final message delta is
self-reviewed, not represented as a fourth independent review. Review budget is
closed; normal PR/human review remains a release gate.

Current local verification on Node 24 / Next 16.4.1 / exact main lock:

| Check | Evidence |
| --- | --- |
| Full Vitest coverage, two workers | **207 files, 1,744 passed**; statements 85.89%, branches 81.82%, functions 86.15%, lines 89.37%; unchanged thresholds |
| Feature coverage | **63 feature files / 21 protected boundaries passed** |
| Focused corrections | 190 tests across six suites passed; final Blueprint/form-contract/choice run **64 passed** |
| Typecheck / build | Passed; optimized build generated 83 pages with loopback public configuration and Sentry delivery disabled |
| Responsive Chromium | Final **15 passed**, one worker, no retries; 320/390/768/1024/1440px in light/dark, all seven sections, pending text retained across navigation, required-field blocking, manual location with no lookup, consent/server refusal and footer/layout checks |
| Lint / static DB / dependency audit | Final repeats passed. Three existing moderate dev-tool packages, no high/critical or exceptions |
| Graph | Final AST refresh: 3,711 nodes / 8,728 edges; 27 unsupported files (including CSS) skipped, community names heuristically refreshed. Not a semantic audit of CSS/docs |

The full unit run overlapped the final sibling-message-only correction; that
affected helper and rendered consumers were explicitly rerun in the final 64-test
run. Earlier runs and snapshots below remain historical, not current evidence.
Browser cases use loopback fixtures, not real Supabase/customer records. No SQL
runtime, live email/provider test, physical-phone or screen-reader session claimed.

Delivery: local, uncommitted and unpushed. Next: separate app PR, unchanged CI gates,
preview review and real-phone UAT. **No database deployment is needed for this
increment.** Existing broad read schemas and stored option values are retained;
application rollback requires no database rollback. Name/country/eligibility
policy changes, extra mandatory answers and account-policy changes are deferred.

## Earlier presentation-only contract and execution context (historical)

October 21, 2026. Compact record: bounded presentation-only Standard change on
fetched main `d88f14e3602dc4ef33ce59dd16d066064f97fa45`.
Branch: `fix/nak-107-onboarding-mobile-clarity`.

Reduce repetitive explanations and strengthen grouping without replacing the
VivIntro fonts, theme, seven-section flow, portfolio presentation or safeguards.
The Blinq screenshots are clarity references, not a new brand or signup contract.

Verified locations: `BlueprintForm.tsx` owns section/field presentation;
`LocationFields.tsx` owns shared manual/search/confirmed location controls;
Dashboard owns the editor footer, navigation guard and debounced saves;
`form-contract.ts` owns the existing client/server name rules. No change to
name syntax, stored option values, schemas, SQL, required-contact policy,
authorization, publication consent, liveness, autosave or location providers.

Existing `Single` already displays **Never married**. Existing name checks reject
digits/symbols while allowing spaces, ASCII apostrophes/hyphens. Unicode/single-name
support remains a coordinated UI/API/SQL follow-up; do not silently strip characters
or promise support the database cannot accept.

## Acceptance and evaluations

| ID | Expected outcome / negative case | Evaluation |
| --- | --- | --- |
| MC1 | Clear section headings/group boundaries; optional badge replaces repeated introductory paragraphs; essential field hints only | Blueprint rendered tests; all seven sections, both themes, 320/390/768/1024/1440px screenshots and bounds |
| MC2 | Remove full-name paragraph beside inputs, retaining public full-name/guessable-link disclosure in the sharing group before final consent | Rendered section-7 disclosure test; existing publication/consent tests |
| MC3 | Education location says city, state/region, country; astrology has one short optional explanation, unchanged lock semantics | Rendered tests and optional-field tests |
| MC4 | Section 7 separates appearance, public sharing and optional contacts without redundant panels; appearance vs workspace distinction and recipient saving risk remain clear | Rendered group tests; existing contact/appearance/legacy sharing tests; responsive screenshots |
| MC5 | Manual entry is an underlined, focused 44px action before searching; provider notice remains before any external lookup; switching to manual makes no lookup | Location rendered/interaction test and browser keyboard/layout check |
| MC6 | Concise footer retains private-draft/review meaning and legal links; safe-area actions stay reachable | Dashboard tests and responsive bounds |
| MC7 | Invalid names remain visible/actionable, no silent filtering; numbers/markup rejected on client and server; incomplete private drafts and navigation/publication gates unchanged | Existing name contract and Dashboard suites, strengthened name cases |

Validation mode: regression-first copy/structure assertions plus passing
characterization of unchanged state/validation contracts. No new requests or
database writes are introduced. Browser persistence uses loopback fixtures, not
real customer records. No production edits, deployment, commit or push authorized.

## Progress and evidence

### October 22 continuation: complete editor action flow

Saved changes recovered onto latest main `a113a62`; original uncommitted work
retained in named Git stash `onboarding-mobile-clarity-pre-main-backup`.
Standard, compact presentation/navigation increment. Earlier test evidence below
is historical and does not certify this integrated version.

- MC8: persistent bottom Back/Continue on every screen size, using the existing
  `rememberEditorSection` validation gate. Last section replaces Continue with
  Review. Back never discards answers. No duplicate in-content primary Continue.
- MC9: Preview and Save draft remain secondary tools at the end of the section;
  early Review is secondary, while final publication stays in the consent dialog.
  Dashboard remains an explicitly labelled exit with the existing unsaved guard.
- MC10: section change resets only the editor scroller and focuses the new
  section heading without opening a keyboard; errors retain first-field focus.
- Evaluate bottom navigation at 320/390/768/1024/1440px in both themes, keyboard
  and missing-field blocking, optional-section passage, final review, draft
  no-op saving, footer/input bounds and retained publication tests.
- Non-goals: new mandatory fields, identity/account name synchronization,
  new dropdown storage values, SQL, provider settings or portfolio templates.
  Family and Astrology remain optional. No production or remote writes.

Design basis: existing VivIntro tokens and section/validation ownership; GOV.UK
button guidance (one primary action, descriptive labels), and Vercel Web Interface
Guidelines (focus, errors, safe areas), consulted October 22. No new UI library,
animation, database request or persistence path.

Contract recorded before runtime edits. Implemented locally; validation/review
in progress. Changed runtime: Blueprint, shared LocationFields, editor footer
copy and scoped form styles. Tests: Blueprint, location, name contract and the
existing responsive onboarding suite. Project map links this record.

Regression-first: six assertions failed on the original presentation (duplicated
introductory copy, old education wording, absence of groups and unobtrusive manual
entry). After correction, a retained Dashboard test caught manual-entry placement
stealing error focus from Search country. Reuse the existing preferred composite
focus marker on the search-country select; keep that original assertion unchanged.
The focused form/location/name/Dashboard run then passed 153 tests. A preceding
four-suite run also passed all 67 non-Dashboard tests after intended copy updates.

Local Next initially refused a dependency junction outside its filesystem root.
The task-owned junction alone was removed (the other worktree is intact) and an
exact-lock install completed. No framework configuration or dependency was changed
to hide that environment failure. Install/audit reports three moderate dev-tool
packages (Vitest/mocker/coverage), zero high/critical, in the unchanged main lock.
Dependency remediation is separate; no audit exception or automatic update added.

## Final verification — October 22, 2026

Verified locally on Node 24.18.0, Next 16.3.8, exact main lockfile. Fetched main
remains `d88f14e` at handoff. No dependency/CI/schema/generated-type change.

| Check | Final result |
| --- | --- |
| `npx vitest run --coverage --maxWorkers=2 --reporter=dot` | 201 files / **1,686 passed**; statements 85.68%, branches 81.68%, functions 86.13%, lines 89.22%; unchanged thresholds |
| `npm run coverage:check:features` | 61 feature files and 21 protected boundaries passed |
| `npm run lint` / `npm run typecheck` | Passed on final runtime |
| `npm run build` | Passed on final runtime; 82 static pages, loopback-only public configuration, no production provider credentials |
| `npx playwright test e2e/onboarding-foundations.spec.ts e2e/portfolio-editor-layout.spec.ts --project=chromium --workers=2` | Final **13 passed**; 320/390/768/1024/1440px × light/dark, all seven sections, plus layout and keyboard manual-entry cases; 109 screenshots |
| `npm run security:audit` | Existing policy passes: no high/critical and no exceptions. Three moderate dev-tool packages remain in unchanged main dependencies |
| `npm run db:smoke` / `git diff --check` | Passed; static database checks only, no SQL execution required/claimed for this presentation-only change |
| `graphify update .` | Code graph updated (3,634 nodes); last refresh found no topology change. CSS/doc semantics are not established by this AST-only update |

Full-suite correction MC-D1: the first full run passed 1,685 tests and failed the
shared 8px spacing contract on a new 6px legend padding. Corrected new CSS spacing
to 8px (including the narrow-fieldset padding), kept the check unchanged, verified
63 targeted tests, then reran the complete coverage suite successfully above.
The coverage-gate invocation immediately after that failed run lacked a generated
summary; it was not counted as a pass. Final complete coverage and feature gate pass.

Visual inspection: final 320px light/dark and 390px section-7 top/contact views,
320px Astrology, 390px manual location and 1440px Basics preserve the existing
fonts, tokens and surfaces. Country code and phone stack below 640px; larger
screens retain their aligned row. Small appearance buttons retain readable labels,
nonshrinking icons and selection checkmarks. Tests assert those bounds instead of
only checking the outer dialog. Public/private fields and projection stay unchanged.

Browser runs use loopback fixtures/mocked saves; they are not physical iPhone,
Safari, OAuth, provider-delivery or production database evidence. The dev fixture
emits expected unavailable-liveness diagnostics; an earlier browser pass also
logged a dev-server aborted-stream error. Assertions passed; no clean production
runtime claim is made. Existing negative-path unit logs/duplicate-key fixture
warnings are not hidden or represented as newly fixed.

## Independent review and freshness

Two fresh-context read-only rounds, Codex (exact deployed model unavailable),
isolated source copies rather than the mutable working tree. No source edits,
external calls, test execution or recursive delegation by the reviewer.

- Initial snapshot `ad5533f3ab3b04a0a7d8c8452255bdaa6d23ba18652a5f461d550f6f1f7a2082`
  at host temporary folder `vivintro-mobile-clarity-review-bbee7247173548ccad477cccb3b4c83b`:
  no material findings; top-of-section-7 proof and narrow phone readability were
  limitations, not falsely reported as verified.
- Return snapshot `3d65a8a5697d4acc8b8c555299735501c130395970bf91265ff56e30e65d0a34`
  at `vivintro-mobile-clarity-final-1449f7700c334556b60ceb80484da5aa`:
  independently inspected mobile layout corrections and final 320/390px proof;
  phone readability and top-of-section limitation resolved. Verdict:
  **no_material_findings**. All 1,124 packet paths matched before/after both reviews.
  Reviewer traced MC1–MC7, retained server validation/consent/projections and shared
  location callers. Execution results above are coordinator evidence, not reviewer runs.
- Provenance check passed on the final runtime before this results-only append.
  Reviewed runtime SHA256: Blueprint `0a2660771ac34b2cf22d158a9850a53f581791eb5ddbd7a15ba907c2df8d6732`;
  LocationFields `9535a6f0eb16e89815ee2adf072093f9f36a90798a8a462f24d3e1f3dfc7ad3f`;
  Dashboard `a92ada47e2c7ebbd8693152202ee6dc79a06a2ebeea8e18e7048d2125a48b124`;
  CSS `d6dbbadd9a90db749a2b4331bfd2334864e1e8cbe771ff705be61a9a9ab8afa8`.

## Outcome and boundaries

MC1–MC7 pass the scoped evaluations. Ten changed/created files: four runtime
presentation files, four test files and two documentation files. No public
portfolio template, SQL, name syntax, eligibility, mandatory-field count, private
contact requirement, saves, provider configuration or account identity changed.
Optional examples remain collapsed; critical DOB, location-provider, private-field,
income/contact and public-name/link disclosures remain. No PDF or password-reset
changes included. No new API request or database-backed dropdown is introduced.

Status: **Verified locally; not committed, pushed, merged or deployed**. No database
migration is needed for this increment. Hosted CI and physical-device verification
remain separate release checks; the moderate dev-tool dependency follow-up remains
visible. Rollback is presentation-only; no customer data needs rewriting/removal.

## Current integrated handoff — October 22

Base `a113a62` (merged #126), uncommitted branch above. MC1–MC10 implemented.
Bottom navigation reuses the existing forward-validation gate; final Review is
primary only on section 7. Secondary Preview/Save/early Review live at the section
end. Dashboard exit remains guarded. Focus is an editor-owned React effect,
not a delayed global DOM callback that could target a later editor instance.
At narrow widths exit controls have a separate row; the entire save status stays
readable. The layout contract now checks labelled 44px exit bounds, no header
overlap and at least half a 667px screen available to answers, rather than requiring
the title and the newly labelled exit to share a row. All section-7 privacy
disclosures remain; no public portfolio renderer or data/security rule changed.

Current evidence (not the earlier d88f14e results):

- Focused Blueprint/location/name/Dashboard: **157 tests passed** after focus changes.
- Full unit run: **1708 passed, one timeout** in unchanged hybrid lint configuration
  parity test for `src/app/page.tsx` (20s). Isolated unchanged-deadline rerun of
  hybrid-lint + shared-presentation: **35 passed** in 5.78s. This is not claimed as
  an entirely green single full-suite run; hosted CI remains required.
- Source review against the shared spacing check identified new 12px button padding. Changed it to 16px,
  preserving the check; its three assertions pass and affected layout rerun passes.
- Chromium browser: **19 passed** in 4.6m, one worker, 90s scenario budget; individual
  assertion deadlines unchanged. Covers 320/390/768/1024/1440 × light/dark, all
  sections, bottom controls, validation, saves, manual location, consent/server
  refusal, hydration and review background/focus isolation. Final padding correction
  followed by **2 passing layout cases** across four widths (44s).
- Earlier exploratory browser failures: a test-local variable shadowed the footer
  locator (fixed), a cramped labelled header (fixed), and dev HMR during writes /
  default 30s multi-section scenario timeouts. No product guard was bypassed.
- Initial concurrent coverage run interrupted after failures; no current full
  coverage result is claimed. Coverage floors/gates are unchanged and remain CI gates.
- Production/full audit: no high/critical findings, no exceptions; three existing
  moderate dev-tool packages remain. Static `db:smoke` and diff whitespace pass.
- Graph AST refreshed (3682 nodes). CSS/docs are outside AST semantic coverage.
- Lint passes after moving task-generated custom build artifacts outside the repo;
  no lint exclusions added. Final build/typecheck/lint confirmation recorded below.

Self-review: canonical validation/persistence ownership retained; standalone
Blueprint navigation defaults unchanged, dashboard opts out of duplicate controls;
no new database reads/writes, packages, migrations or stored option values. No
production provider, email, physical device, Safari or assistive-technology session
was exercised. Family/Astrology and new mandatory-field policy remain unchanged.

Release status: **local changes only**. Next is a separate app PR with normal CI,
preview review and real-phone UAT; no database deployment is needed. Historical
independent review above does not certify this newly integrated navigation diff.

Final confirmation: default `npm run build` (Next 16.4.1, 83 generated pages),
`npm run typecheck`, `npm run lint` all passed in sequence on final runtime;
`git diff --check` passed. Generated Next heading/custom-build type-path edits
were removed; no intended AGENTS/TypeScript configuration change. Final mobile
320px proof visually inspected after the spacing correction. The full unit run
overlapped that CSS-only correction; shared-presentation was explicitly rerun on
the final CSS, not inferred from the wider run. CI coverage remains pending.
