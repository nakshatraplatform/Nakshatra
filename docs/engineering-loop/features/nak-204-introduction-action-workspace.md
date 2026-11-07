# NAK-204 Introduction action workspace

Status: implemented and validated locally. Application checks, the complete
Supabase PostgreSQL 17 database job, and independent correction review passed.
Not committed, merged or released. Risk: Critical (tenant authorization and migration).
Documentation mode: Full. Branch: `feat/nak-204-introduction-action-workspace`.
Baseline: main `c675159`, carrying uncommitted NAK-202 and NAK-203 work.

## Goal and non-goals

Open an Introduction, share separately with each family, record the broker's
sharing confirmation, start reminders, and see responses and safe history.
Reuse BrokerDesk headers/tokens/loading/error components, live sessions,
canonical activation and the Introduction repository. B2C behavior is unchanged.
Family reports/comments belong to NAK-205; family disclosure/grants to NAK-206.
No automated WhatsApp sending, delivery/read claims or candidate response proxy.

## Data and authorization contract

- Two share-state rows are created atomically per identity-bound Introduction.
  Historical activation backfills `not_started`, never fabricated delivery.
- Composite tenant FK, closed side/state values, positive versions, bounded
  counts and timestamp checks protect the private table. No direct client or
  service-role grants. Authenticated guarded RPCs own operations.
- Reading requires `customers.read` scoped to both participants and both live
  read mandates. V2 read compatibility remains. Sharing requires
  `introductions.manage_sharing` on both sides, both V3 mandates and current
  publication/readiness. Owners/admins are organization-wide; assigned advisors
  and coordinators need both participants assigned. Viewer role cannot share.
  Activation remains the existing `introductions.send` boundary. Coordinators
  need an authorized sender to activate a created Introduction before they can
  manage its side-sharing operations; the UI explains this handoff explicitly.
- Resource refs and side values never grant authority. Live identity, workspace,
  assignments and mandates determine access. Both recipients use the existing
  identity-bound participant URL; no contact or capability is encoded in it.
- Commands lock Introduction then side row, fence the side version, bind actor
  and exact payload to the idempotency key, and atomically write state, safe
  event and audit. Expired keys can be reused after their existing TTL.
  Candidate responses and grants never change through this command.

## Interaction and recovery

1. Open an Introduction from the list, customer page or dashboard.
2. Choose a side and Share on WhatsApp or Copy link. A created Introduction
   first uses canonical activation, then a separate per-side attempt command.
   This avoids calling the global expiry worker while holding an intro lock.
3. Send to the correct family's trusted conversation. **I shared with this
   family** records only the broker's explicit manual confirmation.
4. Reminder attempts require a waiting side, prior sharing attempt/confirmation,
   active response window, 24-hour cooldown and fewer than 30 reminders.
5. Refresh retrieves current permissions, responses and latest 100 safe events.

Popup blocking creates no attempt. Clipboard/popup failure after command success
leaves an honest attempt and requires refresh. Activation followed by a failed
side command leaves no false side confirmation. WhatsApp cancellation cannot be
distinguished from an unsent attempt. Message text contains no names/contacts.
Existing activation, notification and expiry workers keep their current ownership;
no automatic email or WhatsApp dispatch is added by a manual sharing command.

## Pages, RPCs and endpoints

| Surface | Responsibility |
| --- | --- |
| `/brokerdesk/w/[workspaceRef]/introductions` | Bounded server-rendered list, pagination, empty/error states |
| `/brokerdesk/w/[workspaceRef]/introductions/[introductionRef]` | Two side cards, responses, allowed actions and history |
| `resolve_brokerdesk_introduction_actions` | One bounded query, default 25 / maximum 50, timestamp/ref cursor |
| `resolve_brokerdesk_introduction_action` | Both side states, responses and latest 100 controlled events |
| `record_introduction_share_action` | Guarded versioned/idempotent side mutation |
| `GET .../workspaces/[workspaceRef]/introduction-actions` | Strict list query; existing relationship-filtered GET stays compatible |
| `GET .../introductions/[introductionRef]` | Private detail projection |
| `POST .../introductions/[introductionRef]/share-actions` | Same-origin, bounded JSON, strict schema, session and existing update throttle |

