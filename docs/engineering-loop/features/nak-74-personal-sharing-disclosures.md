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

## Consolidated disclosure follow-up — October 15, 2026

The owner requested consolidating the remaining pointers into one PR. Pending
scope clarification, preserve the last confirmed boundary: personal-portfolio
privacy/terms disclosures, with BrokerDesk and monetization deferred. Do not
interpret this as approval to change production settings or certify all twenty
launch workstreams. Public operator/address/market/governing-law/grievance facts
have been requested and remain unresolved; no invented values may replace them.

Implemented source-verifiable additions:
- Explain PostalPincode, Zippopotam and optional Google Places inputs/purpose,
  and manual entry as an alternative to external location lookup.
- Describe personal-flow Supabase sign-in/PKCE cookies, ten-minute deletion
  security cookies, persistent local theme preference and provider-hosted pages.
- Qualify marketing analytics as a configured page-view filter, not a complete
  network or consent-applicability assessment.
- Distinguish VivIntro's normalized liveness records from Didit's capture
  processing and asynchronous deletion, with no unverified deletion guarantee.
- State the owner-confirmed free personal offer; add no refund restrictions.

Acceptance: notices match current source; the manual-entry alternative remains
available before searching; existing search/access/account behavior is unchanged;
unknown legal/provider/operational facts are recorded as outstanding evidence.
Use existing render, location-provider, location-field and cookie tests plus
targeted lint/typecheck. Do not add prose-mirroring tests. A cookie banner or
jurisdiction-specific legal clauses require confirmed applicability, not inference
from the absence of a banner.

Source checks: `location-provider.service.ts` and `LocationFields.tsx` (server
lookup input bodies, ZIP+4 normalization and manual mode); Supabase browser,
server and proxy clients; installed `@supabase/ssr` cookie defaults (400-day
maximum age when written, distinct from session validity); deletion cookie
helpers and their callback/deletion clear paths; theme provider; marketing
analytics filter; candidate worker's no-face-retention deletion request.
The account paragraph also now distinguishes export from deletion's fresh-sign-in
requirement, matching current account APIs rather than requiring reauthentication
for both operations.

