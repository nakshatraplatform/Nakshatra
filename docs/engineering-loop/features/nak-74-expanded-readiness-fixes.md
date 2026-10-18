# NAK-74 expanded readiness fixes

## Contract and scope

Mode: review and fix. Risk: **Critical** (database authorization, quotas, concurrent private uploads, destructive cleanup). Base: main `d1e08f8`; branch `security/nak-74-expanded-readiness-fixes`.

Resolve DEEP-API-01, DEEP-DB-01, DEEP-API-02, DEEP-UI-01–05 and DEEP-OPS-01. Email authentication and DMARC are explicitly excluded. Existing personal-portfolio consent, ownership, liveness and approved-access rules remain authoritative. BrokerDesk product development is outside this change.

## Implementation plan and invariants

- Anonymous quotas use an HMAC of the trusted network address independent of User-Agent. Shared-network users share the anonymous bucket; authenticated quotas stay account-scoped. Independent provider/target restrictions remain necessary.
- Accepted interest submissions consume five/hour at the database insertion boundary, transactionally with request/outbox creation. Remove API pre-consumption; duplicate no-op requests do not consume twice. Direct authenticated RPC calls obey the same rule.
- Horoscope commits compare the expected current object with the current row while serializing on its portfolio. A losing concurrent upload cannot replace a successful upload. Record obsolete-object cleanup durably in the same database transaction; cleanup failure never restores stale metadata. Cleanup survives account deletion and cannot remove a currently referenced object.
- Account confirmation uses the maintained modal keyboard lifecycle: initial focus, containment, inert background, Escape, scroll lock and focus return; notices/progress stay in the dialog. Photo removal requires explicit confirmation. Deletion copy distinguishes confirmation, the recovery window and later processing.
- Personal shells provide one focusable main-content target. Protected pages return consistent noindex response directives, including exact root paths, without changing authentication.
- Scheduled maintenance includes retention, with independent last-success and overdue counts for each implemented class. Prove behavior using isolated fixtures; deployment, enabling production scheduling and deletion of real retained rows remain separate release actions.

## Evaluations

| Finding | Required evidence / wrong implementation rejected |
| --- | --- |
| API-01 | Actual quota service + persisted bucket fixture rejects sixth same-IP request across rotated UAs; independent IP unaffected; raw address never persisted. |
| DB-01 | Transactional SQL invokes accepted submissions across distinct portfolios; sixth direct call rejected with no request/outbox; API does not double consume; duplicate no-op and unauthenticated calls covered. |
| API-02 | Actual upload service interleaving and database CAS checks retain successful current attachment; stale/error cleanup cannot restore old row; durable cleanup retries and live-reference protection. |
| UI-01/04 | Browser keyboard opening/Tab/Shift+Tab/Escape/focus return and reauth-return; in-dialog error/progress; truthful recovery/processing copy. |
| UI-02 | Skip link moves focus to one main target on auth/account/verification shells. |
| UI-03 | Cancel confirmation makes no deletion request; confirmed action removes chosen photo; keyboard cancellation supported. |
| UI-05 | Headers match exact and descendant protected paths; access metadata noindex; public landing remains indexable; auth unchanged. |
| OPS-01 | Local expired/current rows per retention class, successful scheduled execution and independent durable health; stale/overdue state unhealthy. Never claim production backlog cleared using local evidence. |

Required integration checks: lint, typecheck, unit coverage gates, isolated migration replay/pgTAP/generated types, production build and affected browser cases. Obtain fresh independent read-only review of final source. Record blocked or unexecuted checks honestly.

## Rollout and recovery

Apply forward-only schema before dependent application code. Validate installed grants/functions and worker secrets/enablement; run synthetic staging checks. Inspect production health before and after an explicitly authorized maintenance run. Monitor each cleanup class independently. Quota rollback must not restore an API-only bypass; horoscope rollback must not restore stale-row recovery. No production DNS or email changes.

## Progress / evidence

