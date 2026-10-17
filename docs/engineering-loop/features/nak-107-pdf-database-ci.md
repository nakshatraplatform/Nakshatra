# NAK-107 PDF database CI correction

## Contract and scope

PR #106, branch `feat/nak-107-pdf-link-lifecycle`, starting commit `1542f12`.
Correct the evidenced pgTAP integration failures without relaxing production
publication, session, quota, private-table or public-projection safeguards.
Security-sensitive test-contract review; SQL behavior is unchanged by this fix.

## Evidence and correction

- CI run `39059677510` clean migration replay passed. Database tests failed:
  PDF suite aborted after 5/33 assertions with SQLSTATE 22023, and session
  perimeter assertion 12/40 rejected the new public QR resolver.
- `pdf_original_token_001` had 22 characters, while canonical publication
  requires 21 URL-safe characters. Use `pdf_original_token_01` consistently;
  keep `pdf_replace_token_001` (21 characters). No production validator changes.
- `resolve_portfolio_pdf_link(text)` intentionally serves anonymous public QR
  requests and returns only a text share token behind canonical publication
  eligibility. Add only this exact signature to the established public-RPC
  exceptions and document its rationale. The catalog-wide guard remains active
  for every other authenticated SECURITY DEFINER function.
- Strengthen PDF tests with anonymous validation denial and a ready-ticket
  assertion (35 total). Add public resolver permission, text-only return and
  documented-rationale assertions to the perimeter suite (43 total).

## Verification / release gates

The user supplied the failed pgTAP logs. Docker/Postgres are unavailable locally;
static fixture checks and unit tests do not establish database execution.
Hosted clean replay, all pgTAP tests and exact generated-type parity must pass
before merge. Existing manually added RPC declarations may require replacement
with the real generated artifact after tests reach that step. Do not weaken the
schema drift check. No merge, production SQL or deployment is authorized here.

Local `npm run db:smoke`, `npm run typecheck`, assertion-plan counts (35/43),
token lengths (21/21) and `git diff --check` passed. Fresh-context read-only
reviewer `/root/pr106_ci_review` inspected snapshot
`4cd1fce01a627486d776b8b2899f03ef91c59e2267712eb462fddcbd0fec9cba`
against base `1542f12`, independently confirmed counts and canonical guards,
and found no concrete issues. Exact model identity is unavailable; no
cross-model claim. This subsequent documentation-only update does not alter
the reviewed SQL/tests. Graphify update completed; optional SQL extraction
dependency is absent, so SQL review was direct.

Next: commit/push with repository hooks, then hosted database and type checks.

## Scoped lesson

Use the actual canonical token-length contract in publication fixtures. A new
deliberately anonymous SECURITY DEFINER resolver needs an exact, documented
exception plus public-only behavioral tests; never exempt a name pattern or all
new functions to make the perimeter check pass.
