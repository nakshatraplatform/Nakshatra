# Dashboard, review continuity and canonical geography

## Execution context

Release continuation on 2026-10-08: the owner requested delivery to main and assigned
NAK-105. Branch: `fix/nak-105-dashboard-geography-release`. Latest main `e7b0d74`
adds NAK-73 liveness completion; integration preserves its server-authoritative
verification refresh and completion callback on the single relocated liveness panel.
Both dashboard test sets are retained with current action vocabulary. The earlier
reviewed source remains historical evidence, not coverage of this new integration.
An independent bounded integration review is required for these new merge paths,
not a restart of the exhausted dashboard defect-correction cycle.

Production rollout must remain schema-first because Vercel does not wait for CD.
Prepare a database-only NAK-105 PR containing the three forward migrations and
their pgTAP tests, validate/merge/apply it through protected CD, then merge the
dependent application PR after its own checks. No production SQL is applied by
local checks. The unrelated NAK-102 feature-record edit remains uncommitted.
Pre-push cannot run the prior Windows-incompatible workflow tests: eight failures
were reproduced. Normalize checkout CRLF and select installed Git for Windows
Bash for these test subprocesses; all ten original deployment-safety assertions
now run and pass without exclusions. Linux keeps `/bin/bash`; production workflow
and secret handling are unchanged. Full integrated validation is pending below.

Integrated local validation: 1162 tests / 162 files pass with no exclusions;
global coverage and all 57 governed files pass. Lint/typecheck and production
build (79 routes) pass. All ten workflow assertions pass after the Windows
portability fix. Database fixture smoke passes; actual Supabase runtime remains
unavailable locally. Security audit has no production high/critical findings,
but retains the existing development-only exception expiring 2026-10-09 00:00
New York; it is not a fix. Hosted CI and schema deployment remain release gates.

Approved by the owner on 2026-10-07. Base: origin/main 59dcc0b. Full record,
Critical tier because this includes additive migrations and owner-only state.
Original implementation authorization excluded deployment, production writes,
bypasses and landing changes; the later main-release request is recorded above.
Linear connection `linear_phoenix` is unavailable in this session; issue assignment
and durable Linear synchronization remain pending. No issue number is invented.

## Contract and design

1. Edit is directly available for every editable saved portfolio, including an
   unpublished one. Sharing is explicit Copy link / Share on WhatsApp and only
   offered for an active published Introduction.
2. One publishing journey sits above activity. Required-answer completion is not
   labelled overall publication completion. Liveness navigation targets the one
   existing owner verification component without first repeating previews.
3. Both preview openings are remembered for the same saved review revision across
   review close/reopen and reload. Changed answers, photos, photo visibility/order
   or horoscope invalidate review. Consent remains a separate explicit action;
   verification, ownership, account entitlement and protected-viewer gates remain.
4. Canonical geography uses existing ISO country codes, administrative region
   codes and GeoNames city IDs. Validate IDs and hierarchy at the database boundary,
   persist candidate IDs, and never infer a city from a duplicate name. No postal,
   street, Google API or discovery-feature additions.
5. Manual/unmatched legacy labels remain readable and editable. No fuzzy migration
   of private data or modification of published snapshots. Unknown source-region
   codes in reference imports are retained separately, not invented as regions.
6. Field sequence groups identity, current location, profession/introduction, then
   photos; education precedes career; birth place precedes birth time. Keep current
   stable section IDs, saved navigation, required fields and privacy classifications.
   Marital Status moves from Personal story to Basics (the readiness resume mapping
   changes with it); Personal story becomes explicitly optional. No requirement is removed.

## Architecture / verified locations

- `src/app/dashboard/dashboard-client.tsx`: owner workspace and review dialog.
- `src/components/portfolio/BlueprintForm.tsx`: section order and field grouping.
- `src/components/portfolio/LocationFields.tsx`: dependent reference selection.
- `src/features/portfolio/server/publication-readiness.contract.ts`: safe projection.
- `supabase/migrations/20261003150000_pilot_test_publication_exemption.sql`:
  current owner readiness and progress commands; all live exemptions previously revoked.
