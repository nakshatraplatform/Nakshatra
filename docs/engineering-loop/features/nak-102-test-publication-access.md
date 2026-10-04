# NAK-102: Rahul test-publication access and dashboard clarity

Mode: full, because this crosses authorization, database triggers, anonymous public access, and Storage policy. Risk: critical. Decision: the owner's October 3 request and earlier explicit choice permit a permanent Production public-link exception for `rahulgollapalliranganatha@gmail.com`, but no other account and no synthetic Didit proof.

## Contract

- An explicit private database grant to Rahul's existing, confirmed Auth user allows his self-owned candidate portfolio to complete disclosure and publish a personal link without Didit. Email alone is not a grant; it must match the exact confirmed account and the active grant row. An anonymous/public caller cannot create a grant.
- Every other owner still needs current Didit verification. Representative-created portfolios remain blocked. Revoke the grant to close the personal link and media immediately, without deleting the saved portfolio.
- Test access never makes the portfolio broker-eligible, never creates an `identity_verification_subjects` proof, and never produces an identity-verified badge. The owner dashboard identifies test access plainly.
- The dashboard groups activity, link controls, and previews and avoids repeating “Sharing paused” above “not shareable.” The Unpublish safety action remains available when an existing publication is suppressed.
- Narrative limits are recommendation-only in this change. The owner will decide revised maxima after seeing the current 1600/1200/1200 constraints and publication layouts.

## Design and affected boundaries

`app_private.pilot_test_publication_exemptions` owns the revocable grant. `app_private.pilot_test_publication_exempt(candidate_id)` requires exact account email, confirmed email, owner/creator equality, self-profile, and an active row. `app_private.personal_publication_verification_satisfied` combines that narrow rule with the existing real proof for personal publication only. The migration updates readiness, disclosure, both direct-write publication triggers, the server-owned publication transaction, and the public-link predicate. Existing public and protected-photo Storage policies use that predicate. Broker eligibility, verification status RPC, and badge trigger deliberately continue using `current_identity_verification` only.

The TypeScript readiness projection adds `test_exempt` instead of mislabeling Rahul as `verified`; the service and dashboard use one publication-status helper. Server-owned public and approved projections remain unchanged. No browser parameter selects or asserts the exemption.

## Evaluation contract

| ID | Case and expected result | Check |
| --- | --- | --- |
| EX-1 | Rahul without a row, or another account with a row, cannot bypass verification. | New pgTAP grant/identity cases; service remains denied for `required`. |
| EX-2 | Confirmed Rahul with the row can confirm disclosure and publish through the service-only transaction. | New pgTAP transaction and unit service case. |
| EX-3 | Public link and photos are available during the grant and fail closed immediately after revocation. | New pgTAP public resolver and shared publication predicate cases. |
| EX-4 | A test publication has no Didit proof or identity badge, and broker eligibility is unchanged. | New pgTAP proof/badge checks; source review of BrokerDesk proof predicate. |
| UX-1 | Dashboard groups primary controls, does not duplicate paused/not-shareable copy, and names test status honestly. | Dashboard component tests and responsive visual pass. |

A wrong implementation that changes only a React condition will fail the database transaction and public-link cases. A wrong implementation that inserts a fake identity proof will fail the no-proof/no-badge cases. A grant that relies only on email will fail the no-grant case.

## Rollout and rollback

Do not grant or publish in Production until the migration has passed hosted database tests and the application version supporting `test_exempt` is deployed. Apply pending migrations in order through CI/CD (Production previously lacked `20261003120000_b2c_admin_creator_invitations`), then confirm the exact Rahul Auth account and add one active private grant using the trusted SQL Editor. Never expose a service key to the browser. The grant command for that trusted editor is:

```sql
insert into app_private.pilot_test_publication_exemptions(user_id)
select id from auth.users
where lower(btrim(email)) = 'rahulgollapalliranganatha@gmail.com'
  and email_confirmed_at is not null
on conflict (user_id) do update set revoked_at = null
returning user_id;
```

Require exactly one returned account and independently verify its email before proceeding. Production must also set `NEXT_PUBLIC_APP_URL=https://www.vivintro.com` and redeploy: the current `createShareUrl` fallback would otherwise return a localhost URL even after successful publication. Refresh the dashboard, review public and Complete previews, confirm disclosure, publish, test the guest link and protected-contact flow, then verify it has no identity badge. Do not describe the account as verified.

Emergency rollback: set `revoked_at=now()` on the exact row after confirming the user ID. The public-link and media predicates then fail closed immediately; there is no need to delete portfolio data. A code rollback before revocation could produce a stale dashboard, so revoke first. Supabase CDN/signed URLs may remain accessible until their short expiry and must be treated as a residual exposure in the release review.

## Progress and evidence

Implementation in progress on `feat/nak-102-test-publication-access`, based on merged NAK-101 in `origin/main`. The SQL migration, 23 pgTAP assertions, TypeScript readiness contract, publication service, dashboard layout/copy, and focused component tests are in the local worktree only. Lint, typecheck, build, `db:smoke`, 946 unit tests, and desktop/mobile authenticated dashboard E2E passed; the final small empty-state copy change passed its focused dashboard suite (31/31). The desktop dark-theme screenshot was inspected; its activity/link group is visually contained and legible. Local pgTAP is blocked because Docker/Podman is absent; hosted database tests and a Production release review remain mandatory. Fresh-context read-only security review found no material source finding after the anon Storage and authenticated approved-predicate test cases were added, but did not execute pgTAP. No Production migration, exemption grant, publication, or share-link test has been run for this change.
