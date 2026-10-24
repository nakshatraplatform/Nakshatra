# Sentry for VivIntro

NAK-89 configures the Next.js application. Sentry organization `vivintro`, project
`nakshatra`. The agent's MCP login is separate from application instrumentation.

## Configuration and deployment

Set `NEXT_PUBLIC_SENTRY_DSN` to this project's public DSN in Vercel before building.
Preview and Production environment scopes are independent. Keep Development
local if desired. No DSN or an invalid/non-Sentry destination disables delivery.
Rebuild/redeploy after changing public variables: they are compiled into browser
bundles. The build adds only the exact DSN ingest origin to `connect-src`.

Environment comes from `VERCEL_ENV`; local development uses `development`.
`NEXT_PUBLIC_SENTRY_ENVIRONMENT` can explicitly select development, preview,
production or test. Release uses `VERCEL_GIT_COMMIT_SHA`; non-Vercel builds should
set `SENTRY_RELEASE` to the Git commit. These are public diagnostic labels.

For readable production frames, configure a **private build token** with source-map
upload permission as `SENTRY_AUTH_TOKEN` in the build environment. Never prefix
it with `NEXT_PUBLIC_`, commit it or paste it into a support conversation. The
build targets `vivintro/nakshatra`. The token is consumed by the build plugin,
not the browser. Generated source maps are deleted after upload. Without a token,
Sentry map generation/upload is disabled; capturing errors still works but
original production source lines have not been established. Do not enable
`productionBrowserSourceMaps` to work around missing upload credentials.

Local environment files are ignored; `.env.example` documents variable names.
No Vercel environment or deployment is changed by this branch.

## Captured data and limits

- Browser uncaught exceptions/rejections and React error boundaries; Next server
  request/render/action failures and Edge errors through SDK instrumentation.
- Automatic performance traces: local 100% sampling during development and
  probabilistic 10% sampling otherwise. A local sampling hook replaces incoming
  sampling randomness on both core and incoming OpenTelemetry scopes, and a local
  sampler ignores remote sampled flags; the span
  envelope reports the resulting local decision. This is a target rate, not an
  exact per-minute quota.
  Missing DSN disables transmission. Sampling is not complete request logging.
- One shared privacy policy for Node, Edge and browser. Private URL segments,
  all query strings/fragments, bodies, cookies, headers, identity, locals, DOM
  breadcrumbs, attachments and arbitrary context are excluded. Exception text is
  redacted by default; error classes and source frames remain. Source-map debug
  IDs are preserved. This deliberately prioritizes privacy over raw error text.
- Replay is not installed/enabled. Free-form SDK logs, metrics, sessions and
  attachments are blocked by the initial policy. Outgoing trace headers are not
  propagated to other services in this first setup.
- Transport to Sentry necessarily exposes technical network metadata; this is
  not an anonymity guarantee. Review Sentry account retention/access/DPA settings
  before production activation.

## Handled failures and background workers

`src/lib/observability/operations.mjs` reports deliberately handled failures and
names important spans. `operation-contract.mjs` owns the explicit vocabulary;
only approved operations/codes and UUIDv4 diagnostic references survive the final
privacy filter. Arbitrary tags, error text, reference strings and context still
cannot cross the boundary. Do not add user content, provider IDs or email addresses
to this vocabulary. Original exceptions keep their scrubbed source stack; calls
with only a failed result use a synthetic operational exception.

Coverage includes verification start/current/resume/cancel/check-result and
management status/retry/withdraw, failed Didit webhook receipt, portfolio draft
save/publication/dashboard load, the shared `logServerError` callers, confirmation
email work in `after()`, and maintenance task failures/deferrals. Expected
verification 4xx responses are not reported as errors. After-response confirmation
failures use the response's request reference and await bounded SDK flushing.
This is explicit coverage, not automatic collection of every returned 5xx or all
console output. New handled failure boundaries must opt into the shared reporter.

The native verification, account-deletion, retention and broker-maintenance CLIs
use `scripts/observed-worker.mjs`. It initializes the pinned Node SDK with the same
runtime-neutral privacy policy, retains the job's business result, reports errors
and awaits up to two seconds of flushing/closing on either outcome. Native
telemetry requests also have a 1.5-second absolute deadline that destroys stalled
sockets, including responses that start but never finish. Worker telemetry uses
direct connections to the validated Sentry destination, bypassing environment
HTTP proxies so the deadline owns the socket throughout connection setup. A
flush timeout alone does not release those connections. The Node SDK
already existed transitively; it is now an explicit pinned dependency. Nothing
loads TypeScript or Next.js framework initialization inside the native CLIs.

For scheduled GitHub workers, add the public repository/environment variable
`NEXT_PUBLIC_SENTRY_DSN` in GitHub Actions. The verification and broker worker
steps pass it through along with `SENTRY_ENVIRONMENT=production` and
`SENTRY_RELEASE=${{ github.sha }}`. A Vercel variable does not reach GitHub Actions.
Do not copy `SENTRY_AUTH_TOKEN`, service-role keys or provider credentials into
telemetry configuration. An absent or invalid DSN disables transmission and does
not prevent required worker processing. Local/manual CLIs use the same public
DSN and may set `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` explicitly.

Approved logical operation labels identify dashboard/draft RPCs and shared Didit
and Resend transports, including SDK child spans. Raw URLs, query strings, SQL,
credentials and request/response contents remain excluded. Concurrent operation
scopes are isolated by the SDK's async-context lifecycle.

Recognized source paths retain their artifact-relative name. Unknown paths use
their source-map debug ID when available, or a distinct event-local alias without
exposing the original path. Source frames and debug-image references use the same
mapping. This fixes filename collisions; it does not prove authenticated upload
or original production TypeScript resolution. Those remain release checks.

Provider-internal logs, new API boundaries without explicit reporting, missed-job
Sentry monitors, alert inbox receipt, and completeness of end-to-end operations
remain outside this change. Existing GitHub worker/health alerts are preserved.

## Verify before rollout

1. Run lint, typecheck, unit/coverage and a production build.
2. In an isolated local or Preview build, temporarily add a route that throws
   `new Error("VivIntro Sentry verification error")` and a browser click handler
   throwing the same error. Exercise both through the real Next app.
3. Confirm error events and traces through Sentry, with the expected environment
   and release. Inspect outgoing synthetic payloads for a unique private-value
   sentinel in URL/body/context; it must be absent. Never test with real people.
4. After configuring source-map upload, repeat on the actual built deployment and
   confirm a first-party frame resolves to original TypeScript file and line.
   An accepted HTTP request or generated JavaScript frame alone is insufficient.
5. Remove temporary routes before committing or releasing. Leave the test issue
   available for inspection; resolving it is optional cleanup.
6. Configure alert recipients/rules and prove receipt separately before relying
   on Sentry for incident response. SDK installation alone does not configure alerts.

To stop browser collection, remove the DSN and rebuild/redeploy; an environment
edit alone cannot alter existing bundles. To remove the integration, revert the
SDK dependencies, Next wrapper and all initialization/error hooks together.
