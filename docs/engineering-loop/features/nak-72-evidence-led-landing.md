# NAK-72 — Product evidence on the landing page

## Execution context

- Linear: https://linear.app/phoenix-works/issue/NAK-72
- Branch: `feat/nak-72-evidence-led-landing`.
- Current base: `fdc948a` (fetched `origin/main`, October 12, 2026).
- Mode: implement and review. Significant public trust/content contract.
- Scope: homepage examples, public explanations and metadata. No changes to
  authorization, provider workflows, publication eligibility, billing, storage,
  database objects, deployment configuration or retention periods.
- Status: October 8 reconciliation rebased onto latest main on October 12;
  integrated local verification and fresh review passed. User authorized the
  branch push; PR, hosted CI, merge and deployment remain separate actions.
- Original cc94 package/lint-test edits remain outside this worktree.

## Intent and reconciliation

Help people and families understand what VivIntro does through concrete examples
of its current application. It supports an editable marriage Introduction shared
through existing networks, with a separate owner-approved Complete Portfolio.
Useful answers and source-backed claims support search and answer discovery;
there is no promise of ranking, AI citations, matching outcomes or legal identity.

The October 3 draft was locally validated on `1b92ba1`, but was not committed or
released. It is preserved in the Git stash named `NAK-72 preserved October 3
draft before October 8 reconciliation`. Its 880-unit/27-browser results and
two-round review apply only to that historical source. They are not validation
of this reconciled implementation.

Later merged decisions supersede three earlier assumptions: signup is open
(NAK-104), new publications have one public Introduction rather than marketed
Brief/Detailed choices (NAK-102), and candidate checks are liveness-only without
portfolio-photo matching or IP analysis (NAK-60/73). NAK-102 also delivered the
user-approved hero, sample-first CTA, family/viewer story, mobile rhythm and
expandable disclosures. Keep those improvements instead of replaying the old
draft over them. Older lifecycle documents still contain historical photo-match
and seven-field readiness wording; current source and current feature records
govern this task's claims.

## Design and implementation

- Keep `LandingExperience` server-rendered and `GuidedTour` as the existing small
  client boundary. Preserve the headline, eyebrow, variants, anchor IDs, signup
  and sample routes, motion safeguards, and approved brand.
- Replace three repeated benefit cards with concrete Public Introduction,
  Complete Portfolio and owner-only examples in the existing layout. Explain
  that public free text must not contain private contact details.
- Show a fictional draft with real field labels, two audience previews, and an
  illustrative share link. Do not invent checked users, live tokens, customer
  counts, testimonials or screenshots of private profiles.
- Add a direct category answer and correct the editing/unpublishing explanation
  in the shared visible FAQ/schema data. Retain clear forwarding/capture limits.
- Use one homepage description across search/social metadata; keep the approved
  search title and social headline. No new schema type or crawler file.
- Correct the broad public-noindex statement and distinguish pausing access
  from revocation on trust/privacy/viewer pages. Remove stale invite-only
  operator copy from About without inventing a biography.

## Claim-to-source evidence

| Public claim | Current source inspected |
| --- | --- |
| One public Introduction and a separately approved Complete Portfolio | `src/features/portfolio/template.ts`, `server/public-snapshot.service.ts`, `server/approved-snapshot.service.ts`; `portfolio-overview-vocabulary-privacy.md` |
| Published name, age, marital status, story/work/family/cultural information; photo settings matter | Public snapshot allowlist and `src/components/templates/CelestialUnion.tsx`; current portfolio privacy notice |
| Contact, exact birth details, protected originals and optional horoscope require approval | Approved snapshot allowlist, media resolvers, `docs/portfolio-data-classification.md` |
| Contact/private preference notes excluded even from Complete | `createApprovedPortfolioSnapshot` contact mapping and `APPROVED_EXCLUDED_PREFERENCE_KEYS` |
| Email-confirmed personal requests; owner approval; 15-day renewable/revocable grants | `src/features/access/server/access.service.ts`, portfolio lifecycle services and access lifecycle SQL/tests |
| Unpublish pauses access; republish can restore still-valid grants; rotation revokes | `20260911120000_b2c_pilot_launch_enforcement.sql`, `20260921120000_persistent_public_introduction_links.sql`, retained by the server-owned publication wrapper and latest `20261003150000_pilot_test_publication_exemption.sql`; `b2c_pilot_launch_policy.test.sql` |
| Candidate liveness does not establish photo ownership, identity, age or profile truth | Current `nak-60-liveness-ip.md` contract; `didit-candidate-contract.mjs`, provider/worker, `liveness-only-policy.test.ts` |
| Open free creator signup; publishing has its own checks | `open-creator-onboarding.md`, signup/auth bootstrap, current `readiness.ts` and publication-readiness service |
| Portfolio URLs are noindex; marketing pages remain indexable | `src/app/p/[token]/page.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts` |

