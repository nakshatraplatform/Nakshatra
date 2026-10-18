# Hybrid Next.js linting without the vulnerable glob chain

## Contract / context

2026-10-17 user approved Oxlint only for Next checks, retaining traditional ESLint
for official React Hooks/compiler and existing React, TypeScript, import and JSX
accessibility checks. Remove the vulnerable Next ESLint dependency chain and fail
closed on missing checks. Preserve unrelated dirty frontend/font cleanup work.
Baseline HEAD f86a001; existing eslint-config-next 16.3.4 effective rules captured
before removal in `tests/fixtures/lint-rule-baseline.json`. No push/deploy requested.
Significant tooling/security-gate change; fresh independent review required.

## Design / constraints

- Pinned Oxlint 1.88.0 owns 21 native Next rules, explicit severities matching the
  captured Core Web Vitals configuration. No native React/compiler migration.
- Oxlint lacks `no-location-assign-relative-destination`. Preserve that one rule
  in an attributed local ESLint compatibility implementation with negative and
  positive fixtures. Do not keep the whole Next plugin installed to obtain it.
- Directly depend on the same installed ESLint plugins and parsers; reproduce
  existing non-Next rules/options, globals, file scopes and ignore patterns.
- One npm lint command and pre-commit workflow invoke both engines; CI already
  invokes npm lint. Missing binary/config or rule is an error, not a fallback.
- No high/critical audit exceptions remain after chain removal; validate audit
  reports and command status as before. Guard lockfile against reintroduction.
- No custom package fork, node_modules patch, fake package version, audit
  suppression or Next framework downgrade. Local compatibility rule is a small
  owned maintenance surface, removable when Oxlint supports it natively.

## Evaluations

| ID | Acceptance / plausible regression | Check |
| --- | --- | --- |
| HL1 | All non-Next effective rules and options retained | Compare effective ESLint configs to captured baseline |
| HL2 | Every prior Next rule mapped at the same severity; missing native rule cannot silently vanish | Config/rule inventory plus compatibility-rule assertion |
| HL3 | Deliberately broken Hooks, effect, immutability, ARIA, TS and Next samples still report | Real engine integration fixtures |
| HL4 | Full lint and staged-file workflow execute both engines and fail nonzero | Subprocess/CLI command checks |
| HL5 | Vulnerable chain absent, future reintroduction rejected | Clean install, lockfile guard tests, npm ls, full+production audit |
| HL6 | Missing/invalid audit output still fails closed, no exceptions allowed | Audit unit and CLI boundary tests |
| HL7 | Repository unaffected by tooling migration | lint/typecheck/unit coverage/build and fresh review |

## Progress / decisions

Implemented and locally verified. Upstream docs inspected: Oxlint configuration,
ignore/inline suppression semantics, native Next inventory and current registry.
No speed improvement claim; no live app business-rule changes planned.

- Removed eslint-config-next and @next/eslint-plugin-next plus fast-glob,
  micromatch and braces from the actual installed/locked tree. Directly pinned the
  existing ESLint plugin versions; no experimental Oxlint React/JS-plugin bridge.
- Clean npm ci completed; full and production audits pass with zero findings.
  Removed `security/audit-exception.json` and the runtime exception allowance;
  full high/critical findings now block without exceptions. Retired-chain guard
  handles root, nested and alias package entries even with a clean registry report.
- Captured non-Next config comparison passes; 21 native Next mappings and the
  attributed single-rule fallback retain all 22 prior checks/severities.
- Oxlint initially identified native internal anchors in CelestialUnion, privacy
  page and header test mock. Changed only those anchors to next/link, retaining
  URLs and visible content. Existing explicit native-image exceptions moved to
  scoped Oxlint comments; no blanket suppression introduced.
- Security-review skill's referenced playbook is absent from its installation.
  Available main checklist and fail-closed tests used; fresh reviewer still required.
- Database/provider behavior is not affected. No remote write, push or deployment.

## Verification / review (2026-10-17)

- Clean `npm ci` passed. It reported host allow-scripts warnings for optional
  fsevents/unrs-resolver scripts; no approval policy was bypassed. Installed tool
  execution and build passed with the resulting installation.
- `npm run security:audit`: full and production reports have zero findings;
  no exceptions. `npm ls braces fast-glob micromatch eslint-config-next
  @next/eslint-plugin-next` returns an empty tree.
- `npm run lint` and `npm run typecheck`: passed. Earlier OpenGraph suppressions
  now belong to Oxlint; no unknown ESLint rule placeholders or blanket disables.
- Full unit/coverage: 165 files / 1,169 tests passed; 56 feature coverage gates
  passed. Statements 85.76%, branches 79.11%, functions 84.80%, lines 89.30%.
  Log: `/tmp/nak-hybrid-lint-coverage.log`.
- Default production build passed: `/tmp/nak-hybrid-lint-build.log`.
- Existing portfolio footer/help/return-to-top browser regression: three passed
  across desktop/tablet/mobile Chromium fixtures, after the internal Link changes.
  Log: `/tmp/nak-hybrid-lint-browser.log`. No physical-device/hosted CI claim.
- Fresh-context read-only review: no material findings; independently passed 61
  lint/security tests and compared original pinned Next config/rule tarballs.
  Snapshot `1c81569561357ad64ddb8ac8d86aaa90fb7a7c41793ad68917499522220dadbd`;
  provenance checked current after execution. Actual reviewer model unavailable;
  source was read-only by instruction, not filesystem-isolated. Parent full checks
  are separate evidence. Only documentation changed after the reviewed snapshot.
- Whitespace check passed. Graphify graph/executable unavailable. No DB replay
  needed for this tooling-only contract; hosted CI remains pending until push.

## Upgrade and rollback notes

Keep Oxlint and direct plugins pinned until reviewed upgrades. Re-evaluate the
22-rule baseline when upgrading Next, not only when upgrading Oxlint; this is not
automatic subscription to newly added upstream rules. Remove the compatibility
rule only after native behavior/positive-negative fixtures establish parity.
Do not remove the official React plugin merely because Oxlint advertises React
support. Missing config/rules and both linter exit statuses remain blocking.

Rollback is a reviewed Git change, not re-enabling the expired exception: restoring
the old Next ESLint chain will intentionally fail the dependency guard/audit.
This change introduces one bounded local rule, not a privately published package
fork. Retain its MIT notice and negative/shadowing/external/cycle fixtures.
