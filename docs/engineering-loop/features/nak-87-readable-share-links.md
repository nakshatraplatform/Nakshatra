# NAK-87 — readable portfolio share links

## Execution context

- Issue: https://linear.app/phoenix-works/issue/NAK-87
- Base: main `6fda9be`; isolated `feat/nak-87-readable-share-links` worktree.
- Risk: Critical (migration and public link lifecycle). Full record; independent review required.
- Product decision, October 20, 2026: `/p/aditi-sharma`; duplicate names receive `-2`, `-3`, etc. No random suffix in newly generated links.
- Current implementation snapshot: `a9e5fcf` (parent commit `923d09d`). Independent review and local checks pass. Next: push/open PR; hosted CI and release remain separate. No production migration, deployment or merge performed.

## Problem and goal

Replace opaque newly generated Introduction URLs with predictable first/last-name paths while retaining existing shared links, stable publication, public/Complete separation and explicit link replacement. This is a customer portfolio feature; BrokerDesk is excluded.

## Design and verified locations

- `supabase/migrations/20261020192354_readable_portfolio_share_links.sql`: private digest-only reservation registry, normalization/atomic allocation, guarded publication and replacement; four existing SQL validators accept 3–160 characters. Retain current resolver/quota bodies and ACLs via checked, allowlisted catalog replacement. The public RPC signatures/types remain unchanged.
- `src/features/portfolio/server/publish.service.ts` and `share-lifecycle.service.ts`: request DB allocation using the existing empty text parameter and use its returned path. Existing stored identifiers remain stable.
- `src/features/portfolio/share-path.ts`: common Zod input boundary for interest/location consumers; accepts readable names and existing opaque paths. This parser never authorizes Complete access.
- `src/app/dashboard/dashboard-client.tsx`, `src/components/portfolio/BlueprintForm.tsx`: explain name disclosure, guessing and permanent replacement. Existing visual/animation system is retained.
- `src/app/privacy/page.tsx`: disclose indefinite digest-only link reservations without claiming anonymity.
- `supabase/tests/database/readable_share_links.test.sql`, `access_lifecycle.test.sql`: actual publication, resolvers, access requests, grants, retirement, legacy links and name-change stability.
- `scripts/test-readable-share-links-local.mjs` and CI: sixteen independent concurrent PostgreSQL transactions plus rollback assertion, restricted to a disposable local database.
- `e2e/readable-share-links.spec.ts`, mock Supabase: actual Next pages and interest dialog for named, numbered, short and legacy paths across three viewports. The mock does not establish database allocation; SQL/concurrency tests do.

## Rules and boundaries

1. Use reviewed first/last names, lowercased; apostrophes removed, whitespace/repeated hyphens normalized. Exclude middle names. Legacy full-name fallback uses first/last words. Current product names are ASCII, at most 50 characters per part. Missing/invalid normalized parts fail closed.
2. The reservation primary key arbitrates collisions atomically. Suffix search is bounded at 10,000 issued variants; exhaustion fails safely. Failed SQL transactions roll back reservations. Readiness failures occur before allocation.
3. Store only SHA-256 path digests, without portfolio/account references; do not release them on account deletion. Digests of predictable names are guessable and are not anonymization. Backfill paths currently recorded in portfolios/snapshots; historical URLs already absent from both cannot be reconstructed.
4. Keep existing opaque/named paths on ordinary republish, including name edits. Explicit replacement uses the published identity (not unreviewed drafts), updates owner/snapshot atomically and retains the established reveal-grant revocation and audit flow. Old paths do not redirect or resolve after replacement.
5. A SECURITY INVOKER trigger prevents direct runtime-role changes to `share_token`. Guarded SECURITY DEFINER lifecycle commands retain privileged ownership. Clients cannot call the allocator/read its registry or invoke the service-only publication RPC.
6. Preserve session/owner, completeness, consent, liveness, quotas, public snapshots, noindex, restricted media and Complete access rules. A predictable public path is not a secret or proof of authorization.

## Compatibility and rollout

- Public RPC signatures stay compatible. Before app rollout the previous trusted server can still submit a 21-character Nano ID at first publication; the database reserves that path too. The updated app sends empty text for new allocation. Stable existing identifiers are not rewritten.
- Apply the forward migration before deploying the updated app. Immediately deploy/redeploy the application so interest/location HTTP parsers accept short names too. Do not roll back to an old app after distributing short named links.
- Existing owners can use **Rotate link** to obtain a name-based URL. This intentionally invalidates the old URL and revokes current Complete grants; it is not an automatic migration.
- Recovery: retain issued-path tombstones and forward-fix. Do not delete reservations, restore retired paths, or automatically repoint former links. The disposable local stack uses project `nak87-readable` on ports 55920–55929; the existing Ascendia stack is excluded.

