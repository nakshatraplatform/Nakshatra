# NAK-60 candidate liveness and IP checks

Mode: full. Risk: critical (consent, verification, publication and migration).
Branch: `fix/nak-60-liveness-ip-verification`, original base `1b92ba1`; integrated main `ef61233`.
Authority: product owner request on 2026-10-03; NAK-60 in Phoenix works / Nakshatra.
This supersedes the candidate photo-match policy, not representative verification.

## Contract

During the self-created pilot, a signed-in candidate with a saved self-owned
portfolio explicitly consents to Didit-hosted camera liveness and IP analysis.
Delegated invitations cannot start or retry verification. Management links retain
status/withdrawal access, but retry and provider creation/attachment require the
authenticated owner. This preserves the newer main pilot policy. Neither a portfolio photo nor an
ID document is required or transmitted. Approval requires the exact configured
workflow/version, an approved session, and approved nonempty liveness and IP
reports. ID or face-match reports cannot establish this new proof. A liveness
check does not establish identity, age, photo ownership, uniqueness or truthful
profile details. IP analysis is a risk signal, not proof of identity or residence.

Preserve authenticated-session/ownership checks, disabled delegated starts, consent
withdrawal, expiry, signature verification, private management tokens, leased
reconciliation, uncertain-create recovery and provider deletion. Keep only
normalized results; do not log/store raw camera evidence, IP addresses, decisions,
tokens or hosted URLs. Legacy proof is not relabelled. Photo edits do not revoke a
liveness/IP proof. Existing representative document requirements stay independent.

## Implementation and location map

- New forward migration: distinct `candidate_liveness_ip` method and candidate
  RPCs; retain old records for lifecycle cleanup. Shared reconciliation gains an
  explicit IP-result argument; the old signature cannot approve new-method work.
- `session.service.ts` / `session.repository.ts`: photo-free start/retry/register/
  attach; classified safe errors. `didit.provider.ts`: pinned hosted session.
- `scripts/identity-verification-worker.mjs`: policy branch plus normalized IP
  outcome. Existing webhook and durable recovery remain shared.
- New management credentials bind to one exact attempt. A new attempt permanently
  supersedes prior retry authority while preserving withdrawal. Subject locks
  serialize starts/retries; pending recovery/deletion must complete before reuse of
  subject-keyed worker slots. Provider deletion preserves the new normalized result.
- Dashboard, invitation/management page, publication checklist, public badge:
  bounded liveness claim and matching fresh consent.
- Forward database migration is required before new application and worker.
  Old deployments must be drained during rollout; old candidate workflows are
  retired, never silently interpreted as the new policy.

## Evaluations

| ID | Case / expected outcome | Rejecting check |
| --- | --- | --- |
| LIP-1 | Candidate with a saved self-owned draft and no photo can start with valid ownership/consent | pgTAP begin/attach plus service test with no Storage client |
| LIP-2 | Provider request contains no portrait, identity or IP supplied by the application | exact request-body unit assertion |
| LIP-3 | Missing/declined IP or liveness, wrong workflow/version, document/face results do not verify | worker negative matrix, SQL false/null IP checks |
| LIP-4 | Invalid invitation, stranger, expired/withdrawn management token and late result cannot authorize | pgTAP negative cases and existing session/webhook tests |
| LIP-5 | New proof gates publication; old proof cannot masquerade as liveness/IP; photo edits preserve new proof | pgTAP current-proof/photo mutation/publication regressions |
| LIP-6 | Only actual link failures say expired; config/state/schema failures are distinct and private | service/provider errors and safe diagnostic tests |
| LIP-7 | Provider failure keeps durable recovery and withdrawal available | service/worker recovery tests; real Sandbox required before release |
| LIP-9 | Retired candidate APIs cannot bypass fresh consent, token supersession or cleanup | direct anon/auth legacy RPC rejection; shared attach still supports representative suite |
| LIP-10 | Late terminal webhooks cannot displace a newer polling job or restart completed polling | terminal-before-deletion and delayed/duplicate-after-retry pgTAP; current job remains claimable and completes |
| LIP-8 | Badge and consent make no photo-match or legal-identity claim | component tests and browser critical path |

