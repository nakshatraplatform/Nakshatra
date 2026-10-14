# Unassigned — Structured location capture for India and the United States

## Execution Context

- Requirement source: user decisions on 13 October 2026 to implement India + US structured location capture without latitude, longitude, PostGIS, or radius queries, followed by the explicit decisions to require two manually entered street-address lines for portfolio creation, require a complete non-street hierarchy for show-interest, and use PostalPincode.in plus Zippopotam.us while deferring Google Places.
- Relevant project context: `docs/vivintrodesk-document-map.md`, `docs/vivintrodesk-mvp-contract.md`, and `docs/portfolio-data-classification.md`.
- Current implementation status: integrated onto the latest `origin/main`, including the newer guarded Show Interest commands. Exact Indian PINs use PostalPincode.in and exact US ZIP/ZIP+4 input uses Zippopotam.us; candidate fields remain transitional compatibility data. All three migrations pass PostgreSQL/PLpgSQL parsing and repository fixture checks. Full migration replay and pgTAP still require CI or another Docker-capable environment.
- Next incomplete step: run the full migration/pgTAP suite in CI, inspect a representative hierarchical matching query plan, and regenerate Supabase types from a fully migrated database. Google Places remains a disabled future enhancement unless its optional server key is configured.
- Blocking question: none.
- Context last verified: 13 October 2026 against `origin/main` at `f6529ce`; the geography integration lives in an isolated worktree and leaves unrelated landing/legal-page edits untouched.

### Code Locations

| Repository-relative path | Symbol, section, or route | Role | Why needed and intended change | Evidence |
| --- | --- | --- | --- | --- |
| `src/components/portfolio/LocationFields.tsx` | `LocationFields` | edit | Replace the rigid hierarchy with a shared search-first picker plus manual fallback. | Verified, current worktree |
| `src/components/portfolio/BlueprintForm.tsx` | `updateResidence` and foundation section | edit | Persist postal code, full ISO subdivision code, and normalized source in portfolio data. | Implemented and tested |
| `src/components/portfolio/InterestRequestModal.tsx` | `DetailsForm`, `InterestPayload` | edit | Require the shared hierarchy for every interest request without collecting street address. | Verified, current worktree |
| `src/app/api/reference/location-suggestions/route.ts` | `POST` | create | Rate-limited same-origin provider proxy for authenticated editors and active public portfolio viewers. | Implemented and tested |
| `src/features/location/server/location-provider.service.ts` | provider adapter | create | Isolate Zippopotam.us, PostalPincode.in, and future optional Google parsing, timeouts, and normalization. | Implemented and tested |
| `src/features/interest/server/interest.contract.ts` | request schemas | edit | Validate structured codes and postal fields. | Verified, current worktree |
| `src/features/interest/server/interest.repository.ts` | `submit` | edit | Pass structured location to the database-owned command. | Verified, current worktree |
| `src/features/interest/server/existing-viewer-profile.service.ts` | reusable profile projection | edit | Reuse the authenticated viewer's canonical structured location. | Verified, current worktree |
| `src/features/portfolio/server/dashboard.mapper.ts` | `mapCandidate` | edit | Include structured location in the candidate payload. | Verified, current worktree |
| `supabase/migrations/20261013190000_structured_location_capture.sql` | migration | create | Seed India/US ISO subdivisions, add queryable columns, synchronize candidate data, and extend the guarded interest commands without reopening the retired direct RPC. | Implemented; PostgreSQL/PLpgSQL parsed, runtime replay pending CI |
| `supabase/migrations/20261013210000_hierarchical_location_matches.sql` | migration | create | Canonicalize the matching hierarchy on portfolios and add the service-only tiered matcher. | Implemented; PostgreSQL/PLpgSQL parsed, runtime replay pending CI |
| `tests/location-reference.test.tsx` | location picker cases | edit | Cover search, confirmation, ambiguity, and manual fallback. | Verified, current worktree |
| `tests/location-suggestions-route.test.ts` | route cases | create | Cover authorization, same-origin, provider success, and public-token rejection. | Passing |
| `tests/interest-request.test.tsx` | interest UI/API cases | edit | Cover required structured submission and existing-profile location confirmation. | Verified, current worktree |
| `supabase/tests/database/structured_location.test.sql` | schema assertions | create | Prove ISO seeds, queryable fields, RLS, hierarchy validation, disclosure guards, readiness, and command persistence. | Added; full pgTAP execution pending Docker/CI |

