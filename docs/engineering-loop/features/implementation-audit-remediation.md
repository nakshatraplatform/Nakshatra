# Implementation audit remediation

## Current increment: resolve PR 138 against main

The user authorized merging current `main` after GitHub reported conflicts. This
supersedes the earlier topic-only integration boundary below. Starting topic:
`55c4e21cf826c4d24cc1d7c887114e0c08e58ae9`; incoming main:
`1cadea4080690c4782f0af4706ee21ef6a4ac197`. Critical integration review applies
because cleanup, owner authorization, consent and database contracts overlap.

Preserve main's published-snapshot disclosure revision, task-first dashboard,
authoring-choice validation, hydration safeguards, password recovery, email,
observability and family-viewer behavior. Its October 19 landing decision also
supersedes the earlier viewport fallback: animate across viewport sizes unless
reduced motion is requested.

Reuse main's `/api/dashboard/relationships` and `get_owner_relationship_page` as
the canonical owner/live-session queue. Remove this branch's duplicate endpoint,
hook, contract and unreleased queue DDL; retain the 60-record pagination and
authorization regressions against the canonical RPC. No deployed migration is
rewritten. The additive audit migration retains photo retirement/cleanup and the
transactional eight-photo cap. Keep extracted media/relationship components,
partial-upload recovery, shared modal lifecycle, request-scoped public reads,
batched signing, deferred view writes and validation reuse.

Acceptance: conflict-free ancestry containing both revisions; lint, typecheck,
unit/feature coverage, build, security audit, clean migrations/pgTAP, generated
types, concurrency and affected browser checks pass; fresh independent review
has no unresolved material findings. Push to the existing compliant PR branch.
No production deployment, remote database writes, provider calls or PR merge.
Verification and review results for this increment will be recorded below.

### Main-merge review correction

Fresh-context review round 1 (`/root/main_merge_independent_review`, model not
reported by the host) found `MAINMERGE-REVIEW-001`, P2: overlapping deletion of
duplicate legacy photo paths can skip both retirement jobs when the draft has no
publication-progress row. The committed concurrency harness reproduced zero
queued obligations before the fix. Its expanded cases now cover the duplicate
deletions and attachment racing retirement as well as the eight-photo cap.

The undeployed migration now acquires parent locks before ordered path locks for
attachment/update/deletion. A new BEFORE DELETE trigger shares that enforcement
function and returns OLD before attachment-only checks, preserving cascade
  deletion. After-retirement checks run under those locks.

### Main-merge verification and limits

- Passed: lint without warnings, Next route generation/typecheck, fixture checks,
  dependency audit with zero affected packages, production build, 1,829 unit tests
  across 217 files, and coverage floors for 64 feature files/21 protected boundaries.
- Before the final retirement-lock correction: clean Supabase PostgreSQL 17
  migration replay, 1,959 pgTAP assertions/67 suites, public generated-type drift
  check, real authenticated photo-cap concurrency, readable-link allocation,
  family-viewer limits, both approval/retry overlap orders and four email HTTP
  integration cases passed. Four inherited SQL unused-parameter warnings remain.
- After the correction: a fresh reviewer independently passed six exact-function
  PostgreSQL 14 concurrency/cascade/derivative cases and 77 unit tests. This is
  focused SQL semantic evidence, not a full Supabase/PG17 replacement. Review
  round 2 resolved `MAINMERGE-REVIEW-001` with no new material findings on snapshot
  `52970bc935372b580c37c0cf7c5f567d5456aa4ecb2a6137d3ff3ea200637218`.
- Fresh browser run: 155 passed, one intentional skip, across desktop/tablet/mobile
  Chromium, covering merged navigation, landing, keyboard dialogs, old-grant
  pagination, published-consent failure/retry and per-request cache/deferred writes.
  A missing synthetic-token fixture was corrected without changing application
  authorization or weakening assertions. The broader 786-case attempt was
  interrupted by local disk exhaustion; it is not recorded as a complete pass.
