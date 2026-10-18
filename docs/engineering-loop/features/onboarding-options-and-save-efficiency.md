# Onboarding options and save efficiency

## Contract

October 17, 2026. Significant tier: shared UI options and concurrent persistence.
Extend local onboarding foundations on `fix/nak-107-onboarding-save-stability`;
preserve previous uncommitted work. User authorizes meaningful proposal changes,
with existing design/safeguards and reduced database traffic. No deployment,
commit, push, PDF, mandatory sensitive answers, eligibility or matching changes.

1. Keep established fonts, tokens, form sections, field constraints and blank
   optional answers. Static option lists/search require no database request.
2. Use familiar labels while preserving stored values. Improve work/education,
   currency/diet/horoscope wording; retain old answers. Remove Only Child from
   new choices without deleting historical data. Sensitive taxonomy remains
   non-exhaustive and optional; Other uses the existing bounded string field.
3. Preserve self-description when temporarily selecting a listed answer and
   returning to Other during the same editor session. Do not add private data
   storage to localStorage. No silent income reinterpretation on currency change.
4. Private autosave uses a two-second idle debounce, skips locally malformed
   intermediate answers and unchanged existing drafts. Manual retry remains.
   At most one draft save may be in flight; preserve newer keystrokes and do not
   restore stale disclosure consent. Do not publish while work is unsaved.
5. Repeated section selection does not write progress. Debounce navigation and
   serialize progress writes, keeping only the latest pending section. Old
   responses must not move the current UI backward. No automatic retry loop.
6. Keep authenticated owner-scoped atomic backend saves, limits, liveness,
   canonical geography, photo/access checks, revision-bound consent and privacy
   projections. Optimizing client traffic is not permission to bypass them.

## Evaluations before implementation

| Criterion | Case and expected result | Wrong implementation rejected |
| --- | --- | --- |
| No-op save | Existing saved draft, repeated Save draft: zero writes | Every click rebuilds relational records |
| Save coalescing | Delayed save, overlapping attempt/new edit: one active request, latest edit retained | Parallel requests finish out of order |
| Idle batching | Rapid text entry: one request after two seconds; malformed intermediate answer: none until corrected | Request per keystroke or rejected-input loop |
| Progress batching | Same section repeatedly: zero; rapid valid navigation: one final write; delayed responses preserve UI | Duplicate or stale progress writes |
| Choices | Native select, Other, temporary alternate, section return, legacy value | Unknown value erased or user forced into wrong category |
| Financial meaning | Currency change with range: explicit confirmation/reset | Existing amount silently becomes another currency |
| Compatibility | Existing authoring/publish/privacy tests and responsive themes | UI-only relaxation of backend safeguards |

Tests: Dashboard and Blueprint component regressions, option helper tests,
existing API/schema/publication suites, full coverage/static/build and responsive
loopback Chromium. Measure transport request counts in synthetic interaction
tests, not a claim about production SQL latency/capacity. Existing street/minimum
SQL changes still require authoritative database CI and separate deployment.

## Execution context

`BlueprintForm.tsx` owns controls; `blueprint-options.ts` stable option values;
`dashboard-client.tsx` owns autosave/section progress; `dashboard.service.ts`
maps each draft to one guarded atomic RPC that syncs candidate/family/work data.
Baseline: autosave 1400ms, section debounce 300ms, explicit Save always writes,
no in-flight promise guard. Prior runtime verification: 1423 unit tests passed;
that is historical evidence, not validation of this increment.

## Implemented increment

Shared static registry keeps stored values stable: Single displays Never married;
Part-time is available; qualification and diet labels explain unfamiliar wording;
currencies show code/name; horoscope preference describes importance, not a bare
Yes/No. INR uses lakh/crore annual bands. Other currencies retain existing numeric
bands with readable amounts and currency labels; this is not a currency conversion
or country-based income inference. Existing unknown/old income values remain selected.

Community uses an explicit native select with conditional Other (150 characters),
not an invented universal caste registry. Religion, qualification, diet (100) and
currency (20) also reuse bounded existing scalar fields for Other. Session memory
recovers temporarily deselected text across section navigation; no extra persistence
or localStorage. Selected answers use ordinary owner-only draft saves. A legacy
unknown answer opens as an editable self-description; opting out remains possible.
Only Child is no longer offered to new users; a historical selection remains visible.
Reducing a populated sibling list and changing a currency with an income range
require confirmation. Cancel preserves data; confirmed currency change clears only
the range, not other work answers. Income opt-out no longer erases the currency.

Dashboard saves batch after two idle seconds. The same shared draft schema checks
malformed supplied answers locally; it does not require a complete private draft.
Manual saves still reach server validation when unsaved. Same-value section updates
do not mark work unsaved. Existing saved drafts send no redundant Save write.
One promise gates manual/autosave overlap. New edits during an in-flight save are
retained and scheduled after completion; revision checks still invalidate stale
consent and prevent publication of an unsaved revision. Failed autosaves do not
loop on the same revision; manual retry remains available.

Section resume writes batch after 800ms and retain one latest pending target while
one write is active. Re-selecting the current/persisted section is a no-op. A late
response updates the saved resume position without replacing newer form navigation.
Transport failures do not loop, and unmount clears pending timers. This path stores
only noncritical resume position; draft data and consent remain separate guarded
operations. No server API/RPC, authentication, same-origin/body-size/rate-limit,
geography, photo, liveness or publication eligibility checks were removed.

