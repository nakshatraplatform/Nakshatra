# Membership anonymous-grant hardening

Date: 2026-10-02. Risk: critical (database authorization). Mode: implement and
review. Follow-up to failed database job on database-only CD PR.

## Failure and contract

The supplied CI log reports 919 passing assertions and one failure out of 920:
brokerdesk_team_projection.test.sql test 4 expects anon to lack SELECT on
organization_members. This is a post-replay pgTAP assertion failure, not evidence
of a migration SQL execution error. The membership table has RLS enabled and
authenticated-only policies, but migrations never explicitly revoke initial
Supabase default anonymous grants. Grants and row policies are separate checks;
the failed privilege assertion alone does not establish row disclosure.
GitHub run 37085731273 confirms migration replay succeeded and only the database
test step failed.

Add a forward migration removing all table privileges from PUBLIC and anon on
this one table. Preserve explicit authenticated and service_role permissions,
existing policies, guarded team RPCs and all membership data. Do not rewrite
applied migrations, weaken the failed assertion, change other tables, or mutate
production during verification.

## Evaluations and release

- Keep existing ACL assertion; add anon non-SELECT privilege denial and actual
  SELECT/INSERT permission-error checks, plus an RLS-enabled assertion.
- Existing owner/advisor/other-agency projection assertions remain required.
- Reproduce default inherited grants in isolated native PostgreSQL, apply the
  real migration, verify denial, authenticated/service access preservation,
  unchanged rows/policies and idempotency. This does not replace full pgTAP.
- Full local Supabase replay/pgTAP is blocked: Docker daemon does not respond.
  Hosted CI must replay migrations and run the full suite before merge.
- Native PostgreSQL 14 execution passed: reproduced the original failed grant
  assertion using default anon/PUBLIC privileges, applied the real migration
  twice, confirmed SQLSTATE 42501 for anonymous reads and four write operations,
  and preserved authenticated/service access, RLS, policy and data.
- Fresh-context independent reviewer membership_grants_review found no issues,
  inspected grant/policy lineage and the team RPC consumer, and independently
  checked the native fixture. Reviewed snapshot:
  9e0dd93f2eed02195ea7043205d9e8597e99f604c7b88bcf36dfeab664a443bb.
- Database fixture smoke check and 11 migration-history/reference tests passed.
  Native fixture is deliberately smaller than the Supabase schema and does not
  establish a full integration-suite pass. Graphify executable unavailable.

The migration changes only privileges and requires normal protected CD after
merge to affect a hosted database. Re-granting anonymous access would restore
the failed security condition and is not a recommended rollback. The npm audit
failure is independent and remains unresolved without an approved exception or
upstream patch.
