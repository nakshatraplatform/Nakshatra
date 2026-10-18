# Onboarding PR delivery and database-first release

October 17, 2026. User authorizes committing/pushing the outstanding onboarding
work and creating PRs, not merging or running production deployment. PDF work is
excluded. Historical feature records describe the permissions/evidence at the time
of implementation; this record supersedes their no-commit/no-push delivery boundary.

## Branches and integration

- Database-only: `fix/nak-107-onboarding-publication-checklist`, based on fetched
  `origin/main` `aeeaecc` (merged security PR #109), commit `8172ea4`.
  Exactly one forward migration and two pgTAP test files; no application runtime,
  PDF functions, generated type declarations or dependency changes.
- Application: `fix/nak-107-onboarding-save-stability`, all onboarding increments
  plus the database prerequisite in its history. Integrates `aeeaecc` and the
  database commit rather than overwriting newer main safeguards. It targets main
  so all existing PR CI triggers run; keep it DRAFT until database deployment.
  Once the database PR is merged, its matching database changes drop out of the
  app PR diff. Refresh against main and recheck before merging the app.
- Account import/test conflicts were resolved by retaining BOTH saved-introduction
  names and main's deletion-dialog keyboard/focus/error recovery safeguards.
  The main skip target in Dashboard is retained. No CI/rate-limit/auth changes.

## Release sequence (manual authorization required)

1. Wait for all database-PR checks, especially clean migration replay, pgTAP and
   generated-type parity. Review the migration; passing application mocks is not
   database validation. Local Docker is unavailable in this environment.
2. Squash/merge only the database PR into main. A normal app deployment from that
   commit contains the previous compatible app, not the onboarding app changes.
3. Actions -> **Production Database Deployment**, branch **main**, leave
   `confirm_production` unchecked. A successful preview changes no database.
4. Review the COMPLETE pending list and approved Supabase target. Expected new
   onboarding file: `20261017220000_simplify_portfolio_publication_fields.sql`.
   Main also includes PR #109's three security migrations; if still pending, they
   require their own approved release review. Do not blindly apply every pending
   file or claim only one is pending. Stop if any PDF/unexpected migration appears.
5. Dispatch the same workflow on the reviewed main revision with
   `confirm_production` checked. It previews, applies and verifies migration
   history. Require successful apply AND history verification, not preview alone.
   If main changed after preview, preview the new revision again before applying.
6. Refresh the app PR against main; wait for all required checks. After verified
   migration, mark app ready, review and squash/merge. Then verify the configured
   app deployment and smoke-test onboarding/account on the deployed revision.
7. Smoke-test missing required fields, incomplete private saves, optional Family/
   Astrology, short optional narratives, editor stability, names, currency/Other
   recovery and publication with fresh consent/liveness. Check both themes and
   small/mobile/desktop widths. Do not use real customer data for testing.

The new migration removes street-address and optional narrative minimum
requirements only. Adult identity, canonical geography, primary-photo, length,
function privilege, owner/session, liveness, consent/revision and public/private
boundaries remain. Historical street values are not deleted or made public.

## PDF PR #106

Read-only inspection confirms #106 contains the separate PDF migration,
PDF-channel tests, related RPC type declarations/perimeter tests and PDF CI notes.
None is an onboarding prerequisite. It can be closed WITHOUT merging. Keep its
branch/history if future reference is useful; closing is not deleting or executing
SQL. No production PDF migration execution/history was verified by this task.
Do not interpret closing a PR as undoing any database change run independently.

## Verification freshness

Prior isolated reviews and 1,434 passing tests applied before main PR #109 was
integrated. Re-run combined-state checks and review the integration delta; do not
present those earlier results as validation of the merged snapshot. Required
hosted database/CI gates remain pending even if local checks pass.
