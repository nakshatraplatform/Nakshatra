# Broker introduction system design — phases 4–12

The broker-facing product remains named `BrokerDesk` internally. That label is
not a public brand commitment and can be replaced when the B2B product is named.

## Phase boundaries

### Phase 4 — Create an introduction

A broker starts from a customer relationship they are already authorized to
manage. The recipient is recorded only as a human-readable family label and an
optional email hash plus masked hint. There is deliberately no target customer,
target organization, or target broker foreign key.

The database checks the workspace membership, role scope, customer assignment,
active customer mandate, active portfolio publication, and both
`introductions.create` and `introductions.send` capabilities. It then creates a
15-day introduction and one hashed claim capability. Creation never asks the
portfolio owner for per-introduction approval.

### Phase 5 — Freeze the disclosure version

Every successful portfolio publication appends an immutable
`portfolio_disclosure_versions` row. It records the public data, owner-approved
Complete data, a generated Broker Standard projection, media manifests,
horoscope manifest, presentation settings, and publication timestamp. Broker
RPCs never return the stored Complete data.

The Broker Standard projection keeps the Complete Portfolio's identity,
personal, family, education, career, lifestyle, preference and astrology
content, while removing all contact fields, financial fields, geographic
reference identifiers, credit information and owner-private questionnaire
fields. The projection is generated in the database from an explicit allowlist
and pinned with the publication version.

An introduction references exactly one version and also stores its generated
Detailed Introduction snapshot. Later portfolio publications cannot change an
existing introduction. New introductions must use the latest version; the
creation service retries once if a publication races with introduction setup.

Every organization with its own active mandate receives its own
`broker_portfolio_update_notices` row. A notice can be flagged for clarification
without blocking publication or future sharing. The flag starts an off-platform
phone or WhatsApp conversation.

### Phase 6 — URL and device-pass design

Broker link:

`https://vivintro.com/introductions/bir_<opaque-reference>#pass=<43-character-secret>`

The fragment is not sent in the initial HTTP request, server logs, referrer
headers, or social previews. The browser exchanges it through a same-origin API.
Only the SHA-256 claim hash is stored. A successful one-time exchange removes
the claim hash and establishes an HttpOnly, Secure-in-production, SameSite=Lax,
time-limited device cookie. Exchange retries derive the same device secret and
are idempotent. Each introduction uses its own cookie name, so claiming a later
introduction does not silently remove Broker Standard access to an earlier
active introduction on the same device.

The claimed device receives the pinned Broker Standard Profile. A copied, forwarded,
reused, invalid, or missing pass receives only the pinned Detailed Introduction.
Revoked and expired introductions disclose neither view.

Protected media paths never reach the browser. After the database authorizes the
device session, the server uses the already-required Supabase service role to
create five-minute signed Storage URLs. Missing media-signing configuration
degrades to the portfolio text rather than weakening authorization.

### Phase 7 — Minimal audit history

`broker_introduction_events` accepts exactly six values:

- `created`
- `shared`
- `claimed`
- `response_submitted`
- `revoked`
- `expired`

Other state belongs on the introduction, pass, response, or notification row.
Audit payloads contain opaque references and status metadata, never raw tokens,
raw recipient email addresses, portfolio JSON, or another broker identity.

### Phase 8 — Response and notification

Only the device holding the active Broker Standard pass can submit one
`accepted` or `declined` response and an optional 1,000-character comment. A
same-value retry is idempotent; a conflicting second response is rejected.

The response appears independently in the source broker's customer page and the
portfolio owner's dashboard. It does not notify, reveal, or look up another
broker. Follow-up conversation stays outside the application for the pilot.

### Phase 9 — Broker workspace and action queue

`/brokerdesk/w/<workspaceRef>/dashboard` is the default BrokerDesk destination.
Its projection is calculated in the database from the signed-in membership,
workspace entitlement, role capability, customer assignment, and active
mandate. It contains only the current organization’s counts and actionable
items: unseen responses, customer publication notices, clarification flags,
and shared introductions expiring within 72 hours.

