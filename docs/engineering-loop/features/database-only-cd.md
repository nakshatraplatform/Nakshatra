# Database-only CD

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
