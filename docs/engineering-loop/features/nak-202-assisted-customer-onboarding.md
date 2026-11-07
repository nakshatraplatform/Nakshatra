# NAK-202 — Assisted customer onboarding

## Execution context

- Status: **application checks, independent review and local Supabase PostgreSQL 17 validation passed**.
- Risk: **Critical** — authenticated candidate authority, broker RBAC,
  invitation credentials, exact-email activation and private delivery data.
- Documentation mode: Full.
- Branch: `feat/nak-202-assisted-customer-onboarding`, created from
  `origin/main` at `397b78c` on 23 October 2026.
- The combined local work now continues on
  `feat/nak-204-introduction-action-workspace` with NAK-203 and NAK-204.
- Current step: human code review of reconciliation to `origin/main` at
  `c675159` (PR #144). The complete local Supabase database job passed in the
  [NAK-204 validation run](./nak-204-introduction-action-workspace.md#supabase-postgresql-17-database-validation-7-november-2026).
- Database follow-up on 6 November 2026 passed 19 NAK-202 assertions in a
  supplemental PostgreSQL sandbox and obtained a 20,000-row index plan.
  See the original
  [database validation record](./nak-202-database-validation.md).
- Sources of truth:
  [`vivintrodesk-mvp-contract.md`](../../vivintrodesk-mvp-contract.md),
  [`vivintrodesk-family-assisted-data-architecture.md`](../../vivintrodesk-family-assisted-data-architecture.md),
  and the merged
  [`NAK-201 identity foundation`](./nak-201-family-viewer-identity-foundation.md).

## Goal

Expose the merged candidate-owned Family Viewer identity foundation through a
small assisted-onboarding workflow:

1. an authorized broker employee may propose a family representative from the
   existing Customer Detail page;
2. the candidate sees every proposal and active viewer in one private roster,
   approves or rejects proposals, may directly invite a viewer, selects one
   primary viewer and may revoke access;
3. approval or direct invitation sends a private link to the request-scoped
   email and offers a manual WhatsApp handoff without storing the raw address;
4. the invited person signs in with the exact confirmed Google account and
   activates the membership; and
5. no Introduction or portfolio access is added in this phase.

## Product invariants

- One candidate-level roster covers all active broker relationships.
- At most three Family Viewers are active; the candidate is not counted.
- A broker proposal never grants access and never creates an invitation.
- Only the candidate may approve a proposal or directly invite a viewer.
- Activation requires the exact confirmed Google email approved by the
  candidate.
- Only email hashes and masked hints persist. Raw family email is scoped to the
  candidate's request and immediate delivery attempt.
- Broker responses are deliberately generic after authority is established, so
  duplicate, cross-agency and bounded-queue state cannot become a membership
  oracle.
- Candidate roster details are never returned to a broker. A broker sees only
  the permitted active-viewer aggregate. Proposal insertion/history is withheld
  because global email deduplication would otherwise expose roster membership.
- Family Viewers cannot respond to Introductions. NAK-203 owns the read-only
  family dashboard; NAK-206 owns portfolio disclosure grants.
- Personal B2C sharing and the public `/p/<opaque-token>` flow do not change.

## Page and URL index

### BrokerDesk private application

| Page | Route | NAK-202 responsibility |
| --- | --- | --- |
| Workspace gateway | `/brokerdesk` | Existing authenticated redirect; no public content |
| Today | `/brokerdesk/w/[workspaceRef]/dashboard` | Existing action surface; no family queue added yet |
| Customers | `/brokerdesk/w/[workspaceRef]/customers` | Existing customer book |
| Customer detail | `/brokerdesk/w/[workspaceRef]/customers/[relationshipRef]` | Add safe Family Assistance summary and proposal action |
| Introductions | `/brokerdesk/w/[workspaceRef]/introductions` | Reserved for NAK-204 |
| Introduction detail | `/brokerdesk/w/[workspaceRef]/introductions/[introductionRef]` | Reserved for NAK-204 |
| Team | `/brokerdesk/w/[workspaceRef]/settings/team` | Existing team administration |

The URL contains opaque workspace and relationship references only. Names,
email addresses, phone numbers, candidate ids, organization ids, response
states and disclosure levels never appear in a path or query string. Every
BrokerDesk page is private and `noindex, nofollow`; server authorization is
still required on every read and mutation.

### Candidate and family setup

| Page | Route | Responsibility |
| --- | --- | --- |
| My brokers | `/brokers` | Existing mandate controls plus candidate-owned Family Assistance roster for eligible V3 broker relationships |
| Family invitation | `/join/family` | Fragment exchange, Google sign-in guidance and neutral activation outcome |
| Family dashboard | `/family` | Reserved for NAK-203; not created by NAK-202 |

Family management stays under **My brokers** in V1 because it exists only for
broker-linked candidates. It is not added to the personal dashboard's primary
navigation and is not shown to a customer without an active V3 relationship.

## Application architecture

```text
Server page
  -> authenticated session
  -> feature service
  -> strict output schema
  -> repository
  -> one guarded public RPC
  -> private tables

Client action
  -> thin versioned Route Handler
  -> same-origin + bounded JSON + Zod
  -> authenticated session + named rate limit
  -> feature service
  -> repository/RPC transaction
  -> immediate request-scoped email attempt
  -> bounded safe response
```

The browser never queries Family Viewer tables or Supabase RPCs directly.
Pages are Server Components by default. Client Components own only form state,
confirmation dialogs, submission and accessible feedback. Database RPCs remain
the authority for ownership, RBAC, row locks, limits, idempotency and audit.

## HTTP contract

### Candidate commands

| Method and path | Responsibility |
| --- | --- |
| `GET /api/v1/customer/family-viewers` | Resolve the bounded candidate-owned roster |
| `POST /api/v1/customer/family-viewers` | Candidate-direct invitation and immediate delivery attempt |
| `POST /api/v1/customer/family-viewers/[viewerRef]/decision` | Approve with exact email re-entry or reject a broker proposal |
| `POST /api/v1/customer/family-viewers/[viewerRef]/primary` | Select one active primary viewer using optimistic row version |
| `DELETE /api/v1/customer/family-viewers/[viewerRef]` | Revoke membership and live invitations immediately |

### Invitation activation

| Method and path | Responsibility |
| --- | --- |
| `POST /api/v1/family-invitations/exchange` | Move a fragment token into a short-lived signed HttpOnly cookie |
| `POST /api/v1/family-invitations/accept` | Exact-email, confirmed-Google activation through the NAK-201 RPC |

### Broker commands and projection

| Method and path | Responsibility |
| --- | --- |
| `POST /api/v1/brokerdesk/workspaces/[workspaceRef]/customers/[relationshipRef]/family-proposals` | Propose without authorizing; always return a generic accepted result after scoped authority |
| `GET /api/v1/brokerdesk/workspaces/[workspaceRef]/customers/[relationshipRef]/family-viewers` | Resolve the safe family-setup projection used by Customer Detail |

All mutations require same-origin requests, strict bounded JSON, authenticated
sessions, named rate limits and idempotency keys where the RPC contract
requires them. Private responses use `Cache-Control: private, no-store` and
`Referrer-Policy: no-referrer`.

## Database and query design

NAK-202 reuses the NAK-201 tables and command RPCs. It adds only the missing
broker-safe read projection `resolve_brokerdesk_family_setup` if source
inspection confirms no equivalent exists.

The projection must:

- authorize `family_viewers.propose` against the requested workspace relationship and require an active V3 mandate;
- find the selected candidate through the tenant-scoped relationship;
- return the global active-viewer count without identities or provenance;
- always return an empty `ownProposals` array; do not expose insertion-sensitive
  history, masked emails, display labels or individual lifecycle state;
- compute `canPropose` from `family_viewers.propose` and active V3 mandate;
- return a neutral unavailable result for invalid, unauthorized or inactive
  relationships; and
- use the existing
  candidate roster index
  before adding any speculative index.

No N+1 query is permitted. Candidate roster and broker setup are each one RPC.
Any new index requires a named hot query plus `EXPLAIN (ANALYZE, BUFFERS)`
evidence; an index is not added merely because a column is filterable.

## Delivery contract

- Invitation tokens are opaque 256-bit HMAC-derived values and appear only in
  the URL fragment before exchange.
- The fragment is cleared from browser history after exchange.
- The exchange cookie is signed, HttpOnly, Secure in production, SameSite=Lax,
  scoped only to `/api/v1/family-invitations` and expires after 15 minutes.
  The narrow route-family scope lets a verified capability survive the Google
  sign-in round trip without exposing it to pages or unrelated APIs.
- Email delivery occurs only after the database confirms invitation creation.
- A provider failure does not undo candidate consent or fabricate delivery.
  The interface reports the failure and exposes the already-authorized private
  link for manual copy or WhatsApp handoff; V1 does not claim an email retry.
- Manual WhatsApp handoff shares the same invitation URL. It is labelled as an
  initiated share, never delivered or read, and does not weaken exact-email
  activation.

## Implementation phases

1. **Contract and page index** — reconcile NAK-201 completion, add this feature
   record and verify every planned control maps to one endpoint and RPC.
2. **Read projection** — add the broker-safe family setup RPC, generated type,
   schema, repository method and cross-tenant pgTAP coverage.
3. **Server command boundary** — add Family Viewer contracts, repository,
   service, token/cookie and the candidate/broker Route Handlers.
4. **Candidate workflow** — add Family Assistance to `/brokers`, including
   direct invitation, proposal decision, primary selection, revocation,
   delivery feedback and manual WhatsApp handoff.
5. **Broker workflow** — add the summary and proposal form to existing Customer
   Detail without exposing the candidate's full roster.
6. **Activation workflow** — add `/join/family` and exact-Google activation
   with neutral error handling.
7. **Validation and review** — run database, route/service/component,
   accessibility, type, lint, build, security and fresh-context review gates.

## Acceptance criteria and evaluations

| ID | Criterion | Evidence that must reject a wrong implementation |
| --- | --- | --- |
| AC-01 | Scoped broker can propose, never activate | pgTAP and route test prove no invitation or active membership is created |
| AC-02 | Broker cannot infer another agency's roster or proposal | cross-workspace fixtures receive the same safe response and no foreign rows |
| AC-03 | Candidate sees one bounded cross-broker roster | RPC/service tests validate owner-only output and maximum ten actionable rows |
| AC-04 | Approval requires exact email re-entry | mismatch returns neutral unavailable and creates no invitation/email attempt |
| AC-05 | Direct invite and approval never persist raw email | schema/audit/idempotency assertions and source review reject raw address storage |
| AC-06 | Invitation activation requires the exact confirmed Google identity | wrong email/provider, expired, replayed and replaced token tests fail closed |
| AC-07 | Three-viewer and sole-primary invariants remain transactional | existing NAK-201 concurrency suite plus command regression tests pass |
| AC-08 | Revocation is immediate and idempotent | repeated DELETE leaves no live token or active membership |
| AC-09 | Delivery status is honest | provider failure is visible, does not roll back consent and is never called delivered |
| AC-10 | URLs leak no personal or authorization data | route inventory and source tests permit opaque references only |
| AC-11 | Pages are private and usable | noindex metadata, keyboard-labelled forms, loading/error/empty/success states and mobile layout checks |
| AC-12 | Existing B2C and BrokerDesk behavior is unchanged outside this slice | affected regression suites, full type/lint/unit/build and diff review pass |
| AC-13 | Query shape uses existing indexes without N+1 reads | database plan inspection names the tenant/candidate-leading index and repository performs one RPC per projection |

## Explicit non-goals

- Family Viewer Introduction list or portfolio reads;
- broker delegation of candidate Interested/Decline;
- side-specific Introduction sharing and family updates;
- frozen mutual-interest disclosure grants;
- WhatsApp OTP, AiSensy delivery receipts or phone-only identity;
- personal paid Family Viewers;
- custom broker questionnaires; and
- a generic task or CRM engine.

## Rollout and recovery

The read projection migration is forward-only and safe before application
deployment. Application entry points remain hidden until their complete server
boundary is deployed. Rollback hides NAK-202 pages/actions and revokes endpoint
entry points; it does not delete candidate-authorized rows or reconstruct raw
email. Existing NAK-201 revocation commands remain the recovery path for issued
memberships and invitations.

## Progress

### Database follow-up — 6 November 2026

- Replaced the stale LIMIT-10 assertion left after the privacy correction with
  an equal-projection test across different agency proposal histories.
- Added five denial cases for null reference, expired mandate, revoked
  mandate, disabled entitlement and ended customer relationship.
- Supplemental PGlite 0.5.9 / PostgreSQL 18.6 replayed 125 migrations.
  71 of 72 suites passed 2,072 assertions. The sole missing-Vault failure also
  occurs on unchanged main, which passes 70 of 71 suites / 2,053 assertions
  in the same harness.
- The family, accountless, guest-approved and member-interest focused suites
  pass all 209 assertions. The exact roster aggregate on 20,000 fixture rows
  uses the existing candidate roster index and three shared buffer hits.
- Fresh-context reviewer `nak202_database_review` independently replayed the
  migrations, passed all 19 NAK-202 assertions and reproduced the index plan.
  No material database finding. Concurrency, official Supabase 17 replay and
  generated-type drift remain pending.
- Prepared the NAK-203 feature contract. Its runtime implementation remains
  gated on completing the official NAK-202 checks.

### Latest-main reconciliation — 5 November 2026

Validation scope: base `c675159`, including dirty/untracked NAK-202 files. No
commit, push, PR or remote database mutation was performed. The original dirty
implementation is retained in the named pre-reconciliation recovery stash.

Final validation completed 6 November 2026:

- Full coverage rerun: **230 files / 1,929 tests passed**; 85.49% statements,
  81.72% branches, 85.64% functions, 89.20% lines.
- Feature coverage: **69 feature files and 21 protected boundaries passed**.
- Post-review lint, typecheck and final Turbopack build passed. Final diff
  whitespace/conflict checks passed. Dependency manifests/configuration unchanged.
- All 50 existing database rate-limit action/quota tuples were compared against
  the prior definition and preserved; six family actions are additive.
- The 12 browser checks and independent correction review above remain current.
  Database runtime/type generation/query-plan gates remain blocked, not passed.

- `npm ci --ignore-scripts`: passed against latest main's lockfile.
- `npm run lint`, `npm run typecheck`, `npm run db:smoke`: passed.
- `npm run security:audit`: passed its high/critical gates; 11 packages affected
  by moderate advisories remain in the inherited dependency tree.
- Initial reconciled full coverage run: 229 files / 1,927 tests passed; 85.43%
  statements, 81.68% branches, 85.65% functions, 89.12% lines. A final run includes
  the review corrections and new email test; do not treat the initial run as
  final correction evidence.
- `playwright test e2e/family-onboarding.spec.ts e2e/guest-approved-viewing.spec.ts
  --workers=1`: 12 passed across desktop, tablet and mobile Chromium. Uses local
  mock services; does not establish live OAuth or provider email delivery.
- `npm run build` (Turbopack): passed with loopback public placeholder config;
  final post-review build is being refreshed. The historical `--webpack` command
  is incompatible with current main's graph CSS chunking, so no config was weakened.
- `npm run test:db:local`: blocked by missing Docker and Podman. Full migration
  replay, pgTAP, family concurrency, clean generated-type comparison and
  `EXPLAIN (ANALYZE, BUFFERS)` on representative roster counts remain required.
- Independent fresh-context reviewer `nak202_main_reconciliation_review`
  confirmed R1/R2 corrections and passed 11 focused tests. Runtime paths were
  read-only during the return review. No new material correction finding.
- B2C personal portfolio, interest, approved access and dashboard source paths
  are byte-for-byte equal to main. The shared login change is opt-in only for
  `/join/family` continuation; browser checks retain regular password sign-in.
- Graphify AST update completed; no API-backed semantic rebuild was requested.

Database review procedure: use the repository's disposable local Supabase stack,
reset/replay all migrations, run the complete pgTAP and family concurrency suite,
then generate public types and run `check-database-types.mjs`. Inspect the
candidate/status aggregate query with `EXPLAIN (ANALYZE, BUFFERS)` for realistic
rosters; no new index or measured performance claim is introduced here. Production
credentials and customer data must not be used for these checks.

- Fresh review confirmed NAK202-R1: random reference bytes are not RFC UUIDs.
  The email adapter now derives a deterministic domain-separated UUIDv8; a test
  using the actual shared email schema failed before the fix and passes after it.
- Fresh review confirmed NAK202-R2: own-proposal reads exposed global roster
  deduplication outcomes. The RPC now withholds proposal history, the output
  schema rejects nonempty history, and broker UI never renders proposal identities.
  This narrows the planned projection to preserve the existing non-oracle rule.
  Candidate-only proposal review remains available.

- Preserved all prior dirty/untracked NAK-202 files in a recovery stash, advanced
  the feature branch to `c675159`, and reapplied them without conflicts.
- Retained current main's accountless B2C interest and approved viewing code.
  Shared rate-limit and generated-type additions merged additively.
- Renamed the unapplied migration to
  `20261105120000_family_viewer_assisted_onboarding_projection.sql`; its old
  timestamp collided with the merged landing-feedback migration. No deployed
  migration was renamed or edited.
- Reconciled the MVP contract with PR #144 personal email/browser-proof access
  and the existing candidate liveness-only implementation. Broker and family
  identity rules remain distinct from personal guest proofs.
- Earlier test results below are historical and do not establish this snapshot's
  validation. Current check results are recorded after execution.

### Historical implementation evidence — 23 October 2026

- Latest `origin/main` verified at `397b78c`; merged NAK-201 commit `fa01bc9`
  is an ancestor.
- Working branch created from that exact revision.
- Existing NAK-201 schema, indexes, command RPCs, generated types, customer
  invitation patterns, BrokerDesk Customer Detail and candidate My Brokers
  surface inspected.
- No equivalent broker-safe family setup read projection exists; this is the
  first executable implementation dependency.
- Added `resolve_brokerdesk_family_setup` with V3 mandate, scoped RBAC,
  relationship-lifetime and tenant checks. The projection returns the global
  active count and only the calling agency's bounded proposal history.
- Added explicit rate-limit actions, public reference schemas and the complete
  machine-readable endpoint inventory for broker, candidate and activation
  flows.
- Added strict contracts, one feature repository/service boundary, HMAC-derived
  fragment capabilities, a 15-minute route-family-scoped signed HttpOnly exchange
  cookie, immediate Resend delivery and manual WhatsApp handoff.
- Added the broker proposal panel to Customer Detail, the candidate-owned roster
  to My brokers, and the neutral `/join/family` activation workflow. No family
  Introduction or portfolio read authority was added.
- Independent review found and the branch now resolves five issues: the login
  continuation parameter, Google-only activation UX, transport-schema drift,
  direct `/join/family` progression without a local capability, and premature
  portfolio-viewing copy. No cross-tenant bypass, raw-email persistence, token
  leak or missing hot-query index was found.
- Validation completed locally: lint passed; Next.js type generation and
  TypeScript passed; 214 test files / 1,789 tests passed with 85.39% statement
  and 88.95% line coverage; all 65 feature-file and 21 protected-boundary
  coverage gates passed; production source
  compilation passed. Page-data collection could not complete because the
  isolated worktree intentionally has no Supabase environment variables.
- Database smoke fixtures passed. Migration application, pgTAP and query-plan
  evidence remain pending because Docker/Podman is not available on this host.
- The installed PostgreSQL parser accepted all five top-level statements in
  the NAK-202 migration; this is syntax evidence, not a substitute for replay.
- Graphify AST knowledge graph refreshed after implementation.
