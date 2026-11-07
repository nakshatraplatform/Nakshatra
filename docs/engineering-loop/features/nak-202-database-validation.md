# NAK-202 database validation

Reviewed on 6 November 2026 against main `c675159` and the uncommitted
NAK-202 migration and tests.

The 7 November 2026 [NAK-204 validation run](./nak-204-introduction-action-workspace.md#supabase-postgresql-17-database-validation-7-november-2026)
cleared the tooling blocker described below. The combined worktree passed the
complete local Supabase PostgreSQL 17 database job, including the NAK-202
suite and Family Viewer concurrency.

## Review correction

The earlier privacy correction removed proposal history from the broker
projection, but a pgTAP source-text assertion still expected `LIMIT 10`.
Replaced that obsolete assertion with a behavioral comparison proving two
agencies with different proposal histories receive identical safe results.
The test plan retains all prior authority assertions and adds five cases for
null references, mandate expiry, mandate revocation, disabled entitlement and
an ended relationship. All 19 assertions pass in the supplemental sandbox.

## Supplemental execution

The disposable sandbox uses PGlite 0.5.9 with PostgreSQL 18.6, pgcrypto and
pgTAP 1.3.3 from commit `b941782fada240afdb7057065eb3261a21e8512c`.
Auth, Storage and scheduler structures are synthetic. Three unavailable
provider extension creation statements for pg_cron, pg_net and Vault are
omitted only in the temporary harness. Repository migrations are unmodified.

The harness lives at
`C:/Users/Lenovo/AppData/Local/Temp/nak202-db-1626e9b9b0a64a82b3792d52b93bd586/validate.mjs`.
Its SHA-256 is
`6A0412E08E0CC76AE4D4AA9178A71A12FB3AB0F4C0DEEFF2F89C175DA8ED414C`.
The harness expands the existing psql fixture include and gset variables,
validates each TAP plan count, and treats failing assertions as failures.

| Check | Main baseline | NAK-202 |
| --- | --- | --- |
| Migration replay in this sandbox | 124 applied | 125 applied |
| Passing suites | 70 of 71 | 71 of 72 |
| Assertions in passing suites | 2,053 | 2,072 |
| Infrastructure failure | production_readiness_fixes requires unavailable vault.create_secret | Same failure |

The five focused suites pass 209 assertions in total. They cover assisted
onboarding, the Family Viewer identity foundation, accountless interest,
guest approved viewing and member interest sharing. The missing Vault
operation remains an infrastructure failure in the full supplemental run.

## Query-plan evidence

Extracted the exact active-viewer count query from the NAK-202 migration.
Loaded 10,000 synthetic candidates with one active and one pending viewer each,
then ran ANALYZE and EXPLAIN (ANALYZE, BUFFERS) with the default planner.
No planner setting was forced and no new index was added.

```text
Aggregate
  -> Index Scan using candidate_family_viewers_candidate_roster_idx
       Index Cond: candidate_id = fixture UUID AND status = 'active'
       Filter: revoked_at IS NULL
       Index Searches: 1
       Buffers: shared hit=3
Planning Time: 0.429 ms
Execution Time: 0.166 ms
```

These timings describe one warm synthetic query in a local WASM process.
Staging must establish latency budgets on the actual database tier.

## Original tooling limits on 6 November 2026

The repository targets Supabase PostgreSQL 17. The official disposable
Supabase migration replay, complete pgTAP suite, real multi-session concurrency
and clean generated-type comparison remain pending. PGlite serializes its
connection and cannot establish the concurrency gate.

The machine has no Docker, Podman, PostgreSQL client or installed WSL
distribution. GitHub CLI authentication is absent. The GitHub connector returns
an unknown-tool error and the browser tool fails to initialize its kernel
assets even after reset. Git SSH reads still work and main remains c675159.

Resume with a disposable Supabase stack and run the database job from
`.github/workflows/ci.yml`, including Family Viewer concurrency, B2C approval
retry, photo limits and generated-type drift. Retain query-plan output as
review evidence. Resolve failures before declaring NAK-202 ready to merge.

## B2C compatibility

The core personal-sharing, interest, approved-access and dashboard source paths
match main byte-for-byte. The focused B2C database suites pass with NAK-202
applied in the supplemental sandbox. The prior application evidence records
1,929 passing tests and 12 browser checks. This follow-up changes the database
test and documentation only.