- Existing code and established patterns inspected; previous completed remediation is merged into base.
- New branch created; unrelated dirty checkout remains untouched.
- Mandatory `linear_phoenix` connection is unavailable in this session; no alternate workspace connection will be used. Keep this repository record until the required connection can synchronize NAK-74.
- All nine source fixes are implemented; the latest correction evidence and remaining release gates are below. No deployment or production cleanup performed.


## Decisions and implementation map

- The anonymous key is IP-only rather than a second RPC bucket: authenticated quota RPCs intentionally ignore the anonymous hash, so a second identical consumption would double-charge accounts. Existing trusted-proxy validation and HMAC privacy remain.
- The canonical private interest engine charges immediately before insertion, after its idempotent duplicate return. API maps the database denial to 429/Retry-After.
- Horoscope reservations and CAS live in one forward-only migration; `HoroscopeRepository` exposes the guarded commands. Direct browser pointer writes are revoked, including reattachment of retired paths. Failed or abandoned uploads stay tracked before external I/O. Immutable historical disclosure references hold old objects for their existing lifecycle; this is intentional compatibility, not failed orphan deletion.
- The existing interest-modal keyboard lifecycle is extracted into `src/lib/ui/modal-lifecycle.ts` and reused for account deletion. Photo deletion uses the same native confirmation convention as existing horoscope/link actions, including keyboard cancel.
- Protected routes use noindex HTTP headers and access metadata. Robots allows page crawling so search engines can observe noindex; authentication remains the data boundary. API crawling remains disallowed.
- The existing primary scheduler dispatches retention; no competing schedule is introduced. Each retention class gets a separate transaction, bounded 500-row work and independent durable health. `run_data_retention()` remains a compatible bounded operator coordinator.
- Browser fixtures accept explicit alternative local ports, preserving defaults, because an unrelated checkout already owns the normal mock port. That server and other Docker projects are preserved.

## Initial evaluation outcomes

Initial checks caught an obsolete API-only quota test, two old direct-write horoscope tests, a retained robots-disallow expectation, and a local retention SQL variable error. Tests now assert the intended stricter contracts; no valid control was skipped. The upload service interleaving rejects the late writer without deleting/restoring metadata. Full unit coverage passed 1,395 tests and 61 feature gates before the additional in-dialog-error assertion. Isolated focused database tests passed 44 assertions; clean final replay and integrated validation follow. Supabase changelog/functions documentation and WAI dialog guidance were consulted on October 17; installed Next documentation governs response matching.


## Fresh review round 1 and corrections

Three fresh-context read-only reviewers inspected snapshot `ad2d09daf390c92e94b5336f93a3fc9c7c1e1a5f9926997431622c4bf921a21b`. Exact reviewer model IDs were unavailable; no cross-model or human approval is claimed.

- RUI-01 P2 confirmed: locked background plus unconstrained dialog could strand controls on short displays. Added viewport-bound internal scrolling and short portrait/landscape keyboard/error recovery coverage.
- ROPS-01 P2 confirmed: new SQL suites used no_plan, conflicting with the repository fixture gate. Replaced with exact numeric plans; fixture gate and full 1,514 database assertions pass.
- RDB-01 P2 confirmed validation gap: initial live-reference test did not contain a queued live object and SQL completion fencing was untested. Added actual live-object queue fixture, failed cleanup/backoff/reclaim, wrong/stale/expired tokens, successful acknowledgement, foreign-owner commands and invalid-session denial. The reviewer found no separate material database implementation defect.
- Full build initially exposed a malformed-fixture TypeScript inference error; corrected the mock's explicit unknown-data boundary. A later build needed the repository's required public environment values; it passes with nonsecret build placeholders.
- A real loopback SDK/Storage check verified actual service + persisted anonymous quota across 20 rotated User-Agents. It also verified authenticated competing CAS calls, idempotent response recovery and real object cleanup. Logical stale-write conflicts now use explicit PostgREST PT409 rather than a native serialization-failure code; real HTTP409 was confirmed. No provider email, production service or live data was used.

