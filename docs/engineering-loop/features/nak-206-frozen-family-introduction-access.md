# NAK-206 frozen Family Viewer access

Critical authorization change on `feat/nak-205-broker-recorded-responses`. Builds
on the NAK-205 Introduction and the candidate-owned roster from NAK-201.

## Contract

- An active exact-email Google Family Viewer with live V3 authority on both
  sides can open the opposite pinned Broker Standard Profile before
  mutual interest while responses are still open. The detail page is read-only. An account representing both
  sides can still see safe history but cannot open either profile as a viewer
  on that Introduction.
- The candidate or broker records consent for the expanded audience during
  the same Interested action. Each side consents to disclosure of its own
  Complete Portfolio and Protected Contact to the opposite candidate and
  that candidate's eligible Family Viewers for 30 days if interest is mutual.
  A stored Protected Contact entry grants no viewing permission by itself.
- The mutual transition freezes eligible roster IDs in the same transaction.
  No existing consent or grant is upgraded retrospectively. A late viewer
  has no profile access to that Introduction once it is mutual. Frozen viewers
  see Complete until the Introduction's original Complete window ends.
- Membership removal revokes the frozen grant and current reads also check the
  verified account, active roster, both mandates, candidate readiness, pinned
  disclosure version, Introduction state and expiry. Renewing a paused mandate
  leaves old bilateral Introductions closed, including those past the response
  deadline with an otherwise live Complete window. The migration also closes
  still-live historical windows with evidence of a recorded pause or termination.
  An uninterrupted renewal retains its existing behavior.

## Implementation and rollout

The new private grant table stores only the Introduction, viewer, side and
timestamps. The Introduction owns the version and expiry. Existing response
RPCs remain candidate-only for clients that have not collected the expanded
consent. The updated UI uses dedicated response RPCs for explicit new consent.
Existing candidate and broker response authorization and the mutual notification
event remain in the canonical transaction.

`/family/introductions/[introductionRef]` reuses the portfolio renderer.
`GET /api/v1/family/introductions/[introductionRef]` resolves the authorized
projection. Its bounded `asset` selector serves the authorized photo or
horoscope through the same live perimeter. Storage URLs are absent from the
HTTP response. Every asset request reauthorizes the session and file selection,
and returns private no-store headers. A viewer can save content already
delivered during authorized access.

Apply the schema before the application. The older app remains compatible
and collects candidate-only consent. The application can be rolled back
independently. Preserve frozen grant records and pause revocations. If family
viewing needs to be suspended, revoke authenticated EXECUTE on the Family
Viewer detail RPC in a follow-up migration.

Acceptance checks cover no pre-mutual grant, no historical audience upgrade,
a mixed candidate and broker mutual transition, opposite version and contact,
late addition, viewer removal, both response and Complete windows, paused
mandate renewal, and media reads through the active session.

## Local validation

- Clean Supabase PostgreSQL 17 replay and generated public type comparison
  passed. All 74 pgTAP files and 2,261 assertions passed.
- The local email integration, readable-link, approval/retry, Family Viewer,
  photo-cap and Introduction concurrency gates passed. The Introduction gate
  exercises both lock orders around an overlapping response and mandate pause,
  then verifies that renewal leaves Complete access closed.
- All 1,989 unit tests passed. Coverage passed for 75 feature files and 21
  protected boundaries. Lint, type checking, the production build and the dependency audit passed.
- Independent read-only review identified and re-reviewed fixes for raw asset
  locators, ambiguous roster membership, viewer removal races and both pause
  lock orders. Public family reads expose bounded asset selectors, and the
  service-only locator checks the exact live session and pinned storage scope.
- All nine local Playwright shards completed across desktop, tablet and
  mobile with the CI retry and timeout settings. Results were 817 clean
  passes, one desktop public-theme case that passed on retry, seven
  configured skips and zero hard failures.
- NAK-205 and NAK-206 are local on the same branch. Hosted CI and release
  are pending review.