- Final clean Supabase replay, expanded authenticated retirement harness and
  committed-range secret scan remain for hosted CI: Docker stopped responding
  after local storage exhaustion. Only task-generated Next caches were removed;
  other project containers were not restarted. No production services were called.

The public RPC shape is unchanged by the final private trigger/locking correction.
Two fresh-context independent rounds were used for this integration; reports and
immutable before/after evidence are retained under `/tmp/nak-main-merge-review*`.
Push/CI and deployment are distinct gates. Do not infer release readiness from
conflict resolution or the focused local checks.

## Execution context

2026-10-25, working copy on `test/nak-84-coverage-hardening`, starting HEAD
`ef0eb7d`. Existing account/navigation/landing and browser-test edits were initially
unrelated and are preserved; the follow-up includes their integration failures.
Graphify graph is absent. Full record: critical risk because
this increment changes private cleanup, owner projections and database concurrency.

## Contract and scope

Implement the audit's four correctness findings first:

1. Deleting photo metadata must atomically preserve a storage cleanup obligation.
   Storage failures must be retried by existing maintenance; no new scheduler.
2. Owners must reach older pending interests and grants, with existing management
   actions, through bounded server pagination rather than a newest-50 window.
3. Successful photos in a partially failed batch must appear immediately and
   invalidate publication review. Never automatically repeat a failed POST.
4. Concurrent writes must not exceed eight profile photos per portfolio.

Preserve owner/live-session authorization, signed-media restrictions, disclosure
history, representative verification and existing action confirmation. No production
mutation, deployment, quota reset or unrelated visual redesign.

## Design basis

Reuse `horoscope_object_cleanup`'s transactional outbox/leased worker pattern for
retired photo objects. Keep photo cleanup separate because immutable BrokerDesk
disclosure references and photo metadata have their own lifecycle. The database
owns retirement and cap enforcement; the existing maintenance endpoint consumes
only database-authorized object paths. Retired paths cannot be reattached while
cleanup is in flight. Retain referenced disclosure objects.

Use a new owner/live-session RPC for complete relationship queues. Keep existing
projections compatible for initial summaries and existing deployments. Existing
PATCH routes remain authoritative for approve/reopen/renew/revoke decisions.

## Evaluations

| Invariant | Check that rejects an incorrect fix |
| --- | --- |
| Cleanup survives storage failure | Delete queues original/thumbnail/blur atomically; worker failure retains a job; retry and stale leases tested |
| Private paths remain private | Anonymous/non-owner RPC tests; worker functions service-role only; retired paths cannot be reattached |
| Older records remain actionable | More than 50 records, pagination reaches oldest pending interest/active grant, UI opens existing management actions |
| Partial batch preserves success | First upload succeeds, second fails/throws; first remains visible, review invalidates and no automatic retry |
| Eight-photo cap | Two transactions starting at seven photos cannot both commit |
| Compatibility | Existing media, relationship, maintenance and dashboard suites; generated public DB types; lint/type/build and clean migration/pgTAP |

## Baseline evidence

Prior read-only audit: 212 passing tests, one existing dashboard test failed
before its unsaved-state assertion because the streamed account header had not
settled. Typecheck passed. Existing audit findings 5–14 are subsequent increments,
not claimed resolved by these four corrections.

## Delivery and recovery

Deploy the additive migration before matching application/worker code. Existing
photo deletion already loses cleanup obligations on failure; do not claim this
migration can discover every historical orphan. No existing stored object is
deleted merely by applying the migration. Production storage/worker execution is
separate from local validation. Roll back application code without dropping queued
cleanup obligations. Current validation and independent review are recorded below;
deployment and unrelated checkout gates remain separate.

## Implemented increment

- Audit 1: `photo_object_cleanup` is filled by a transactional media retirement
  trigger. Metadata deletion now succeeds independently of transient Storage
  outages; existing maintenance consumes up to five leased paths per run, retries
  failures with bounded backoff and refuses stale acknowledgements. Canonical legacy
  owner/file paths remain supported; live duplicates and immutable disclosure
  references are retained. Historical untracked orphan discovery and abandoned
  upload intents remain outside this deletion correction.
