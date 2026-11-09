# Personal approved files and interest email recovery

Critical authorization change based on main `9f822b7`. Supersedes the signed
private viewer URL portion of the accountless approved-viewing app record.

- A personal Vivara approved viewer must sign in with a confirmed account to
  open a private photo or the horoscope. Existing account-ID approvals and
  reciprocal member shares use the same database resolvers. An already approved
  guest email can use a confirmed matching account. Member grants remain tied
  to their account IDs.
- The file route accepts a share token and opaque file key. It resolves the
  live session, approval and canonical descriptor with the viewer client, then
  streams the exact object through a private, non-cacheable application
  response. Signed Storage URLs are no longer issued for personal viewer files.
  A forwarded URL fails without independent approval. Revoked, expired and
  unpublished approvals cannot open new requests. Previously issued URLs
  expire on their original schedule and recipients can retain received bytes.
- A browser remembered through guest email verification can still see approved
  details and public photo variants. The private-sharing banner and approval-email landing page link to sign-in
  with a safe return path. Owner editor and BrokerDesk media use their separate
  access contracts.
- Guest verified submission queues one owner notice and one requester receipt.
  Reviewed approval queues an access email. The existing guest worker rechecks
  that approval before dispatch. Keep the existing templates and delivery IDs
  stable across retries. On November 9, production health showed disabled
  scheduling, 31 overdue email deliveries, and three overdue guest jobs.
  The authorized scheduler activation was verified with scheduled dispatches.
  The worker retired the three guest jobs beyond their 24-hour delivery window.
  Sentry issue NAKSHATRA-A then identified a second blocker. The owner
  notification worker failed while parsing the deployed public app URL before
  claiming mail. A rollback-only claim probe passed. Both mail workers now use
  a shared origin resolver with a canonical fallback on Vercel Production.
  The protected health check includes this resolver. Confirm production's
  `NEXT_PUBLIC_APP_URL` setting and deploy, then verify fresh inbox delivery.
  See the [production maintenance runbook](../../operations/production-maintenance.md).

## Boundaries and evaluation

The route and presentation live under `src/app/p/[token]`, supported by
`public-portfolio.service.ts` and the additive migration
`20261109161700_signed_in_approved_portfolio_files.sql`. The migration reuses
the canonical guest-grant predicate and existing approved projection. It adds
only a private helper and replaces two public function bodies, preserving the
public RPC types and privilege grants.

- Route tests exercise photo/document success, forwarding, mismatched accounts,
  malformed keys and denial when the same grant is revoked. Browser tests
  exercise actual app URLs, signed-out guest recovery and second-account denial
  with loopback Storage fixtures.
- The guest approval pgTAP suite exercises the confirmed email binding,
  independent-account denial, revocation, and all three durable mail events.
  Run the suite against a clean local Supabase database or required CI.
- Release the file-serving app and matching migration together. If the app is
  deployed first, existing guest-only approvals require the migration before
  their matching accounts can open private files. Test the deployed route with
  synthetic accounts and a representative large image.
- Email recovery requires the production origin correction and a fresh
  consented request/approval with inbox evidence from both recipients. Do not bulk replay
  stale jobs or infer delivery from provider acceptance.