A [plain-language explanation](../../security/expanded-readiness-explained.md) maps all nine observations to product scenarios and reusable engineering lessons.


## Historical pre-integration verification — October 17, 2026

Fresh review round 2 (`7a170062d30baab36ec82a963323375c8030952eec8651505c9d5336bf9808e6`) resolved RUI-01, ROPS-01 and RDB-01 with no further material findings from any of the three scoped reviewers. All final implementation/test/config/type files match that reviewed snapshot; subsequent changes here and in the runbook/project map are handoff-only documentation.

| Check | Result |
| --- | --- |
| `npm run test:unit:coverage` | Passed: 1,396 tests, 61 feature gates. |
| Clean isolated migration replay + complete pgTAP suite | Passed: 56 suites, 1,514 assertions. |
| `npm run db:smoke` | Passed: numeric fixture plans and migration conventions. |
| Generated public database types | Regenerated from clean migrated local database; exact comparison passed. |
| Supabase database lint, public + app_private | Passed error gate; four existing unused-parameter warnings remain in historical publication/BrokerDesk functions. |
| `npm run lint`, `npm run typecheck` | Passed; lint retains two existing image eslint-disable warnings. |
| `npm run build` | Passed with nonsecret public build placeholders. |
| Responsive browser checks | Passed 24 distinct Chromium cases across desktop, tablet and mobile projects, combining the 21 unaffected passing cases with the three corrected short-screen reruns. Includes keyboard confirmation cancellation, reauth return, error recovery, skip focus, indexing responses, photo cancellation/confirmation and shared interest-modal consumers. |
| Actual SDK/isolated Storage boundary experiment | Passed: actual persisted anonymous quota across 20 changed UAs, simultaneous CAS winners/losers, HTTP409, idempotent retry, retired object removed/current object retained. Synthetic local fixtures only. |
| `npm run security:audit` | Passed: zero affected packages, no exceptions. |
| TruffleHog 3.97.9, changed-file filesystem scan | Passed: zero findings; offline/no verification, no network credential checks. |
| Impeccable mechanical detector | No findings on inspected changed UI targets. |
| Independent review | Three fresh-context reviewers, two coordinated rounds; no unresolved material source finding. No human/cross-model certification asserted. |

Final main fetch still resolves `d1e08f8`; no integration drift. Graphify is unavailable and no graph exists here. Reports and raw execution logs are retained outside the repository under `/Users/nagarjunmallesh/.codex/reports/nak74-expanded-2026-10-17/`.

**Release limits:** apply and verify the three new migrations, coordinate application deployment, enable/verify the primary maintenance schedule and explicitly authorize a real retention run. The original 54-row production backlog is not represented as cleared. Historical immutable disclosure references intentionally hold cleanup until their own lifecycle releases them. Real search-engine removal, physical-device assistive technology and production operational cadence remain unexecuted. The required named Phoenix Linear connection is unavailable; no other workspace was modified.

**Compatibility:** migration-first revocation of direct horoscope writes deliberately rejects the old application's upsert path. Coordinate a short pause of horoscope write operations while applying the schema and switching to the new application version; do not advertise uninterrupted rolling compatibility or roll back to the unsafe restore/upsert flow. This window does not grant extra access.

## Reusable lesson

Centralize a rule at the lowest shared trusted mutation boundary, separate durable state changes from retryable external cleanup, and test the actual failure boundary. Browser styling cannot establish focus behavior; a cleanup function cannot establish scheduler execution; a mocked HTTP client cannot establish real SDK error/response handling.


## OPS-VERIFY-01 correction and latest-main integration

The subsequent requested fresh verification confirmed a pre-existing omission: the canonical interest writer stores message text in both `message` and `request_reason`, while cleanup cleared only the former. Monitoring also ignored the leftover copy. This supersedes the earlier no-material-findings conclusion for retention. Source review report: `/Users/nagarjunmallesh/.codex/reports/nak74-expanded-verification-2026-10-17/review.md`.

