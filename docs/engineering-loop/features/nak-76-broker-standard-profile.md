# NAK-76 — Broker Standard Profile

## Problem

Broker-mediated links currently unlock the stored Complete Portfolio, including
contact and financial fields. The approved product model instead requires a
Complete-like broker view with contact, financial and owner-private information
removed. The old preparation RPC also returns raw Complete data to the broker
application so it can build the Detailed fallback.

## Goal

Create one immutable, version-pinned Broker Standard projection at the database
trust boundary. Authorized broker links receive this projection and the
published horoscope attachment; forwarded or unclaimed links continue to
receive the Detailed Introduction.

## Contract reconciliation

- Keep the existing one-recipient Introduction primitive.
- Reconcile new BrokerDesk Introduction expiry to the approved 15-day term;
  existing links retain their issued expiry rather than being extended.
- Do not require the recipient to be a VivIntro customer.
- Keep independent agency isolation and the existing mandate checks.
- Keep the current single-use pass during this phase.
- Defer pair workflows, family identity, questionnaires, payments and contact
  release.
- Preserve the legacy API value `accessMode: "complete"` and response key
  `completeData` for one database-first rollout cycle. Both now mean Broker
  Standard in broker-originated flows and never carry Complete data.

## Implementation plan

1. Add a private SQL projector with explicit top-level and nested allowlists so
   future fields remain hidden until deliberately classified.
2. Persist `broker_standard_data` on every immutable disclosure version and
   backfill existing versions.
3. Derive the projection with a private trigger whenever a version is captured.
4. Make preparation and resolution RPCs read only the bounded projection.
5. Derive the Detailed fallback from the pinned version in a private trigger;
   keep the legacy RPC parameter temporarily but prevent it from changing data.
6. Preserve Complete media and the published horoscope for the authorized
   Broker Standard view; preserve public media and no horoscope for fallback.
7. Update recipient copy without adding navigation or workflow steps.
8. Add pgTAP assertions for projection shape, retention, forbidden fields,
   private privileges and automatic derivation.

## Security considerations

- `complete_data` remains in `app_private` and is never returned by broker RPCs.
- The projector is `app_private`, `SECURITY INVOKER` SQL and executable only by
  database owners; authenticated and anonymous roles have no execution grant.
- The persisted column is non-null, object-shaped and protected by a recursive
  forbidden-key constraint.
- The trigger overwrites supplied projection data from the canonical Complete
  data, preventing caller-selected disclosure expansion.
- Resolution rechecks workspace activation, entitlement, relationship state,
  current publication and the active `introductions.send` mandate. Ending a
  mandate or unpublishing therefore closes an already-issued link immediately.
- Existing opaque references, mandate checks, device-pass hashes, expiry,
  revocation, rate limits, no-store responses and short-lived media URLs remain
  unchanged.

## Rollout and compatibility

Apply the migration before deploying the application copy change. During that
window the old UI may still say Complete Portfolio, but the database already
returns the safer Broker Standard projection. The legacy transport labels avoid
breaking an already-open client during the database-first rollout. A later API
version may rename them after pilot validation.

Rollback of the disclosure behavior should use a forward migration. Do not
drop the new column while any deployed resolver depends on it. Returning raw
Complete data to broker RPCs is not an acceptable rollback.

## Acceptance criteria

- Broker Standard retains customer name, family, education, non-financial
  career, lifestyle, preferences, astrology, full eligible photos and horoscope.
- No contact, email, phone, annual income, currency, wealth stage, credit band,
  private note or private package field appears anywhere in the JSON.
- Missing/invalid/forwarded passes continue to resolve Detailed only.
- Existing Introductions use their pinned version's generated Broker Standard
  projection after migration.
- Authenticated callers cannot select version rows or execute private projector
  functions.
- Unit, type, lint, build, migration and pgTAP checks pass.

## Implementation progress

- Contract reconciled and recorded in `docs/vivintrodesk-mvp-contract.md`.
- Database projection, backfill, derivation trigger and resolver change added.
- Recipient-facing copy updated to name Broker Standard Profile.
- Behavioral pgTAP coverage now exercises real publication gates, projection
  derivation and tamper resistance, Detailed fallback, pass-authorized Broker
  Standard resolution, horoscope inclusion, 15-day expiry, mandate termination
  and unpublishing.
- The clean CI replay exposed that the shared opaque-reference generator had
  never admitted the later `pvr` and `bpn` reference types. The migration now
  keeps the generator fail-closed while explicitly admitting those persisted
  portfolio-version and broker-notice prefixes.
- `npm test`, lint, typecheck, production build, `db:smoke`, SQL parsing and
  independent review passed locally. A clean migration replay and pgTAP run
  remain required in CI because Docker/Podman is unavailable on this host.

## Decisions and deviations

- The database, not TypeScript, is the source of truth for the disclosure
  projection. This prevents a direct RPC caller from expanding the view.
- Transport labels are deliberately retained for rollout compatibility and are
  documented as legacy rather than silently treated as product terminology.
