# Candidate liveness recovery

## Execution context

Risk: Critical; full engineering record because this changes authorization, lifecycle concurrency and a public database contract. Local branch: `fix/nak-60-candidate-liveness-recovery`; integration base: `a17a343` (latest fetched main). Its tree is identical to the previous `fa17a56` base; only rebase-generated commit identities differed. Local implementation and independent return review are complete; external release verification remains pending. No production quota resets, remote migrations, deployment, pushes or Linear writes were performed by this implementation run.

## Problem and goal

The dashboard loses the hosted Didit link after navigation. An existing registered attempt prevents another start but provides no recovery actions. Give the authenticated primary candidate owner status, resume and cancellation without a management token. Representative checks remain unchanged.

## Approved implementation contract

- Current-state GET and strict, same-origin resume/cancel POST routes require a live authenticated session. PostgreSQL independently checks session and primary ownership.
- Resume retrieves the stored V3 session, validates exact session/workflow/version/vendor correlation and a credential-free HTTPS `verify.didit.me` URL, then rechecks eligibility. Resume never creates a session. A completed provider session requests reconciliation; outages preserve the existing attempt.
- Cancellation names the expected current attempt, is idempotent, fences approval immediately and queues cleanup. Stale tabs cannot cancel replacements. New creation waits for cleanup and fresh consent; verified proofs are preserved.
- Database-clock deadline is creation plus 30 minutes; repeated starts/resume do not extend it. Final reconciliation may accept a valid terminal decision before 35 minutes. An unfinished final lookup expires; completion at/after 35 minutes cannot approve. Backfill existing unfinished candidate-only checks, not representatives or verified proofs.
- Candidate creation quota is five registered provider creations per user/hour, shared by start/retry. Existing state queries, resume and pre-registration configuration failures do not consume it; registered uncertain creations do. Shared recovery interaction quota is 30/user/minute. Keep anonymous management-link limits.
- Use the existing five-minute leased worker for bounded expiry and cleanup. Exact correlation remains required. Known-session 404 means absence, not affirmative biometric deletion. Retain bounded retry/backoff and safe failure alerts. Database fencing, not provider deletion, prevents late approval.
- Dashboard loads database state, polls unfinished visible checks every 15 seconds and refreshes on tab return. It explains creating, active, awaiting-result, cleanup, terminal and verified states. Resume/cancel are explicit; cancel requires confirmation; terminal outcomes clear consent. Display Retry-After without automatically repeating creation.

## Security and compatibility

Private assertions use the trusted runner after RESET ROLE; worker behavior runs as service_role. No test-only production privilege grants, role-dependent temporary tables or function-body assertions. No provider payloads, hosted URLs, management tokens or camera evidence in logs. HTTP responses are private/no-store. Existing bearer links remain compatible, not an unauthenticated owner-recovery bypass. No additional scheduler or test quota bypass.

## Components

- Candidate recovery routes/service and shared repository in `src/features/identity-verification/`.
- Didit provider retrieval adapter and existing worker.
- Dashboard and client API.
- Forward migration `20261006055529_candidate_liveness_recovery.sql`, public RPC types, shared pgTAP fixtures and recovery suite.
- Existing representative, publication and verification regression suites.

## Acceptance and validation

1. Lost-link recovery uses the same provider session: dashboard/service regressions and Playwright refresh/second-tab/resume/cancel tests passed on desktop, tablet and mobile using loopback fixtures.
2. Session/owner authorization: pgTAP anonymous, non-owner, cross-user, missing, malformed and revoked-session cases passed.
3. Cancellation, cleanup gate and stale attempt fencing: pgTAP and cancellation-during-retrieval service test passed. Parallel native PostgreSQL probes confirmed one registration from two starts and rejection of attachment after cancellation during creation; automated CI concurrency coverage remains desirable.
4. Deadline and grace: pgTAP deadline/no-resume, unfinished-final-lookup, grace-period approval, hard expiry and late-approval rejection passed.
5. Quota registration semantics: pgTAP existing-attempt/no-quota and exhausted reservation, and start/retry configuration-preflight tests passed. Creation versus interaction cooldown scope is explicit; no automatic start retries.
6. Provider response validation and outage safety: adapter wrong correlation, untrusted/credential-bearing URL, oversized/malformed payload, HTTP 404/429/500 and timeout tests passed; service outage preserves the attempt.
7. Preserve proof/publication/representatives: full native SQL suite; authoritative clean Supabase CI still required.
8. Required lint/typecheck/unit/coverage/build/type generation, fresh independent review and real Sandbox recovery loop must pass before release readiness.