## Problem

- Portfolio creation uses provider-specific GeoNames admin-one codes and has no postal-code field.
- Show-interest accepts free-text country/state/city and stores those values only in JSON metadata.
- Provider failures and ambiguous postal codes need an explicit, accessible confirmation/fallback path.
- Future geographic enrichment needs stable country, subdivision, locality, and postal identifiers, but the current phase must not collect coordinates.

## Goal

Provide one search-first location flow for portfolio creation and interest requests, normalize India/US selections to ISO 3166-1 alpha-2 and full ISO 3166-2 codes, and persist the structured result in queryable columns while preserving current display strings and disclosure behavior. Portfolio creation additionally collects two owner-only street lines outside the matching hierarchy.

## Change Contract

### Scope

- India and United States country/subdivision reference data.
- PostalPincode.in lookup for six-digit Indian PIN codes.
- Zippopotam.us lookup for five-digit US ZIP codes; ZIP+4 is normalized to its validated five-digit matching boundary.
- Google Places (New) autocomplete/details retained only as a future optional enhancement behind a server-only credential.
- Manual fallback and explicit user confirmation.
- Structured portfolio, transitional candidate, and interest-request persistence.
- Compatibility with existing portfolio JSON and display strings.

### Non-goals

- Latitude, longitude, PostGIS, or distance/radius queries.
- Street-address collection in show-interest or use of street lines for matching.
- Global subdivision coverage in this phase.
- Backfilling ambiguous legacy locations.
- Changing public, Complete, or Broker Standard disclosure tiers.

### Invariants

- Portfolio publication requires country, subdivision, city, postal code, provider/manual provenance, and both owner-only street-address lines.
- Show-interest requires country, subdivision, city, and postal code but never collects street-address lines.
- Street-address lines remain only in private portfolio draft JSON and are forbidden from public, approved, and Broker Standard disclosures.
- Provider outages never prevent manual entry or submission.
- Google credentials remain server-only and optional.
- Raw provider responses are not persisted.
- Coordinates returned incidentally by a postal provider are stripped and never included in the application suggestion contract.
- Geographic reference identifiers remain excluded from public and Broker Standard projections.
- Existing portfolio and interest display strings continue to work during rollout.

## Risk Assessment

**Initial risk tier:** Significant

**Rationale:** This changes shared form contracts, database persistence, a public rate-limited route, and an external paid-service boundary. Location is personal data, though exact coordinates and addresses are excluded.

**Documentation mode:** Full — migration, shared UI, external integration, compatibility, and privacy boundaries require coordinated evidence.

## Design and Quality Constraints

- Reuse the existing `LocationFields` controlled-component boundary and database-owned interest command.
- Keep provider parsing in a server-only adapter; client code receives only bounded suggestions.
- Use complete ISO subdivision codes such as `IN-KA` and `US-MA`; retain GeoNames IDs as optional locality identifiers.
- Store postal codes as text.
- Permit manual city values when no canonical locality exists, but never attach an unverified GeoNames ID.
- Maintain parent-bound RLS/command ownership rather than granting direct writes to structured location columns; full-row matching remains service-only.
- Use the installed Next.js 16 route-handler and environment-variable guidance: runtime validation, same-origin POST, server-only secret, bounded payload, and explicit rate limiting.

## Implementation Plan

1. Add evaluation cases and observe their intended failures.
2. Add India/US ISO subdivision definitions and normalization helpers.
3. Add the migration, structured columns, compatibility backfill, candidate synchronization, and updated interest command.
4. Add the provider adapter and protected suggestion/resolve route.
5. Convert `LocationFields` to search-first confirmation with manual fallback.
6. Integrate structured fields into portfolio and interest flows.
7. Regenerate database types and update focused tests.
8. Run focused tests, lint, typecheck, database checks where available, production build, Graphify update, and fresh review.