- Audit 2: `/api/relationships` and `list_relationship_queue` page eight records
  with server-side search/filtering and exact existing action IDs. SQL and HTTP
  boundaries require live owner authorization. Initial summaries count all matching
  pending/set-aside/active records while keeping their bounded recent cards.
- Audit 3: every successful upload applies its photo/URL and invalidates review
  before the next file. A subsequent rejected or thrown upload preserves successes
  and unsaved answers without retrying the POST.
- Audit 4: media cap enforcement locks the parent portfolio before counting;
  moving a record locks both affected parents in ID order. The standalone overlap
  check is included in database CI and refuses non-loopback connection settings.
- Adjacent audit 5: failed/malformed owner interest/access reads surface an error
  rather than false empty queues. Audit 12: the existing real-page unsaved-answer
  test now awaits streamed header rendering through async `act`.

## First increment validation (historical, 2026-10-25)

- Partial-batch regressions were observed failing before the correction, then
  pass for returned errors and exceptions, preserving unsaved text.
- Seven focused files: **159 tests passed** on the final source, including the
  independent review's broker-history regression.
- Full local Supabase PostgreSQL 17 schema initialized with real GoTrue/Storage
  migrations; all application migrations replayed from a clean application schema.
  Docker's default data volume ran out of space; an isolated container with host-backed
  data storage resolved that environment blocker. No other project's containers or
  data were modified. Local buckets match `supabase/config.toml`.
- **59 pgTAP suites / 1,594 assertions passed**, including 29 new assertions.
- Real overlapping transactions: one gallery write commits and the competitor fails
  with 23514, leaving eight photos. Negative control with the original unlocked
  trigger fails this same check; the corrected trigger was restored and passes.
- Public database types regenerated and compared exactly; typecheck, production
  build, `db:smoke`, Oxlint and focused ESLint pass.
- Existing modal/dashboard browser checks: **10 Chromium cases passed**. New
  older-grant/error/retry/paging/revoke journey passes desktop, tablet and mobile
  Chromium. The mobile test first raced responsive hydration; it now explicitly
  awaits the collapsed stage before opening it. No physical-device claim.
- Full unit run: 1,592 passed / 4 failed in three unrelated dirty account/landing
  test files; one unhandled rejection comes from the account router mock lacking
  `refresh`. Landing GSAP mock lacks `timeline.set`, and SocialLoginButton's color
  transition violates an existing brand test. These files were not changed here.
- Global lint: blocked by eight errors in untracked generated
  `brag-output/composition/assets/gsap.min.js`; focused first-party lint passes.
- Database lint: no errors; four existing unused-parameter warnings in historical
  broker/publication functions. Local Supabase security advisors: no issues found.
- Fresh-context independent review completed in three bounded rounds, reviewer
  `/root/audit_remediation_review` (exact model unavailable), with source hashes
  unchanged before/after each round. Initial finding **AUDIT-REVIEW-001**, P2,
  introduced by the queue migration: broker responses bypassed search/filtering
  and repeated without a bound. Confirmed and corrected with an eight-record
  independently paginated subsection shown only on the first history page, retaining
  recipient search/source filters and existing detail actions. The reviewer's
  scratch reproducer fails on the original change, passes after correction, and
  final review reports **no material findings**. Round 2 independently ran all
  96 dashboard tests. Round 3 verified a one-line test-only typing correction:
  Testing Library requires an exact-name regex rather than Playwright's `exact`
  option. Final typecheck, production build, lint and 159 focused tests pass;
  the three responsive queue browser cases also pass after the UI correction.
  Final reviewed manifest:
  `e33b6ce849b0b674f9ca8459109036522194527f88a9acf5bb99bc96ac73f33b`.
- The overlap harness now performs competing writes as the authenticated owner,
  using the shared live-session fixture. Setup/inspection/cleanup use the trusted
  fixture role. Its positive and original-trigger negative controls pass/fail as
  intended after this strengthening.

## Remaining increment contract (approved 2026-10-25)

