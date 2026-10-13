# Interest / viewer change evidence ledger

Mutable check/review progress, separate from the stable [feature contract](interest-viewer-experience.md). Excluded from source-provenance capture only because appending reported outcomes does not change requirements or runtime source.

Base: `f46ccf1258798e0b1db9a02b44bf22d121af9adf`; dirty branch `fix/nak-105-interest-and-viewer-experience`. Preserve/exclude the unrelated user-edited NAK-102 document. Current implementation, tests and migration are otherwise included in review.

## Completed evidence

- Initial full `npm run test:unit:coverage`: 170 files / 1,241 tests passed; 57 feature gates passed. Historical pre-final defensive-boundary edits.
- Focused `npx vitest run tests/interest-owner-details.test.tsx tests/existing-viewer-profile.service.test.ts tests/repositories.test.ts tests/location-route.test.ts --maxWorkers=2 --reporter=dot`: 16 passed (before the additional repository rejection regression).
- `npm run typecheck` and `npm run lint`: passed during final correction cycle.
- Final pre-round-2 and post-round-2-correction `npm run build`: passed.
- Full stable `npx playwright test --workers=2`: 177 passed, 6 intentional project-specific skips (6.5 minutes) on round-2 source. After the round-2 corrections, `npx playwright test e2e/interest-viewer-experience.spec.ts --workers=2`: 12 passed, including 600-character unbroken family/message paragraphs in history and access dialogs at 320, 375, 768 and 1440px. Not a real provider/production test.
- Post-round-2 owner/resolver/repository/location focused suite: 17 passed. Two directional-label/historical-location regressions failed before correction, then passed. Typecheck and lint passed. Full final unit coverage: 170 files / 1,244 tests passed (116.44 seconds); 85.8% statements, 79.44% branches, 84.73% functions, 89.39% lines. Graphify AST update passed; SQL extraction unavailable because its parser dependency is absent, so SQL was inspected directly.
- Final `npm run coverage:check:features`: passed for 57 mapper/service/contract files (80% per metric).
- `npm run db:smoke`: failed before the IDR5 correction (`no_plan()` violated the repository’s numeric-plan rule), then passed after replacing it with `plan(34)` without removing assertions. This static fixture check is available locally despite missing Docker; it is not a substitute for pgTAP execution.
- `npm run db:verify`: blocked, Docker lifecycle inspection fails because Docker is unavailable. No hosted database access was used to substitute for this gate.

## Independent review

Round 1/3: fresh-context SQL-only review at SHA256 `6D615C9ACF958ACEE388CC8DFE66B325C76CF18E63978CCF38CE816D4252A423`; base above. `/root/interest_database_review`, model unknown; changes required, IDB1 (P2, confirmed, introduced), whitespace-only context bypass. Corrected source and new negative assertions; database execution still blocked. Final full-manifest review pending. No cross-model or human approval is claimed.

Round 2/3: `/root/interest_final_review`, fresh context, model unknown; full-manifest snapshot `a0655aed8b46e16f5010dde2825968278870ce7a58e2b31eb94c33ecb43eb746`, freshness verified at both ends. Immutable report: `C:/Users/Lenovo/AppData/Local/Temp/vivintro-interest-review-round2-report.md`. Reviewer independently passed 103 tests / 11 files. Changes required:

- IDR1 (P2, confirmed, introduced, IV5): photo fixtures violated the active owner-namespace trigger. Corrected all fixture paths and Storage probes to the real fixture-owner UUID namespace. Structural correction only; database execution remains blocked, not resolved as a runtime gate.
- IDR2 (P2, confirmed, introduced, IV4/IV8): relationship display reversed direction. Changed to “Viewer’s relationship to candidate”; regression failed before and passed after correction. Corrected, final independent recheck pending.
- IDR3 (P2, confirmed, introduced surface, IV4/IV10): valid 600-character unbroken context/message overflowed. Reviewer reproduced in local Chrome. Added wrapping/min-width constraint and browser assertions against paragraph width and scrollWidth (not merely clipped document width), covering history and access dialog. All 12 responsive cases passed. Corrected, independent recheck pending.
- IDR4 (P2, confirmed, introduced, IV4): historical string location was lost. Restored fallback after structured location; regression failed before and passed after correction. Corrected, independent recheck pending.