## Implementation progress (2026-10-06)

- Added owner recovery endpoints, retrieval-only resume, cancellation UI, polling, forward lifecycle migration, atomic creation quota, worker expiry and known-session absence handling.
- Lost-link dashboard regression was observed failing before implementation.
- Lint passed with two pre-existing OpenGraph warnings; typecheck and db:smoke passed. Full unit/coverage run passed 1,029 tests, global thresholds and all 55 per-feature checks (`/tmp/candidate-recovery-verification-final.log`).
- Final clean native PostgreSQL 14 replay and all 43 suites passed 1,160 assertions after lifecycle/locking corrections. Parallel probes against that scratch replay confirmed one provider reservation and fenced cancellation during creation. Native fixture emulation is diagnostic evidence, not authoritative Supabase CI.
- Supabase CLI generated public RPC contracts from the native scratch database. Only additive RPC type blocks were carried into the existing formatted committed type file; full authoritative type drift comparison remains pending.
- Disk exhaustion interrupted an edit and stopped scratch PostgreSQL. Removed only regenerable `.next/cache`, restarted scratch server and reran checks. Final production build passed (`/tmp/candidate-recovery-build-final.log`). Docker diagnostic did not respond and was interrupted; do not claim authoritative local Supabase verification.
- Playwright recovery tests passed for desktop/tablet/mobile. Batched desktop/mobile screenshots were inspected: no horizontal overflow or clipped recovery content. Tests use loopback fixtures, not provider camera completion.
- Candidate-only cleanup acknowledgements and bearer retry/withdrawal now acquire foreground lifecycle locks before worker/token locks, avoiding inversion with cancellation/expiry. Representative behavior remains unchanged. Due deadline reconciliations are prioritized within the existing claim queue. A retired candidate reconciliation lease is a completed no-op, not an alert-generating retry.

## Independent review ledger

Fresh-context review of snapshot `8d4b06ac6e6c480df6089bd1737def456964785e29324536b5f0cfd60df18a9a`, base `fa17a56`, required changes. All findings were introduced and confirmed:

- CR-01 (High): nullable no-attempt cancellation flag rejected by API schema. Coalesced to false; actual RPC boolean regression added.
- CR-02 (Medium): known-session absence incorrectly stamped affirmative deletion time. Preserve original deletion timestamp while separately recording absence; SQL regression asserts no fabricated purge evidence.
- CR-03 (Medium): idle/terminal tabs missed another tab's new check. Visible-tab refresh is unconditional; polling remains unfinished-only. Idle-to-active visibility regression added.
- CR-04 (Medium): anonymous bearer retry throttle inadvertently relaxed. Retained original anonymous throttle; authenticated owner interaction limit stays separate. Signed-out retry regression added.

Return review of snapshot `f541315e4ecf9d70dee9eadaf026536c52e4c7dce5e1c89201d1a9002ef5f33a` found no new material findings and resolved CR-01–04. Reviewer independently reran 60 focused unit tests. Its native SQL attempt passed eight assertions before existing scratch concurrency-probe data caused a token collision; that is not represented as a full independent SQL pass. A final narrow correction limits deadline backfill to unfinished attempts, matching the approved scope; the final freshness review is recorded below.

Final round-three review of snapshot `d60f1a773cb43b4a64e5b1c57ac35b1e7749659cb627065a012d5544b3393b90` verified freshness before and after inspection and found no material findings. It confirmed the unfinished-only backfill and independently passed all 35 recovery SQL assertions on a clean native scratch replay, including unchanged shared fixtures and rollback. Only extension installation was omitted because native pgTAP functions were already loaded. The coordinator separately reran all 43 suites: 1,160 assertions passed. The earlier 60 focused tests remain applicable to unchanged application/test source. This final record update is documentation-only, after that reviewed implementation snapshot; it does not imply Supabase CI, real provider validation or deployment approval. `graphify update .` could not run because the executable is unavailable.

