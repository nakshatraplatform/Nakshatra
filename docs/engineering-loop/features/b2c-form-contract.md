# B2C pilot portfolio form contract

Mode: full. Risk: critical at publication. Status: implementation in progress on the existing authenticated draft and publish routes. No deploy or merge yet.

## Product decisions and conflicts resolved

- Pilot creation is self-only. The form does not ask the user who is creating the portfolio; older delegated drafts remain private and cannot publish.
- Keep `PUT /api/dashboard` for draft saves and `POST /api/portfolio/publish` for reviewed publication. The requested `POST /api/profiles` is not added because the owner chose the established route contract.
- No new per-field visibility system. New public disclosure uses one Introduction (formerly Detailed); Complete Portfolio follows owner approval. The old reduced-disclosure projection remains only to serve historical snapshots without automatic widening. The template field-by-field inventory is the next product decision, after the form is stable.
- The exact typed handoff values (1600/1200/1200 maxima, optional answers with 80-character minimum when answered, interests 6, languages 10, values 5) take precedence over the attached screenshot's alternative 600/500/400 writing recommendations. Empty optional narratives remain allowed.
- First and last name are required; middle name is optional. Each part is limited to 50 ASCII letters, spaces, apostrophes and hyphens. This exact requested regex excludes accented and non-Latin names; revisit before a multilingual launch. Full name appears in the public Introduction.
- DOB is required for publication, from 1920 onward and age at least 18. Gender, a listed height, Marital Status, current country and city, profession title, short description and one shareable primary photo are required. Cultural, astrology, family, lifestyle and preferences remain optional unless an entered value violates its validation rule.
- Existing published snapshots remain readable. An older draft must meet the current contract before it is republished; never silently truncate or broaden its exposure.
- The public-snapshot database trigger rejects fields outside the selected historical/current projection and rejects a mode that disagrees with the published draft. The subsequent single-Introduction trigger rejects new publications using the retired mode. A further server-owned publication boundary prevents browser credentials from supplying any snapshot projection or editing either snapshot table directly.

## PR #74 publication-integrity correction

The canonical TypeScript public and approved snapshot mappers already run in the authenticated Next.js route. Keep them as the single source of projection logic rather than duplicating a large, drift-prone mapper in SQL. The route verifies the actor and live session, validates the form, saves the draft, checks verification/disclosure/readiness, then uses the existing server-only Supabase service credential for the atomic publication RPC. A service-only SQL wrapper binds that verified actor to its real live session before calling the established publication transaction. Revoke authenticated execution of the old public RPC and direct INSERT/UPDATE/DELETE on both snapshot tables. This is fail-closed if the new RPC or service credential is not deployed; production database migration must be coordinated immediately after the app revision reaches `main`.

Implemented in `20261003145000_server_owned_portfolio_publication.sql`, the publish route, and the publication repository. The SQL wrapper checks the supplied actor/session against Supabase Auth's live session table and rebinds the existing atomic transaction to that session. Regression tests assert the old browser RPC and direct snapshot writes are unavailable. The route continues to derive both projections from the same canonical draft after authenticated readiness checks.

Acceptance evidence still required: hosted pgTAP and app CI pass at the final revision; an actual server-route publication returns the durable opaque link; historical snapshots remain readable. Do not silently fall back to the exposed old RPC. Existing readers and already published links must remain available.

Production rollout is a separate release gate. The current CD workflow applies migrations only after a manual dispatch on `main`, whereas the app may deploy when `main` changes. An app-first rollout leaves the old authenticated publication RPC available until CD finishes. For a zero-exposure pilot transition, coordinate a database-first migration with deployment held or publication traffic closed; this deliberately causes a short fail-closed publish interval until the app is deployed. Do not open pilot publication traffic until the migration is verified in Production and a server-route publish smoke test passes. The manual CD workflow and migration history must stay consistent; do not run ad hoc SQL without a verified migration-history plan.

## Implementation and verification

