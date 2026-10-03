# NAK-60 document-free verification

Mode: full (critical biometric, authorization, database and provider boundaries). Status: integrated on `feat/nak-60-liveness-integration`; provider and deployment evidence still required before release.

## Execution context

- Baseline: `origin/main` at `30ee187`; the current integration work is on `feat/nak-60-liveness-integration`. Earlier isolated adapter work and its reviews are retained below as historical evidence.
- Durable issue: [NAK-60](https://linear.app/phoenix-works/issue/NAK-60/validate-didit-sandbox-and-deployed-end-to-end-verification-flow). Current issue body retains the earlier ID-based plan as history and appends the approved reset.
- Approved direction: [document-free decision](../../identity-verification/liveness-only-decision.md); detailed [transition plan](../../plans/nak-60-document-free-verification-plan.md); [provider spike](../../spikes/api-didit-profile-photo-match-spike.md).
- Current code: the candidate route sends the authenticated server-resolved hero photo to the version-pinned biometric workflow; the database binds the attempt and current proof to that media record and digest; photo replacement revokes the proof; the worker requires the exact workflow plus passive liveness and face match and rejects any document result. BrokerDesk representatives retain the separate document/name/date-of-birth policy.
- Next step: apply the forward migration through protected CD, configure `DIDIT_WORKFLOW_ID` and `DIDIT_WORKFLOW_VERSION` consistently in Vercel/worker, and run the controlled real-device Sandbox create/webhook/reconcile/delete test. A real provider session, deletion evidence and privacy review remain release gates.

## Pre-production configuration rename (2026-10-02)

User-approved change: use `DIDIT_WORKFLOW_ID` and `DIDIT_WORKFLOW_VERSION`
instead of the `DIDIT_PHOTO_MATCH_WORKFLOW_*` names. Branch
`fix/nak-60-didit-workflow-env`, base `b5cfea5`. This extends the full feature
record because the setting crosses application, signed webhook and worker boundaries.

The pre-production environment now selects one workflow. Configure the ID-free
candidate workflow for candidate tests. Representative document verification
still has independent decision requirements and must not be assumed functional
with that workflow; concurrent independent workflows need separate configuration
again before enabling both. No verification rule, signature check, database
binding, timeout or deletion policy is relaxed. No remote settings or migrations
are changed. The opt-in sandbox probe retains its explicit `DIDIT_SANDBOX_*`
inputs to avoid accidentally consuming live credentials.

Acceptance: provider and service consume the shared ID/version; the webhook
requires only that workflow plus its secret and rejects other workflows; the
worker consumes the renamed environment inputs while rejecting version drift;
both protected worker steps forward the new names. Focused provider/service,
webhook, worker and operations tests reject incomplete renames.

Validation on this uncommitted increment (2026-10-02): the renamed contract
first failed 17 tests against unchanged implementation, then all 49 focused
tests passed after implementation. `npm run test:unit:coverage` passed all 835
tests / 137 files and all 52 per-feature gates. `npm run lint` passed with two
unused-disable warnings in unchanged Open Graph image files; `npm run typecheck`,
`node --check scripts/identity-verification-worker.mjs` and `git diff --check`
passed. Shared installed dependencies were used through an ignored symlink.
Build/browser checks were not repeated (low disk space and the known Turbopack
external-symlink limitation). No SQL changed, so pgTAP was not rerun. No real
provider calls, deployment, credential edits, commit or push were performed.
`graphify update .` could not run because the executable is unavailable.
Fresh-context review (`didit_env_review`, model identifier unavailable) found no
material finding in the runtime/test/configuration diff. Its independent worker
exercise confirmed the shared settings and rejection of missing/wrong versions
and wrong IDs before provider access. Runtime hashes stayed unchanged; this
verification record and the project-map update were added after review began.

Deployment: rename settings in Vercel and the protected GitHub worker environment
together, then redeploy/restart. Keep ID/version equal to the published candidate
workflow; a rename alone does not establish the original 503's cause. Rollback
requires restoring the old names and the previous code together. Drain old test
sessions before changing the selected workflow ID. Linear lookup for NAK-60 was
unavailable in this session; no issue write was attempted.

## Contract and boundaries

The candidate consents to a Didit-hosted liveness capture compared to their current primary portfolio photo. Neither application request nor workflow collects an ID document. A pass is bound to the candidate, portfolio, immutable photo version and Didit workflow version; later photo changes immediately withdraw the public claim. Existing document-based proofs remain distinguishable. BrokerDesk representative verification is a separate assurance policy.

The application cannot claim legal identity, age, marital status or account uniqueness from this check. Raw images and decisions remain outside application persistence and routine logs. Provider deletion is required after terminal reconciliation, subject to documented provider exceptions.

## Evaluations

| ID | Expected behavior and rejecting check | Status |
| --- | --- | --- |
| N60-1 | Candidate session request includes the exact server-resolved primary photo and a new ID-free workflow ID; it contains no `expected_details` or document fields. A request-body test rejects accidental reintroduction. | Implemented; live Sandbox evidence pending |
| N60-2 | Missing photo, provider config or required workflow-version metadata fails closed before a session is attached. Provider adapter tests reject missing/foreign workflow and oversized image. | Implemented |
| N60-3 | Only the candidate or valid candidate invitation can start a check; a broker cannot replace the bound photo during verification without invalidating the attempt. DB tests use authorized direct mutation to reject service-only enforcement. | Implemented; pgTAP pending locally because Docker is unavailable |
| N60-4 | Only an approved expected liveness and face-match decision on the bound, unchanged photo can become current proof. Missing module, ID module, altered workflow, old photo, replay and withdrawal cannot pass. Worker + pgTAP checks reject an overall `Approved` shortcut. | Worker implemented and unit-tested; pgTAP pending |
| N60-5 | Public portfolio exposes the precise photo-match claim only while it is current; legacy ID proof is not relabelled. Component/browser checks reject a stale badge after photo mutation. | Implemented; browser regression pending |
| N60-6 | BrokerDesk representative flow retains its independent rules and does not inherit candidate photo-match approval. Existing representative tests plus negative cross-policy cases. | Implemented and unit-tested |
| N60-7 | Provider session and biometric evidence are deleted after terminal decisions; timeout, retry, duplicate callback and outage remain privacy-safe. Local worker/route tests plus controlled Sandbox manual evidence. | Durable recovery implemented; live Sandbox deletion evidence pending |

## Review and release gates

Run focused tests while iterating, then lint, typecheck, unit, pgTAP, build and relevant browser flows. Require fresh independent review on the final snapshot. Production enablement requires provider Sandbox evidence, launch-jurisdiction consent/retention decisions, accepted appeal path and protected deployment checks. No source-level success substitutes for those gates.

## First increment evidence (2026-09-30)

- Added `createDiditPhotoMatchSession` in `didit.provider.ts` using separate `DIDIT_PHOTO_MATCH_WORKFLOW_ID` and pinned `DIDIT_PHOTO_MATCH_WORKFLOW_VERSION`; it rejects missing/foreign workflow metadata and sends no document expectations. This adapter is not connected to the live candidate route yet.
- Added `photo-reference.ts` to validate an existing WebP primary photo, derive a digest of the stored bytes and produce a bounded transient base64 reference. No extra photo or biometric template is persisted.
- Added `scripts/verify-didit-photo-match-sandbox.mjs`, run only with sandbox credentials, pinned workflow ID/version and a consenting test portrait. It uses `sandbox_scenario` so a live Didit application rejects it and always attempts provider deletion. No provider IDs or images are logged.
- `vitest run tests/photo-reference.test.ts tests/didit-photo-match-sandbox.test.ts tests/didit-provider.test.ts`: passed, 10 tests. Focused ESLint: passed. `tsc --noEmit`: passed using the NAK-71 worktree's current `node_modules` via an ignored symlink. Docker unavailable, so pgTAP not run. Sandbox variables absent, so the real provider contract remains blocked.

## Independent review and correction

Fresh-context reviewer of `c92c0a5` found three material issues: the probe expected Didit's old `204` deletion result, the candidate adapter accepted any workflow version, and a rejected created session could escape cleanup. The correction pins workflow versions, validates current `200` deletion outcomes and explicitly requests no face-template retention in the probe, adapter cleanup and shared worker. A fresh-session `404` now defers worker redaction rather than claiming deletion.

The second review found that a failed cleanup could lose the only session ID. `DiditProviderCleanupError` now carries a non-serializing session reference for a future trusted orchestrator to register and retry deletion. The photo-match adapter remains disconnected from the live route: before connection, add a durable orphan-redaction queue and test provider/DB failure handoff. A `404` after a lost successful DELETE response remains ambiguous and requires the documented operator investigation. These are open release gates, not evidence of completed provider deletion.

Final independent review of `25abf26` found no new material regression in this isolated increment and confirmed that the protected cleanup handle resolves the reachable adapter finding. It did not certify the future route/queue integration or the live provider contract.

Follow-up review of `3442e1e` found two additional P1 cleanup gaps. The shared
10-second create timeout affected the existing ID path without uncertain-create
reconciliation. The Sandbox probe discarded its correlation when deletion or
response parsing failed. The correction restores the original timeout behavior
for the existing ID path while keeping the disconnected photo adapter bounded;
its durable recovery queue remains a gate before route wiring. The Sandbox
probe now requires a protected local journal written before POST and supports
exact-correlation cleanup retries. Neither correction proves that a real
provider session was deleted; the live Sandbox check remains open.

Independent fresh-context review of the correction found no material issue in
this isolated increment. Full ESLint and TypeScript passed; the unit suite
passed after the code correction. The normal production build remains blocked
by this worktree's ignored `node_modules` symlink outside Turbopack's root,
and local pgTAP remains blocked by unavailable Docker. The journal recovery
path is protected and tested with mocked provider responses; it is not live
provider certification. The legacy ID flow's original transport uncertainty
remains a separate operational concern, and the disconnected photo adapter
must not be wired until its durable orphan-redaction queue exists.

## Integrated pilot increment (2026-10-02)

The candidate route is now connected to the photo-match adapter through a
forward database migration. The provider create is registered durably before
the network call, ambiguous creates are found by exact `vendor_data`, any
orphan sessions are deleted, and the local attempt is then closed as failed so
the private management flow can create a fresh retry. Successful attachment
cancels recovery and starts the normal reconciliation/redaction lifecycle.

The pilot publication gate requires creator entitlement, current photo-bound
verification, required content, and current disclosure confirmation. Billing,
plan selection, and payment records are intentionally not part of this pilot
increment. The future trial/payment design must replace this temporary
entitlement condition rather than silently reusing it.

Fresh independent review found and the implementation corrected four integration
gaps: photo replacement now expires rather than irrevocably revokes the proof;
current reference Storage objects cannot be overwritten or deleted directly;
provider-recovery jobs use the leased deferral policy and strict paginated
response validation; and token-authorized flows read only the RPC-returned
private photo path through a server-only client.

The final re-review then found and closed two race/rotation gaps: original
Storage objects are immutable and active attempt references cannot be deleted,
while provider cleanup remains independent of the currently deployed workflow
version. A fresh final pass reported no remaining P0/P1 findings.

Validation on the corrected integrated snapshot: ESLint, TypeScript, static database
fixture checks, dependency security audit, and the Webpack production build
pass. The unit suite passes 824 of 825 tests on Windows; the remaining test is
the pre-existing POSIX owner-only file-mode assertion for the opt-in Sandbox
journal, which cannot be represented by Windows `stat` mode bits. Local pgTAP
and real Didit Sandbox evidence remain unavailable without Docker and provider
credentials respectively.

## Pull-request CI correction (2026-10-02)

PR #70 exposed two integration-test gaps rather than a reason to relax the
production gates. The shared pgTAP publication fixture now provisions the
pilot entitlement and exact candidate/portfolio/hero-photo binding expected by
the current rules, including backfilling the candidate ID in older hero-media
fixtures. The owner-only-photo test receives verification independently so it
continues to isolate the media-visibility rule. The authenticated Storage
predicate for an active verification reference is explicitly documented and
allowlisted as a non-enumerating, owner-path-scoped perimeter helper.

Focused service tests now cover malformed readiness data, persistence failure,
omitted transition values, missing representative matching configuration,
malformed representative preparation, and provider unavailability. Full unit
coverage (excluding the known Windows-only POSIX mode assertion) passes, and
all feature service/mapper/contract files clear the 80% per-metric gate. ESLint,
TypeScript, `db:smoke`, and `git diff --check` pass. A local pgTAP replay remains
unavailable on this Windows host because Docker is not installed; GitHub CI is
the authoritative migration and pgTAP rerun for this correction.

The hosted pgTAP replay subsequently passed. The remaining CI failure was stale
end-to-end copy and gallery-count expectations: the UI now names the bounded
claim “Live photo match checked,” and the requested all-photo Gallery includes
the primary portrait. Playwright assertions now verify eight thumbnails, the
expected public/private clear-versus-blurred counts, the primary portrait, and
the precise non-identity disclosure instead of looking for the retired generic
identity wording.

The subsequent hosted browser run confirmed all gallery totals and privacy
states, and exposed one final ordering assumption: once the primary portrait is
included, it is intentionally the first featured Gallery image. The end-to-end
test now verifies that initial portrait state, selects the second thumbnail,
and then verifies the adaptive landscape state rather than assuming the Gallery
opens on the first non-hero image.