- `supabase/migrations/20261003130000_b2c_self_created_pilot.sql`: guarded atomic save.
- `scripts/import-geonames.mjs`: country/region/city reference import, no user data.

## Evaluations

### 2026-10-08 presentation follow-up

Standard-risk, bounded presentation increment requested by the owner: adjacent
Edit details / Review and publish actions; no editing shortcut inside final review;
clear preview and next-step vocabulary; hints below controls; inline accessible
lock labels and one visible privacy legend; wrapping editor/review footers and
improved light-theme muted-text contrast. Preserve existing validation, required
fields, per-view evidence, liveness, publication consent and authorization.
No new schema is added by the presentation increment. The owner explicitly
authorized extending the exhausted review cycle on 2026-10-08 to fix and independently
recheck DG-R006 before PR preparation. The overall change retains its Critical tier.
The extension permits a bounded additional cycle (at most three rounds). Overall
rounds 4–6 / extension rounds 1–3 are complete. The final source review resolves the
remaining findings on inspected paths; it does not authorize deployment.

- U1: dashboard actions ordered edit then review; review returns to dashboard,
  not directly to editing (component/browser tests).
- U2: hints do not displace controls in a row; protected labels have accessible
  meaning and a visible shared legend (form component/browser checks).
- U3: all footer actions fit 320/375/768/1024/1280/1440 widths and reduced-height
  zoom-equivalent viewports; no horizontal overflow (browser geometry checks).
- U4: review wording is consistent; consent remains unchecked and guarded;
  representative muted text/background pairs pass 4.5:1 (component/browser checks).

DG-R006 correction reloads authoritative answers before adopting a review hash when
local media invalidated the known revision. Intentional saves retain their returned
hash for the immediate progress comparison, and a newer local edit during a save
prevents review opening. The editor Preview entry follows the same no-unnecessary-save
rule as final review and records a current public-preview opening. Regressions include
local-media/remote-answer changes, ordinary stale editor previews, save-to-review
races and local edits during an in-flight save. The stale editor preview and
save-to-review regressions were observed failing before their corrections.

The editor also traps keyboard focus, supports Escape, restores trigger focus and
makes the background inert while editor/review dialogs are open. U3 intentionally
uses autosave-only mobile actions below 640px (Preview / Review and publish);
Save draft remains visible at desktop widths including 640x450. Useful hints stay
beside their controls, not solely in Terms. Privacy descriptions remain available
to assistive technology for individual inputs and grouped controls.

Follow-up local browser checks: five Chromium scenarios passed, including seven
viewport sizes, keyboard return, four rendered normal-text contrast pairs in each
theme, dashboard preview continuity and explicit unchecked consent. These are
mocked local application checks, not a live Didit or production certification.
Typecheck/lint and production build pass. The earlier presentation coverage run passed
1109 tests in 157 files, excluding only the unchanged Windows-incompatible
`tests/cd-workflow.test.ts`; this is not a full-suite pass. Subsequent correction
and independent-review results are recorded below. Runtime database gates remain open.

| ID | Expected / wrong implementation rejected | Evidence |
| --- | --- | --- |
| D1 | Unpublished owner edits directly; missing button fails | Dashboard component tests |
| D2 | Current previews survive reopening, stale revision does not | Component + pgTAP tests |
| D3 | Liveness accessible without preview repetition; no consent auto-accept | Dashboard tests |
| G1 | Cross-country/region and unknown IDs rejected atomically | pgTAP geography tests |
| G2 | Canonical IDs project to candidate; manual labels survive | pgTAP save + fixtures |
| G3 | Duplicate city names cannot silently choose first match | Location component tests |
| F1 | Field/section order follows contract; stable IDs preserved | Form component tests |

## Delivery / recovery

### Authorized review extension: atomic recovery boundary