The user requests all remaining audit fixes plus the account/landing tests and lint
failures, with full verification before any push. Apply Ponytail and the production
engineering loop; preserve existing local features and authorization. Critical tier
continues to apply to privileged signing and the combined migration/application diff.

| Audit | Smallest complete correction | Verification |
| --- | --- | --- |
| 6 | Request-scoped public resolution/client reuse across metadata, page and availability | Actual Next request counts and cross-request/viewer isolation |
| 7 | Batch authorized photo paths; keep per-item failures and grant TTL | One request for eight paths, partial failures, private derivatives/hidden filtering |
| 8 | Register view recording with Next `after` | Deferred callback and browser/RPC boundary |
| 9 | Reuse shared modal keyboard/scroll lifecycle | Nested confirmation, focus restoration, Escape and working-state behavior |
| 10 | Extract coherent dashboard responsibilities without changing state ownership | Unsaved/autosave/review/media/relationship regressions and browser journeys |
| 11,14 | Remove unused shader dependency and dead helpers/forwarding wrapper; retain account export API | Import/caller scan, lockfile, audit, loading and account tests |
| 13 | Reuse/memoize matching validation results without coupling different contracts | Form validation/error/section tests; no unsupported speed claim |
| Integration | Repair outdated account/GSAP mocks; honor existing motion rule; exclude generated output from source lint | Full lint, typecheck, coverage/feature gates, build, database and browser suites |

No production writes or scheduler activation. Independent review of this new
increment must include the integration with the already reviewed correctness work.

## Remaining increment implementation

- **6:** React request cache reuses the public projection/badge across metadata,
  page and availability reads; the page reuses its request client. Approved
  projections remain authenticated and are not cached across requests. Real Next
  browser tests count one resolution/badge per render and new reads after reload.
- **7:** a shared Storage batch signer receives already-authorized paths and TTL.
  Owner/public/approved services retain visibility/derivative rules, canonical
  private paths and grant-limited expiry. Eight photos require one signing request;
  individual failed entries remain omitted.
- **8:** view recording uses Next `after`, capturing request dependencies during
  render. Callback and real browser/RPC tests cover completion after the response.
  This is response-lifetime work, not a durable analytics queue.
- **9:** account, interest, editor, relationship and lightbox reuse one modal
  lifecycle for focus, nested Escape ownership, inert background and shared scroll
  locks. Native completion dialogs retain native semantics. Gallery arrows/swipes
  remain specific to the gallery.
- **10:** relationship presentation/confirmation and media presentation/actions
  are extracted into cohesive modules. The dashboard retains answers, autosave,
  revisions and publication review. Existing tests caught a missed invalidation
  during extraction; update/delete now call the same review-invalidation callback.
- **11,14:** removed unused `shaders`/`three`, dead auth/browser-export helpers and
  the forwarding loading wrapper. Consumers use `LoadingStatus`; the authenticated
  account-export endpoint remains.
- **13:** matching validation/completion results are reused across progress, errors
  and the form; answer/photo changes recompute them. Server publication checks stay
  authoritative. No measured latency improvement is claimed for this cheap calculation.

### Integration corrections and lessons

Account mocks now supply the router's existing `refresh`; GSAP mocks cover the actual
timeline/refresh contract. Google signup honors the existing no-color-transition
rule. Generated marketing/scratch output is excluded from source lint without
disabling first-party rules.

Browser checks exposed an actual landing regression: enhancement was enabled at
every size despite the existing feature contract and the owner's mobile request.
Bookshelf enhancement now requires 860px width, 700px height and no reduced motion;
narrow/short layouts retain normal-flow cards. Ineligible animation overrides were
removed. Existing fallback/resize/hash/keyboard/no-JavaScript tests remain. Obsolete
sticky-card assertions now check bounded books, a readable final line and full-height
scene. Semantic selectors target current controls, including Google signup. The
contrast scanner excludes only one-pixel `inset(50%)` screen-reader labels, which
do not paint text over the masked wordmark; visible contrast thresholds remain.