No internal organization, candidate, relationship, introduction, or notice UUID
is returned. All navigation uses opaque public references.

### Phase 10 — Lightweight operational follow-up

A recipient response remains immutable. A broker can only mark it reviewed;
the follow-up conversation stays on phone or WhatsApp. A portfolio update can
be acknowledged or flagged for clarification. These actions are deliberately
status fields rather than new audit event types, preserving the six-event
introduction history agreed for the pilot.

Acknowledging or reviewing in one broker organization cannot affect another
broker’s notice or queue, even when both represent the same customer.

### Phase 11 — Link maintenance and security operations

Revoked and expired introductions immediately scrub both claim and device
session hashes, along with claim/last-seen timestamps. The six-event audit row
remains, so operators can diagnose the lifecycle without retaining usable
credentials.

The hourly maintenance workflow calls a service-role-only RPC and is disabled
until the protected GitHub environment, secrets, and
`BROKER_INTRODUCTION_WORKER_ENABLED=true` repository variable are configured.
The worker rejects non-local database hosts other than the approved Nakshatra
project (`xizzzczzhqzabcipbgep.supabase.co`). User requests also perform lazy
expiry, so correctness does not depend on the scheduler being available.

### Phase 12 — Bounded pilot and validation

The initial operating boundary remains two brokers, five customers each,
manual WhatsApp delivery, and no broker-to-broker features. The repository
includes an opt-in local scenario with two isolated broker workspaces and one
customer represented by both. It demonstrates independent queues, an accepted
recipient response, an unread publication notice, and a link approaching
expiry. The default database reset does not load this scenario.

See `docs/broker-pilot-test-runbook.md` for accounts, expected outcomes, and the
manual pilot checklist. Production sample identities are never auto-created.

## Workflow

`Broker customer page -> create link -> activate and copy -> manual WhatsApp ->
first device claims pass -> Broker Standard Profile -> accept/decline -> owner and
source broker dashboards update`

If the URL is forwarded after claim:

`forwarded URL -> consumed pass cannot be claimed -> Detailed Introduction only`

## Important edge cases

| Scenario | Enforced outcome |
| --- | --- |
| Broker lacks assignment, capability, or active mandate | Neutral unavailable response; no record created |
| Portfolio is unpublished or expired | Introduction creation is rejected |
| Customer publishes during creation | Stale version is rejected and the service retries with latest |
| Same idempotency key and same request | Original introduction and URL capability are returned |
| Same idempotency key with changed input | Request is rejected |
| Claim link is opened twice on the original device | Deterministic exchange retry restores the same session |
| Claim link is forwarded or opened on another device | Broker Standard claim fails; Detailed Introduction remains available |
| Introduction expires before claim or response | Pass is revoked and one `expired` event is recorded |
| Broker revokes after claim | Device session stops resolving immediately |
| Recipient submits the same response twice | Idempotent success without a duplicate event |
| Recipient attempts to change an answer | Rejected; broker resolves any change offline during the pilot |
| Customer has mandates with two brokers | Each organization gets an isolated version notice; neither sees the other |
| Recipient email omitted | WhatsApp-only flow works; label still provides broker context |
| Service-role media signing is unavailable | No media is returned; private paths and Broker Standard authorization remain safe |

## Deployment requirements

- Apply migrations through the protected database deployment workflow.
- Configure `SUPABASE_SERVICE_ROLE_KEY` only as a server-side Vercel secret.
- Keep `BROKERDESK_INVITATION_TOKEN_SECRET` stable across deployments; rotating it
  invalidates unclaimed links and active introduction cookies.
- Do not put either secret in a `NEXT_PUBLIC_` variable.
- Retain `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, and
  rate limiting on every claim, read, response, and broker command endpoint.