Overall round 4 / extension round 1 inspected snapshot
`8f1d8553ce6ab632d5932f6750590a36fedf2d6b74a5e6fa68cd15cd5e282e2c`
with start/finish provenance current. Verdict changes required: DG-R006 remains
reachable in the two-read dashboard loader, pairing draft A with readiness B.
DG-GAP002 is a confirmed pre-existing G2 acceptance gap for unmatched saved countries
(South Africa/Gauteng/Johannesburg with an empty directory). Independent evidence:
169 maintained tests, five Chromium scenarios, fixture smoke and nine scratch checks;
two scratch checks deliberately assert defect evidence, not acceptance.

Correction design: an additive owner-only, live-session-guarded STABLE RPC returns
the explicit dashboard portfolio/media/horoscope projection and publication readiness
in one PostgreSQL statement snapshot. No new table, privilege, bypass or public
projection is introduced. The loader must not fetch revision evidence separately
when using this snapshot. Missing-RPC compatibility keeps existing editing/read
projections available but clears review hash, per-view markers and disclosure;
unbound modern or legacy evidence must not be accepted. Apply migration before app
rollout. A country absent from the directory remains a manual label with editable
descendants; choosing a canonical parent clears incompatible descendants, never
guessing identifiers.

Evaluations: loader A/B interleaving must return bound A+A and skip independent
answer/media/readiness reads; missing RPC must fail closed for review while retaining
editing. Malformed/foreign-owner snapshots must not be adopted. PostgreSQL tests
must cover authenticated owner scope, anonymous/revoked-session denial, explicit
projection, STABLE semantics and matching fingerprint. Legacy country tests must
display/edit labels with an empty directory and allow explicit canonical correction.
Runtime SQL replay and clean generated-type comparison remain blocked locally.

Implemented locally: `dashboard-review.contract.ts`, repository snapshot RPC and
`dashboard-view.service.ts` consumer; forward migration
`20261008120000_atomic_owner_dashboard_review.sql` and 13-assertion pgTAP fixture;
manually aligned generated types and loopback browser fixtures. Snapshot payloads
are runtime-validated, checked for the current owner and attachment parent IDs;
denied/malformed responses do not trigger legacy fallback. Only PGRST202 (missing
RPC) permits separately loaded editing data with review evidence cleared. The SQL
projection remains explicit and excludes unrelated attachment linkage/private
integration evidence. No service credential is introduced.

The loader A/B, unbound legacy evidence and unmatched-country checks were observed
failing before implementation. Correction validation on 2026-10-08: 1117 application
tests / 157 files pass with the unchanged Windows-incompatible CD-workflow file
excluded; feature coverage passes all 56 governed files, global thresholds pass,
lint/typecheck pass, build generates 78 routes, five Chromium scenarios pass, and
database fixture smoke passes. Browser fixtures now exercise the atomic loader.
SQL runtime checks remain blocked, not passed. Atomic reload and legacy-country
findings were implemented pending the independent return review recorded below;
these coordinator checks alone were not treated as resolution evidence.

Round 5 / extension round 2 inspected snapshot
`dfc3f747e97a0c1db98dd38360c95685dd8a096d5ec32bf93850e07fec99356c`
with current start/finish provenance. The atomic reload correction passed inspection
and independent loader/client interleaving tests; PostgreSQL calling-query STABLE
semantics were checked against official documentation, not runtime-certified.
Two residual obligations retain their IDs: DG-R006 at missing-RPC -> intentional
hashless-save -> hashless-progress adoption; DG-GAP002 at clear-and-retype replacing
the implicitly displayed manual input. Independent checks: 180 maintained tests,
five browser scenarios and fixture smoke pass; three expected rejection/editing
assertions fail, plus two wrong-outcome traces confirm defects. Report remains
immutable outside source.

Bounded correction: preserve the initial projection's versioned/unbound mode
independently from optional save/progress payloads; that mode requires a present,
matching saved and fresh hash before review. Legacy component projections stay
compatible, but a deliberately null loader projection cannot be downgraded to
them. Manual country mode latches on focus/edit and persists through blank values
and exact directory names until the user explicitly selects the directory.
Six maintained versioned/missing-RPC save-entry regressions and a stateful focused
country regression were observed failing before these corrections. Findings remained
open until the final authorized return review recorded below verified them.

