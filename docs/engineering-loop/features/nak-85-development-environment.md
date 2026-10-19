# NAK-85 — Separate development and production environments

## Execution context

User decision, 2026-10-18: `main` is production and `development` is testing.
Issue: https://linear.app/phoenix-works/issue/NAK-85/separate-development-and-production-environments
Base: main `96538c9`. Implementation uses an isolated worktree; unrelated changes
in the shared checkout are excluded. Full documentation mode; Critical risk because
deployment credentials and database targets are security boundaries.

Next step: prepare and review repository controls, then merge the bootstrap PR
and synchronize development. Live activation needs the development Supabase
project reference and Vercel environment configuration. CLI currently lists only
the Nakshatra production project in its organization. GitHub account has push
permission but no administration permission, so branch/environment protection
changes need a repository administrator.

## Problem and goal

All feature integration targets main. Production CD and workers explicitly select
main; CI and secret scanning also select only main. Separate code branches alone
do not isolate databases. Development must use its own Supabase project for
Postgres, Auth and Storage, synthetic users, and sandbox providers.

## Contract and invariants

- AC-1: main and development exist; feature branches target development and
  tested releases use PRs from development to main. Both integration branches
  require the existing quality, database and secret checks.
- AC-2: CI and secret-scan PR triggers cover both branches. CI quality/builds use
  fake loopback public Supabase configuration, never live credentials. Browser
  fixtures and disposable local database CI retain their existing scope/checks.
- AC-3: Development migrations are manually dispatched on development only,
  default to dry-run, and require an explicit enable flag, approved project ref,
  matching development-scoped secret and credentials. Missing/mismatched settings,
  the production project, tags and wrong branches fail before Supabase is linked.
- AC-4: Existing production CD, production health and provider workers stay
  main-only. No production migration, deployment, provider call or data copy occurs.
- AC-5: Testing deployment uses development-only credentials, Auth redirects,
  buckets, provider configuration and secrets, with synthetic create/update,
  upload, login and cross-user-denial checks before declaring it ready.
- AC-6: Independent review and affected checks pass, with external activation and
  administrative gaps explicitly reported.

No existing schema/migration is edited. The fixed production URL in
`app_private.dispatch_production_maintenance` must remain dormant in development.
No testing worker should be enabled against that dispatcher. A separately guarded
development scheduler is follow-up work if required for provider testing.

## Design and inspected locations

| Location | Responsibility |
| --- | --- |
| `.github/workflows/ci.yml`, `secret-scan.yml` | Existing checks and branch triggers; extend without changing required job names |
| `.github/workflows/cd.yml` | Existing manual main-only production release; preserve |
| `.github/workflows/development-database.yml` | Planned manual development-only release with separate secret names |
| `scripts/check-development-database-target.mjs` | Planned fail-closed target validation; no I/O to provider |
| `tests/ci-workflow.test.ts`, `tests/development-database.test.ts` | Branch/credential and migration-selection regression checks |
| `docs/operations/environments.md` | Setup, release sequence and operational recovery |
| `docs/branch-protection.md`, `scripts/production-controls.mjs` | Existing administrative requirements; actual account lacks admin |
| `src/lib/env.ts`, Next environment guide | Public Supabase config is inlined at build; rebuild per environment |

Follow the existing manual CD workflow and import-safe script entrypoint pattern.
Keep a separate development workflow instead of sharing production credentials or
parameterizing the production workflow. Duplication of the short CLI sequence is
intentional to make secret and branch boundaries directly reviewable.

## Verification plan