The clean database run exposed a pre-existing timing-dependent recovery fixture:
wall-clock-minus-one-second can lie after transaction `now()`. Two fixture jobs now
use `now()`, matching claim eligibility. With an injected 1.2-second delay, the exact
original stops after 29/35 assertions; the correction passes 35/35. Production claim
and deadline logic are unchanged.

The current dependency audit required compatible supported updates: Next 16.4.3,
Zod 4.6.7, Undici 7.30.1, Vite 8.3.5 and Vitest/coverage 4.1.12. Registry audit now
reports zero affected packages. No force upgrade, override or security exception.
Installed Next cache/`after` guidance was checked again after the update.

## Combined follow-up verification

- Patched dependencies: **196 unit files / 1,598 tests pass**, with bounded workers.
  Lines 90.09%, statements 86.58%, branches 82.32%, functions 86.63%; all **63 feature
  files / 18 protected-boundary gates pass**, without lowering floors.
- Final full lint, TypeScript, security audit and production build pass after the
  landing corrections; 55 affected account/auth/landing/server-page unit tests also
  pass. Security exceptions remain empty.
- Clean Supabase PostgreSQL 17/GoTrue/Storage and application migration replay pass.
  **59 pgTAP suites / 1,594 assertions pass**. Public types match exactly; `db:smoke`,
  security advisors and real authenticated competing photo writes pass. DB lint has
  the same four historical unused-parameter warnings. All DB work used the isolated
  loopback database, whose container was stopped/removed afterward. Other projects
  were untouched.
- Fresh-context independent round 1 found no material defects and independently
  passed **224 tests / 11 files**, including all dashboard tests. Round 2 reviewed
  landing/timing corrections with no material findings. Exact model unknown.
  Independent scratch browser execution was blocked before tests by Turbopack's
  external dependency-symlink restriction; no browser pass is attributed to that
  reviewer. Final source/review evidence will be recorded below.
- Graphify is unavailable (`command not found`) and no graph exists. Production
  Storage/provider execution, hosted CI, physical devices and live inbox delivery
  are outside these local checks. No commit, push or deployment performed.

### Browser result reconciliation and source freshness

The full 519-case Chromium desktop/tablet/mobile sweep completed with 498 passes,
six existing viewport-conditional skips and 15 landing failures. They exposed the
fallback defect and stale/ambiguous presentation assertions described above. Some
workers had already collected the older test titles/selectors during correction;
the failed run is retained as historical evidence, not reported as green.

A fresh, separately owned run of **201 cases in all seven affected browser files**
passes across all three projects on the corrected source, with no retries. This
covers every failed full-sweep case plus neighboring landing, scrolling, public
portfolio, signup, typography and contrast checks. The remaining full-sweep cases
did not depend on the landing-only correction. Combined coverage is 513 distinct
passing cases and the same six intentional skips, rather than a claim that the
original full-sweep command passed. Final `git diff --check` is clean.

Validation logs are local `/tmp/nak-audit-final-*`, with the clean affected browser
run at `/tmp/nak-audit-landing-clean-e2e.log`. Review source is captured separately
from this evidence prose so documenting results does not change the tested code.

### Integration target discovery (historical; resolved below)

Read-only fetch found the local branch `test/nak-84-coverage-hardening` at `ef0eb7d`
is three commits behind its remote topic branch. Current remote main `1cadea4` is
55 commits ahead of the local base and includes newer email, onboarding, family
viewer and Sentry changes. Fifty-seven dirty tracked paths also changed on main.
The local results above do not establish compatibility with those unintegrated
revisions. The user has been asked whether to integrate current main, only the
remote topic branch, or retain this base without pushing. No upstream commits have
been applied and no push/readiness claim is made while that scope choice is pending.

### Final independent review

The remaining increment completed its bounded three review rounds with
`/root/remaining_audit_review`, fresh context, exact model unavailable. Final verdict:
**no material findings**. The reviewer independently checked all 112 full-manifest
paths and all 107 code/config/test paths before and after the final round, verified
the corrected illustration assertion, reconciled every historical browser failure
with the 201-case rerun and confirmed the remote ancestry limitation.

