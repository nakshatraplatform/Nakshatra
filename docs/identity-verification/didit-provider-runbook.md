# Didit provider readiness runbook

> Current candidate policy (2026-10-05): liveness only; no IP analysis, portfolio-photo
> requirement or face matching. Workflow versions come from session responses, not env.
> See [NAK-60 current contract](../engineering-loop/features/nak-60-liveness-ip.md). The older photo-bound candidate guidance below is historical.


> **Current split policy (2 October 2026):** B2C candidates use an ID-free,
> version-pinned biometric-authentication workflow that compares a live capture
> with the current primary portfolio photo. BrokerDesk representatives retain
> the separate document/name/date-of-birth workflow. Production remains disabled
> until the migration, Sandbox session, webhook, worker and deletion evidence pass.

This runbook is the Phase 0 control plane for a future Didit integration. It
does not authorize application code to collect, transmit, or store identity
documents until every required production gate below has an owner and evidence.

## Scope and data boundary

- Use a Didit-hosted verification session. The server transiently sends the
  candidate-authorized primary portfolio photo directly from private Storage;
  no browser route exposes it and no additional reference copy is persisted.
- Nakshatra remains the data controller and Didit is a processor. Do not send
  candidate profile fields, family data, or other unnecessary data in
  `vendor_data`, metadata, callback URLs, logs, or support tickets.
- Persist only the minimum application record needed for an eventual decision:
  local verification ID, provider session ID, workflow version, final status,
  timestamps, and deletion outcome. Do not persist document images, document
  numbers, extracted identity fields, biometric material, raw webhook payloads,
  or provider reports unless a separately approved legal requirement exists.
- Never display a provider decision as an absolute identity guarantee. Treat it
  as one input to the product's explicitly defined verification policy.

## Required account separation

1. Create one **Sandbox** Didit Application and one **Production** Didit
   Application in the Didit Business Console. Do not reuse keys, workflows,
   webhook destinations, or retention settings between them.
2. Disable billing auto-top-up and do not add a payment method during Phase 0.
   Record the available free quota and its expiry in the private operations
   record, not in this repository or Linear.
3. Restrict Production console access to named operators with MFA. Record the
   responsible owner and emergency rotation contact in the private credential
   inventory.

## Approved workflow baseline

Create one Sandbox workflow before creating Production. The replacement
workflow must exclude ID-document verification and must validate:

- passive liveness; and
- face comparison to the customer-controlled portfolio reference photo, only
  after Didit capability and consent behavior are confirmed.

Device/IP analysis and every other optional module remain disabled unless a
separate privacy and security review approves them.

Keep the following disabled unless a separate reviewed issue changes the
privacy assessment: Aadhaar verification, PAN or other database validation,
AML/sanctions screening, reusable-network KYC, questionnaires, NFC, phone and
email verification, proof of address, blocklists, and all other optional
modules.

Before Production, take a non-secret configuration record showing the workflow
name/version and enabled modules. Store it in the approved private compliance
location; do not attach document images, session links, API keys, webhook
secrets, or raw identity data to Linear.

## Credential and webhook handling

