# NAK-74 — Personal portfolio sharing disclosures

Date: October 14, 2026. [Durable issue](https://linear.app/phoenix-works/issue/NAK-74/establish-vivintro-public-launch-security-privacy-and-legal-readiness).
Base: `origin/main` at `9f84f3f`. Branch: `docs/nak-74-personal-sharing-disclosures`.

## Contract and owner scope

The owner authorized disclosure changes for creating, publishing, sharing and
managing a personal portfolio. BrokerDesk is under development and outside this
increment. This does not assert that its production routes are disabled.
The owner confirmed there is no paid implementation; refund disclosures are
deferred until paid features are introduced. No refund policy or billing code is
added. Operator/market facts and other NAK-74 workstreams remain open.

This is a bounded content change, not a change to authorization, consent storage,
database retention, verification, media delivery or account deletion.

## Implementation and factual basis

- Privacy and terms now scope their sharing descriptions to a personal link and
  explain private drafts, reviewed publication and updates at the same URL.
- They distinguish public Introduction, account-bound approved Complete access
  and owner-only street-address/note fields, with public free-text caution.
- They explain interest submissions to the owner, 15-day approval/renewal,
  revocation, preserved approval on update, pause/resume on unpublish/republish,
  and revocation when replacing the link. Access expiry does not delete the
  request record.
- The owner explicitly confirmed that a viewer's 15-day access expiry must not
  delete their submission. The privacy page now explains each retention record,
  its purpose and clock in a semantic definition list at `/privacy#retention`.
  Interest history states the same distinction and links directly to that
  explanation. Open/approved requests are explicitly outside the rejected/closed
  180-day cleanup rule; expiry does not start that clock.
- Saved/downloaded copies cannot be recalled. Already-issued temporary file
  links can work until expiry; no promise of immediate file erasure is added.
- The 730-day sentence is narrowed to portfolio access-audit records. Durations
  and cleanup behavior are unchanged.

Verified source: `public-snapshot.service.ts`, `approved-snapshot.service.ts`,
the access lifecycle, immutable access-event schema, current link transactions,
`photo-url.service.ts`, and `run_data_retention()` in migration
`20260817031718_security_phase_4_identity_privacy_rbac.sql`.

Source inspection found that the current approved serializer and its existing
test include career income. The new copy therefore names income among the
possible Complete fields, while leaving it outside the public Introduction.
Do not infer that all financial values are owner-only from older classification
wording. No projection is broadened by this content change.

## What the existing retention periods mean

These are existing engineering policy choices and rationales in the migration,
not legally established minimum periods. They are separate from permissions to
view a portfolio. No cleanup worker was executed during this task.

| Record | Existing cleanup rule | Purpose / important limit |
| --- | --- | --- |
| API rate-limit counters | Delete after 2 days since update | Short-lived counts used to limit abusive requests. |
| Viewer-session records | Delete after 90 days since start | Technical records grouping portfolio visits; not the user's account or portfolio. |
| Portfolio views/events | Delete after 395 days | Owner-facing annual activity/trend window, roughly 13 months. This is separate from Vercel marketing analytics. |
| Rejected/closed request personal details | Anonymize after 180 days since last update | Clear requester identity/contact, family context, message and metadata; keep a non-identifying request record. This rule does not automatically apply to open/approved requests. |
| Portfolio access-audit events | Delete after 730 days | Security/dispute history of request, grant, renewal, access, revocation and link-management events. References and timestamps are held; contact/message/token/media-path keys are excluded by the event schema. This is not a two-year copy of the whole portfolio. |
| Completed deletion receipts | Delete at their retention deadline; 30-day completion window | Short-lived operational proof/retry record after deletion, not a retained portfolio backup. |
| Database backups | 30-day provider-managed target | Recovery copies managed by the host; this target is not enforced by the application's retention function. Actual provider settings and restore/deletion evidence remain unverified. |

The numeric SQL rules require scheduled execution. Production execution and
backup settings have not been verified here. Other pilot/security audit classes
need their own retention decision; the 730-day access-audit rule is not a promise
about every log. Changing these periods would require a separate reviewed policy
and data-handling change. Account deletion and provider/biometric cleanup remain
separate lifecycles.

## Evaluation and limits

- Self-review against current serializers, link/grant lifecycle and media URL
  creation; copied text does not change the underlying permissions or TTLs.
- Passed after the retention expansion: ESLint on both changed pages and
  `InterestHistoryPanel.tsx`; `npm run typecheck`; `git diff --check`.
- Passed: 38 existing tests across `server-pages.test.tsx`, public and approved
  snapshot services, access lifecycle service, and `interest-owner-details.test.tsx`.
  No new prose-mirroring tests.
- An initial test invocation used two nonexistent snapshot filenames and ran
  only the 23 server-page tests; the corrected four-file run above passed all 33.
- No production build/browser run, provider calls, database mutation, production
  legal clearance or deployment performed. Existing policy
  styles are reused; request fetching and access behavior are unchanged.
  Installed Next page documentation was read.
- Graphify graph/executable are unavailable; source inspection was used.

## Remote handoff — October 15, 2026

The owner requested committing and pushing this increment, with a PR description
for manual PR creation. The branch base matches freshly fetched `origin/main`
at `9f84f3f`. Repository commit/push hooks are enabled for lint, typechecking,
fixture checks and the unit suite; their final results and the remote commit are
recorded in NAK-74 after the push. No PR creation or deployment is requested.

Execution context: personal-sharing content is implemented. Its broader
launch-validation gates remain open. Operator
identity/contact/jurisdiction and cookie/location/operational evidence still need
their separate decisions and checks. Do not mark the whole issue complete.
