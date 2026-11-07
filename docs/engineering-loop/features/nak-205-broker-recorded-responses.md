# NAK-205 broker-recorded Introduction responses

Risk tier: Critical. Baseline: merged main `2191752`. Worktree branch:
`feat/nak-205-broker-recorded-responses`.

## Contract

On 7 November 2026, the owner approved decisions received by phone, WhatsApp,
or in person. Brokers can record and act on them without a second in-app
response. This supersedes the candidate-only response rule for the guarded
broker recording route and removes the planned candidate-confirmation prompt.

- An authorized broker records the source, channel, side and outcome. A final
  decision requires an attestation that it came from the candidate or a parent
  the candidate already authorized for that decision. Interested additionally
  attests to explicit consent for 30-day Complete Portfolio and Protected
  Contact disclosure to the other candidate if interest is mutual.
- The broker attests to consent received outside the app. An ordinary Family
  Viewer role or informal family opinion grants no decision authority.
  In-app preauthorization and electronic identity verification for offline
  conversations are outside this implementation.
- Needs time, callback requests and other feedback are append-only private
  reports. Notes remain scoped to authorized members of the same workspace.
  The canonical per-side decision stays immutable after a final response.
- A pair of consented Interested responses starts the existing mutual access
  window once, including mixed direct and broker-recorded responses. The
  existing participant resolver continues to enforce pinned versions,
  revocation and expiry. Broker users and Family Viewers gain no portfolio
  access from recording a decision. NAK-206 owns Family Viewer disclosure.

## Boundaries and validation

The family-update command requires a live broker session, the V3
`introductions.record_family_update` capability on both relationships,
active mandates, both candidates ready, an already shared Introduction within
its response window, and an up-to-date Introduction version. The private
report, decision, audit, and existing mutual notification transition share
one transaction. The idempotency record binds the payload to the actor and
Introduction. Private notes stay out of the candidate response, event and
notification payloads.

Apply the additive migration before the UI. The existing workspace resolver
retains its NAK-204 DTO for older applications. Candidate responses, broker
responses and Complete grants share the same Introduction row and transition.
Application rollback removes the recording controls. If new broker writes need
to be suspended, revoke authenticated EXECUTE on the recording RPC with a
follow-up migration. Keep existing valid consent records and use the existing
Introduction revocation action to terminate individual grants.

Validation targets: denied authority, wrong workspace, missing attestation,
informal feedback, first and second consent, exact retry, stale version, one
mutual event, 30-day expiry, and Protected Contact visible only to candidates.
Release requires clean Supabase replay, generated types, affected application
checks and independent review.
## Review and rollout

The expanded workspace read is opt-in using `?view=responses` on the existing
broker detail GET. Existing browser bundles and application versions retain
the original representation. This flag chooses a response shape and grants
no additional authority.

Independent review checked both candidate scopes, V3 mandates, session guards,
offline consent, concurrent writes, private notes and notification reuse.
Follow-up review confirmed the fixes for revoked date display, Unicode length,
lost-response retries, older browser bundles and contradictory consent copy.

NAK-206 supersedes the pause-and-renewal behavior recorded here. See the
[frozen Family Viewer access record](./nak-206-frozen-family-introduction-access.md)
for permanent closure of old bilateral Complete windows.
## Local database validation

- Clean Supabase PostgreSQL 17 replay passed. All 74 pgTAP files and 2,227
  assertions passed on the final migration and fixtures. The generated public
  types match the clean schema.
- The existing readable-link, approval/retry, Family Viewer, photo-cap and
  Introduction sharing concurrency gates passed, as did the local email
  delivery integration.
- The response fixture verifies both candidates' Complete and Protected
  Contact access, no broker access, a single 30-day grant, exact retry and
  revocation. No B2C runtime paths were changed.

## Local application validation

- Repository lint, TypeScript, production build, dependency audit and diff
  checks passed.
- All 1,985 unit tests passed. Coverage passed for 73 feature files and 21
  protected boundaries.
- The 12 targeted Playwright checks passed across desktop, tablet and mobile
  for the broker workspace and family invitation flows.
- This branch is local and pending pull-request review and hosted CI.
