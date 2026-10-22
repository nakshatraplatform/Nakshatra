# NAK-201 — Family Viewer identity foundation

## Execution context

- Risk: **Critical** — authentication, candidate-owned authorization,
  invitation secrets, private schema changes, concurrency limits, and public
  `security definer` RPCs.
- Documentation mode: Full.
- Branch: `feat/nak-201-family-viewer-identity-foundation`, synchronized to
  `origin/main` at `cc817c9` on 22 October 2026.
- Current step: schema, guarded commands, generated RPC types and database
  contract tests are implemented. Hosted migration replay, full pgTAP and
  concurrency execution, generated-type drift, and human/PR review of the
  post-review corrections remain before merge.
- Sources of truth:
  [`vivintrodesk-mvp-contract.md`](../../vivintrodesk-mvp-contract.md) and the
  [`family-assisted data architecture`](../../vivintrodesk-family-assisted-data-architecture.md).

### Verified locations

| Path / symbol | Current responsibility | NAK-201 action |
| --- | --- | --- |
| `public.candidates.primary_owner_user_id` | Canonical candidate authority | Use the candidate row as the serialized roster lock |
| `public.broker_clients` | Agency-to-candidate relationship | Add the documented candidate-first lookup index |
| `app_private.broker_client_mandates.consent_version` | Current V1/V2/V3 broker consent | Require at least one active V3 relationship before roster creation or proposal |
| `app_private.brokerdesk_command_idempotency` | Existing actor/command replay protection | Reuse with `organization_id = null` for candidate/family commands |
| `app_private.brokerdesk_audit_events` | Private safe audit history | Append named Family Viewer events without email, token, profile, or contact payloads |
| `app_private.generate_public_reference` | Closed opaque-reference generator | Admit only `fvw` and `fvi` in this slice |
| `app_private.member_has_brokerdesk_capability` | Tenant and assignment scoped broker RBAC | Authorize proposals with `family_viewers.propose` against the selected relationship |
| `auth.users` and `auth.identities` | Confirmed account and provider identity | Require the exact confirmed email and a current Google identity at activation |
| `supabase/tests/database/auth-fixtures.psql` | Live-session pgTAP actors | Extend only the NAK-201 test fixture with explicit Google identities |

## Problem

The merged V3 consent and RBAC foundation says who may propose family help, but
there is no candidate-owned roster, candidate approval lifecycle, independently
verified family identity, or concurrency-safe three-viewer limit. Building UI
before this authority exists would make browser state or broker input an
authorization source.

## Goal

Create the private database foundation for a candidate-owned Family Viewer
roster that works across all of the candidate's active broker relationships:

1. a broker may propose, but never activate, a viewer;
2. the candidate may approve/reject a proposal or invite directly;
3. only the exact invited, confirmed Google account may activate;
4. no candidate can have more than three active viewers excluding self;
5. at most one active viewer is primary;
6. candidate removal invalidates pending invitations and active authority
   immediately; and
7. direct table access, URL/reference changes, races, and retries cannot broaden
   authority or reveal another candidate's roster.

## Contract

### Data ownership and states

- `app_private.candidate_family_viewers` is candidate-owned. Broker provenance
  records who proposed a row but never changes roster ownership.
- Live states are `pending_candidate_approval`, `pending_verification`, and
  `active`; terminal states are `rejected` and `revoked`.
- A candidate-direct addition starts `pending_verification`. A broker proposal
  starts `pending_candidate_approval` and creates no invitation until the
  candidate approves it. Because the broker proposal stores no raw address,
  approval requires the candidate to re-enter the full family email. The
  application normalizes and hashes it, and the database must match that hash
  to the broker's pinned proposal before issuing an invitation.
- Active rows require candidate approval, a verified non-owner user, and
  verification time. Only an active row may be primary.
- The three-viewer maximum applies to active viewers. Activation and primary
  changes lock the canonical candidate row so concurrent requests serialize.
- Active plus pending rows are capped at 10 under the same candidate lock, and
  one agency may hold at most five pending proposals for that candidate. A
  valid broker receives only `{"accepted":true}` whether its proposal created
  a row, duplicated an existing cross-agency email audience, matched the owner,
  or reached that bound. No viewer reference or membership-existence bit is
  returned to the broker.
- Duplicate live email audience and duplicate active verified identity are
  rejected by partial unique indexes in addition to command checks.

### Invitations and identity

- `app_private.candidate_family_viewer_invitations` stores only a SHA-256 token
  hash and pinned email hash/hint. The raw token never enters the database.