Final correction validation: 1124 application tests / 157 files (same unchanged
Windows CD-workflow exclusion), 56-file feature coverage and global thresholds,
lint/typecheck, build (78 routes), five Chromium scenarios and fixture smoke pass.
The subsequent copy-only change makes stale/missing-version recovery accurate
without assuming another tab caused it; affected dashboard tests and build are
rechecked for that final wording. Graphify AST update succeeds without API usage;
SQL AST extraction is unavailable (`tree_sitter_sql` missing), so SQL inspection is
direct and runtime SQL gates remain pending. These coordinator results were not
treated as independent source-review acceptance or release authorization.

Overall round 6 / extension round 3 reviewed implementation snapshot
`99106eb0228b35b79b423ec7a2eca4c6c27eaf4db40d1f9787ed3a0a0462b3f3`.
The same fresh-context return reviewer `/root/dashboard_review_extension` reported
**no material source findings on inspected paths**; exact model identity is unavailable,
and this is not a cross-model claim. Start, finish, post-report and coordinator
provenance checks were current. Independent current evidence: 187 maintained tests
in 15 files, 36 unchanged expected-correctness regressions, 30 additional hash-boundary
and manual-focus regressions, five Chromium scenarios and fixture smoke all pass.
Two historical scratch tests asserting the old wrong outcomes were intentionally
not selected; no valid acceptance test was excluded or weakened.

DG-R006 and DG-GAP002 are resolved for this inspected source snapshot. The final
review traced production readiness consumers and compared the full manifest;
atomic SQL and other unchanged boundaries retain the prior structural evidence,
not a new runtime certification. Immutable packet and report are outside source:
`C:/Users/Lenovo/AppData/Local/Temp/dashboard-geography-review-20261008-extension3.json`
and `C:/Users/Lenovo/AppData/Local/Temp/dashboard-geography-review-20261008-extension3-report.md`.
This subsequent feature-record reconciliation is documentation-only, not a claim
that previous checks ran on a new manifest. The authorized extension is exhausted.
No commit, push, PR, deployment, live database mutation or bypass was performed.

Migrations before app rollout; old projections/clients retain compatibility.
Do not rewrite or republish historical snapshots. New nullable candidate columns
are additive; rollback app first, keep additive schema and review evidence. Import
requires explicit operator execution and existing server-only credentials. No
production import or SQL is executed by this task. Local database availability,
full checks and fresh-context review must be recorded before release readiness.

## Progress

### NAK-105 integration correction (2026-10-08)

The integrated main branch passed 1,162 unit tests without exclusions, coverage,
lint, typecheck, production build, database fixture smoke, and ten mocked Chromium
scenarios. These establish local behavior, not live provider or SQL execution.
Independent integration review found NAK105-R001: including verification status
in the server page key remounted the editor on Didit completion and discarded
unsaved answers. Remove only that non-content revision input; retain saved-content
and review-fingerprint invalidation. A maintained regression renders the actual
server page, edits an answer before autosave, and refreshes verification props.
It failed before correction and passes afterward; 90 focused tests and typecheck
pass on this correction. Independent return review 1 resolves NAK105-R001 on
snapshot `48d5d601cb32e366c07733a7235507a62a82a1fe46c5fbc7c855361e05d5c973`:
102 maintained tests plus an independent actual-page regression pass, including
explicit checks that saved-content/fingerprint changes still change the key.
Reviewer identity `/root/nak105_release_integration_review`; model unknown,
fresh-context initial review, same-context return (not cross-model). Report:
`C:/Users/Lenovo/AppData/Local/Temp/nak-105-release-return-report.md`. Final
pre-push validates 1,163 tests / 162 files, typecheck and fixture smoke without
exclusions. This subsequent documentation-only update does not relabel historical
coverage/build/browser runs as fresh; hosted CI validates the final PR revision.

The two NAK-105 migrations have not been applied by this task. Their versions are
now 20261008100000 and 20261008101000, following main's 20261008050441 and preceding
the atomic snapshot migration 20261008120000. Bodies are unchanged. This avoids
inserting older migration versions behind main and does not broaden CD flags.
Schema-first release remains mandatory: schema-only PR and hosted SQL checks,
merge, protected production CD preview/history inspection and authorized apply,
then application PR. No production migration or deployment has been verified.

