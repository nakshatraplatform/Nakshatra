# PR 93 browser CI job isolation

## Problem and contract

Run 37984305611 at be23378 passed audit, lint, typecheck, unit coverage and build,
then exceeded the shared 15-minute job budget. Browser installation consumed
7m24s; E2E was interrupted after 5m29s. An interrupted suite is not a pass.

User approved separating browser tests and caching downloads. Significant-risk
CI execution/required-check change: keep all existing tests, retries, projects,
permissions, audit and database enforcement. No app or production data changes.

## Implementation

Split quality and browser jobs to run independently. Preserve the existing
required `Lint, Test, Coverage & Build` name as an always-run aggregate gate
requiring both results to be success; failure, skip and cancellation block it.
Database checks remain separately enforced. Do not modify branch protection.

Browser job uses Ubuntu 24.04, Node 26 and lockfile-installed Playwright. Its
cache covers only browser binaries, keyed exactly to OS/architecture/lockfile
without broad fallbacks. Always install Linux system dependencies. No production
secrets are supplied: Playwright config starts the existing local mock Supabase
and dev application. The 30-minute job budget contains a 15-minute Playwright
global timeout, leaving setup/report time. Existing failure artifacts upload
even after tests fail. No assertion, retry or project is removed.

Guidance: https://playwright.dev/docs/ci#caching-browsers (2026-10-09).
Caching is not a guaranteed speedup and cannot cache Linux system dependencies.

## Evaluations

ci-workflow.test.ts checks preserved commands, secret isolation, cache-hit/miss
structure, unconditional OS dependencies and report upload, required check name,
and executes the actual gate shell for success/failure/cancelled/skipped outcomes.
YAML/action syntax and test discovery must validate. Fresh independent review
and new hosted cold-cache full browser run are required before readiness; cache
hit execution remains unverified until a later identical-lockfile run.

Local validation: 7 regression tests, ESLint, typecheck, YAML parsing and
actionlint 1.7.12 pass (optional ShellCheck/Pyflakes not installed). Playwright
discovery retains 162 tests in 10 files across all three projects. Live dependency
audit remains zero findings. Hosted Linux execution and cache behavior pending.

Fresh-context reviewer pr93_ci_split_review (exact model unavailable) returned
no_material_findings at snapshot
89c96e9cf2d6a489f81fde022042e6640516f6dbab6ea56c688490a9e94f0a23,
base be23378e57e06bb2fb8c2cc62339c73195772cee. Start/end freshness passed.
Reviewer independently ran actionlint and the actual gate shell for all 25 pairs
of success/failure/cancelled/skipped/empty; only success+success passed. Source,
mock environment consumers and cache/report boundaries were inspected. Hosted
installation, cache hit/miss and complete E2E outcomes remain pending, not passes.
Only result documentation changes after review. Unrelated nak-102 edits excluded.

Rollback restores the old shared-budget workflow, without relaxing security.