## Acceptance and evaluations

| ID | Criterion | Verification |
| --- | --- | --- |
| SL1 | Names, punctuation and short paths work; invalid inputs fail | pgTAP normalization/public resolver/interest tests; unit contracts; three-viewport named-route browser checks |
| SL2 | Same-name concurrent publications cannot collide | unique-insert allocator, pgTAP duplicate owners and local 16-transaction concurrency check in CI |
| SL3 | Republish/name edits and old links remain stable | legacy/named SQL cases; publication service and consumer tests |
| SL4 | Replacement revokes old access and uses published identity | pgTAP readable-link cases and existing access lifecycle grant-revocation/expiry assertions using the returned current token |
| SL5 | Retired/deleted paths cannot be reallocated | private digest tombstones, no account FK, deletion fixture and direct owner-write denial |
| SL6 | Naming does not bypass private access or publication safeguards | pgTAP public/approved boundary, existing full DB suites, independent review |

## Evidence and progress

- **Unit/coverage passed:** full 1,666-test coverage run, 61 feature and 21 protected-boundary gates. After the final publication-return regression, all 34 focused lifecycle/path tests passed. Initial new parser/rotation regressions failed against the old implementation; one incomplete interest fixture was corrected to satisfy existing validation.
- **Database passed:** clean replay through the forward migration; final 61 suites / 1,746 assertions, including 31 readable-path assertions. Existing access-lifecycle expiry tests now follow the actual replacement identifier rather than a stale hardcoded path. No test control or assertion was weakened.
- **Concurrency passed:** 16 independent local PostgreSQL transactions allocate distinct consecutive names; a rolled-back reservation leaves the unsuffixed name available. This check runs in CI after pgTAP.
- **Schema passed:** public generated types match; `db lint --schema public,app_private --fail-on error` passes. The allocator's redundant loop-variable declaration was removed and the corrected schema lint has no new warning. Four existing unused-parameter notices remain outside this change.
- **Browser passed:** all 12 new route/dialog checks across desktop, tablet and mobile Chromium, covering named, numbered, short and legacy paths and noindex metadata. These use mock Supabase for pages; SQL tests separately establish allocation and access boundaries.
- **Static/build passed:** final lint/typecheck and optimized production build. The first build lacked required public Supabase environment values; rerun with loopback-only placeholders passed. No production credentials used.
- **Security passed:** strict dependency audit reports zero affected packages/no exceptions; scoped TruffleHog reports no secrets. Final closing scan runs before push. The repository fixture smoke check caught a missing numeric pgTAP plan; the suite now declares its verified 31 assertions, and the smoke check passes.
- **Independent review passed:** fresh-context reviewer `/root/nak87_readable_links_review` found no material findings on `6fda9be..923d09d`, then confirmed the two-file delta through `a9e5fcf`. It independently passed all 31 SQL cases, legacy-server compatibility, service-role direct-write denial, rollback on invalid public projection, and function ownership/ACL checks. Exact model identity unavailable; this is not a cross-model claim.
- **Upgrade test passed:** reset the disposable database to main's last migration (`20261019025046`), published a real legacy Introduction through the guarded service RPC, then applied the new migration. The old URL and anonymous resolution remained intact; its digest was backfilled and a competing allocation received `-2`. The first fixture attempt omitted a transaction, causing local Auth claims to expire between statements; wrapping fixture setup in a transaction corrected the harness. Final clean replay covers 109 migrations.
- **Tooling limit:** Graphify graph absent and binary unavailable (`graphify update .` reports command not found). Source search, tests and independent review were used; no graph update is claimed.
- Hosted CI/Preview, actual provider/inbox tests, production migration and deployment remain separate from these local checks.

## Decisions and lessons

- A name-only path exposes the first/last name and is guessable, as selected by the user; Complete access continues to be independently authorized.
- Collision assignment belongs in the database transaction, not a JavaScript read-then-write loop.
- Link replacement tests must follow the actual returned identifier. A hardcoded old identifier can make an expiry test silently miss the intended grant and audit path.