API outcomes retain private no-store and no-referrer headers. Strict output
schemas reject extra private fields. Timeline exposes controlled type/time/side,
never arbitrary safe_details, actor identity or comments. Pages are dynamic/noindex.

## Evaluations

| Wrong implementation being rejected | Evidence required |
| --- | --- |
| Both sides marked shared by one click | Selected-side-only DB and client assertions |
| URL/body changes tenant/actor | Cross-agency, role, assignment and mandate tests; strict routes |
| Retry duplicates state/events | Exact same-key replay and changed-payload conflict |
| Stale tab overwrites state | Version fence with no event/audit mutation |
| Repeated reminders spam | Waiting-only, cooldown, count and expiry tests |
| UI claims delivery after opening WhatsApp | Attempt/manual-confirmation browser and client checks |
| Private fields enter list/history | Strict service schema and DB projection assertions |
| B2C breaks | Full suite, guest browser regressions and runtime diff comparison |
| Agency history query is unbounded | Keyset bounds and representative EXPLAIN evidence |

## Rollout and checks

Apply additive migration `20261107120000` after NAK-202/203, then application.
Application rollback preserves private rows/audit; do not delete operational
history. Existing customer activation/revocation workflows remain compatible.

Required: focused contract/service/route/client/page tests, adversarial pgTAP,
full coverage/protected-boundary gates, lint/typecheck/build, browser and B2C
regressions, query evidence and fresh independent review. Official Supabase
PostgreSQL 17 replay, multi-session concurrency and generated-type drift remain
mandatory merge/pilot gates. The isolated PostgreSQL 17 run below satisfied
the local database gates on the combined NAK-202/203/204 source snapshot.

`test:db:introduction-sharing-concurrency:local` reuses the maintained SQL
readiness fixture with randomized identities in a disposable loopback database.
It observes actual backend blocking while testing duplicate same-key retries,
distinct-key stale versions and simultaneous commands for opposite sides.
The CI database job runs this after the existing concurrency checks. The target
guard has executable rejection tests and strips inherited libpq overrides.
The harness passed against the disposable Supabase PostgreSQL 17 database.

## Implemented locations

- Migration `20261107120000_introduction_action_workspace.sql` owns the private
  side-state table, composite tenant integrity, insert/backfill, safe resolvers,
  share command and agency keyset index.
- `src/features/broker-introductions/server/introduction-workspace.*` owns the
  strict projections/commands, feature orchestration and private HTTP outcomes.
  Existing repository and client transport own RPC/fetch I/O.
- `src/app/brokerdesk/w/[workspaceRef]/introductions/` owns the list/detail UI;
  existing customer and dashboard pages link into it. The customer create form
  also captures its form element before awaiting creation, preserving reset.
- `introduction_action_workspace.test.sql`, `tests/introduction-workspace*`,
  the browser fixture/spec and local concurrency scripts cover this increment.
  Endpoint inventory, RPC types and the CI database job include its boundaries.

## Query evidence

A synthetic PostgreSQL 18.6 workload contains 10,055 Introduction history rows
in one agency. The initial per-Introduction policy check scanned history and
took about 7,597 ms / 373,051 buffer hits. Evaluating read authority once per
relationship reduced that to about 96 ms. The final scoped page CTE and partial
`(organization_id, created_at DESC, introduction_ref DESC)` index read 26 index
rows for a 25-row page: about 14 ms / 551 buffer hits. No planner override was
used. These sandbox measurements justify the index/query shape; they are not
production latency guarantees or PostgreSQL 17 staging evidence.

The first benchmark process ran out of memory while browser/full-suite checks
were active. Its replacement ran after the browser server stopped; no failed
measurement is counted as a passing result.

## Validation evidence, 7 November 2026

- Final full application suite: 236 files / 1,980 tests pass, including the
  coordinator-handoff correction; focused correction tests also pass.
- Coverage: 85.76% statements, 81.91% branches, 85.87% functions, 89.39% lines;
  all 73 feature-file and 21 protected-boundary gates pass, unchanged thresholds.
- Focused contract/service/route/client/page/transport checks: initially 37
  tests; the coordinator handoff adds one regression. Boundary cases include
  same-origin/body limits, private error headers, safe SQL errors and strict DTOs.