Authorized correction plan:

- Clear both text copies in the same bounded transaction.
- Centralize eligibility in a private row predicate reused by mutation, remaining count and overdue health, preventing drift.
- Preserve normal 180-day-after-update eligibility and rejected/closed status restrictions. Repair older records carrying the exact previous cleanup signature (all previously-cleared fields NULL and metadata empty, but request_reason remains), even when the old cleanup refreshed updated_at. Require created_at older than 180 days; fresh skeletal, open and approved requests remain protected. This narrowly recognizes legacy partial cleanup rather than treating updated_at as the original activity date.
- Add adversarial SQL regression before implementation: duplicated message, already partially scrubbed row with updated_at today, repeatability, monitoring, bounded batches, current/open/approved controls and service-only guards.
- Earlier new migrations remain unreleased/unpushed; update the pending scheduled-retention migration rather than rewriting historical migrations on main. Production data remains untouched.

Integration: preserved all local work in Git stash `a88a2743cf1c1faf8af63690e49f08069e2cce72`, advanced this branch from `d1e08f8` to fetched main `fc7f55c`, reapplied the work, and resolved only the project-map documentation conflict by preserving both entries. Automatically merged overlapping code requires the full integrated checks and fresh review before readiness. Stash remains a recovery reference until work is validated.


### Implemented correction and independent verification

OPS-VERIFY-01 is confirmed pre-existing and corrected in source. The original scheduled-retention implementation retained the same omission. The initial real local Supabase reproducer failed six of 15 assertions; the corrected retention + expanded suites passed 63 assertions. The final retention suite now has 18 assertions. Added two assertions to the real account-deletion worker suite (26 total), not merely a simulated erasure UPDATE.

The pending retention migration now uses private `interest_request_details_cleared` and `interest_request_retention_due` helpers across cleanup, remaining count and overdue health. The bounded UPDATE clears both `message` and `request_reason`. A private BEFORE UPDATE trigger completes duplicate-text erasure when any caller performs the complete personal-details erasure transition. This covers the historical account-deletion preparation writer without rewriting its destructive implementation or historical migrations. Ordinary retention still preserves open/approved and current requests; explicit account erasure deliberately applies regardless of request status. Legacy repair is limited to old rejected/closed rows matching the exact previous scrub signature; it is not a claim to reconstruct all historic erasure provenance.

Fresh review round 1 on the integrated correction used snapshot `e9c9d9fcbcf8b68f20ab1060057a24b3576e8bffc044cd8fb2388368275b9bc7`, HEAD/base `fc7f55cdbc8cc094db927790dfba7157adbc698c`. Two fresh-context default-model reviewers operated read-only; exact model identity unavailable, no human/cross-model review claimed. Both returned no material source findings and verified source freshness before these documentation-only handoff updates.

- Retention reviewer compiled the exact pending migration in isolated native PostgreSQL 14 and passed 24 behavioral/adversarial assertions. These executed actual historical public/private deletion preparation, tested both text copies, old partial repair, bounded 3→2→0 counts, protected controls, service guards and invalid limits. A forced constraint failure rolled back both erasure and success evidence. Minimal ancillary schemas mean this is focused SQL evidence, not complete Supabase replay.
- Integration reviewer traced automatically merged consumers, canonical quota, CAS/cleanup and preservation of main's wording. Fresh isolated Chromium executed the exact shared modal helper; containment, nested inertness, Escape/focus restoration, skip focus and empty-dialog fallback passed. Exact Next matcher checks passed 39 protected URL variants and the public landing control.
- Fresh application checks pass 1,412 unit tests and 61 coverage gates, lint (two pre-existing unused-disable warnings), typecheck, numeric database fixture gate, diff hygiene and dependency audit (zero affected packages).

