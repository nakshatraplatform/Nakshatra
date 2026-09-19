# Broker introduction system design — phases 4–8

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
14-day introduction and one hashed claim capability. Creation never asks the
portfolio owner for per-introduction approval.

### Phase 5 — Freeze the disclosure version

Every successful portfolio publication appends an immutable
`portfolio_disclosure_versions` row. It records the public data, Complete
Portfolio data, media manifests, horoscope manifest, presentation settings, and
publication timestamp.

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
introduction does not silently remove Complete Portfolio access to an earlier
active introduction on the same device.

The claimed device receives the pinned Complete Portfolio. A copied, forwarded,
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

Only the device holding the active Complete Portfolio pass can submit one
`accepted` or `declined` response and an optional 1,000-character comment. A
same-value retry is idempotent; a conflicting second response is rejected.

The response appears independently in the source broker's customer page and the
portfolio owner's dashboard. It does not notify, reveal, or look up another
broker. Follow-up conversation stays outside the application for the pilot.

## Workflow

`Broker customer page -> create link -> activate and copy -> manual WhatsApp ->
first device claims pass -> Complete Portfolio -> accept/decline -> owner and
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
| Claim link is forwarded or opened on another device | Complete claim fails; Detailed Introduction remains available |
| Introduction expires before claim or response | Pass is revoked and one `expired` event is recorded |
| Broker revokes after claim | Device session stops resolving immediately |
| Recipient submits the same response twice | Idempotent success without a duplicate event |
| Recipient attempts to change an answer | Rejected; broker resolves any change offline during the pilot |
| Customer has mandates with two brokers | Each organization gets an isolated version notice; neither sees the other |
| Recipient email omitted | WhatsApp-only flow works; label still provides broker context |
| Service-role media signing is unavailable | No media is returned; private paths and Complete data authorization remain safe |

## Deployment requirements

- Apply migrations through the protected database deployment workflow.
- Configure `SUPABASE_SERVICE_ROLE_KEY` only as a server-side Vercel secret.
- Keep `BROKERDESK_INVITATION_TOKEN_SECRET` stable across deployments; rotating it
  invalidates unclaimed links and active introduction cookies.
- Do not put either secret in a `NEXT_PUBLIC_` variable.
- Retain `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, and
  rate limiting on every claim, read, response, and broker command endpoint.