Schema PR: https://github.com/nakshatraplatform/Nakshatra/pull/91
Application PR: https://github.com/nakshatraplatform/Nakshatra/pull/92
Both are pushed; main merge and production application remain gated. No unrelated
NAK-102 document edit is included.

Hosted SQL validation of schema commit `999684f` replayed migrations but found
NAK105-R002 (introduced test-fixture defect): two new photo fixtures used paths
outside their owner's namespace and aborted before assertions. Paths now begin
with their matching portfolio user's UUID; the expected snapshot path changes
with the fixture. No trigger, grant, assertion count or access rule is relaxed.
The canonical geography suite passed in that hosted run. Corrected full pgTAP
and final independent structural return review remain pending before merge.

Implementation is local and uncommitted. Current residence gets canonical IDs;
birthplace, work/education location and family origins remain optional labels with
their established visibility. No new private address data is collected. Browser
publication uses database-normalized saved labels for reference selections, not
untrusted submitted labels. Review fingerprints exclude technical timestamps and
generated preview metadata; they include draft content and visible attachment facts.

Historical initial-cycle checks: typecheck, lint and database fixture smoke passed.
Round-2 unit coverage excluding
the unchanged Windows-incompatible CD-workflow file: 1101 tests pass; feature
coverage passes for all 55 governed files. Earlier full execution had eight failures
in that unchanged file (CRLF assumptions and /bin/bash); Linux CI must establish
the authoritative full result. The exclusion is not a full-suite pass.
Local Supabase execution is blocked: neither Docker nor Podman is installed. The
generated public types were aligned manually with the additive schema; regenerate
and compare them on the clean database before release. Browser QA covers mobile
and desktop draft editing, direct liveness navigation and published share controls;
preview continuity uses mocked owner requests and does not certify real protected
photo rendering or provider verification. Four Chromium scenarios and the
production build pass after round-1 corrections. Final correction checks also pass:
1103 application tests excluding the unchanged CD-workflow file, feature coverage,
lint, production build and four Chromium scenarios. The original final review required
changes for DG-R006; the authorized extension and its final resolution are recorded
above. These historical results are not a deployment/readiness claim.

Known release gates: clean database migration replay and pgTAP (including all three
new suites), generated-type regeneration/comparison, full Linux checks, real
liveness/return-to-review and protected-media smoke, durable Linear synchronization,
and explicit owner release authorization. Source review is complete on inspected
paths. Reference imports are a separate operator
action after migration; manual entries remain available without a complete import.

## Independent review resolution ledger

Round 1: fresh-context reviewer `/root/dashboard_geography_review`, exact model
identifier unavailable; snapshot `b9e227a84f9cfd637e33f2ff9cb415bf53359d24be44c12db241abaafe20d10d`
against main `59dcc0b3044ef7633393b21d3f2c2d5c646bcd74`. Verdict changes required.
Source remained unchanged during that review. Round 2 reviewed snapshot
`b20411f930ffe9867de061dedce4adc0aed73a2a81e25d9e5d1a8a28b491a259`:
117 focused tests and smoke passed; DG-R001–005 and DG-GAP001 inspected corrections
were verified (DG-R004 remains structurally verified only). Two further stale-tab
findings required changes. Round 3 is the final bounded return review; no release
authorization is implied.

Round 3 reviewed implementation snapshot
`d2937b5d0fd932de10f8e7ffc64cff359bd370aec7626f42c15ece98c4e13867`;
119 focused tests, fixture smoke and start/finish provenance checks passed. Verdict
**changes required**: DG-R006 remains reachable after a photo-only local edit
clears the known hash and another tab changes answers. The review limit is reached;
implementation was paused pending a further authorized correction/review, subsequently
completed in the extension above. No PR,
push, live database change or deployment was performed. This progress reconciliation
is documentation-only after the reviewed implementation snapshot. DG-R001–005,
DG-R007 and DG-GAP001 were verified on inspected paths; runtime SQL is still blocked.

