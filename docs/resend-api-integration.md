# NAK-65 — Application Resend API integration

## Execution context

Source: [NAK-65](https://linear.app/phoenix-works/issue/NAK-65), revised user
requirement 2026-09-18. Base: `cc3bdba`; branch:
`feat/nak-65-resend-api-integration`. Supabase Auth SMTP/templates (NAK-64)
are deferred and remain unchanged. Linear owns the full foundation plan;
this file records the first API milestone and its implementation evidence.

## Project context and design

Nakshatra is a private marriage-introduction application (current main also
contains VivIntro branding). Next.js 16, React 19, TypeScript, Zod, Supabase,
Vitest and Playwright are used. See `db-architecture.md` and
`engineering-standards.md` for existing persistence and verification rules.
This task inspected the Didit provider/service pattern, environment handling,
test/coverage setup and CI; this is not a whole-repository audit.

The server-only provider owns configuration and external I/O. The strict
message contract owns input limits; callers must resolve authorized recipients
and render trusted templates before dispatch. No route, Server Action, generic
send endpoint, new Auth path or automatic business-event producer is added.
No sender/header/CC override is accepted from message input.

Full documentation mode: critical risk because this boundary handles sending
credentials and recipient data. Independent teammate review is required before
release. Live-provider verification is deferred, not a development failure.

## Acceptance and evaluation contract

| Criterion | Expected behavior | Evaluation |
| --- | --- | --- |
| API-1 | One fixed-origin HTTPS request; sender from server config; stable opaque idempotency key | `tests/resend-provider.test.ts` request assertions |
| API-2 | Import/build without Resend secrets; dispatch fails explicitly when unconfigured; rotation takes effect | Configuration and build tests |
| API-3 | Reject malformed/oversized input, extra headers and multiple recipients before I/O | Negative contract cases |
| API-4 | Bound request and response read to 10 seconds, response to 16 KiB; classify failures without raw errors | Timeout, stream and status tests |
| API-5 | No secrets/recipient details logged; no live calls in CI | Error tests with injected transport; source review |
| API-6 | Existing Auth behavior unchanged; required checks recorded truthfully | Diff, lint, typecheck, unit/coverage, build, CI |

## Implementation plan and locations

- `src/features/notifications/server/email.contract.ts`: validated single-message
  input and normalized dispatch result.
- `src/features/notifications/server/resend.provider.ts`: lazy config, fixed
  endpoint, bounded native-fetch transport; injectable fetch in tests.
- `tests/resend-provider.test.ts`: behavioral tests, no live credentials.
- `.env.example`: optional empty server-only configuration entries.

Use `sendResendEmail` only from trusted server code. It accepts a delivery UUID,
one recipient, a subject, required plain text and optional trusted HTML. It
returns provider **acceptance**, not proof of inbox delivery. The caller owns
authorization, template rendering, persistence and retry scheduling.

## Configuration and later activation

| Variable | Requirement |
| --- | --- |
| `RESEND_API_KEY` | Server-only sending key restricted to the intended domain |
| `RESEND_FROM_EMAIL` | Plain sender email on a provider-verified domain |
| `RESEND_REPLY_TO_EMAIL` | Optional plain monitored email; empty means omitted |

No values are required for `next build`. Do not use `NEXT_PUBLIC_`, commit
credentials or reuse a Supabase key. Changing these runtime values requires
redeployment/restart on hosts that snapshot environment configuration.
Supabase Auth still sends its own emails; this API adapter does not configure SMTP.

After development, verify the sender/domain, disable tracking for sensitive
links, configure credentials privately, and run an authorized real-inbox test
before enabling application delivery. No such activation is performed here.

## Reliability, compatibility and rollback

One call makes one send attempt, never an in-memory retry. A timeout/invalid
response can mean the provider accepted the message but the response was lost.
Retry only with the same delivery UUID and unchanged payload/configuration.
Provider idempotency lasts 24 hours, not forever; the durable worker must bound
uncertain retries within that window and preserve the exact request snapshot.
Never rotate IDs to retry uncertain sends. `retryable` is classification, not
permission for unbounded or immediate retry. Credential/configuration failures
require operator action, not silent message deletion.

The existing `app_private.notification_outbox`, claim and completion RPCs must
be reconciled in the next foundation increment; no new competing queue or
database migration is introduced by this adapter milestone. This milestone
does not claim durable delivery, encryption, worker recovery or webhooks.
Rollback is to remove the unused adapter; no data transformation is involved.

## Decisions / deviations

Use native `fetch`, matching the existing provider pattern, instead of a Resend
SDK. Inspection of SDK 6.28.1 found raw error logging outside production and
unbounded response reads. A small documented HTTP boundary avoids overriding
SDK internals or logging globals. No runtime dependency is added. No generic
service/repository layer is added until durable dispatch needs it.

Primary references checked 2026-09-18:
[send API](https://resend.com/docs/api-reference/emails/send-email),
[errors](https://resend.com/docs/api-reference/errors),
[idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Progress and evidence

API milestone implemented locally, not committed, pushed or released.
First regression run against a fail-closed runnable scaffold: 31 of 36 cases
failed for missing send/input/error behavior. Final focused suite: 45 passed.

Verification on 2026-09-18, base `cc3bdba` plus this uncommitted increment:

- Passed: `npx vitest run tests/resend-provider.test.ts` (45 tests).
- Passed: `npm run test:unit:coverage` (692 tests / 116 files; all repository
  and 48 per-feature gates). Provider line coverage 100%, branches 97.5%.
- Passed: `npm run lint`, `npm run typecheck`, `npm run db:smoke`,
  `git diff --check`, `npm run security:audit` (zero vulnerabilities).
- Passed: `VERCEL=1 npm run build` with synthetic public Supabase settings,
  no Resend settings, all 61 static pages generated. Standalone mode not tested.
- Blocked: `npm run test:e2e -- --workers=2` hit ENOSPC in Turbopack's cache;
  interrupted with 36 passed / 18 not run. This is not a passing browser suite.
  Removed only this worktree's generated `.next` and `.next-e2e` artifacts.
- Not run: pgTAP (no database changes), TruffleHog (binary unavailable),
  hosted CI and independent teammate review. Real email delivery deferred.

Self-review covered contract/config boundaries, redirect prevention, bounded
response streaming and timeout cancellation, safe returned errors, unchanged
Auth files and absent runtime dependencies. Fixed a lint-reserved test variable;
lint and typecheck were rerun successfully. No known material adapter finding
remains; broader release readiness is pending the checks above.

Actual files: added contract, provider, provider tests and this record; updated
only `.env.example`. No package, Auth, migration, CI or Git-hook changes.

Remaining NAK-65 foundation: queue reconciliation, durable/fenced worker,
transient-payload encryption/erasure, retry scheduling, migration coverage and
public types where needed. NAK-66/67 own business events; NAK-68 owns webhooks.