## Rollout and recovery

Apply the migration through protected database CD. Deploy application and worker
together with the published liveness/IP `DIDIT_WORKFLOW_ID` and positive integer
`DIDIT_WORKFLOW_VERSION`; keep API key/webhook secret server-only. Do not run the
representative document flow against this candidate workflow. Legacy candidate
attempts are retired for cleanup and need fresh consent. Do not roll back to an
old app expecting photo proof after activating this migration; disable new starts
and forward-fix while continuing cleanup if deployment fails.

Then test a consenting Sandbox camera journey on iOS and desktop: no-photo start,
Didit handoff, signed webhook, worker decision, public badge, withdrawal, cleanup.
No live provider/production database test is performed implicitly by this task.

## Evidence / execution context

Implemented locally; not released. Latest local evidence:

- Full unit/coverage run: 901 tests across 141 files; feature coverage gate passes
  for all 52 checked mapper/service/contract files (80% per metric).
- Dependency audit passes under the existing exact development-only braces
  exception (expires 2026-10-09); this does not fix that vulnerability. Production
  dependencies have no high/critical findings in this run.
- Lint passes with two pre-existing OpenGraph unused-disable warnings; database
  fixture smoke passes. The final production webpack build (including TypeScript)
  passes after clearing disposable output from earlier runs.
- All migrations replayed on a disposable native PostgreSQL 14 database;
  34 pgTAP suites / 969 assertions pass, including the two new liveness suites.
  This uses synthetic Supabase Auth/Storage scaffolding and pgTAP SQL, not a
  Docker-backed Supabase stack. Docker was unresponsive; hosted CI remains needed.
- Browser public-portfolio/badge check passed on desktop, tablet and mobile (3).
  This does not validate the hosted camera flow.
- Fresh independent review round 1 found NAK60-LIP-R1: an old failed-attempt
  token could create competing sessions and overwrite subject-keyed work.
  The new lifecycle regression failed before correction. Added explicit retry
  supersession, exact-token status, cleanup gating and terminal-result preservation.
  All 15 lifecycle assertions now pass. Independent return review confirmed R1 resolved with 45 fresh SQL assertions.
  Round 2 found NAK60-LIP-R2: remaining old-policy labels in the publication
  checklist and customer introduction panel. These and related signup/publication
  messages now describe liveness and IP checks; representative identity wording
  remains unchanged. Final independent return review found no material findings on snapshot
  `feb687890d14df0f6892db876aac6033bb66c9a70978986f8a9473baf1f89d62`.
  Both R1 and R2 are resolved. Five affected suites (62 tests), lint and standalone
  typecheck passed after the final copy edits. Review used a separate subagent;
  model identity was unavailable. This evidence paragraph was updated afterward;
  no implementation or test changed after the reviewed snapshot.
- Real Didit Sandbox camera/webhook/decision/deletion and production smoke remain
  unperformed. Use the linked rollout runbook; never infer release from mocks.

### October 4 follow-up corrections

The later review superseded the earlier no-findings conclusion with two confirmed
findings: NAK60-OCT4-R1 (original document candidate APIs remained callable) and
NAK60-OCT4-R2 (inherited late-webhook queue replacement). The new regression suite
failed on both behaviors before correction.

- R1: revoke original candidate begin/retry RPC execution for public callers;
  restrict shared legacy attachment to document-method organization representatives.
  Migrate the historical candidate flow test to the supported liveness API while
  retaining ownership, session, invitation, privacy and withdrawal assertions.
- R2: preserve authenticated webhook receipts/idempotency but only enqueue decision
  polling for active, non-deleted attempts. Retire existing terminal reconciliation
  jobs during migration without touching recovery or deletion work.
- Regression suite covers actual anon/auth RPC calls, legacy document candidates,
  terminal events before deletion, delayed/duplicate events after retry, and current
  job claim/completion. Existing representative verification coverage remains.
- Validation: all migrations replayed; 35 native PostgreSQL pgTAP suites / 988
  assertions and `npm run db:smoke` pass. Native Auth/Storage scaffolding is
  supplemental; Docker-backed CI and real Didit Sandbox remain required.
