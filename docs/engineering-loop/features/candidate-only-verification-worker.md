# Candidate-only verification worker

## Execution context

2026-10-06; Critical privileged queue change. Branch
`fix/nak-60-candidate-only-verification-worker`, base `f9c6a5b` (merged recovery).
No production migration, worker dispatch, secrets changes or push is authorized
by this implementation. Local validation and independent review follow below.

## Problem and goal

The shared scheduler requires a representative-only HMAC key and can lease
representative tasks. The current product focus is personal portfolio creation,
candidate liveness and sharing. Remove broker dependencies from the scheduled
candidate worker without deleting broker records or weakening verification.

## Implementation and security

- The existing scheduled CLI selects a candidate-only database claim RPC.
- An additive migration moves leasing into one shared private implementation
  with a bounded subject filter. Filtering occurs before leases and limits.
  Existing all-subject callers keep their original API and semantics.
- Only service_role can invoke the new RPC; the existing worker-role guard
  remains in the shared core. Browser roles gain no private-schema access.
- The scheduler neither requires nor receives the representative HMAC key.
- Candidate cleanup includes historical candidate attempts. Representative
  work remains queued and untouched by this scheduler; representative
  verification is paused, not deleted or silently declared successful.
- Publication, owner/session authorization, expiry, quotas and deletion
  confirmation remain unchanged. No new scheduler or environment variable.

## Acceptance and evaluations

1. Candidate liveness succeeds with the matching key absent: worker unit test.
2. An older representative job cannot occupy a candidate batch or acquire a
   lease: behavioral pgTAP with both subjects, cleanup and a limit of one.
3. Anonymous/authenticated callers cannot lease work; invalid batch sizes fail:
   real-role pgTAP. Legacy all-subject RPC remains compatible.
4. A scope-contract violation fails before provider I/O: worker regression.
5. Workflow settings and CLI select candidate-only processing; retain the four
   necessary secrets: DIDIT_API_KEY, DIDIT_WORKFLOW_ID, SUPABASE_URL and
   SUPABASE_SERVICE_ROLE_KEY. Existing enable/alert variables remain required.

## Validation and rollout

Validation on the uncommitted implementation based on `f9c6a5b`:

- Passed: focused worker suite (15 tests), full unit/coverage suite (153 files,
  1,035 tests; all 55 feature coverage thresholds), lint, typecheck, database
  smoke checks, production build and diff whitespace checks. Lint retains two existing OpenGraph
  unused-disable warnings.
- Passed diagnostic native PostgreSQL: all 44 suites / 1,170 assertions,
  including the new candidate queue suite. This is not the authoritative
  Supabase stack.
- Independent fresh-context, read-only reviewer
  `/root/candidate_only_worker_review` (model not exposed) found no material
  findings on snapshot
  `e548a270a12aa8a7e63804a816aba7ec2ec6cd409eabbdfb4c7556c94236f080`.
  It independently passed the worker tests, 17 operations/schema tests,
  10 queue assertions and seven additional authorization/bounds assertions.
  An actual CLI subprocess against a synthetic localhost API succeeded without
  the matching key and failed closed when the candidate claim RPC was missing.
- Pending: authoritative clean Supabase CI, generated-type regeneration and
  real Didit cleanup. Local CLI type generation could not complete; the new
  public RPC type was inspected against its SQL contract, not generator-verified.
- No production migration, worker run, secret change or push was performed.

Deploy the additive migration through protected
CD before the matching workflow/worker. A missing claim RPC fails closed and
must never fall back to the shared broker-capable queue.

## Decisions / deviations

The request scopes the scheduler, not deletion of the BrokerDesk application.
The shared evaluator and legacy RPC remain available for a future separately
configured representative processor; no separate processor is introduced here.