Final reviewed code/config/test manifest:
`6a9cf5a9bb49827d27a8f7f3ff0fc224554d58ea607ed41436992667c682022f`,
base `ef0eb7da8238a442e4cac74dfe81abb2671295a6`, review freshness
2026-10-26 01:07:56 UTC. Only this evidence prose was appended afterward; code,
dependencies, tests and configuration remain unchanged. Integration with the chosen
upstream source requires new affected validation/review before push.

## Approved topic-branch integration (2026-10-25)

The user selected **only the three newer remote topic-branch commits**, rather than
current main. This is a separate integration increment: preserve the reviewed audit,
account and landing implementation while fast-forwarding to `b827dc2` (including
`9f0bf6d` and `c5613a6`). Current main is intentionally outside this integration.

Contract: retain both durable photo cleanup and the upstream expiry-reminder
producer/health/pre-send fencing. A slow or failed reminder producer must not starve
photo cleanup; failed cleanup must not starve existing email work. Keep both RPC
additions in generated types, preserve both feature records, and replay both ordered
migrations on a clean isolated database. No production scheduler/provider mutation.
Critical risk continues to apply to maintenance and migration integration.

Before integration, changed tracked/untracked source was backed up outside the
checkout and saved as stash `a6da45df9722d46baa988e72fdee4a245c641e92`; generated
marketing output was excluded and left untouched. The branch fast-forwarded without
rewriting remote history. Restoring the stash produced one documentation conflict;
both the expiry-reminder and landing feature entries were retained. Maintenance,
its tests and generated types merged automatically and require combined checks.

Acceptance: full unit/coverage/lint/type/build/security gates; clean combined
migration/pgTAP/types/concurrency checks; maintenance isolation regressions; affected
browser smoke; fresh independent review of the integrated snapshot. Commit and push
only this topic branch after applicable checks pass; latest-main compatibility and
production execution remain outside the selected target.

### Topic integration verification and review

- **1,614 unit tests / 197 files pass** after integration. Coverage: 90.11% lines,
  86.62% statements, 82.41% branches, 86.66% functions. All 63 feature-file and
  18 protected-boundary gates pass. Full lint, typecheck, production build, security
  audit (zero affected packages) and fixture smoke pass.
- Clean ordered migration replay includes the upstream expiry migration and the
  audit migration. **60 pgTAP suites / 1,657 assertions pass**. Regenerated public
  types match exactly, database security advisors report no issues, and SQL lint
  retains only the four previously recorded unused-parameter warnings.
- Real competing authenticated gallery writes still enforce the eight-photo cap.
  Maintenance/photo-cleanup/expiry/mail focus: **54 tests pass**, including pending
  producer and independent failure scenarios.
- **18 browser cases pass**, without retries, across desktop/tablet/mobile Chromium:
  avatar navigation, password recovery, older sharing records and real request-cache/
  deferred-view behavior. The other reviewed UI code is byte-identical to the prior
  passing audit snapshot, so its 201-case presentation matrix remains applicable.
- A fresh integration reviewer `/root/topic_integration_review` (exact model unknown)
  independently passed the 54 focused tests and checked all 120 full-manifest / 113
  code paths. Verdict: **no material findings**, integration round 1. It verified
  precisely the three selected upstream commits, both worker tasks, failure/lease
  fencing, migration/privilege/type compatibility and preservation against backup.
  Reviewed code manifest: `635eac24dcf546c44bb1f7d1f2b86204cd596ac74709295699bf8b5e971a00da`;
  base `b827dc2d9ec94b0a5de9593e97851f12089bbf71`, freshness 2026-10-26 01:57:05 UTC.
  Only evidence prose was appended after review; final code hashes are checked
  again before commit. Logs: `/tmp/nak-topic-integration-*`.

The previous pending target choice is resolved. The intended push is a normal
fast-forward to `test/nak-84-coverage-hardening`, preserving remote history. Main
was not integrated or modified. PR #116 for the older branch revision is already
merged; pushing does not reopen it. A new PR/main compatibility, hosted CI and
production/provider execution remain separate from this selected-target verification.