- Existing-data upgrade check passes on a separate disposable database: a legacy
  active attempt and its polling lease retire; recovery and deletion remain queued.
- Fresh independent correction review reports no material findings; both
  NAK60-OCT4-R1 and NAK60-OCT4-R2 resolved. Reviewer independently executed six
  native suites / 145 assertions and checked source provenance before/after on
  snapshot `c5de4a67d3668bf2d53c17ecb8983702e447b7ecb2fa929774a0a3767395a762`.
  Fresh-context Codex subagent; actual model identity unavailable. This evidence
  paragraph was updated afterward; implementation/tests remain unchanged.

### Integration with main (October 4)

Remote main advanced six commits to `ef61233` while this feature was reviewed.
Six textual conflicts affected dashboard/signup copy and their tests. Resolution
preserves main's responsive navigation, self-only pilot, test publication exemption
and sharing rules together with bounded liveness/IP claims. New landing, trust and
privacy copy from main now describes liveness/IP rather than retired photo matching.

The unreleased migration moved from `20261003040242` to CLI-created
`20261005020238_candidate_liveness_ip_verification_merge.sql`, after main's
self-pilot migrations. Otherwise main's later migration would regrant access to
the retired photo API. Main's already merged migrations remain unchanged.
Candidate start/register/attach/retry now enforce saved self-owned draft access;
anonymous links retain withdrawal/status but never mint a new hosted check.
Management status offers retry only to the eligible signed-in owner. Historical
invitation tests were changed to assert the deliberately disabled pilot contract.

Evaluation: migration replay and 40 native database suites / 1091 assertions pass,
including a new 12-case self-pilot suite, existing test exemptions, public access,
publication and representative flow. Typecheck and lint pass (two existing
OpenGraph directive warnings). All 972 unit tests / 149 files pass; production webpack build and six public
portfolio browser checks (desktop/tablet/mobile) pass. Existing-data upgrade
against latest main preserves recovery/deletion while retiring legacy polling.
Fresh independent integration review found no material findings and independently
passed 10 native suites / 216 assertions on snapshot
`6913a0c805444537040cdbb98c3dde4010551f1454601013eb33560d6ce52470`.
Reviewer was a fresh-context Codex subagent; model identity unavailable. Only this
evidence paragraph changed after review. Native fixtures are supplemental to
full Supabase CI. No live provider or production mutation performed.

Execution context: main integration reviewed and validated; merge commit/push
completes this integration task. Coordinated migration/app/worker release and real Didit
Sandbox checks still follow the rollout runbook.

Original trace: request reached `begin_candidate_photo_verification` and stopped
before Didit. SQLSTATE 22023 was mapped indiscriminately to expired-link copy.
The specific production row remains uninspected. React #418 and extension message
channel errors are separate; no causal link to this validation failure is proven.
Graphify unavailable. Low local disk space limits heavy tooling; only regenerable
`.next` output was removed. No production changes authorized or performed.

Sources checked: Didit V3 create/retrieve-session docs (liveness_checks and
ip_analyses arrays); Supabase database-functions docs; installed Next route-handler
guide. Provider-backed validation remains necessary for the published workflow.

### CI public trust wording correction

CI run 37255346781 passed Supabase migrations/pgTAP but failed four browser
checks because `public-trust-clarity.spec.ts` still expected `Live photo checked`.
Both affected scenarios reproduced locally before correction. The test now asserts
`Liveness checked`, its bounded accessible explanation, and the unchanged test
publication exemption. The trust disclosure heading and its keyboard test now
use `Liveness and IP checks`. No verification or database policy changed.

The full browser run also exposed two existing critical-path tests acting on
streamed markup before it became visible. They now wait for the visible portfolio
before keyboard focus and for the visible hero before measuring bounds, preserving
all focus, outline, height and access-control assertions. The completed full local
run (`npx playwright test --workers=1`) passed 99 tests with the existing 6 skips;
targeted ESLint and diff checks pass. An earlier full run exhausted local disk
while writing Next cache; only generated project build output was cleared before
rerunning. Hosted CI confirmation follows the fix push.
