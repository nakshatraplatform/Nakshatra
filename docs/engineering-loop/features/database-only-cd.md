# Database-only CD

## Preview-only follow-up — 2026-10-05

Mode: implement and review. Risk: critical; reuse this feature record for the
bounded production workflow change. Base: `52106e3`, branch
`fix/nak-58-cd-preview-only`. Related verified issue: NAK-58 (completed original
database-verification work; this follow-up does not reopen it).

### Contract and evaluations

1. Manual dispatch on `main` with `confirm_production: false` (the default)
   validates credentials, links the project and previews pending migrations with
   `--dry-run --skip-vault`. It must not apply migrations or require every pending
   migration to be recorded remotely.
2. Explicit confirmation runs preview, application and final-history verification
   in that order. Normal step failure handling must prevent application after a
   failed prerequisite. No feature-branch dispatch may run production steps.
3. Preserve production environment, pinned dispatch revision, serial concurrency,
   Vault exclusion and manual-only triggering. Missing secrets identify their
   names, never their values.

The YAML remains the sole owner of dispatch and step-selection rules. Add
`tests/cd-workflow.test.ts` for both dispatch modes, branch rejection and synthetic
credential validation. Use native actionlint for YAML/Actions syntax; local
condition tests cover the workflow's simple boolean subset, not the hosted
Actions scheduler or live Supabase authentication.

Planned checks: focused Vitest red/green, actionlint, ESLint, typecheck, database
smoke and independent source review. Production connection/application and a
hosted preview require the workflow on `main` and remain separate release checks.
No production command is executed during local evaluation.

### Rollout and recovery

Merge through a PR after CI. Dispatch with confirmation unchecked first, review
the pending migrations and dispatch revision, then confirm only while `main`
still selects that revision. If `main` changed, obtain a new preview and CI
evidence. A preview does not reserve database state; check concurrent/manual
database changes before applying. A failed final-history check does not roll back
applied SQL. Environment approvals and credentials are GitHub settings, outside
this code change. Live application smoke tests remain follow-up work.

### Progress

- Contract recorded and regression tests added before changing the workflow.
- Regression-first result: four expected failures on the original workflow
  (unchecked preview skipped and each missing-secret case lacked a diagnostic).
- Implemented default preview and explicit apply/history gates in
  `.github/workflows/cd.yml`. Renamed the Actions workflow and run titles to make
  the selected operation visible; added name-only missing-secret annotations.
- Updated `README.md` release instructions and the existing `PROJECT.md` link.
  No dependency, schema, production secret or environment settings changed.
- Passed: 21 focused tests across `cd-workflow`, `migration-history` and
  `migration-reference-order`; full unit suite (149 files, 968 tests); typecheck;
  focused ESLint; actionlint v1.7.12; `db:smoke`; `git diff --check`.
  Full lint passed with two pre-existing unused-disable warnings in unchanged
  Open Graph image files.
- Independent fresh-context review by `/root/cd_preview_review` (inherited model,
  exact variant unavailable): no material findings. Reviewer independently ran
  focused tests, ESLint, actionlint and freshness checks on snapshot
  `2669110ebc3417f7e5a3841005d82f17a86e30b1aa5b6e5d231d67f463a1e93e`.
  Only this evidence/progress section was updated after review; implementation
  and test sources are unchanged.
- Source inspection confirms no `always()`/status override or
  `continue-on-error`: failed prerequisites prevent application through Actions'
  implicit success condition. Hosted scheduling is not simulated by unit tests.
- Pending: PR/release and actual GitHub-hosted preview with the configured
  credentials. No production connection or migration application was attempted.

## Historical implementation evidence

Date: 2026-10-02. Mode: implement and review. Risk: critical (production migration
workflow). Scope: remove duplicate Vercel deployment, verify CI triggers and add
read-only post-migration history verification. Existing CLI upgrade and disclosure
migration repair are retained as prior work.

## Contract and implementation

- Vercel's existing GitHub integration owns application deployment. CD requires
  only SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD.
- Preserve manual dispatch, main-only condition, explicit production confirmation,
  production environment, serial concurrency and repository read permissions.
- Pin checkout to github.sha so a moving main branch cannot change the SQL selected
  when the run was dispatched. Do not enable automatic production writes on merge.
- Preview and apply migrations with --skip-vault, then obtain CLI 2.119 JSON
  migration history and compare every row with the checked-out migration versions.
  Pending, remote-only, duplicate, missing or malformed rows fail verification.
- Verification uses version history, not SQL-content hashes; it does not detect
  schema drift or prove application behavior. Tests and resets stay in CI's local
  disposable database. Production is never reset for validation.
- CI already runs on pull_request to main and push to main. No CI trigger change
  is needed. Existing clean replay and pgTAP remain. The prior chronological
  prefix test covers the discovered migration-order bug, but a general populated
  upgrade test job is outside this bounded change and is still absent.
- Manual CD does not automatically gate on CI results. Operators must confirm CI
  for the dispatch revision. Native Vercel deployment does not wait for CD; use
  separate, backward-compatible schema-first and dependent-application releases.

## Evaluation

| Criterion | Evidence | Result |
| --- | --- | --- |
| Database testing before merge | CI pull_request triggers; run 36973784348 | Passed on prior main integration source |
| Database testing after merge | CI push trigger; run 36974297362 at b5cfea5 | Passed on prior main integration source |
| Missing/extra/inconsistent deployment history fails | tests/migration-history.test.ts | 10 cases passed |
| Existing prefix ordering guard preserved | tests/migration-reference-order.test.ts | Passed |
| No Vercel CLI/secret dependency remains in CD | Workflow diff inspection | Passed |
| Workflow syntax | Official checksum-verified actionlint v1.7.12 on CI/CD | Passed |
| New script/test lint, types and whitespace | Focused ESLint; tsc --noEmit; git diff --check | Passed |
| CLI integration with live read-only history | CLI 2.119 `migration list --linked --output-format json` followed by verifier | Passed: 70 applied, none pending |
| Independent review | Fresh-context, inherited-model database_cd_review; source read-only | No actionable findings; independently verified captured live history |
| Hosted execution of changed workflow | Requires committing/pushing changes and manual dispatch | Not run |

## Files and recovery

Changed .github/workflows/cd.yml; added scripts/verify-migration-history.mjs and
its focused test; documented releases in README.md. If the final history check
fails, applied SQL is not rolled back: inspect actual remote history before any
retry or repair. Keep secrets in GitHub settings, never in the repository.

Linear routing check: the tool named linear_phoenix returned workspace PrismPro,
not Phoenix works. No Linear writes were made; this record preserves the plan and
evidence until routing is corrected. No new issue identifier or branch invented.

Graphify update was attempted but the executable is unavailable on this host.

Release the CLI package/lockfile upgrade together with CD because the history
verifier uses the validated CLI 2.119 JSON contract. GitHub environment protection
settings were not inspected; a production environment declaration alone is not
evidence that reviewer approval is configured.