## Security and Privacy Considerations

- Authenticated editors may search directly; signed-out interest viewers must present an active public portfolio token.
- The provider route requires same-origin POST and the existing database-backed anonymous/authenticated rate limiter.
- Request bodies and provider responses are bounded and schema-validated; outbound fetches use short timeouts.
- `GOOGLE_PLACES_API_KEY` is read only in a server-only module and never returned.
- Only normalized country/subdivision/city/postal fields and an optional provider reference are persisted relationally; raw responses and coordinates are forbidden.
- Portfolio street-address lines are manually entered, stored only in the private owner draft, excluded from provider requests and matching, and blocked by every disclosure safety predicate.
- Location remains personal data subject to existing portfolio/request retention and access controls.

## Acceptance Criteria

- [x] AC-1: Portfolio users can search by ZIP/PIN, confirm an India/US normalized result, or enter it manually.
- [x] AC-2: Country uses ISO 3166-1 alpha-2 and subdivision uses a full, country-consistent ISO 3166-2 code.
- [x] AC-3: Show-interest requires the same structured hierarchy and never asks for street address.
- [x] AC-4: Indian PIN results can present multiple choices and never silently choose the first post office.
- [x] AC-5: Missing configuration, provider errors, timeouts, and empty results preserve manual fallback.
- [x] AC-6: Portfolio, transitional candidate, and interest rows contain queryable structured fields; existing display strings and metadata remain compatible.
- [x] AC-7: No latitude, longitude, geography, PostGIS, or raw provider response is collected or stored; portfolio street lines remain owner-only and outside matching.
- [x] AC-8: Provider access is same-origin, rate-limited, secret-safe, and unavailable public tokens are rejected uniformly.
- [x] AC-9: Existing disclosure projections continue to omit internal geographic reference identifiers.
- [ ] AC-10: Application checks, static database checks, and SQL parsing pass on current main; full repository migration/pgTAP runtime verification remains environment-blocked and is recorded below.
- [x] AC-11: Exact US ZIP and ZIP+4 searches use Zippopotam without credentials, normalize state to full ISO 3166-2, preserve multiple place choices, and never retain coordinates.

## Verification Plan

Validation mode: behavioral change with regression-first tests.

| Criterion | Representative check | Expected result |
| --- | --- | --- |
| AC-1/2/5 | Location component tests | Search selection writes normalized codes; manual fallback remains usable after errors. |
| AC-3/6 | Interest component, route, repository, and pgTAP tests | Required structured values reach queryable columns and compatibility metadata. |
| AC-4 | Postal adapter fixture | All distinct matching post-office/locality choices are returned. |
| AC-7 | Schema/diff inspection and database tests | No coordinate or address field exists. |
| AC-8 | Route tests | Cross-site, over-limit, invalid-token, and malformed requests fail without provider calls. |
| AC-9 | Existing snapshot/projection tests | Reference identifiers remain redacted. |
| AC-10 | `npm run lint`, `npm run typecheck`, focused/full Vitest, database verification where available, `npm run build` | Required checks pass or blockers are recorded. |
| AC-11 | Provider, component, contract, and pgTAP tests | US ZIP responses normalize to `US-*`, ZIP+4 stores the five-digit boundary, multiple places remain selectable, and `zippopotam` provenance is accepted end to end. |

## Compatibility, Rollout, and Rollback

- Migration precedes application deployment.
- Existing name fields and portfolio JSON remain readable; new columns are nullable.
- Backfill only recognized India/US codes and exact subdivision-name matches.
- Application works without Google configuration by using PostalPincode.in for India, Zippopotam.us for the US, and manual entry for provider failures or city-text entry.
- Rollback is application-first; database columns remain harmless and should be removed only by a later forward migration after consumers are retired.

## Implementation Progress