- PR #74's first hosted pgTAP run replayed the migrations successfully but failed in publication fixtures because the single-Introduction trigger rejected drafts with no `privacy_mode`. The app already normalizes an absent mode to `balanced`; commit `576b6f7` made the migration do the same while still rejecting an explicit retired `private` mode. The hosted pgTAP, JS CI, and secret scan all passed on that commit. The final server-owned-publication revision requires a fresh hosted CI run.

- `src/features/portfolio/form-contract.ts` provides editor draft/publish validation and dotted field errors. `BlueprintForm.tsx` has the revised narrative prompts, examples, character guidance and keyboard-reachable interest chips. `readiness.ts` drives the same required-fact checklist. The pending migration updates `app_private.portfolio_missing_required_details` so direct database publication cannot bypass required facts or entered-answer limits.
- The stored lifestyle lists are still comma-separated strings because the established data model and public templates use that shape; the editor renders them as chips, and both API and database bound the item counts. Array storage, universal empty-string-to-null migration, profession autocomplete, optional phone OTP, pets/exercise preferences, and added children-living-status questions are **not complete**. They require compatibility and privacy decisions, not a silent schema rewrite.
- Focused unit tests cover core contract and UI. Full suite and SQL runtime checks are release gates; maintain a separate record of pre-existing Windows-only test failures rather than calling the entire suite green. Local PostgreSQL, Docker and `psql` are unavailable in this workspace, so the pending migrations and pgTAP tests have not been exercised against a database.

## Acceptance before release

Draft autosave preserves unfinished narratives, including answers shorter than 80 characters; publishing rejects those answers with field-level errors. This is intentional so moving between sections cannot discard a sentence in progress. Publish also rejects missing required facts and a headline location that disagrees with structured city, region, and country. Six interests is the maximum at UI, API and database layers. The public Introduction preview and approved Complete Portfolio remain consistent with the final field matrix. Navigation between sections preserves unsaved answers. Keyboard and screen-reader checks pass for chips and examples. Database tests must confirm direct-publication and public-projection rejections. No PR should be described as pilot-ready until those checks pass.

## October 29, 2026 — field validation correction (current work)

The owner approved the implementation after the code-level evaluation. This
supersedes the historical ASCII-only name decision above. Risk: critical because
the publication checklist and path allocator must agree with the app. Full
record retained here; no new route, dependency, quota, or authorization change.

### Contract and design

- A shared pure portfolio field validator supplies UI and draft/publish rules.
  Person names require a Unicode letter and allow letters, combining marks,
  spaces, apostrophes (straight/curly) and hyphens; existing length limits remain.
- Apply person-name rules to the owner, parents, siblings, and private contacts.
  Profession, short description and manually entered city require at least one
  letter, while legitimate mixed text such as `3D artist` and `Sector 7` remains.
- Preserve unfinished/blank optional answers, existing stored read schemas,
  phone formatting and whole-number sibling limits. Do not strip invalid input
  or silently rewrite stored data. Explain corrections on blur and at submission.
- Update SQL with a new forward-only migration. Existing published links remain
  stable. New ASCII names retain readable name paths; non-ASCII names use a
  bounded ASCII `vivara-` identifier through the existing reservation allocator,
  so all current route/authorization contracts remain valid without transliteration.
- Local Docker is stopped. An isolated temporary PostgreSQL instance can check
  migration function behavior; that does not establish clean Supabase replay or
  real Auth/RLS behavior. No remote migration or production requests are authorized.

### Acceptance and verification plan

| Criterion | Verification |
| --- | --- |
| Reject numeric-only required text and every invalid person-name location | Shared schema and authenticated route tests; no writes on rejected payload |
| Accept Kannada, Hindi, Tamil, accented and decomposed names | Schema and rendered form tests, SQL name and allocation checks |
| Preserve valid mixed text and optional blanks | Regression cases for employer/degree/profession/city/description |
| Accessible correction after typing/paste | Field-associated errors after blur; retain entered value |
| Checklist cannot count invalid required text complete | Readiness and editor issue regression |
| Publication and share paths support the same valid names | SQL assertions; existing readable path tests unchanged |
| Numeric field protections remain | Existing phone/count/date/height/postal suites |