- Database: 127 migrations replay in the supplemental sandbox; the new suite
  passes 63 assertions. Full supplemental run passes 73/74 suites and 2,167
  assertions. The remaining missing `vault.create_secret` failure is the same
  synthetic-infrastructure limitation already reproduced on unchanged main.
- Browser: 18 desktop/tablet/mobile cases pass for broker actions, the family
  dashboard and B2C guest approved-viewing/revocation. The strict fixture type
  correction has no production-runtime effect. The final broker browser rerun
  passes all six desktop/tablet/mobile cases after the correction.
- Typecheck, lint, production build, database fixture smoke and diff checks pass.
  The first build caught an E2E nullable-type error; strict fixture parsing fixed it.
- The initial Windows run could not start Docker or psql. The isolated WSL2
  follow-up below supersedes that tooling blocker.
- Personal sharing, interest, access, portfolio components and dashboard runtime
  paths remain byte-for-byte equal to main. Combined NAK-202 auth/My brokers
  adapters remain separately covered; this phase changes only B2B runtime paths.
- Graphify AST update: 4,268 nodes, 10,318 edges and 338 communities; no API use.

## Supabase PostgreSQL 17 database validation, 7 November 2026

The database job from `.github/workflows/ci.yml` ran locally in a dedicated
Ubuntu WSL2 distribution on D: with Docker 29.1.3, Node 26.13.0, the lockfile
Supabase CLI 2.119.0, and Supabase PostgreSQL 17.11 (image 17.11.0.002).
The 1,333-file source manifest SHA-256 was
`bea47ac5de2b93390ccc6f335aef11a9afbb3b59301f2aeda9e241b8089ac170`.
The run used the worktree based on main `c675159` and synthetic local data.

| Repository gate | Result |
| --- | --- |
| `npm run ci:db:start` and `npm run test:db:reset` | Passed. Clean replay applied 127 migrations, including NAK-202/203/204. |
| `npm run test:db` | Passed. All 74 pgTAP suites and 2,201 assertions, including the 63 NAK-204 assertions and the Vault-backed production-readiness suite. |
| Readable-link allocation, approval/retry, member sharing and photo-cap concurrency | Passed with overlapping transactions. |
| Family Viewer concurrency | Passed the three-viewer cap and sole-primary overlap. |
| Introduction sharing concurrency | Passed four target guards, same-key retries, distinct stale-version rejection and concurrent opposite-side updates. |
| `npm run test:email:local` | Passed all four signed-webhook and suppression cases. |
| Clean public schema generation and exact comparison | Passed after copying the Supabase-generated artifact. The first comparison found only the order of `record_introduction_share_action`. Its signature and the other declarations matched. TypeScript passed after regeneration. |

The startup initially hit an interrupted image cache and a registry rate
limit. A clean Docker store restored the pinned images, and the temporary VM
memory limit and D: swap kept the run within host capacity. No test, migration,
application logic or workflow gate changed during this follow-up. The logs,
source manifest and generated artifact are under
`D:\Nakshatra-validation\nak204-20261107`. The temporary WSL settings were
restored after the sandbox was stopped.

## Review and decisions

Fresh-context read-only reviewer `/root/nak204_independent_review` (Codex;
exact model ID unavailable) inspected initial manifest `505008228f33d2a8...`,
1,331 paths against main `c675159`. It independently ran 37 focused tests and
reported no material findings. The announced E2E-only type correction was read
separately; all production source hashes remained fresh during that review.

**NAK204-R1**, P3, confirmed introduced UX/documentation gap: a coordinator
cannot activate a created Introduction through manage_sharing. Keep the existing
sender boundary; explain the handoff instead of implying a mandate problem.
The UI and contract now do so and an explicit regression passes. Correction
review inspected the change and the subsequently added CI overlap harness.
The reviewer reports R1 resolved and no material findings. Manifest
`c2d812fe487dd8bb...` matched all 1,333 paths at review start/finish; the parent
also verified provenance before this evidence-only documentation update.
The reviewer independently ran 38 focused tests, four target-guard tests and
the harness syntax check. It did not claim actual PostgreSQL execution.

## Execution context

The combined NAK-202/203/204 worktree is ready for user review. Hosted CI remains
part of the PR process. NAK-205 family-reported updates follows the existing
candidate-only response contract.