- Completed: shared search-first picker, PostalPincode and Zippopotam adapters, future optional Google adapter, protected route, required show-interest hierarchy, owner-only portfolio address lines, ISO reference data, queryable persistence, portfolio/candidate synchronization, a service-only hierarchical matcher, disclosure guards, generated types, and tests. Integration onto current `main` preserved its verified-email, candidate-details, self-created portfolio, and publication-review contracts.
- Next incomplete step: execute complete migration and pgTAP suites on a Docker-capable machine or CI, inspect representative matching query plans, and regenerate Supabase types from the migrated schema.
- Blockers: local PostgreSQL/Supabase replay cannot start because neither Docker nor Podman is installed. The latest main checkout now contains the previously missing migration history. Graphify update may still refuse its existing graph integrity guard.
- Verification status on latest main: lint and typecheck passed; 1,274/1,274 unit tests passed; `npm run db:smoke` and production build passed; all three migration files and their PLpgSQL functions parsed. Full pgTAP remains to be confirmed.

## Decisions / Deviations

- Decision: no coordinates or PostGIS in this phase.
- Decision: India + US coverage first, globally compatible code format.
- Decision: both street-address lines are required at portfolio publication, remain private draft data, and never enter the relational match hierarchy or a disclosure snapshot.
- Decision: country, state, city, and ZIP/PIN are mandatory for show-interest; street address is not collected there.
- Decision: PostalPincode.in and Zippopotam.us are the credential-free MVP providers; Google is a deferred optional enhancement and manual fallback is mandatory.
- Decision: Zippopotam ZIP+4 input is normalized to the five-digit ZIP because the upstream endpoint validates only that geographic boundary; latitude and longitude in upstream responses are stripped.
- Decision: five-digit US ZIP normalization is enforced independently in the UI/schema, application mappers, interest command, portfolio matching trigger, migration backfills, and publication readiness so direct database RPC writes cannot split tier-1 matches.
- Decision: `US-VI` uses `United States Virgin Islands` as its canonical application/database name and retains common provider spellings as aliases.
- Decision: `location_confirmed_at` was removed after review because a durable timestamp would be misleading without a distinct confirmation command; Phase 1 stores only the requested location fields and normalization source.
- Review resolution: provider quota authorization, bounded upstream bodies, legacy ISO normalization, hardened interest-command compatibility, stale autocomplete races, replacement-location invalidation, state-dependent field clearing, and country/city-bound GeoNames identifiers were corrected. On latest `main`, the migration now extends `submit_interest_details` and a guarded four-argument `submit_existing_interest` instead of recreating the retired direct RPC; its disclosure blacklists cover canonical relational aliases.
- Approval required: No — these decisions were explicitly supplied or are within the approved implementation scope.

## Final Pre-Merge Evidence

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- Full Vitest on latest main: 1,274 passed, none failed.
- `npm run build`: passed with process-local placeholder public Supabase values; the new `/api/reference/location-suggestions` route is included.
- SQL parser: all three new migration files and every PLpgSQL function passed PostgreSQL parsing.
- `npm run db:smoke`: pass after expanding the fixture checker to count pgTAP `like` and `results_eq` assertions.
- `npm run db:verify`: blocked before the complete repository migration/pgTAP execution because Docker/Podman is unavailable.
- No production Supabase writes were performed. The branch is based on latest `origin/main`, which includes the previously missing historical migrations.

## PR #98 CI follow-up

- CI confirmed migration replay succeeds, then pgTAP fails because the shared completed-draft fixture predates required ISO geography and private address lines. The fixture and its affected readiness assertions now reflect the publication contract; public-perimeter test data no longer copies private address lines into `published_data`.
- Replaced two unsupported pgTAP `like(...)` calls with `ok(... LIKE ...)` assertions.
- Updated browser fixtures and assertions for search-first ZIP/PIN entry, manual fallback, and normalized owner location. The 15 previously failing cases now pass across desktop, tablet, and mobile.
- Added focused contract/provider/publication tests; full Vitest and feature coverage gate pass (1,284 tests), as do lint, typecheck, static database fixtures, and a production build with process-local placeholder public Supabase values.
- Full pgTAP remains unverified locally because Docker/Podman is unavailable; the next PR CI run must confirm the database suite. No production database writes were made.

**Status:** Integrated on latest main and unit-verified; full pgTAP/CI verification pending
