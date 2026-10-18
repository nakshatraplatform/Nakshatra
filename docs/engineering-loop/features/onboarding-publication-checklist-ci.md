# Onboarding publication checklist — PR #111 CI correction

## Problem and contract

User-supplied logs for commit `8172ea4`, workflow `39092463852`, show successful
migration replay followed by six pgTAP failures: public_perimeter 32–36 and
published_snapshot_completeness 20. Docker registry rate limits recovered and
the tests actually ran (57 suites / 1,540 assertions); retrying alone is not a fix.

The approved onboarding change makes street addresses optional. These two older
fixtures still removed address_line_1 to construct an incomplete publication.
That fixture is now complete, so its old denial expectation is no longer valid.
Correct the fixtures/expectations, not the production access implementation.

## Implementation and evaluations

- Public perimeter: remove both optional street lines and positively assert all
  five approved access paths still work (portfolio, destination, horoscope,
  protected photo, snapshot RLS). Then remove required postal_code and keep all
  five original denial assertions, restoration and rejection/revocation checks.
  Plan increases 38 -> 43; no assertion deleted or skipped.
- Published snapshot: incomplete draft now lacks required postal_code, preserving
  the invariant that draft editing cannot revoke an intact reviewed publication.
  Missing address_line_1 is a positive control, plus anonymous URL resolution.
  Missing required career.title is an additional denial control. Existing missing
  ZIP, malformed DOB, protected storage, owner-only hero, renewal/rotation and
  republishing assertions remain. Plan increases 24 -> 26.
- No migration, function/grant/RLS, runtime app, dependency, CI or timeout change.
  A wrong implementation that disables completeness would fail the retained
  required-field/denial controls; one that still requires street would fail the
  new positive controls.

## Validation and delivery boundary

Run fixture/plan checks and independent delta review. Docker/psql are unavailable
locally; hosted clean replay, all pgTAP and generated-type parity remain required.
Do not label static validation a pgTAP pass. Push the correction to #111 and carry
it into app PR #110 so neither branch retains the obsolete fixture. No merge,
production SQL or deployment is authorized. Database-first rollout is unchanged.

Local fixture/plan checks and diff whitespace checks passed. Independent fresh-
context review `/root/pr111_fixture_review` (actual model unknown) found no
material issues, independently reran fixture checks and verified both changed
test hashes against its immutable snapshot. It did not execute PostgreSQL.
Plans are 43 and 26; expected full-suite count increases by seven. This correction
must still pass the authoritative hosted database job before merge.