Primary provider references checked October 15, 2026:
- [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
  and changelog: sign-in state uses cookies; browser cookie expiry is not server
  session validity. No Supabase SDK/configuration change was made.
- [Vercel analytics privacy](https://vercel.com/docs/analytics/privacy-policy):
  cookie-free analytics still processes request-derived information.
- [Didit verification privacy](https://didit.me/terms/verification-privacy-notice/)
  and [biometric retention](https://didit.me/terms/biometric-data-policy/):
  provider capture/processing is separate from VivIntro's stored results. The
  verification notice describes configurable retention and model-data use
  enabled by default, with an organization opt-out. VivIntro's actual settings
  were not inspected; do not assert opt-out, a fixed retention region/deadline,
  completed erasure or absence of secondary use. Console/contract confirmation
  remains a release evidence dependency, not a proven configuration violation.

Validation: 70 existing tests passed across server pages, location providers,
location fields/routes, deletion cookies, theme, analytics and owner request
details. Targeted ESLint, typecheck and diff whitespace checks passed. No browser
capture, production build, legal applicability determination, provider-console
mutation, real verification or database cleanup was performed for this follow-up.

Disposition: POL-03's missing location explanation and POL-04's missing
personal-flow cookie/storage notice are corrected in source; their provider and
runtime/consent evidence is still open. POL-05's public operator/grievance/legal
facts remain pending owner input. Stored terms-acceptance versioning and the
other twenty-part launch checks have not been implemented or signed off by this
copy increment. Keep this follow-up uncommitted on the same branch pending the
scope/business-detail response, then prepare one consolidated PR.

### Owner-confirmed markets and grievance mailbox — October 15, 2026

The owner confirmed India and the United States as launch countries. These are
intended markets, not evidence of data residency or a chosen operating/legal
jurisdiction. Individual US states and provider transfer/biometric applicability
still require assessment where relevant.

The public grievance mailbox is `nakshathra.platform@gmail.com`, spelled exactly
as provided. Privacy's fallback and `.env.example` now use it. An existing deployed
`VIVINTRO_GRIEVANCE_EMAIL` value will still override the fallback; deployment
configuration must match the approved address before checking the live notice.
No message was sent and mailbox ownership/delivery was not independently tested.
This confirms an email address, not a named grievance officer's appointment.

The owner requested an explanation of governing law. No governing law or forum
has been selected. Operator identity, public business/contact address and actual
country/state of operation remain unanswered; launching in India/US does not
answer those questions. No invented jurisdiction was added to terms. The earlier
pending-markets/mailbox statements above are superseded by this confirmation.

### Founder situation and audience clarification — October 15, 2026

The owner clarified the audience as Indians living in India and abroad seeking
arranged marriage, primarily India. Preserve India/US as the previously confirmed
initial launch countries; this is not approval for unrestricted worldwide rollout.
Privacy now describes that audience and initial-market distinction.

VivIntro is currently operated by two developers with no registered entity. The
terms fallback now states this confirmed fact rather than implying an entity is
awaiting formal confirmation. Address copy says business/contact address instead
of requiring a company registered office; existing environment keys remain
compatible and can name responsible individuals. Do not infer a sole
proprietorship, partnership, corporation, operator domicile or governing-law
choice from the founders' audience or lack of incorporation.

Public operator names, actual country/state of operation, an appropriate public
business/contact address and the named grievance contact are still unanswered.
The mailbox alone does not identify the accountable individual. These disclosure
changes do not certify that any particular business form or public launch meets
applicable requirements. No jurisdiction, legal structure or company name was
invented, and no deployment configuration was changed.

### Public operators and shared grievance responsibility confirmed

The owner authorized the exact public names **Nagarjun Mallesh** and **Rahul
Gollapalli Rangnatha**, confirmed that both operate from the **United States of
America**, and confirmed that both handle grievances at
`nakshathra.platform@gmail.com`. Terms now names both operators and the operating
country. Privacy identifies both grievance contacts, with wording that supports
multiple people. Environment examples carry the approved public names; existing
deployed values can still override them and require live verification.

No US state, business/contact address, chosen governing law or court/forum was
provided. Do not infer these from developer workspace paths, customer audience
or US hosting. The earlier unknown-names/country/grievance-person statements are
superseded by this confirmation. No legal entity was registered by these edits,
and no formal officer-role eligibility or launch compliance is certified.

### Owner decision — defer location/address/governing-law publication

The owner explicitly requested skipping the remaining US-state, public address
and governing-law decisions for this implementation, emphasizing founder identity
and product purpose. These questions no longer block this disclosure increment;
do not keep requesting them to finish the agreed code work.

Terms now emphasizes the two named founders and the portfolio-sharing purpose.
It omits the operator-location sentence and unfinished address/jurisdiction
messages. Existing optional address/governing-law environment hooks remain
compatible and render only when supplied; empty values no longer show a public
placeholder. The example configuration labels those fields optional. No chosen
jurisdiction or address was fabricated.

This is an explicit scope deferral, not a legal determination that those details
are unnecessary for every launch context. Preserve unresolved applicability and
provider/operational evidence in NAK-74 without presenting this code increment as
completion of the entire launch audit. BrokerDesk and monetization remain out of
scope. The prior hold-for-business-details instruction is superseded: finish
checks, integrate current main, and commit/push this consolidated follow-up on
the existing branch. The user retains manual PR creation.

Execution context: finish the personal-policy consolidation and publish its
remote branch. Initial markets, founders and shared grievance contacts are
confirmed. Address/governing-law publication is deferred by the owner; broader
NAK-74 legal, cookie/provider and production evidence remains open.

### Integrated validation and final handoff

Integrated `origin/main` at `f07b376` (PRs #101 and #102) without rewriting the
already-pushed branch history. The documentation-index conflict keeps both main's
NAK-106 records and this NAK-74 record. Main's location-field label changes are
preserved alongside the new contextual privacy notice. Its serializers and
personal grant durations are unchanged; the notice's requester examples do not
claim the now-optional candidate fields are mandatory.

The integrated production build passed, including TypeScript and all 81 static
pages, using non-secret synthetic Supabase build configuration. Full lint passed
with zero errors and two existing unused-disable warnings in Open Graph sources.
The repository's merge-commit hook may remove an unused directive in a staged
main file; that is comment cleanup only, not a media behavior change.

Browser inspection of the local production build at a 1280px viewport confirmed
the founder names and absence of unfinished address/law placeholders on Terms,
both privacy contacts and the approved mailto address, request persistence after
15-day access expiry, and the location/storage/retention section anchors. No
horizontal overflow or broken same-page anchor was observed. This is a bounded
desktop policy inspection, not a responsive whole-application/accessibility or
provider-network audit. The local start helper emitted the existing standalone
output advisory; the pages rendered successfully.

Final pre-push fixture, typecheck and full unit-suite outcomes plus the resulting
remote commit are recorded in NAK-74 after the push. No production environment,
database or provider settings were changed, and no deployment or legal clearance
is claimed. This completes the owner-scoped personal disclosure implementation;
the wider NAK-74 release review stays open.
