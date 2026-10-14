# Unassigned — Hierarchical geographic matching RPC

## Execution Context

- Requirement source: user contract on 13 October 2026 for a coordinate-free, country-safe proximity expansion RPC used by handshake and compatibility-report workflows.
- Authoritative product context: `docs/vivintrodesk-document-map.md` and `docs/vivintrodesk-mvp-contract.md`.
- Related feature: `docs/engineering-loop/features/structured-location-capture.md`.
- Current status: integrated on latest `origin/main`; the RPC migration and pgTAP assertions are present, and PostgreSQL/PLpgSQL parsing plus static database fixture checks pass. Full repository replay and pgTAP remain pending a Docker-capable environment.
- Next incomplete step: run the full migration/pgTAP suite, inspect representative `EXPLAIN (ANALYZE, BUFFERS)` plans with production-like cardinality, then wire the service-only RPC into each workflow with an explicit safe projection.
- Context last verified: 13 October 2026 against `origin/main` at `f6529ce`; unrelated landing/legal edits remain untouched in the original checkout.

### Code Locations

| Path | Role | Status |
| --- | --- | --- |
| `supabase/migrations/20261013210000_hierarchical_location_matches.sql` | Canonical portfolio columns, normalization trigger, indexes, and RPC | Implemented |
| `supabase/tests/database/hierarchical_location_matches.test.sql` | Boundary, ordering, lifecycle, collision, null-postal, limit, and privilege checks | Implemented; full pgTAP runtime pending |
| `src/types/database.generated.ts` | Supabase table and RPC contract | Updated |
| `supabase/migrations/20261013190000_structured_location_capture.sql` | Existing India/US capture and transitional candidate projection | Inspected dependency |
| `src/features/portfolio/server/dashboard.mapper.ts` | Writes normalized location into draft JSON consumed by the database trigger | Inspected caller |

## Problem

VivIntro needs useful geographic expansion without collecting exact coordinates. Postal codes, city names, and subdivision names are not globally unique, so a matcher that compares child fields without their parents can silently cross country or state boundaries. The live repository also stored the first structured-location projection on `candidates`, while the approved matching contract places its canonical hierarchy on `portfolios`.

## Goal

Store a normalized ISO hierarchy on `portfolios` and provide `get_hierarchical_matches(source_portfolio_id, limit_count)` with four mutually exclusive tiers: postal code, city, subdivision, then country. Return active, unexpired matches in tier order without exposing the full-row RPC to browser roles.

## Scope and Invariants

- `country_code` is an ISO 3166-1 alpha-2 shaped value and `subdivision_code` is an ISO 3166-2 shaped value with a matching country prefix.
- Postal codes are text, preserving leading zeroes and country-specific formatting.
- Every tier includes its parent boundaries; missing values never become global wildcards.
- The source portfolio is excluded.
- Results must be published, active, and unexpired.
- The RPC returns the current `portfolios` contract plus `proximity_tier`, ordered by tier and newest creation time.
- The full-row RPC is executable only by `service_role`; handshakes and compatibility reports must apply their own authorization and disclosure projection before returning data to a client.
- No PostGIS, coordinates, street-address matching, or radius claim is introduced. Owner-only street lines are outside this relational matcher.

## Risk Assessment

**Risk tier:** Critical.

**Reason:** The change adds production columns, constraints, a generated lifecycle column, indexes, a privileged data-returning RPC, and a backfill. Incorrect boundaries could cause privacy leakage or cross-country matches.

**Documentation mode:** Full because this is a migration and shared matching contract.

## Design

- The portfolio draft remains the write contract. A database trigger normalizes its structured location into the canonical relational columns and prevents direct column drift.
- The candidate location projection remains temporarily for compatibility with the in-progress capture rollout, but matching reads only `portfolios`.
- The query uses four `UNION ALL` branches with disjoint exclusions. This makes tier precedence explicit and lets PostgreSQL use boundary-specific indexes.
- A partial hierarchy index supports country and subdivision tiers through left-most prefixes. A country/postal index supports Tier 1. A functional city index supports case-insensitive city matching in Tier 2.
- `is_active` is generated from `is_published`; expiry remains a time-dependent query predicate and is not embedded in a generated column.
- India post-office/locality labels are not promoted into a fifth hierarchy level. An Indian PIN is the current local-area discriminator; post-office names can be added later as a tie-breaker only after normalization and product evaluation.