Round 3/3: `/root/interest_round3_review`, fresh context, model unknown; full-manifest snapshot `760b6d0c90d645710f133dd0322e0f49b8e040808a96a3631249746bdeb5ecd3` (926 paths), freshness passed at start/finish. Immutable report: `C:/Users/Lenovo/AppData/Local/Temp/vivintro-interest-review-round3-report.md`. Reviewer independently passed 77 unit tests / 10 files and 12 responsive browser cases. IDR2–IDR4 resolved on that snapshot. IDR1/IDB1 source corrections supported but SQL execution still pending. One new finding IDR5 (P2, confirmed, introduced): missing numeric pgTAP plan. After the report, changed only `no_plan()` to `plan(34)` and native fixture preflight passed. No assertion was weakened or removed. Graphify update completed again (SQL parser still unavailable).

The default three-round budget was exhausted. On October 13, 2026 the user explicitly authorized one additional fix/recheck round. The post-round-3 one-line SQL-test edit means round-3 source provenance cannot be claimed current; the corrected source has handoff packet `C:/Users/Lenovo/AppData/Local/Temp/vivintro-interest-review-post-correction.json`, snapshot `ae5493954fa40c5612e8c3338c5b7dfcea67fc706ddab974b2d30516d425fc63`. Existing TypeScript/browser results remain applicable to unchanged application paths, not to unexecuted SQL behavior. `npm run db:smoke` passed again on the authorized recheck turn. No application/source edit occurred during round 4.

Round 4/4 (authorized extension), October 13, 2026: `/root/interest_round4_review`, fresh context, actual model unknown; full final changed-manifest and affected-consumer review on the corrected snapshot above. Immutable report: `C:/Users/Lenovo/AppData/Local/Temp/vivintro-interest-review-round4-report.md`. Reviewer and coordinator freshness checks passed after review. Verdict **blocked for required database execution**, with **no new material source finding**. IDR5 resolved on this snapshot through independently passing native fixture gate; IDR2–IDR4 resolved through fresh regressions. IDR1 and IDB1 source corrections supported but deferred for SQL runtime verification, not labeled fully resolved.

Fresh reviewer evidence:

- `npm run db:smoke`: passed; all 34 assertions retained and plan matches the maintained checker.
- Targeted unit command covering eleven interest, owner details, location, auth, repository, template and portfolio files: 104 passed (26.43 seconds).
- `npx playwright test e2e/interest-viewer-experience.spec.ts --workers=2`: 12 passed (1.2 minutes), desktop/tablet/mobile projects with four widths and both long-text owner surfaces.
- `npx playwright test e2e/complete-access-journey.spec.ts --workers=2`: 6 passed (20.7 seconds), including eight-photo galleries, protected-image loading, unsigned reload and expired/revoked access. Local mocks only, not actual SQL/Storage.
- `git diff --check` and packet freshness at start/finish: passed. Full changed source plus effective SQL/auth/photo/owner consumers inspected; this is not an exhaustive audit of every repository file.
- Required database replay/pgTAP/actual Storage RLS/generated-type verification: blocked; Docker, Podman, psql and the Docker engine pipe are unavailable. No tools installed, hosted database accessed, migration applied, branch pushed, PR created or deployment performed.

Remaining coverage gaps retained explicitly: the SQL non-owner-details assertion obtains its request ID through requester table RLS and can become vacuous if that row is hidden; authoritative negative coverage should use a known fixture request ID. Successful non-self SQL persistence, real provider flows, physical mobile keyboards, short-page/smooth-motion timing and destructive live actions are not proven by local mocks. No new source defect was established from those limits. The four-round authorized budget is now complete; further source corrections/review rounds need new evidence and authorization rather than automatic acceptance.

Evidence-backed fixture lesson: run the available native fixture preflight even when Docker is absent; fixed pgTAP plans must match the retained assertion count, and fixture media paths must satisfy active owner-namespace/cap triggers. Source integrity is a distinct gate from actual database execution.

This ledger and PROJECT map are excluded from provenance only for reporting outcomes, never for changing requirements/runtime source.

## Remaining release gates

Authoritative clean migration replay/pgTAP including actual Storage RLS and live-session/expiry boundaries; hosted CI; coordinated schema/application rollout authorization; real provider testing separately authorized. Implementation is local, not merged/deployed. No legal-compliance certification.

## Draft publication handoff

On October 13, 2026 the user authorized pushing this reviewed branch and creating a draft PR to run hosted CI, not merging or deploying. Before publication, source provenance remained current. Remote `main` had advanced to `ebed0a0` through PR96 (NAK-71 loading feedback), overlapping the dashboard, interest modal, styles and project map. The reviewed branch is being published without silently integrating that newer change; merge compatibility and tests against the combined source remain a separate pending gate. The unrelated NAK-102 document edit is excluded from the commit. CI includes a clean local Supabase migration replay, pgTAP and generated-type drift check; production migration deployment is a separate manually dispatched workflow and is not authorized here.