- Raw family email is request-scoped only. NAK-202 may use the re-entered
  address to deliver the invitation after the database confirms the matching
  hash, but must not persist it in the roster, invitation, audit, or delivery
  metadata. Both private tables and both creation commands enforce the
  canonical lower-case masked-hint shape; a caller cannot persist a raw address
  by placing it in the hint field.
- An approved viewer has at most one live invitation. Replacement revokes and
  clears the earlier token before inserting the new seven-day invitation.
- Acceptance requires a live VivIntro session, confirmed `auth.users.email`, an
  `auth.identities` row whose provider is `google`, and an exact normalized
  email-hash match.
- A confirmed email from another provider, the candidate's own account, an
  expired/revoked/replaced token, or a modified opaque reference grants no
  access and receives a neutral unavailable result.
- Rejected/revoked memberships and consumed/replaced invitations immediately
  scrub email hashes, hints and unnecessary person fields. Expired unconsumed
  invitation scrubbing remains a mandatory NAK-207 retention-worker gate before
  pilot activation.
- Account deletion preparation revokes affected memberships, destroys pending
  tokens, scrubs invitation/member identity fields and nulls actor provenance
  before the Auth account is deleted. It matches both actor UUIDs and the
  deleting account's normalized email hash so an unaccepted invitation cannot
  survive same-email account recreation; it also revokes proposals on any
  surviving candidate row owned by the deleting account.

### Scope boundaries

- NAK-201 implements private tables, constraints, indexes, public RPC commands,
  a bounded candidate roster projection, and database tests.
- NAK-202 owns application routes, invitation delivery state, assisted broker
  UI, email/WhatsApp handoff, and candidate screens. NAK-201 therefore records
  invitation creation atomically but does not claim that a message was sent.
- NAK-203 owns the read-only family dashboard.
- NAK-206 owns Broker Standard reads and frozen mutual-interest Complete grants.
- No family member can respond to an Introduction in this slice.
- Personal VivIntro, B2C sharing, protected contacts, and personal-link behavior
  are unchanged.

## RPC design

| RPC | Caller | Atomic responsibility |
| --- | --- | --- |
| `propose_candidate_family_viewer` | Scoped broker user | Validate V3/RBAC; conditionally create within the bound; always return one generic authorized acknowledgement |
| `create_candidate_family_viewer` | Candidate owner | Create pending viewer, replace invitation, audit, and return safe refs |
| `decide_family_viewer_proposal` | Candidate owner | On approval, require the re-entered email hash to match the proposal and create an invitation; or reject without email/token material |
| `accept_family_viewer_invitation` | Exact Google account | Consume token once and activate under candidate lock |
| `set_primary_family_viewer` | Candidate owner | Replace the sole primary under candidate lock and expected row version |
| `revoke_family_viewer` | Candidate owner | Revoke membership and all live invitations atomically |
| `resolve_candidate_family_roster` | Candidate owner | Return all actionable rows within the 10-row bound, prioritized active first, plus owner-safe proposal provenance |

All mutations require a live session, bounded inputs, opaque-reference format
validation, an idempotency key, a request hash, authorization before disclosure,
and a safe audit event. Candidate and family commands reuse
`brokerdesk_command_idempotency` with `organization_id = null`; broker proposal
records its organization. No command accepts a candidate id, participant side,
disclosure tier, or verified user id from the client.

## Evaluations

| ID | Representative case | Required result / evidence |
| --- | --- | --- |
| AC-1 | Private schema inventory | Both tables, RLS, revokes, opaque immutable refs, checks, and named indexes exist |
| AC-2 | Scoped broker proposes under active V3 | One pending proposal is created; no invitation or access is created |
| AC-3 | V1/V2, wrong tenant, unassigned, or viewer-role broker proposes | Neutral failure and no roster, audit, or idempotency mutation |
| AC-4 | Candidate approves/rejects proposal | Approval requires a re-entered email whose normalized hash exactly matches the proposal and creates one seven-day invitation; mismatch fails neutrally; rejection creates none; retry is idempotent |
| AC-5 | Candidate adds viewer directly | Pending-verification row and one live invitation are created atomically |
| AC-6 | Exact confirmed Google account accepts | Token is cleared, invitation consumed, and membership becomes active once |
| AC-7 | Wrong/unconfirmed/non-Google/self account accepts | Neutral failure with no membership or token mutation |
| AC-8 | Expired, replayed, or replaced invitation | Neutral failure; only the newest live token can activate |
| AC-9 | Concurrent fourth activation | Candidate lock plus count keeps active viewer count at three |
| AC-10 | Simultaneous primary changes | Candidate lock plus partial unique index leaves at most one primary |
| AC-11 | Duplicate live email or verified user | Database constraints and commands reject duplication without an oracle |
| AC-12 | Candidate revokes | Membership and invitations become unusable immediately; retry is idempotent |
| AC-13 | Cross-owner reference modification | Neutral result and no details or side effects |
| AC-14 | Direct table/function access | `anon`/`authenticated` have no private access; only intended guarded RPCs execute |
| AC-15 | Existing behavior | DB smoke, complete pgTAP, generated-type drift, TypeScript, lint, unit, coverage, and build gates pass |
| AC-16 | Critical review | Fresh-context reviewer reports no unresolved material finding on the final snapshot |
| AC-17 | Account deletion | Preparation revokes UUID-linked, email-addressed, and candidate-owned authority and removes every new Auth and sole-owner organization foreign-key blocker before deletion |
| AC-18 | Cross-agency duplicate/full queue | Valid broker calls receive the same generic acknowledgement and never expose whether another route already exists |
| AC-19 | Real races | Disposable Postgres sessions overlap third/fourth activation and competing primary changes; final invariants hold |