| Criterion | Wrong implementation to detect | Check |
| --- | --- | --- |
| AC-1/2 | PRs to development have no checks or CI receives production secrets | Branch-trigger/config regression and GitHub branch readback; admin settings inspected separately |
| AC-3 | Wrong ref, missing enable flag, production/mismatched ref, missing credentials allowed | Pure guard and real Node subprocess negative cases; ensure credential sentinels absent from logs |
| AC-3 | Confirmation writes on wrong branch or before preview/guard | Workflow step-selection tests, pinned checkout, no reset, explicit dry-run |
| AC-4 | Production jobs select development | Preserve original workflows and test their main-only selection |
| AC-5 | Testing points at production or lacks real Auth/Storage | CLI/Vercel configuration readback plus synthetic deployed tests; blocked until provisioned |
| AC-6 | Syntax/type or coverage regression | Focused tests, lint/typecheck/full unit coverage, build with fake config, independent review |

Behavioral validation: new CI branch/credential regression should fail against
the original workflow before changing it. Deployment behavior is tested locally;
no hosted migration run is fabricated as evidence. Hosted Actions tests cannot be
fully reproduced by string/condition tests, so workflow syntax is also validated
where tooling is available and the PR remains subject to hosted CI.

## Rollout and recovery

1. Bootstrap configuration PR targets main; after merging, synchronize development
   with main before any feature PR targets development.
2. Administrator protects development and restricts each GitHub deployment
   environment to its matching branch. Preserve main rules and production access.
3. Create an independent development Supabase project, apply migrations using the
   guarded workflow, configure Auth/Storage and sandbox providers, and bind Vercel
   Preview to development with distinct credentials and a stable testing URL.
4. Test synthetic flows and inspect both environment project URLs. Release
   compatible schema changes before dependent production app deployment; do not
   promote a build containing development NEXT_PUBLIC values into production.

Rollback: disable the development enable variable and revert the configuration
PR through normal review. No production data is altered by this setup. Reverting
application code does not undo database migrations; use forward compatible fixes.

## Progress and final evidence

- Remote and local development created at main `96538c9`; explicit user-selected
  long-lived branch name is an exception to feature-branch naming rules.
- Linear NAK-85 created in verified Phoenix works / Nakshatra.
- Separate development Supabase project, Vercel settings, branch/environment
  protections and deployed synthetic tests are pending.
- Repository implementation prepared: CI/secret triggers cover both branches;
  CI builds use loopback-only placeholders with a separate cache namespace;
  manual development CD and its import-safe guard are implemented. Production
  workflow files and all migrations are unchanged. AGENTS records the explicit
  long-lived branch exception, and the operations guide covers external setup.
- Before implementation, the new CI branch/credential test failed against the
  original main-only trigger (one intended failure; eight existing cases passed).
- Local checks on the implementation, 2026-10-18: lint and TypeScript passed;
  196 test files / 1,607 tests passed; coverage 85.82% statements, 81.72% branches,
  86.38% functions, 89.34% lines; all 61 feature and 18 protected gates passed.
  Focused workflow/history/guard checks: 49 passed. Actionlint v1.7.7 validated
  the three changed/new workflows (external shellcheck/pyflakes disabled); all
  workflow YAML also parsed with duplicate-key checks. Diff whitespace passed.
- Normal `npm run build` passed with the same fake loopback configuration as CI.
  Initial build was blocked by an external node_modules symlink in the isolated
  worktree; replacing it with an APFS-cloned dependency copy resolved that local
  setup limitation without changing application code.
- Fresh-context independent review completed at code commit `20bc76a`, snapshot
  `11d3962d80234ee062afa8be1cdf679693967e74467b7b1f0de0f29ff8f77d85`,
  with no material findings. Reviewer independently passed the 49 focused checks,
  additional guard boundary cases, CLI option verification, unchanged production
  file comparison, whitespace and provenance checks. Exact reviewer model was
  unavailable; this was fresh-context review, not a claimed cross-model review.
  This subsequent edit records evidence only. PR milestone belongs in NAK-85.
  Hosted CI remains pending until the PR runs. Database replay, browser
  suites and real-provider tests were not rerun locally for this config-only
  increment; existing required CI jobs are preserved, with live activation still
  blocked on separate resources. Graphify command/graph are unavailable here.

No release or readiness claim until the external setup and checks are complete.