**Historical validation interruption (resolved by the Docker retry below):** after the focused 63-assertion Supabase pass, the local Docker engine stopped answering even its read-only ping. A subsequent full account-deletion pgTAP attempt could not connect to the local port. Full integrated clean Supabase replay, complete pgTAP, DB lint and regenerated-type comparison must be rerun when the local engine works. The real deletion functions passed the independent native PostgreSQL checks, but the full 26-assertion repository pgTAP file remains unexecuted on the final snapshot. No global Docker restart, other-project container change or production mutation was performed. Prior 1,514-assertion full-Supabase evidence remains historical and does not substitute for this gate.

Reports and raw evidence: `/Users/nagarjunmallesh/.codex/reports/nak74-retention-fix-2026-10-17/`. Detailed browser/build completion is recorded below. Changes remain local and unpushed. Required `linear_phoenix` synchronization remains unavailable; no alternative workspace was written.


### Final integrated application results

- Production build passed with the repository-required nonsecret public build placeholders.
- The five affected browser suites covered 48 distinct desktop/tablet/mobile cases. Initial batch: 46 passed, two tablet failures (one still-loading 5-second assertion and one browser context teardown timeout during concurrent build). Both exact cases passed individually after the build with unchanged tests/source. Preserve the first failure logs and traces as environmental/flake evidence; this is combined passing coverage, not a clean single 48-case run.
- A final fetch still resolves origin/main to `fc7f55c`; this branch HEAD matches it with the feature changes applied. No integration drift found.
- All implementation, configuration, migration and test file hashes still match the independently reviewed snapshot. Only the four project/feature/runbook/explanation documents changed afterward.

**Disposition before Docker retry:** OPS-VERIFY-01 source correction and latest-main integration complete. Application checks and required fresh source review pass with the browser rerun qualification above. Full database release validation remains blocked as documented; do not merge/deploy based solely on this handoff. No commit, push, production migration, schedule change or real backlog deletion occurred in this correction turn.


### Docker retry — full database validation completed

Docker initially still failed read-only engine/status checks. A normal Desktop restart timed out; graceful termination removed backend children but left a childless host backend stuck. After verifying its exact process identity and absence of children, the remaining host process was closed and Desktop reopened. No Docker reset, prune or unrelated volume/container deletion occurred. The virtualization log records a host `no space left on device` error before the earlier VM shutdown; the new VM booted and the test database recovered normally. Only regenerable `.next/cache` and `.next-e2e/dev/cache` under this worktree were removed to reduce pressure. Disk space remains low; no unrelated project files were cleaned.

Refreshed the task-owned `nak74-readiness` scratch migrations/tests/templates and ran all commands explicitly local against its ports 55421/55422. Results supersede the preceding database blocker:

| Check | Current result |
| --- | --- |
| Clean local Supabase reset / complete migration replay | Passed, including all three pending expanded-readiness migrations. |
| Complete pgTAP suite | Passed: 57 suites, 1,534 assertions, including the full 26-assertion real account-deletion worker and 18-assertion duplicate-message regression. |
| Public + app_private database lint | Passed error gate; four historical unused-parameter warnings remain unchanged. |
| Security advisors, warn/error level | Passed; no issues returned. This is the database advisor scope, not an exhaustive product security certification. |
| Generate public types + repository comparison | Passed; generated types exactly match checked-in public schema types, with only repository-permitted newline normalization. |
| Source provenance | All implementation/configuration/migration/test files remain identical to the independently reviewed source; this retry changes documentation/evidence only. |

The full database validation blocker is resolved. Earlier application results remain applicable to unchanged source: 1,412 unit tests/61 feature gates, production build, lint/typecheck/audit and 48 distinct browser cases with the two isolated reruns recorded above. Production deployment, installed-schema verification, scheduler activation and authorization of real cleanup are still separate release actions; no perfect-code or live-backlog-clearance claim is made. No new application code, commit or push was required for this retry. The task-owned synthetic stack was stopped after validation; Docker Desktop and unrelated project volumes were preserved. Retry logs and regenerated types are saved outside the repository in the existing report directory's `docker-retry/` folder.
