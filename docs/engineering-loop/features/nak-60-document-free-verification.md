# NAK-60 document-free verification

Mode: full (critical biometric, authorization, database and provider boundaries). Status: implementation in progress; not releasable.

## Execution context

- Baseline: `origin/main` at `33f9091`; implementation branch `feat/nak-60-document-free-verification` began from that commit plus the plan commit `ae58289`.
- Durable issue: [NAK-60](https://linear.app/phoenix-works/issue/NAK-60/validate-didit-sandbox-and-deployed-end-to-end-verification-flow). Current issue body retains the earlier ID-based plan as history and appends the approved reset.
- Approved direction: [document-free decision](../../identity-verification/liveness-only-decision.md); detailed [transition plan](../../plans/nak-60-document-free-verification-plan.md); [provider spike](../../spikes/api-didit-profile-photo-match-spike.md).
- Current code: `didit.provider.ts` sends ID expectations; `session.service.ts` shares candidate and representative attachment; `scripts/identity-verification-worker.mjs` requires ID, legal name and DOB; `20260910120000_brokerdesk_representative_verification.sql` supplies the current RPCs; `portfolio_media` hero may be changed by service and direct authorized DB writes; public badge uses `identity_verified`.
- Next step: run the controlled Didit Sandbox create/delete probe with a consenting test portrait and a published ID-free workflow. Then design and test photo-bound persistence and worker policy. Preserve the representative ID policy pending a separate product decision. A real provider session and privacy review remain release gates.

## Contract and boundaries

The candidate consents to a Didit-hosted liveness capture compared to their current primary portfolio photo. Neither application request nor workflow collects an ID document. A pass is bound to the candidate, portfolio, immutable photo version and Didit workflow version; later photo changes immediately withdraw the public claim. Existing document-based proofs remain distinguishable. BrokerDesk representative verification is a separate assurance policy.

The application cannot claim legal identity, age, marital status or account uniqueness from this check. Raw images and decisions remain outside application persistence and routine logs. Provider deletion is required after terminal reconciliation, subject to documented provider exceptions.

## Evaluations

| ID | Expected behavior and rejecting check | Status |
| --- | --- | --- |
| N60-1 | Candidate session request includes the exact server-resolved primary photo and a new ID-free workflow ID; it contains no `expected_details` or document fields. A request-body test rejects accidental reintroduction. | Adapter passed; app integration pending |
| N60-2 | Missing photo, provider config or required workflow-version metadata fails closed before a session is attached. Provider adapter tests reject missing/foreign workflow and oversized image. | Adapter passed; persistence binding pending |
| N60-3 | Only the candidate or valid candidate invitation can start a check; a broker cannot replace the bound photo during verification without invalidating the attempt. DB tests use authorized direct mutation to reject service-only enforcement. | Planned |
| N60-4 | Only an approved expected liveness and face-match decision on the bound, unchanged photo can become current proof. Missing module, ID module, altered workflow, old photo, replay and withdrawal cannot pass. Worker + pgTAP checks reject an overall `Approved` shortcut. | Planned |
| N60-5 | Public portfolio exposes the precise photo-match claim only while it is current; legacy ID proof is not relabelled. Component/browser checks reject a stale badge after photo mutation. | Planned |
| N60-6 | BrokerDesk representative flow retains its independent rules and does not inherit candidate photo-match approval. Existing representative tests plus negative cross-policy cases. | Planned |
| N60-7 | Provider session and biometric evidence are deleted after terminal decisions; timeout, retry, duplicate callback and outage remain privacy-safe. Local worker/route tests plus controlled Sandbox manual evidence. | Planned; Sandbox blocked pending provider setup |

## Review and release gates

Run focused tests while iterating, then lint, typecheck, unit, pgTAP, build and relevant browser flows. Require fresh independent review on the final snapshot. Production enablement requires provider Sandbox evidence, launch-jurisdiction consent/retention decisions, accepted appeal path and protected deployment checks. No source-level success substitutes for those gates.

## First increment evidence (2026-09-30)

- Added `createDiditPhotoMatchSession` in `didit.provider.ts` using separate `DIDIT_PHOTO_MATCH_WORKFLOW_ID`; it rejects missing/foreign workflow metadata and sends no document expectations. This adapter is not connected to the live candidate route yet.
- Added `photo-reference.ts` to validate an existing WebP primary photo, derive a digest of the stored bytes and produce a bounded transient base64 reference. No extra photo or biometric template is persisted.
- Added `scripts/verify-didit-photo-match-sandbox.mjs`, run only with sandbox credentials and a consenting test portrait. It uses `sandbox_scenario` so a live Didit application rejects it and always attempts provider deletion. No provider IDs or images are logged.
- `vitest run tests/photo-reference.test.ts tests/didit-photo-match-sandbox.test.ts tests/didit-provider.test.ts`: passed, 10 tests. Focused ESLint: passed. `tsc --noEmit`: passed using the NAK-71 worktree's current `node_modules` via an ignored symlink. Docker unavailable, so pgTAP not run. Sandbox variables absent, so the real provider contract remains blocked.