Execution context: initial schema/readiness regressions added before code edits;
implementation and validation in progress. Relevant sources: `form-contract.ts`,
`readiness.ts`, `BlueprintForm.tsx`, `LocationFields.tsx`, the canonical SQL
publication checklist and share-path allocator. Existing `.graphifyignore` and
`brag-output/` work are unrelated and will be preserved.

### Implementation evidence (local, before independent review)

- Added `field-validation.ts`; reused by editor schemas, inline text feedback,
  manual owner-city feedback, and publication readiness. Broad read schemas
  remain unchanged. Added schema, route, accessibility and browser regressions.
- Added `20261030020722_portfolio_field_validation.sql` and
  `portfolio_field_validation.test.sql`. Private ICU-based letter classification
  plus explicit Unicode combining-mark ranges agree with the JS letter/mark
  policy for tested scripts. The allocator preserves ASCII readable paths and
  uses reserved UUID-based ASCII paths for new non-ASCII names. No public RPC
  signature changes, so public generated database types are unchanged.
- Red phase: 16 intended failures reproduced before implementation. First green
  full suite: 1,854 tests; coverage passed for 64 feature files and 21 protected
  boundaries. Lint, typecheck and production build passed.
- Isolated PostgreSQL 14: migration compiled against minimal dependencies;
  executable assertions passed for Kannada/Hindi/Tamil/accented/decomposed names,
  invalid names, required-text checklist, path allocation, and private helper
  permissions. This is not a clean Supabase migration/pgTAP replay.
- Full Supabase replay/pgTAP is blocked because Docker is not running; no project
  database was started or reset. Matching protected migration must precede the
  app rollout. Physical-device and production smoke checks remain separate.
- Browser regression and fresh review are in progress. Final execution/review
  receipts are stored outside source in `/tmp/nak-field-validation-*` and reported
  in the handoff. No commit, push, remote migration, or deployment was requested.

### Independent review correction FV-001

Fresh-context review confirmed a medium-severity compatibility regression: the
visible legacy contact row retained an invalid hidden `contact_person` after its
name was corrected. Two added tests reproduced the failure before the fix.
Explicit contact edits now replace the old `contact_person`/`phone`/`email`
aliases with the existing editable rows, retaining row content and `secure_note`.
Removing the last row cannot revive an old contact. Legacy name errors target
the actual first contact control. This is an explicit editing conversion, not a
data backfill. Focused correction/schema/API checks: 106 passed.

The initial 3-viewport browser regression passed. Full coverage, static checks,
build and browser checks are being repeated for the corrected source; required
return review uses a new snapshot. Initial review report:
`/tmp/nak-field-validation-review-report.md`. Supabase clean replay remains
pending independently of these local checks.

### Final local validation and delivery boundary

Corrected implementation: 217 files / 1,856 unit tests passed, with all 64 feature
coverage floors and 21 protected-boundary floors. Corrected lint, typecheck and
production build passed; the desktop/tablet/mobile browser regression passed
again. A test-only TypeScript selector-options error was fixed and its 34-test
file rerun passed. Dependency audit passed with zero affected packages.

Graphify was updated after the code changes; `portfolioTextError()` now maps to
its schema, readiness and UI consumers. Unrelated Graphify filter and generated
video work remain untouched. The FV-001 return-review receipt is
`/tmp/nak-field-validation-review-report-2.md`; the coordinating handoff records
its verdict and provenance separately from this contract.

Implementation is prepared on `fix/nak-107-portfolio-field-validation`. Full clean Supabase migration/pgTAP CI
remains required before release, followed by schema-first protected CD and the
matching app. No production values were changed and no data backfill runs.

### Push preparation

The required `db:smoke` gate caught two conventions in the new pgTAP file: its
assertion counter does not recognize `matches()`, and runtime roles must not
inspect private objects directly. The test now uses an equivalent `ok()` regex
assertion and a session-local security-invoker wrapper for the permission denial.
All 15 assertions remain; no application or migration behavior changed.
`npm run db:smoke` passes. Clean Supabase/pgTAP execution is still pending.
