# Production and development environments

Approved in [NAK-85](https://linear.app/phoenix-works/issue/NAK-85/separate-development-and-production-environments)
on 2026-10-18. Setup is incomplete until the external settings and synthetic
checks below are verified.

| Environment | Git branch | Application deployment | Supabase |
| --- | --- | --- | --- |
| Production | `main` | Vercel Production / live domain | Existing Nakshatra project (`xizzzczzhqzabcipbgep`) |
| Development/testing | `development` | Vercel Preview / stable testing URL | Separate Nakshatra Development project; reference pending |
| Local work / automated CI | Feature branch | Local app / disposable test build | Local mock or disposable local Supabase |

## Branch and release flow

Create issue-named feature branches from development. Open feature PRs into
development and run the same required quality, database and secret checks as main.
Only the release owner (`NagarjunMa`) may authorize a release PR from development
to main and merge it when ready. Collaborators must not directly push or merge
into main. Until the owner issues a release instruction, keep work in development.
An emergency release/hotfix exception also requires explicit owner direction.
Preserve shared release ancestry; prefer merge commits when promoting long-lived
branches so previously released commits do not repeatedly appear as new changes.

The bootstrap configuration PR also targets development, following the owner's
updated routing instruction. Introduce and validate the configuration there;
it reaches main only through a later explicitly authorized release PR. Features
available only from default-branch workflow discovery may require that later
release before manual dispatch is visible. Verify hosted CI actually runs for
development PRs. Do not treat merely creating the branch as an isolated testing
deployment or bypass missing checks to bootstrap it.

Both integration branches must require PRs, block force pushes/deletion and retain:

- `Lint, Test, Coverage & Build`
- `Supabase migrations and pgTAP`
- `TruffleHog Secret Scan`

Use a separate development ruleset, preserving the existing main ruleset.
An administrator must configure it: the connected account has push permission
but no administration permission as of 2026-10-18. GitHub environments must permit
only their matching **branch**, rejecting similarly named tags. Preserve the
existing production and identity-worker environment policies/reviewers.

For main, retain required PRs/checks and configure an administrator-enforced
restriction so only `NagarjunMa` can update main through a PR merge. Apply
protections to administrators as supported, avoid collaborator/bot bypasses, and
review organization administrator access because administrators can change rules.
Requiring the owner's review alone does not restrict who can press Merge.
Also limit access to production Supabase/Vercel secrets, deployment controls,
and production database migration credentials to the release owner. A GitHub
environment approval alone does not block Vercel's independent Git deployment.

Verified external state on 2026-10-18: main requires PRs and passing checks, but
does not reserve merges to the owner; production GitHub environments have no
branch policies/reviewer gates configured. These changes are not yet enforced.
Do not run `scripts/production-controls.mjs --apply` as a substitute: that helper
does not implement owner-only merge access. Future release/freeze conditions will
come from the owner and must be recorded before they are implemented. Public
website access is a separate control from code/deployment access; the owner's
intended website audience still needs clarification.

## Provision the development Supabase project

Create a new project in the Nakshatra organization, with independent database
password, API keys and signing configuration. Match the production Postgres major
version (17) and apply the same checked-in migration history. Use synthetic users
and records; do not copy production users, customer data, Storage objects or Vault
secrets. Configure Auth and Storage independently; migration replay alone does
not reproduce all project dashboard/control-plane settings.

Use CLI/MCP for project configuration. Use an isolated checkout/link for each
environment so development setup cannot replace the production link in another
working directory. Confirm the exact project reference before any remote write.

Create the GitHub Actions environment `development`, restricted to the development
branch. Use only environment-level development values:

| Setting | Type | Purpose |
| --- | --- | --- |
| `DEVELOPMENT_SUPABASE_PROJECT_REF` | Variable **and** secret, identical values | Approved project reference and target cross-check |
| `DEVELOPMENT_DATABASE_ENABLED` | Variable, initially `false` | Enables the target guard only after configuration review |
| `DEVELOPMENT_SUPABASE_ACCESS_TOKEN` | Secret | Prefer a token scoped to the development project and needed management operations |
| `DEVELOPMENT_SUPABASE_DB_PASSWORD` | Secret | Development database password |

Never populate these settings from the production project's secrets. Separate
names prevent fallback to the repository's existing production secret names.
The workflow rejects the known production reference even when both settings match.

After enabling the reviewed configuration, manually run **Development Database
Deployment** on the development branch with confirmation unchecked. Review its
revision and migration list. Dispatch that reviewed revision with confirmation
checked to apply migrations and verify recorded history. If development advances,
preview/review the new revision first. This workflow does not automatically require
prior green CI; check CI for the selected revision before confirming application.
It never resets a hosted database or applies Vault secrets.

Migrations install a maintenance dispatcher whose destination is the fixed live
URL. Keep its private enable state disabled in development; do not configure
production worker credentials or call its enable RPC. Verify this remains disabled
after replay. GitHub production provider workers already reject development.
Testing worker/provider lifecycles needs a separate development-safe dispatcher or
explicit development CLI invocation; do not enable the production scheduler.

## Bind Vercel Preview to testing

Keep Vercel's Production branch as main. Give development a branch Preview URL
or a stable testing subdomain configured for Preview and that branch. Custom
Vercel environments are optional; ordinary branch previews can supply this setup.

Use a stable address, for example `https://dev.vivintro.com` (proposed, not
configured). This avoids repeatedly changing OAuth settings for individual
preview URLs. If developers must also be isolated from production project
settings/secrets, use a separate Vercel development project with appropriate
project/team access. In that separate project's settings, development is its
deployment branch and even its environment named Production must contain only
development service credentials; do not attach the live production domain.

Review **all Preview and local-development variables**, not just development's
branch override: feature previews must also avoid production credentials. Configure:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the
  development project; server-only `SUPABASE_SERVICE_ROLE_KEY` from that same project.
- `NEXT_PUBLIC_APP_URL` for the testing application; independent cookie/token/HMAC
  secrets listed in `.env.example`. Keep server-only secrets out of `NEXT_PUBLIC_*`.
- Development Supabase Auth Site URL and exact callback allowlist. Configure
  Google OAuth to allow the development Supabase callback, without weakening PKCE,
  ownership checks, OTP or production callback restrictions.
- Private photo/horoscope buckets and their migration-defined RLS/constraints.
- Didit Sandbox credentials, its liveness workflow and testing webhook URL/secret;
  isolated email configuration limited to approved test recipients. Application
  notifications and Supabase Auth SMTP are independent integrations.

Use distinct Google OAuth Web application clients for production and development.
For the development client, configure Authorized JavaScript origins with the
testing origin (and local origins only if needed). Its Authorized redirect URI
is the development **Supabase** callback,
`https://<development-project-ref>.supabase.co/auth/v1/callback`, not the app's
callback. Put that client's ID/secret only in the development Supabase Google
provider. In development Supabase, configure the testing Site URL and allow the
app's `/api/auth/callback` redirects, including the intended bounded continuation
paths/query parameters. Keep the production client/provider configured for the
production project/domain. Separate Google Cloud projects are optional when
independent consent-screen publishing and project IAM are also required.

Rebuild after changing public values: Next embeds `NEXT_PUBLIC_*` at build time.
Deploy production afresh with Production configuration; do not promote a Preview
build containing development Supabase values into Production. GitHub CI uses fake
loopback settings and its build artifacts are not deployment artifacts.

## Activation evidence and promotion

Before calling development ready, verify both deployed browser and server target
the development project. Test with two synthetic users: sign-in/recovery, portfolio
create/save/update/readback, upload/replace/delete, publication, and denied reads
or writes to the other user's private row. Denials must have no writes. Provider
webhook/worker checks need real sandbox evidence beyond routine mocks.

Release migrations using the existing manual main-only production workflow. Vercel
does not wait for that separate workflow: apply compatible schema additions before
merging dependent application changes; coordinate incompatible changes explicitly.
Never copy development records to production as part of a release. Auth sessions,
Storage objects and sandbox verification results do not transfer between projects.

If setup fails, leave `DEVELOPMENT_DATABASE_ENABLED=false` and stop using the testing
deployment until configuration is corrected. Production remains on main. Recover
application changes through normal reviewed reverts; database migration recovery
uses forward-compatible changes and appropriate backups, not a hosted reset.

References: [Supabase environments](https://supabase.com/docs/guides/deployment/managing-environments),
[Vercel environments](https://vercel.com/docs/deployments/environments),
[existing production controls](../branch-protection.md).