## Acceptance Criteria

- [x] AC-1: Tier 1 requires equal country and postal code.
- [x] AC-2: Tier 2 requires equal country, subdivision, and city and excludes Tier 1.
- [x] AC-3: Tier 3 requires equal country and subdivision and excludes the same city.
- [x] AC-4: Tier 4 requires equal country and excludes the same subdivision.
- [x] AC-5: Source, unpublished/inactive, and expired portfolios are excluded.
- [x] AC-6: Results are ordered by tier ascending and `created_at` descending, with a deterministic ID tie-breaker.
- [x] AC-7: Invalid limits are rejected and valid limits bound the final ordered set.
- [x] AC-8: Portfolio location values are normalized from draft data and support any uppercase ISO-shaped country/subdivision code.
- [x] AC-9: Matching has indexes for hierarchy-prefix and country/postal access paths.
- [x] AC-10: Anonymous and authenticated clients cannot execute the full-row RPC; `service_role` can.
- [ ] AC-11: The focused PostgreSQL migration/RPC checks pass; full pgTAP checks and representative production-like query plans use the intended indexes.

## Verification

| Criterion | Check | Status |
| --- | --- | --- |
| AC-1–7 | `supabase/tests/database/hierarchical_location_matches.test.sql` | PostgreSQL and PLpgSQL parsing passed; complete pgTAP execution blocked locally because Docker/Podman is unavailable |
| AC-8–10 | pgTAP schema, trigger, index, and privilege assertions | Static fixture checks passed; complete pgTAP execution blocked locally |
| Type contract | `npm run typecheck` | Passed on 13 October 2026 |
| Lint | `npm run lint` | Passed on 13 October 2026 |
| India normalization and mapper regression | `npx vitest run tests/location-provider.service.test.ts tests/dashboard.mapper.test.ts` | Passed: 2 files, 11 tests |
| SQL integration | `npm run db:verify` | Blocked before database startup: neither Docker nor Podman is installed |
| Performance | `EXPLAIN (ANALYZE, BUFFERS)` on representative data | Pending staging/production-like dataset |

## Compatibility, Rollout, and Recovery

1. Apply the structured-location capture migration first, then this migration.
2. The backfill prefers the normalized candidate projection and falls back to portfolio draft data.
3. Deploy workflow consumers only after the migration. Consumers must not return the RPC's raw full rows.
4. Monitor null country rates and tier distribution before using geographic rank as an automated decision.
5. Application rollback is safe because existing candidate and JSON fields remain. Database rollback should be a forward migration that first removes RPC consumers, then drops the RPC/indexes; retain populated columns until rollback safety is confirmed.

## Decisions / Deviations

- The repository did not yet contain the stated columns or `is_active` on `portfolios`; the migration adds and backfills them instead of assuming an out-of-band schema.
- The requested full-row return shape creates a disclosure risk, so execution is service-only and explicitly requires downstream projection.
- Time expiry is checked dynamically in the RPC. A stored/generated expiry-derived boolean would become stale without scheduled writes.
- India local-area refinement uses exact PIN in this release. Post-office/locality is not yet stable enough to become a universal hierarchy boundary.
- Review correction: the RPC projection follows columns established by migration history rather than drift-only generated fields; null child boundaries are excluded instead of acting as wildcards; both India providers normalize the city-level match boundary to District; same-city candidates reach Tier 2 when one or both postal codes are missing because Tier 1 is impossible; and exact Tier 1 postal matches are excluded from every lower tier to prevent duplicate rows.
- Runtime correction: focused PostgreSQL execution found and fixed an invalid schema-qualified `coalesce` call and verified the final four-tier function body, ordering, normalization, and readiness behavior.
- Review correction: city names differing only in case remain Tier 2 within the same country and subdivision; a functional city index and fixture cover that behavior.
- Deployment note: this branch starts from latest `origin/main`, which contains the previously missing historical migration files. CI must still run the full migration replay and pgTAP suite before any production migration deployment.