| ID / severity / materiality | Classification / origin / criterion | Evidence and correction | Disposition / verification |
| --- | --- | --- | --- |
| DG-R001 / medium / material | Confirmed / introduced / D2 | `dashboard-client.tsx` stale hash repeated after close/reopen. Refresh readiness before opening; stale server rejection closes review and refreshes the server page keyed by fingerprint. Do not save old local answers as recovery. | Verified in round 3 on inspected recovery path; combined case remains R006. |
| DG-R002 / medium / material | Confirmed / introduced / D2 | Media-only edits cleared the hash and entered legacy fallback. Refresh the saved media revision before showing review; null modern fingerprint cannot use legacy markers. | Verified in round 3 on ordinary media-only path; combined remote-answer case remains R006. |
| DG-R003 / medium / material | Confirmed / introduced / G1,G2 | `LocationFields.tsx` regionless city omitted country parent for legacy labels. Always persist selected city country, independent of region. | Verified in round 3; Singapore legacy/regionless regression passes. |
| DG-R004 / medium / material | Confirmed / introduced, test-only / G1,G2 | Geography SQL helper omitted existing atomic-command object requirements. Added visibility settings and astrology/lifestyle/preferences objects. | Structurally corrected and fixture smoke passes; actual pgTAP blocked by missing Docker/Podman. |
| DG-R005 / low / nonmaterial | Confirmed / introduced, test compatibility / D1,D3 | Server-page mocks omit readiness. Revision key now has fail-closed defaults and includes review hash. | Verified in round 3; all 23 server-page tests pass. |
| DG-GAP001 / medium / material acceptance gap | Pre-existing / pre-existing / D2 | Overview previews did not record evidence. Both dashboard entries now open a new tab and record per-view evidence for the saved revision. | Verified on inspected entries in round 3; component and mocked browser continuity pass, overlapping requests pass. |
| DG-R006 / medium / material | Confirmed / introduced / D2 | Media invalidation, separately read answers/readiness and hashless saves could combine stale answers with newer or unbound evidence. Atomic owner snapshot binds the read; initial binding requirements survive optional save/progress payloads, and present matching hashes are required before review. | Resolved on inspected paths in overall round 6, snapshot `99106eb0228b35b79b423ec7a2eca4c6c27eaf4db40d1f9787ed3a0a0462b3f3`, report checks C1–C5. Independent negative and positive save/preview boundary regressions pass. Runtime SQL remains a separate pending gate. |
| DG-R007 / medium / material | Confirmed / pre-existing / D2 | Reviewing an unchanged editor saved stale local answers before checking the remote revision. Save only locally unsaved answers (or first draft), otherwise compare server revision first. Only an intentional save may allow expected hash change. | Corrected and verified in round 3; unchanged-editor regression passes. |
| DG-GAP002 / medium / material acceptance gap | Original gap pre-existing; first correction introduced focus regression / G2 | Unmatched countries were hidden/disabled; clearing or typing an exact directory name then replaced the manual textbox. Keep unmatched labels editable and latch manual mode on focus/edit until an explicit directory switch; never invent canonical IDs from text. | Resolved on inspected paths in overall round 6, same snapshot, report checks C1–C4. Stateful keyboard and no-focus change regressions pass, including explicit canonical switch and descendant clearing. |

Detection lesson: technical timestamps must not invalidate content review, while
attachment visibility and changed answers must. Check every supported preview
entry and media-only edit path, not only the final dialog. Preserve the regression
tests here when modifying onboarding; SQL smoke alone is not database validation.
Also keep a known saved hash until authoritative answers/media are reloaded, not
merely until any progress request returns a newer hash. Unchanged review navigation
must not write draft answers. Dashboard-level failures must be announced even when
no editor or review dialog is open.
Initial modern or deliberately unbound review mode must survive optional API
fields; missing hashes cannot downgrade it to legacy review. Keep positive matching
save cases alongside rejection cases. Manual controls must preserve DOM identity
and focus through blank/exact-name values until an explicit mode switch; keep
stateful keyboard regressions, not only static value assertions.
