# Disclosure migration ordering recovery

Date: 2026-10-02. Risk: critical (production migration). Documentation mode: full,
bounded to the reference-generator prerequisite and deployment recovery.

## Problem and contract

A hosted upgrade with already-published portfolios failed at statement 23 of
`20260919170000_broker_introduction_lifecycle.sql`: SQLSTATE 22023,
`unsupported public reference type`. The table default requests `pvr`, but the
previous generator permits neither `pvr` nor `bpn`. The existing repair in
`20260922160000_broker_standard_profile.sql` runs too late for a populated upgrade.
Empty-database replay followed by final-schema tests concealed this dependency.

User authorized all pending migrations, including BrokerDesk and candidate
liveness. Live migration history read after the failure shows 58 applied through
`20260919120000`; 12 remain pending. This is a history check, not a table-level
rollback verification. Initial tool-session Management API queries failed for lack of accessible
authentication. A subsequent CLI dry run and authorized push succeeded; all 12
remaining migrations applied. Post-push dry-run, object-query and advisor commands hit the intermittent
CLI authentication failure again; the successful push is confirmed, but those
additional verification results are not established. A subsequent migration
history read succeeded: 70 applied, latest `20261001120000`, zero pending.

## Implementation and compatibility

- Extend the closed generator allowlist before lifecycle table defaults and
  backfill execute, using the exact existing later definition and revocations.
- Retain the later replacement for databases that already applied the lifecycle
  on empty data; the final generator definition and permissions converge.
- Repair the unapplied historical migration rather than append an unreachable
  new repair after it. No migration-history repair, skipped SQL or direct
  production schema patch is required for the reported failing database.
- Preserve cryptographic randomness, all existing prefixes, null/unknown-prefix
  rejection, empty search_path, invoker security and restricted execution.
- Do not change existing disclosure data, backfill selection or authorization.
- Existing package manifest/lock edits upgrade Supabase CLI to 2.119.0; these are
  from the separately authorized preceding step.

## Acceptance and evidence

| Criterion | Check | Result |
| --- | --- | --- |
| New prefixes precede every migration consumer | `npx vitest run tests/migration-reference-order.test.ts` | Original fails for pvr/bpn; fixed passes |
| Populated baseline backfill succeeds before later migrations | Actual table/backfill SQL executed in disposable PostgreSQL 14.22 with one published fixture | Original fails with reported error; fixed passes |
| Baseline snapshots/media separation and duplicate protection preserved | Same native SQL regression executes backfill twice and checks snapshot values, one public vs two complete media, one version | Passed |
| Old prefixes valid, invalid/null prefixes fail and runtime roles cannot execute generator | Native SQL assertions | Passed |
| Repository migration/test fixture conventions | `npm run db:smoke` | Passed |
| Test lint and diff hygiene | Focused ESLint; `git diff --check` | Passed |
| Post-upgrade object query, dry run and security advisors | CLI read-only checks | Blocked by intermittent AccessTokenRequiredError |
| Final migration history | `supabase migration list --linked` | Passed: 70 applied, latest 20261001120000, zero pending |
| Hosted Supabase upgrade | `supabase db push --linked --skip-vault --yes` | Passed: all 12 remaining migrations applied |
| Independent fresh-context review | `migration_order_review` (inherited model, source read-only) | No actionable findings; independently reran chronological test |

The temporary behavioral harness is `/tmp/vivintro-disclosure-regression.py`;
it uses synthetic rows and a disposable local PostgreSQL cluster, never remote
credentials or production data. It executes the actual production disclosure
table and backfill fragments, not the whole lifecycle migration. The maintained
Vitest check covers chronological literal-prefix dependencies in the SQL source;
it is not a general SQL parser or substitute for hosted migration execution.

## Recovery

The authorized retry completed successfully from this corrected checkout using
`supabase db push --linked --skip-vault --yes`. For another database at the same
failure point, retry `supabase db push --linked --skip-vault` from the corrected
checkout. Confirm the planned batch starts at `20260919170000`. Successfully
recorded earlier migrations must not be rerun or marked reverted. If a duplicate
relation or other unexpected state error appears, stop and inspect the failed
migration's database objects rather than dropping tables or repairing history
blindly. After success, `supabase migration list --linked` should show all 70
versions through `20261001120000` and a dry run should show no pending migrations.
Application smoke checks remain separate from migration completion.

## Lesson

A helper used by a migration backfill must support that backfill at its own
position in history. A later replacement can make final-schema tests pass while
real upgrades fail. Check generator prefixes in migration order and exercise
backfills with existing rows.

Graphify update could not run because the `graphify` executable is unavailable.
