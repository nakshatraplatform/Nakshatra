# Open creator onboarding and feedback

Mode: full. Risk: critical (authentication, authorization, forward migration, production role change). Source: owner decision on 2026-10-04. Issue: NAK-104. Branch: `feat/nak-104-open-creator-onboarding`.

## Problem and goal

The public landing page currently sends visitors to a launch waitlist, password signup rejects uninvited addresses, and the database gives creator capability only to entitled or operator accounts. This prevents real users from completing the private-portfolio journey and giving onboarding feedback. The owner now wants self-service signup for every visitor, while only `nakshatra.platform@gmail.com` remains a pilot administrator.

## Contract

1. Any visitor may use email/password or Google to create an account. A confirmed account may create one owner-controlled, private portfolio without an invitation. A viewer following a shared link must not silently acquire a portfolio as a side effect of showing interest.
2. An unconfirmed or revoked session cannot create or mutate a portfolio. Public publication still requires a self-created portfolio, required details, disclosure consent, and current photo/liveness verification or the separately authorized, narrowly scoped test exemption. Protected access remains owner-approved.
3. Public calls to action and auth screens lead directly to signup/signin. Old waitlist and creator-invitation links lead to signup; their write endpoints do not grant access. Historical private records remain intact for audit and recovery.
4. The only active Production pilot-admin grant belongs to `nakshatra.platform@gmail.com`; Rahul's admin grant is soft-revoked, without changing his Auth account or test-publication grant. Application authorization is still database-backed, never inferred from a displayed email or UI label.
5. After completing the portfolio details, an owner can optionally submit concise onboarding feedback. It must be private, bounded, authenticated, and viewable only by the platform administrator; it must never become part of public or protected portfolio content.

## Design and rollout

- Keep `app_private.actor_can_create_portfolio` as the canonical database capability and change it to confirmed-account ownership. The existing portfolio unique owner constraint, RLS/transaction rules, and independent publication gates stay in place.
- Retire waitlist/invite writes rather than deleting historical data. Use forward-only migrations and preserve old links as safe redirects.
- Do not deploy app copy suggesting open access until the migration is applied. CI must test a clean database replay, authorization negatives, and the signup/owner journey; CD migration history must be checked before live smoke tests. Production migration history was observed at `20261001120000` on 2026-10-04, so several earlier forward migrations remain pending.
- The production admin change is separate from deployment: exact confirmed Auth identities were checked, Rahul's existing row was soft-revoked, and a query confirmed one active admin row, for the platform email, at 2026-10-04 16:44 UTC.

## Execution context

Verified at `origin/main` `ef61233`: auth routes/forms, dashboard, landing, publication services, pilot and invitation migrations, and current pgTAP fixtures. The open-signup, retired-route, feedback, and current-contract updates are implemented on `feat/nak-104-open-creator-onboarding`. Hosted database verification and release authorization remain pending.

## Evaluation

| ID | Case and expected result | Wrong implementation rejected by |
| --- | --- | --- |
| OPEN-1 | Uninvited email signup succeeds; confirmation opens a private draft. | Auth route test and clean-database pgTAP capability test |
| OPEN-2 | Unconfirmed account and revoked session cannot create. | pgTAP negative cases |
| OPEN-3 | Viewer-only OTP/OAuth does not bootstrap an owner draft. | Auth callback/verify tests |
| OPEN-4 | Old waitlist/invite endpoints cannot grant/revoke capability. | Route 410 and SQL privilege tests |
| OPEN-5 | Publication still fails before verification/consent/content. | Existing publication and self-only pgTAP suites |
| OPEN-6 | Completed owner may submit bounded private feedback; another user cannot read or submit for that portfolio. | Feedback route and pgTAP tests |
| OPEN-7 | Only the platform account is active admin in Production. | Exact-target Production read-only verification, recorded above |

## Security considerations

No client assertion, entered email, historical waitlist row, or invite token grants creator capability. Confirmed Auth identity and live session are required at the database boundary. Feedback must exclude contact fields and be rate-limited. Old private data is not deleted; any retention decision is separate. Public visitor traffic may increase Auth/email/Didit cost and abuse exposure, so monitor rate limits and provider quotas after release.

## Progress and evidence

Local lint, typecheck, production build, 932 unit assertions across 146 files (bounded to four workers), and four Chromium landing/auth browser checks passed. The first full unit run found two stale invitation expectations (corrected) plus worker startup timeouts under high parallelism. The fresh-context independent review found two feedback SQL/test issues (missing hero media in a completion fixture and a null admin-list limit); both were corrected and the return review found no remaining material defect in those paths. This is static review, not a database pass. Local clean migration replay/pgTAP could not start because neither Docker nor Podman is installed. Hosted database CI, migration-history review, and staged production rollout remain release gates. Production app/database migrations have not been deployed by this task.
