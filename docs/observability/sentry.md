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
- Automatic performance traces: 100% during development and 10% otherwise.
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

A caught error converted into a normal API response needs deliberate safe
capture if monitoring that case is desired. This change does not rewrite every
handler or forward all console output. GitHub workers run outside Next and still
need separate SDK/flush/error instrumentation. Provider-internal logs, queue
health monitors, alert delivery and completeness of end-to-end operations are
not established here. Refer to the earlier observability investigation.

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
