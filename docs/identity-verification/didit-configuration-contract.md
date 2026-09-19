# NAK-47 — Didit configuration and webhook compatibility

## Execution context and problem

User requirement (2026-09-19): configure Didit using only `DIDIT_API_KEY`,
`DIDIT_WORKFLOW_ID`, and `DIDIT_WEBHOOK_SECRET`. Baseline: `92ef17b` on
`origin/main`; implementation branch `fix/nak-47-didit-configuration`.
The original checkout has unrelated contributor-document edits, preserved in
place; this task uses a clean separate worktree.

The session provider already uses the API key and workflow ID. The webhook
validator additionally requires application/environment configuration and an
event ID, preventing the supplied Console sample shape from being accepted.

## Sources and scope

- [Official integration guide](https://docs.didit.me/integration/api-full-flow):
  three Didit configuration values; no Application or Organization ID in session creation.
- [Official webhooks reference](https://docs.didit.me/integration/webhooks):
  full-body HMAC, timestamp checks, workflow/session events, and refreshed retry
  timestamps. The reference describes event/application/environment fields;
  the user-provided Console sample omits them. Support both shapes, without
  claiming the sample proves a live delivery contract. Sources read 2026-09-19.

Critical risk; full feature record because this changes webhook authentication
configuration and replay handling. No schema changes, deployment, provider
settings changes, decision-policy changes, or unrelated UI changes.

## Design and invariants

- `didit.provider.ts` owns server-only session creation (unchanged).
- `didit.webhook.ts` verifies a full-body signature and freshness, then validates
  the configured workflow and application-generated vendor reference.
- `webhook.repository.ts` passes only identifiers and hashes to the existing
  service-role RPC. The RPC matches attempt, subject, and stored provider session
  atomically before deduplicating and queueing reconciliation.
- The existing worker fetches decisions using the scoped API key. Webhook
  decisions and redirect parameters never directly approve an identity.
- Deployment isolation comes from separate API keys, workflow IDs and webhook
  secrets. No additional application/environment IDs are needed. Never reuse a
  destination secret across Sandbox and Production.
- Keep SHA-256(event_id) for envelopes with an event ID, preserving existing
  receipt identities. Without one, hash the canonical authenticated payload
  excluding only the top-level dispatch timestamp, with a versioned prefix.
  This keeps timestamp-refreshed retries stable while distinguishing changed
  decisions, event types, sessions, and record-update times. Only hashes are
  persisted; no raw evidence is retained.
- No new dependencies or abstractions; keep existing route/service/RPC boundaries.

## Acceptance and evaluations

| Criterion | Evaluation | Expected outcome |
| --- | --- | --- |
| AC-1 Three Didit settings suffice | Provider tests and webhook tests with extra env variables unset | Session creation and authenticated receipt succeed |
| AC-2 Both envelope shapes work | Webhook tests with/without event/application/environment IDs | Safe identifier/hash projection only |
| AC-3 Forgery and mismatches fail | Bad secret, tampered body, stale/future timestamp, wrong workflow, malformed vendor/session | Rejection before persistence |
| AC-4 Retry safety | Same event ID or same event-ID-free content with reordered keys/refreshed timestamp | Same event hash; corrected decisions remain distinct |
| AC-5 Durable acknowledgment | Route tests, success/duplicate/error RPC results | 202 only after receipt; persistence failure returns 503 |
| AC-6 Deployment guidance agrees | `.env.example`, provider runbook, readiness guide | Only three Didit variables; existing app/worker configuration still applies |

## Implementation and verification

Regression-first: update webhook tests, observe missing-config failure, implement,
then run focused provider/webhook/worker tests and lint, typecheck, full unit
coverage, build. Database binding is inspected in the existing RPC; no migration
is required. Actual outcomes will be recorded here after execution.

## Rollout and rollback

Configure the three Didit variables on the server and the matching API key on
the worker, retain the existing Nakshatra/Supabase secrets, redeploy after review,
then complete a real sandbox session. Confirm delivery, worker normalization and
purge before production. Generic Console placeholders remain invalid local
references. Old application/environment variables are ignored after this change.
Rollback restores the old configuration requirement; restore those variables
before rolling back. Historical receipts remain valid; no data rewrite is needed.

Independent security review and hosted CI remain required before release.
Real sandbox delivery and production verification are not established by mocks.

## Progress

Implemented on `fix/nak-47-didit-configuration`. Updated the webhook validator,
`.env.example`, provider runbook, production-readiness guide, project reference
(`CLAUDE.md`), and webhook regression tests. The provider gateway and worker
already use the correct credentials and required no changes.

Validation on 2026-09-19:

- Regression baseline: seven webhook tests failed at the old configuration
  requirement after unsetting the extra variables, demonstrating the defect.
- Focused provider/webhook/route/worker tests: 29 passed before final additional
  route cases; final webhook suite: 18 passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed before build-generated route types existed.
- `npm run test:unit:coverage`: 116 files, 707 tests passed; statements 85.37%,
  branches 79.09%, functions 84.56%, lines 88.62%; feature coverage gate passed.
- `git diff --check`: passed.
- Independent security review: no blocking findings. Added the recommended
  exact historical event-hash assertion; final webhook suite passed afterward.
- `npm run build`: blocked by Turbopack's prohibition on a node_modules symlink
  outside its root. Shared installed dependencies were used after an isolated
  install exhausted disk space; its incomplete files were removed.
- `npm run build -- --webpack`: application compilation passed; build typecheck
  failed in generated login/signup page types because their existing optional
  page argument includes `undefined`. Those source files are unchanged in this
  task. Synthetic public Supabase configuration was used for build only.
- Hosted CI, real Didit sandbox delivery, and deployment: not run locally.
  No database migration changes; pgTAP was not rerun for this adapter-only change.

The implementation is locally tested, with full build readiness pending the
unmodified login/signup page typing errors and hosted CI. No production
configuration was changed. The lesson from this correction is to distinguish
documented credential requirements from optional webhook metadata; retain
authentication through destination secrets and stored session correlation.
