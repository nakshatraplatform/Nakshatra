# NAK-203 Family Introduction dashboard

Status is implemented locally with application validation, independent review
and the combined Supabase PostgreSQL 17 database job passed.
Risk is Critical because this adds an authenticated cross-broker
projection. Documentation mode is Full.

Branch is `feat/nak-203-family-introduction-dashboard`, based on main
`c675159` and carrying the reviewed uncommitted NAK-202 work.

The user authorized continuing NAK-203 on 6 November 2026 while the NAK-202
database gate was pending. Both increments passed the local Supabase database
job on 7 November 2026 on the combined NAK-204 branch.

## Goal and scope

Give an activated Family Viewer a simple read-only dashboard at `/family`.
Show a bounded list of eligible Introductions across the candidates they
support, with active, awaiting, mutual, expired and closed states derived by
the server. The candidate keeps authoritative response control.

NAK-203 owns list metadata and navigation. NAK-206 owns Broker Standard
portfolio reads and frozen Complete disclosure. Until those grants exist,
the list must not offer a profile-opening action that would claim access.

## Architecture

Use the existing live-session guard and exact verified membership from
NAK-201. A Server Component calls a feature service, a strict output schema
and one guarded RPC named `resolve_family_introductions`. A versioned
`GET /api/v1/family/introductions` endpoint serves pagination.

Resolve the viewer from the live account. Derive supported candidate IDs and
Introduction sides in the database. Recheck active membership and the current
V3 representation rules before returning each row. Broker users cannot use
this projection to expand their workspace authority.

The normal page size is 25 and the server maximum is 50. Use stable keyset
pagination ordered by creation timestamp and opaque Introduction reference.
Validate cursor bounds. Return a safe next cursor and use one bounded query
per page, with no per-row RPC calls.

Before implementing SQL, verify the current Introduction schema and existing
indexes against the named workload. Inspect the viewer-to-candidate lookup
and source/recipient Introduction lookups with EXPLAIN (ANALYZE, BUFFERS).
Add an index only when current plans justify it.

## Data and interaction rules

- Return the supported candidate label, opaque Introduction reference, safe
  lifecycle state and applicable timestamps.
- Opposite-person identity is deferred with portfolio disclosure to NAK-206.
  Cards use a short Introduction reference plus the supported candidate label.
- Keep workspace internals, other agencies, other family viewers, private
  broker comments, contact details, media and financial data outside this list.
- Revalidate every page read. Removal or loss of authorization removes rows
  immediately. Closed history contains only explicitly authorized metadata.
- Use private no-store responses and noindex metadata.
- Provide loading, empty, expired-session and recoverable error states.
- The page exposes no response, share, broker-update or family-management
  mutation. Candidate management stays under My brokers.

## Evaluations

| Case | Expected behavior |
| --- | --- |
| Activated exact-email viewer | Sees only eligible Introductions for supported candidates |
| Pending, revoked or unrelated viewer | Receives a neutral denied or empty result without identity leakage |
| Multiple brokers | Family list can aggregate permitted rows while each broker stays isolated |
| Expired or revoked V3 mandate | Rows follow the current fail-closed authorization rule |
| Modified references or cursor | Cannot select another user, candidate or agency |
| Equal creation timestamps | Pagination has deterministic ordering without duplicates |
| 26 and 51 available rows | UI and server bounds are enforced |
| Concurrent membership removal | Next read loses the removed authority |
| Mutating candidate response endpoint | Family identity is denied by existing candidate-only checks |
| Guest B2C browser proof | Does not satisfy the family live-session guard |

Required checks include pgTAP authorization and pagination cases, service
schema tests, route tests, browser checks, existing B2C regressions, query
plans and independent review. Reuse current UI contracts and component styles.

## Implemented locations

| Location | Responsibility |
| --- | --- |
| `20261106120000_family_introduction_dashboard.sql` | Guarded metadata-only resolver, bounded stable cursor and lifecycle calculation |
| `src/features/family-viewers/server/family-dashboard.contract.ts` | Strict input and output schemas |
| `src/features/family-viewers/server/family-dashboard.service.ts` | Query parsing, repository orchestration and safe errors |
| `FamilyViewerRepository.introductions` | One RPC per page |
| `src/app/api/v1/family/introductions/route.ts` | Live session, private headers, bounded input and existing family-read throttle |
| `src/app/family/` | Private server-rendered dashboard, loading state and owned B2B styles |
| `src/app/join/family/family-invitation-client.tsx` | Activation handoff to the family dashboard |
| `family_introduction_dashboard.test.sql` | 32 database assertions |
| `tests/family-dashboard*.test.*` | Contract, service, route and page behavior |
| `e2e/family-dashboard.spec.ts` | Desktop, tablet and mobile progression and signed-out denial |