Location search already debounces 300ms, requires two characters and aborts stale
requests (`LocationFields.tsx`); preserved rather than adding duplicate lookup code.
Option selection/search is local, with no database-backed dropdown endpoint.

## Design comparison

| Before | After |
| --- | --- |
| Bare/technical dropdown wording and free-text community datalist | Familiar labels, explicit Other field, unchanged existing form surfaces |
| Currency code only; ambiguous scale | Currency name/code and readable annual ranges; explicit reset confirmation |
| Silent truncation of filled sibling rows | Native confirmation, cancel retains all answers |
| Every unchanged Save repeats full relational synchronization | No write for an already-saved existing draft; same visible controls |
| Short debounce and overlapping progress requests possible | Two-second idle draft batching and serialized latest resume position |

No CSS, fonts, theme tokens, portfolio navbar, hero artwork or section architecture
changed. More fields appear only when Other is chosen. No new icons-only labels.

## Review / evidence

- Red/green: unchanged Save and current-section selection each previously made one
  write; both now make zero. Currency/sibling confirmations and bounded community
  recovery tests failed before implementation and pass afterward.
- Focused `npx vitest run tests/dashboard-client.test.tsx tests/blueprint-form.test.tsx
  --maxWorkers=2 --reporter=dot`: 113 passed. Tests cover rapid entry, intermediate
  malformed input, slow save/newer edit, latest pending section, failed progress,
  same-value saves, legacy scalar recovery and currency/sibling confirmation.
- Synthetic rapid typing produces one request after idle, not one per input;
  slow-save test has one active write and then saves the newer version. These
  transport counts do not measure production SQL duration or maximum capacity.
- Fresh-context review: `/root/onboarding_options_efficiency_review`, model identity
  unknown, isolated immutable source plus separate dependency-linked test scratch.
  Verdict no_material_findings; independently ran 113 focused tests. Final browser
  test extension statically reviewed; broader checks remain coordinator evidence.
- Reviewed snapshot: `C:/Users/Lenovo/AppData/Local/Temp/vivintro-options-save-review-861dae83e33041c7995801bc02f748b7`.
  Baseline `fc7f55c` / preceding reviewed local increment; local `main` is an older
  ancestor, not a refreshed remote-main reference. No remote operations performed.
- SHA256 runtime: Dashboard `3e1e7aa478561046970d4558c3cff5798be94290446adefc876da9b8188c6027`;
  Blueprint `02e7601befb2f3880bfc8ef9e614ad8c1d920781469c720abd932b5a787c2fba`;
  options `3e7c7c5db8b8d85343b6851eed1a1a720687eca2019efce024a36eca33c7e09f`.
- Lint, TypeScript, loopback production build (81 static pages) and `db:smoke` pass.
  Full coverage, final responsive screenshot pass and Graphify results recorded below.

Final coordinator verification on unchanged reviewed runtime, October 17:

| Check | Result |
| --- | --- |
| `npm run lint` / `npm run typecheck` | Passed |
| `npx vitest run --coverage --maxWorkers=2 --reporter=dot` | 185 files, 1,434 tests passed; statements 86.22%, branches 81.35%, functions 85.39%, lines 89.84%; all unchanged thresholds pass |
| `npm run coverage:check:features` | 59 mapper/service/contract files passed, 80% each metric |
| `npm run build` with loopback-only Supabase/app configuration | Passed, 81 static pages; no production service calls |
| `npx playwright test e2e/onboarding-foundations.spec.ts --project=chromium --workers=2` | Final 10 cases passed: widths 320/390/768/1024/1440, both themes; all sections, actionable validation, no-op save, Other/recovery and bounds; 90 screenshots |
| Visual inspection | Desktop light qualification Other, mobile dark community Other and desktop light community Other retain existing typography/tokens/surfaces; controls remain within viewport |
| `npm run db:smoke` / `git diff --check` | Passed; fixture/static checks only, not pgTAP execution |
| `graphify update .` | Passed; 2,204 nodes / 6,733 edges. SQL parser unavailable: no SQL graph coverage claimed |

The first full-coverage invocation accidentally put `--maxWorkers=2` after the
package script's second command, so Vitest used default concurrency and was stopped.
The explicit two-worker command above completed successfully. No tests, coverage
thresholds, timeout controls or CI checks were weakened. Existing negative-path
logs and a broker test duplicate-key warning do not establish clean production logs.

## Boundaries and recovery

No new dependency or migration for this increment; the earlier street/narrative
forward migration remains unexecuted locally because Docker is unavailable. Required
database replay/pgTAP and production deployment remain separate release gates.
No commit/push/PR/deployment in this task. Rollback the three UI/runtime files as a
cohesive increment; retain saved scalar answers and do not delete customer data.

Deferred: universal/community taxonomy, country-aware visa semantics, expanded
language coverage, marital eligibility, Unicode/single-name policy, required-contact
policy, profession suggestions, new-account welcome, primary-photo UX, matching,
provider email delivery and physical Safari checks. See the consolidated feedback
ledger. These require more than copy/list changes and are not silently included.
