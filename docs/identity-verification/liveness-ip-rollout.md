# Candidate liveness and IP workflow rollout

## Current liveness-only deployment (2026-10-05)

The IP rollout below is historical. The current contract is liveness only.
Save a Didit workflow with Liveness enabled and Face Match, IP analysis and ID
verification disabled. Configure `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID` and
`DIDIT_WEBHOOK_SECRET`; no manual version setting is needed. Didit returns the
session version, which is stored and matched by the worker.

Drain older registered candidate attempts and unresolved cleanup jobs before
changing workflow IDs. Apply `20261006030752_candidate_liveness_only_verification.sql`
through protected database CD first, then deploy matching application/worker code.
Use the same workflow ID/API key in Vercel and the protected worker environment.
Existing IP proof is not rewritten, and still requires IP approval. A failed old
attempt can retry only with fresh current consent after cleanup.

Test dashboard consent, real Sandbox camera handoff, signed webhook, worker
approval, publication badge, retry, withdrawal and confirmed provider deletion.
The optional create/delete probe needs only `DIDIT_SANDBOX_API_KEY` and
`DIDIT_SANDBOX_WORKFLOW_ID`, plus the existing private recovery-journal path.
It does not test the full camera/webhook journey. Keep representative document
verification separate; the current shared workflow ID cannot serve both policies.

## Historical liveness + IP rollout

Current policy: [NAK-60 contract](../engineering-loop/features/nak-60-liveness-ip.md).
This replaces portfolio-photo matching for candidates. Representatives retain
their document policy and must not use the candidate workflow. The self-created
pilot requires the signed-in candidate to own a saved self-declared portfolio;
delegated invitation starts/retries remain disabled. Existing management links
retain withdrawal/status access, while retry requires the eligible owner.

## Configuration and deployment

1. Publish a Didit workflow with liveness and IP analysis only. Do not include
   ID verification or face matching. Configure the provider's desired IP risk
   thresholds; VivIntro requires each resulting IP report to be `Approved`.
2. Drain existing candidate sessions and cleanup jobs before the change. Confirm
   no unresolved provider recovery/redaction work remains. Schedule the cutover:
   the migration retires old photo-start RPC permissions and old candidate proof.
   Previously checked candidates need a fresh liveness/IP check; no automatic
   upgrade of historical consent or proof is made.
3. Apply `20261005020238_candidate_liveness_ip_verification_merge.sql` through database
   CD before deploying the new app/worker. It adds a separate policy, exact-attempt
   management-token binding and explicit IP approval. It does not delete evidence
   at Didit; the existing protected worker continues provider deletion.
4. Set `DIDIT_WORKFLOW_ID` and `DIDIT_WORKFLOW_VERSION` to the new published
   workflow in **both Vercel and the protected GitHub worker environment**. Retain
   the matching server-only API key/webhook secret. Redeploy the application and
   run the worker with the matching code/configuration. Changing only Vercel
   leaves the worker unable to reconcile the new policy.
5. Verify the webhook destination `/api/webhooks/didit` and signed V3 delivery.
   Browser callback parameters never count as approval.

## Verification

Use a consenting test candidate in Sandbox, first without any saved photo.
Start from the dashboard, accept the camera/IP consent and open Didit. Confirm no
ID or reference-photo prompt. Complete the camera flow; verify webhook receipt,
worker approval of both reports, current publication readiness and “Liveness
checked” badge. Check camera denial, declined IP, retry, consent withdrawal and
confirmed provider deletion on iOS and desktop. Retries wait for pending recovery
or deletion to finish, protecting subject-keyed jobs. After deletion, the normalized
failed/declined outcome remains available for retry. An older superseded link can
still withdraw consent but cannot restart a newer session. Do not record raw faces, IP
reports, provider payloads, session URLs or credentials in logs/issues.

An optional automated Sandbox create/delete probe is now photo-free:

```sh
node scripts/verify-didit-liveness-sandbox.mjs /absolute/private-directory/recovery.json
node scripts/verify-didit-liveness-sandbox.mjs --recover /absolute/private-directory/recovery.json
```

The directory must be owner-only and outside the repository. Configure
`DIDIT_SANDBOX_API_KEY`, `DIDIT_SANDBOX_WORKFLOW_ID`, and
`DIDIT_SANDBOX_WORKFLOW_VERSION` separately. This probe does not certify the camera
journey, webhook, decision reports or deployed application.

## Error diagnosis and rollback

Vercel diagnostics contain a fixed stage and SQLSTATE, not the database message.
`IV001` means invalid/expired bearer link; `IV002` means a state conflict;
`IV003` or `IDENTITY_VERIFICATION_CONFIGURATION_INVALID` means missing/invalid
configuration. Generic `22023` no longer becomes “link expired.” Provider errors
distinguish rejection, credentials, rate limiting, timeout and availability.

The reported production 400 ended at the old photo-preparation RPC before Didit.
Its photo lookup and the new provider workflow were incompatible. The particular
stored photo association was not inspected. React hydration #418 and browser
extension channel errors need separate reproduction; this change does not claim
to resolve them.

If cutover fails, disable starts and forward-fix while keeping cleanup operational.
Do not deploy the old photo client against the new publication policy or mark old
proof as liveness/IP to bypass the gate. Keep a database backup and deployment
references under normal release procedures; do not reverse consent history.