Plausible wrong implementations rejected by these checks include counting
viewers before taking a stable lock, trusting a request-supplied user id,
accepting any confirmed provider, creating an invitation before candidate
approval, returning another broker's proposal provenance, leaving a replaced
token valid, or relying on UI limits instead of database constraints.

## Rollout and recovery

- Migrations are forward-only and deploy before any NAK-202 route or UI calls
  these RPCs. Old application code does not reference the new objects.
- No existing candidate, relationship, mandate, or Introduction is backfilled
  with family authority.
- Rollback hides future entry points and revokes execute privileges. Existing
  active viewer rows must be revoked with an audited forward command before any
  later destructive schema retirement; rollback never guesses or broadens
  consent.
- Local Supabase replay may be blocked when Docker/Podman is unavailable. In
  that case SQL parsing, fixture smoke, and static checks are local evidence,
  while hosted migration replay and full pgTAP remain mandatory merge gates.

## Progress and evidence

- Baseline `npm run db:smoke`: passed on clean `origin/main` (`a113a62`) on
  22 October 2026.
- Graphify identified the existing invitation, RBAC, mandate, session-guard,
  and idempotency boundaries; every path in this record was then verified
  against the fresh main worktree.
- Added the private Family Viewer and invitation tables, lifecycle constraints,
  partial unique indexes, candidate-first relationship index, immutable opaque
  references and exact-Google-identity helper.
- Added guarded, idempotent RPCs for broker proposal, candidate direct invite,
  candidate approval/rejection, exact-identity activation, primary selection,
  revocation and bounded candidate-owned roster resolution.
- Added 77 pgTAP assertions, a disposable-Postgres concurrency harness, an
  account-deletion reconciliation migration and generated client RPC types.
  Static SQL parsing
  and fixture smoke pass. Full local migration replay is blocked because this
  host has neither Docker nor Podman; hosted replay remains a mandatory merge
  gate.
- Rebased cleanly onto `origin/main` at `cc817c9`; the B2C files introduced by
  PRs #128 and #129 are byte-for-byte unchanged from that base.
- Latest-main lint, Next/TypeScript generation, all 1,757 unit tests with
  coverage, the 63-feature/21-boundary coverage gate, security audit, and the
  production build pass. The production build used non-secret placeholder
  public Supabase values because this isolated worktree has no deployment
  environment file. The full
  suite required one worker on this Windows host to avoid unrelated child-
  process and UI-test starvation; both affected suites also pass independently.
- First independent critical-risk review found account-deletion, proposal-bound,
  cross-agency oracle and real-concurrency evidence gaps. All four are addressed
  in the current revision. A second review identified PostgreSQL 17 UUID
  aggregation compatibility, sole-owner organization deletion, and broker
  proposal delivery-address gaps; all three now have focused corrections and
  regression assertions. The final review then identified masked-hint
  validation and address-only deletion gaps; both are corrected with database
  enforcement and regressions. Review-budget policy requires the corrected
  snapshot to receive human/PR review plus its mandatory PostgreSQL CI gates
  before merge.
- PR #130's first PostgreSQL run replayed all migrations successfully but stopped
  this file after 13 assertions because the installed pgTAP version does not
  provide a three-argument `like(text, pattern, description)` helper. The locking
  assertion now uses pgTAP's stable `ok(boolean, description)` contract with the
  native PostgreSQL `LIKE` operator; the assertion, plan count, and required
  locking behavior are unchanged. A fresh complete pgTAP and concurrency run is
  required on the corrected commit.