## Decisions, limitations and rollout

### Verification follow-up (2026-10-06)

Fresh review of snapshot `35be1a3bf01df81dda47329c0b5832d31085757e403b6cb71135847c6d3617a3` confirmed FV-01 (replacement keeps an old hosted link), FV-02 (awaiting-result keeps a hosted link), and FV-03 (failed provider request plus retired lease aborts the worker batch). Durable regression tests reproduced all three failures before correction. Hosted and management links now carry the exact attempt ID; successful candidate start returns that ID as an additive HTTP field. Refresh invalidates obsolete links, and rendering requires the current resumable attempt. Failed-start recovery uses the owner status controls rather than an unbound bearer link. Retired candidate reconciliation deferrals return a no-op, while actual database errors remain blocking; a two-claim worker regression and database-error regression cover both outcomes.

Fresh-context return review of snapshot `927b47e81cda1c01e19db524caa92fd72dc1c82f8293506b8dcd89fa41845b17` resolved FV-01–03 with no new material findings in the correction scope. The reviewer independently reran the original stale-link reproductions, the two-claim worker reproduction and 83 focused unit tests. This was fresh-context review, not a verified cross-model review.

Final narrow integration/freshness review of snapshot `5c6f7c7da1f63750c405d8b85b435b5e5ec63d87d226e302e3131f947bbe0947`, base `a17a343`, passed before and after inspection with no material findings. Source manifests confirmed only this feature record differed from the approved correction snapshot; both integration-base trees were identical. FV-01–03 remain resolved. The reviewer inspected completed validation logs without unnecessarily rerunning unchanged tests. This final ledger addition is documentation-only and does not change reviewed implementation source.

After correction, full coverage passed 153 files / 1,033 tests and all 55 feature coverage checks. Lint (two existing warnings), typecheck, db:smoke, security:audit and production build passed. Full Playwright passed 102 tests with six existing skips; the focused recovery tests passed on desktop/tablet/mobile. A real Sharp PNG encoding probe passed. SQL was unchanged by these corrections, so the prior 43-suite / 1,160-assertion native replay remains applicable. Docker diagnostics timed out; authoritative Supabase CI and full generated-type comparison remain pending. Logs are local `/tmp/candidate-recovery-corrections-{coverage,lint,build,browser-full}.log` artifacts, not durable hosted CI evidence.

The unchanged `sharp@0.35.4` dependency was independently identified as a current CI audit blocker (GHSA-wq5f-xc86-pv6w). It is upgraded to patched `0.35.5`, with matching lockfile and no change to the existing development-only audit exception. Full verification and release gates remain distinct.

### Secret-scan fixture correction (2026-10-06)

TruffleHog 3.97.0 reproduced the PR failure at `b2a65b1`: one unverified URI finding in `tests/didit-recovery-provider.test.ts`, line 16. The value was synthetic user information in a negative hosted-URL test, not an application credential. The dedicated regression now constructs the URL using `URL.username` and `URL.password`; all 20 provider tests passed with rejection coverage preserved. No detector, result policy or path exclusion was changed. The branch commit was amended so its PR history no longer includes the flagged literal. A local scan of the complete corrected PR range with the pinned version/configuration and all blocking result classes returned zero findings, with verification disabled to avoid outbound credential checks. Hosted CI remains the final confirmation. Existing production code, migrations and release gates are unchanged.

Production-engineering-loop and Supabase guidance require behavioral authorization checks, a forward-only migration and fresh review. Impeccable hardening guidance retains the existing dashboard design with explicit recovery feedback and accessible controls.

Configure the dedicated provider workflow expiration to 30 minutes where supported. Cancellation does not promise to close an already-open provider tab or revoke hosted tokens.

Release order: resolve validation/review gaps; pass protected clean Supabase CI; obtain domain review; deploy additive migration through protected CD, then matching application/worker; exercise real Sandbox leave/refresh/resume/cancel/cleanup/restart/complete and record exact revisions. No release-readiness claim until these steps pass.