The machine-readable endpoint inventory and generated RPC declaration include
the new GET and resolver. Clean Supabase type generation passed on the
combined NAK-204 branch.

## Authorization and state details

Every read requires a live Auth session, a confirmed email with a matching
Google identity and an active membership whose approved email hash matches.
The database derives both participant sides. Each represented relationship
must have a current V3 mandate, active term, enabled workspace and current
candidate publication/readiness.

Unshared creation drafts are excluded. Shared historical rows may return only
list metadata while current viewer and relationship authority remains valid.
Decline or revocation gives Closed, response expiry gives Response period
ended, one acceptance gives Awaiting the other response, and reciprocal
acceptance during its current window gives Both interested. No comment,
response actor, broker identity or disclosure payload enters this projection.

If one viewer legitimately supports both participants, the SQL aggregates the
supported labels into one Introduction row, preserving cursor uniqueness.
The cursor contains creation time and an opaque reference. Altering it cannot
change the viewer, candidate or agency authority.

## Query evidence and design decisions

The resolver uses the existing active identity-to-candidate index, candidate
relationship lookup and organization/source and organization/recipient
Introduction indexes. Source and recipient histories are collected through
separate joins. The cursor filters both history branches before policy
evaluation. Authorization is evaluated once per relevant relationship in a
materialized CTE, avoiding repeated checks per history row.

Supplemental PostgreSQL 18.6 EXPLAIN (ANALYZE, BUFFERS) with 1,056 related and
10,000 unrelated historical Introductions used the existing source and
recipient indexes. The recorded expanded query used 613 shared buffer hits
and about 20 ms in the local WASM sandbox. Small fixture metadata tables used
sequential scans. These are synthetic plan observations, not staging latency
budgets. No index or planner override was added.

## Validation and remaining gates

- Supplemental migration replay applies 126 migrations.
- The 32 new assertions cover cross-agency aggregation, source/recipient
  membership, paired cursors, 25/50 limits, equal timestamps, final-page
  termination, V2 refusal, membership removal, changed email, removed Google
  identity, mandate revocation, denial of candidate response submission,
  dual-side membership deduplication and no candidate portfolio access.
- Six focused family and B2C database suites pass 241 assertions.
- Full application suite passed across 232 files. Coverage is 85.55% statements,
  81.77% branches, 85.66% functions and 89.24% lines. All 71 feature files and
  21 protected-boundary coverage gates pass.
- Lint, typecheck, final production build and diff checks pass.
- The complete supplemental sandbox run passes 72 of 73 suites with 2,104
  assertions. The missing Vault operation is the same infrastructure failure
  previously reproduced on unchanged main.
- Core B2C sharing, interest, approved-access and dashboard source paths are
  byte-for-byte equal to main. Existing B2C browser regressions pass.
- The [NAK-204 validation run](./nak-204-introduction-action-workspace.md#supabase-postgresql-17-database-validation-7-november-2026)
  passed clean Supabase PostgreSQL 17 replay, all pgTAP suites, real multi-session
  concurrency and the generated-type comparison on the combined branch.

## Review findings and verification

Fresh-context reviewer `nak203_review` found one confirmed P2 issue,
NAK203-R1. The new label schema capped names at 120 characters, while existing
candidate publication supports longer names. Corrected the bound to 180 and
added a service regression. The reviewer verified the correction and passed
all 13 focused service/route/page tests, reporting no remaining material
finding. Long unbroken names also wrap within the card layout, with a browser
regression at the same boundary.

The reviewer inspected authorization, state projection, pagination, API, page,
repository and inventory. PostgreSQL execution and browser evidence are parent
checks. Review does not establish official Supabase validation.

Browser validation passed 18 checks across desktop, tablet and mobile
Chromium, covering dashboard pagination, signed-out denial, family activation
and existing B2C approved viewing/revocation. Desktop and 390px layouts were
visually inspected. The focused six-check dashboard rerun also passes with the
180-character layout case.

The production build passed using loopback public placeholder configuration.
The browser server reported a low-disk cache-write warning. An attempted
cleanup of its ignored generated cache was rejected by automatic approval,
and the cache was left in place. This does not count as a failed browser test.

The first full application run caught a brand-system font fallback mismatch
in the new CSS. Corrected it to the required owned font stack. The focused
brand/dashboard checks and subsequent complete coverage run pass without
changing tests or thresholds for that rule.

## Rollout and recovery

Deploy migrations in order through NAK-202 then NAK-203 before enabling the
page. Keep existing B2C personal-interest and portfolio entry points governed
by their current services. Recovery may remove the family dashboard entry
point and revoke the resolver's execute permission. It does not delete roster
consent or create substitute disclosure grants.

## Next executable step

Review the dashboard on the local NAK-204 branch, which carries NAK-202 and
NAK-203 and has passed the combined Supabase PostgreSQL 17 database job locally.