Personal-link explanations do not redefine participant-only broker introductions
or their mutual-consent/expiry contract. Keep broker representative verification
distinct. No linked family accounts or delegated publishing are advertised.

## Acceptance and evaluations

| ID | Expected outcome / plausible regression | Evidence |
| --- | --- | --- |
| L72-1 | Preserve approved hero, sample/signup/viewer paths and newer landing rhythm; reject restored waitlist or retired view choices | Existing landing/critical-path browser tests and diff review against `e7b0d74` |
| L72-2 | Explain all three audiences and limitations; reject email alone granting access, all-data Complete claims, or photo-match promises | Landing component checks; claim-to-source review |
| L72-3 | Explain pause/resume versus revocation; reject unpublish-as-revocation claims | Scoped FAQ regression and SQL source comparison |
| L72-4 | One H1, consistent visible FAQ/JSON-LD and descriptions, canonical preserved; reject invisible schema-only answers or marketing noindex | Landing and metadata unit tests, rendered inspection |
| L72-5 | New examples fit mobile/desktop and both themes; preserve keyboard access, anchors and reduced motion | Existing landing layout suite and visual screenshots |
| L72-6 | Keep unchanged application boundaries working; no new dependency or sensitive output | Lint, typecheck, unit coverage, build, dependency audit, fresh source review |

Use local fixtures for browser tests and loopback-only Supabase placeholders for
the build. No provider sends or production actions are needed. Source review is
the appropriate verification for explanatory policy corrections; database tests
need not be rerun for unchanged SQL. Existing route assertions remain intact.

## Security, compatibility and rollback

Only fictional content is illustrated. No new data fetching, analytics, form
submission, API, credentials or authenticated route is introduced. Public and
approved snapshots are unchanged. Correct inaccurate documentation without
changing authorization to match it. Retention policy and separate broker checks
remain unchanged. Revert this commit to roll back; no data migration is needed.

Prior N72-R1 (pause versus revocation) remains relevant and is incorporated.
Prior N72-R2 concerned a new colored comparison panel in the preserved draft;
that panel is not restored. Audience examples reuse the current page's existing
card styles. The draft illustration uses explicit surface/ink/muted theme tokens.

## Validation scope and delivery

Commands: `npm run lint`, `npm run typecheck`, `npx vitest run --coverage
--maxWorkers=2`, `npm run coverage:check:features`, `npm run security:audit`,
`npm run build`, and the landing/public-trust/landing-critical Playwright suites.
Current outcomes and fresh-review snapshot are retained in Linear and updated
here at handoff. Dependency installation follows the unchanged main lockfile.

October 8 results:

- Passed: 1,125 unit tests across 161 files and all 56 feature coverage gates.
  Statements 85.54%, branches 79.01%, functions 84.74%, lines 89.15%.
  Log `/tmp/nak72-oct8-coverage.log`.
- Passed: all 82 applicable browser cases across desktop/tablet/mobile; two
  existing duplicate-matrix cases skipped by the suite. The first run passed 76
  and had six disk/Chrome setup, navigation, screenshot or teardown timeouts.
  After removing only task output and sharing byte-identical dependency storage,
  all six passed unchanged with `--last-failed --workers=1`. Logs:
  `/tmp/nak72-oct8-browser.log`, `/tmp/nak72-oct8-browser-retry.log`.
- Passed: typecheck, lint (two existing unused OpenGraph disable warnings),
  whitespace check, and default production build with loopback placeholders.
  Build log `/tmp/nak72-oct8-build.log`. An unsupported Testing Library `exact`
  option in the new tests was caught by typecheck and removed before the final
  coverage run, review and passing typecheck.