The Didit deployment variables are `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, and
`DIDIT_WEBHOOK_SECRET`, following the
[official integration guide](https://docs.didit.me/integration/api-full-flow).
Application ID, Organization ID, and a separate Didit environment variable are
not required. Choose Sandbox or Production by configuring its matching scoped
API key, workflow ID, and destination
signing secret together. Existing
Nakshatra configuration (app URL and Supabase credentials) is still required.
The candidate-only scheduled worker does not require
`IDENTITY_VERIFICATION_MATCH_HMAC_KEY`; that key belongs to separately enabled
representative identity matching, not candidate liveness or cleanup.

In App Settings, copy the API key from **API keys** and create a **Webhooks**
destination with the final public HTTPS URL `/api/webhooks/didit`, version `v3`,
and events `status.updated` and `data.updated`. Use its signing secret, avoid
redirects or browser challenges, set all three Didit variables in Vercel, and redeploy.
Set the same API key on the existing worker. Complete a real sandbox session
from Nakshatra and verify a 202 receipt, worker processing, and session purge.
Console sample vendor references are placeholders, not local verification attempts.

Historical pre-production configuration decision (2026-10-02): candidate creation, webhook
allowlisting and worker reconciliation use the same `DIDIT_WORKFLOW_ID` and
the candidate's pinned `DIDIT_WORKFLOW_VERSION`. The old photo-prefixed names
are not aliases. Rename settings in Vercel and the protected GitHub worker
environment together. The chosen workflow must perform photo-match/liveness
without document collection. Representative creation also reads this ID but
retains its document-based acceptance policy: do not treat it as supported by
the candidate workflow or enable both flows until independent workflow
configuration is restored. Drain existing test sessions before switching IDs.
The opt-in sandbox probe keeps its sandbox-prefixed credentials and settings;
it does not fall back to app credentials.

- An API key is scoped to a Didit Application and authenticates server-to-server
  requests. Keep it only in the production secret manager under
  `DIDIT_API_KEY`; never add it to `.env.example`, `NEXT_PUBLIC_*` variables,
  browser code, test fixtures, CI logs, screenshots, or Linear.
- Store the webhook signing secret separately as `DIDIT_WEBHOOK_SECRET`. Rotate
  it through the provider console/API after every suspected exposure and at the
  cadence recorded in the private credential inventory.
- The deployed webhook endpoint at `/api/webhooks/didit` verifies
  `X-Signature-V2` over Didit's canonical JSON form, enforces a five-minute
  freshness window for both the signed envelope and `X-Timestamp`, and validates
  the configured workflow. It dedupes hashed provider event IDs when supplied;
  otherwise it hashes canonical authenticated content excluding the retry's
  dispatch timestamp. Application/environment fields are optional metadata, not
  separately configured credentials. It resolves an attempt only
  when its server-stored provider subject reference and provider session ID both
  match; it never stores the webhook body or decision object.
- Run `npm run identity-verification:process` every five minutes from the
  trusted scheduler. It fetches a provider decision transiently, projects only
  the normalized result, and deletes terminal provider sessions. It must run
  with the service-role key and must never log decision data, provider URLs, or
  provider credentials.
- Attaching a provider session also queues a delayed reconciliation fallback.
  This recovers a missed provider webhook without trusting an unauthenticated
  caller. Provider calls time out after ten seconds; transient failures retry
  with database-controlled exponential backoff from five minutes up to one
  hour. Alert when the scheduler fails or a work item reaches repeated retries.
- The candidate workflow must return no identity-document result and must pass
  passive liveness plus face match on the exact pinned workflow ID/version. The
  representative workflow must contain exactly one approved document result and
  pass its existing name/date-of-birth policy. Cross-policy or ambiguous results
  fail closed. Validate both workflows and signed deliveries in Sandbox.
- The repository secret scan detects high-entropy values assigned to
  `DIDIT_API_KEY` or `DIDIT_WEBHOOK_SECRET`. Didit does not publish a stable
  credential prefix in its public documentation, so this detector is purposely
  assignment-bound rather than claiming an unverified provider format.

## Sandbox validation procedure

1. Use only consented test material and synthetic test identities where Didit
   supports them. Never place real identity documents in source control,
   fixtures, screenshots, Linear, or shared developer folders.
2. Create a candidate hosted session from VivIntro with a consented test primary
   photo. Confirm the request uses `portrait_image`, the hosted flow asks for no
   ID, and the decision contains the pinned workflow version, passive liveness,
   and face match.
3. Separately validate the BrokerDesk representative document matrix in
   [india-document-matrix.md](india-document-matrix.md). Record the provider
   application, workflow version, date, test-material source category, outcome,
   and error class in the approved private evidence store.
4. Configure a Sandbox webhook endpoint and send provider test events. Verify
   signature rejection, stale-event rejection, duplicate-event handling, and
   the absence of raw payload logging before a real integration is proposed.
5. Query the provider's current retention setting. Set the shortest available
   retention as a fallback; Didit's public documentation currently states one
   month is the shortest console option. Complete the deletion test in
   [privacy-and-retention.md](privacy-and-retention.md).

## Production go/no-go gate

All of the following must be complete before enabling a Production workflow or
processing an identity document:

- Sandbox evidence shows the candidate photo/liveness checks and the separate
  BrokerDesk representative document checks behave as recorded.
- The DPA, subprocessors, security evidence, biometric/liveness evidence,
  processing region, retention, deletion, incident-notification, and
  termination/deletion commitments are reviewed by the appropriate owner.
- A data-protection and product decision establishes the legal basis, user
  notice, consent/acknowledgment language where needed, appeal/manual-review
  path, age handling, and unsupported-document behavior.
- The process-and-purge deletion path is tested from a server-only environment
  without logging a provider key, webhook secret, document, session URL, or raw
  response.
- Production keys and webhook secret exist only in the approved secret manager;
  the TruffleHog synthetic-detector test and the GitHub PR scan pass.
- A separate implementation issue has added and reviewed the server-only
  session-creation, webhook-verification, authorization, retention, and
  observability code.

## Provider references

- [Configuration contract and validation](didit-configuration-contract.md)
- [Didit API authentication](https://docs.didit.me/getting-started/api-authentication)
- [Didit hosted sessions overview](https://docs.didit.me/api-reference/overview)
- [Didit webhook verification](https://docs.didit.me/integration/webhooks)
- [Didit data retention and deletion](https://docs.didit.me/console/data-retention)