- Passed under existing policy: dependency audit, with the unchanged
  GHSA-vfj7-8cjw-p6xm development exception expiring October 9 at 00:00 New York.
  This content task does not remediate or extend that exception.
- Inspected screenshots: desktop/mobile disclosure examples, desktop draft,
  laptop tour at 1366×768, and mobile dark full-page output. Width matrices,
  keyboard, anchors, compact laptop cards and reduced motion pass in Playwright.
  Initial screenshots are retained in `/tmp/nak72-oct8-browser-first`; final
  laptop screenshots are under the worktree's `test-results`.
- Fresh-context reviewer `nak72_current_review`: `no_material_findings`; actual
  model identifier unavailable, not cross-model or human review. Report:
  `/tmp/nak72-oct8-review-report.md`; packet `/tmp/nak72-oct8-review.json`,
  snapshot `d9e20ce47add9f063735d76334d7c5abe51463c3b25d59a090ef14442d45e71b`.
  Start/end/final provenance passed. Reviewer traced every changed hunk and the
  backing disclosure, liveness and lifecycle code/SQL, but did not rerun runtime
  checks. Only this progress record changed after review; source/tests are the
  reviewed versions. Laptop checks requested by the reviewer subsequently passed.
- Blocked: `graphify update .` because the executable is unavailable. No graph
  exists in this worktree. No database/provider checks were run for unchanged
  backend/SQL; no remote service mutation occurred.

Real Didit camera sessions, provider deletion, email delivery, deployed indexing,
rankings, conversions, and production behavior are not tested by this content
work. Existing deployment/release gates remain with their owning issues.

## October 12 main integration

- Rebased the local NAK-72 commit onto fetched main `fdc948a`. The sole conflict
  was adjacent feature entries in PROJECT.md; retained both NAK-105 and NAK-72.
  NAK-72 application and test files are byte-identical to the October 8 commit.
- Main supplies the completed dependency remediation: deleted expired exception,
  pinned ESLint root-discovery adapter, updated lockfile and exception-free audit.
  No exception extension, dependency downgrade or new NAK-72 application behavior.
- Clean `npm ci --ignore-scripts` passed. `npm run security:audit` passed with
  zero affected packages, no high/critical findings and no exceptions. This closes
  the expired-exception blocker through main's remediation, not renewed acceptance.
- Passed: lint (two existing OpenGraph unused-disable warnings), typecheck,
  database fixture smoke check and production Next.js 16.3.8 build (80 generated
  pages) with synthetic loopback public configuration.
- Passed: `npx vitest run --coverage --maxWorkers=2` (1,195 tests / 166 files) and
  all 57 feature coverage gates. Statements 85.70%, branches 79.42%, functions
  84.91%, lines 89.23%. An initial npm-script invocation was interrupted before
  completion because its worker argument applied to the final coverage command;
  the explicit bounded Vitest command above is the completed passing run.
- Passed: `npm run test:e2e -- e2e/landing-layout.spec.ts
  e2e/public-trust-clarity.spec.ts e2e/critical-paths.spec.ts --workers=1`:
  82 cases across desktop/tablet/mobile; two existing duplicate-matrix skips.
  No retries, assertion edits or timeout increases. Desktop/mobile disclosure
  examples and 1366px laptop-tour screenshots were visually inspected.
- Fresh-context reviewer `nak72_integration_review` returned
  `no_material_findings` against snapshot
  `5f703d322607e0731a9ad080a5a34c2a7cf845173259b75f7920258fd32db0ac`.
  Start/end provenance passed; all 910 source files matched the isolated copy.
  Reviewer independently passed 78 focused tests / eight files; coordinator
  browser/coverage/build evidence remains separate. Exact model identifier is
  unknown, so this is not a claimed cross-model review. Report:
  `/tmp/nak72-oct12-integration-review-report.md`. Subsequent edits only record
  final evidence here and in PROJECT.md; app/tests/dependencies remain unchanged.
- Whitespace check passed. Graphify update is blocked because its executable is
  unavailable; no graph exists in this worktree. Historical October 8 outcomes
  above are separate from these integrated-run results.
- No database migration is introduced by the NAK-72 diff. Existing main migrations
  are retained unchanged; their hosted database/deployment gates remain separate.
- User authorized pushing the compliant NAK-72 branch. No PR, main merge,
  production configuration change or deployment is requested here.
