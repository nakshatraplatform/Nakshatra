# Next ESLint dependency audit investigation

Date: 2026-10-02. Status: user-approved temporary risk acceptance implemented and
locally verified; hosted CI pending. Risk: critical (CI security gate). No
vulnerability repair claimed.

CI fails on GHSA-vfj7-8cjw-p6xm through eslint-config-next ->
@next/eslint-plugin-next -> fast-glob -> micromatch -> braces. The installed
braces 3.0.3 has no patched release at investigation time. Stable Next ESLint
plugin 16.3.8 and canary 16.4.0-canary.58 still depend on fast-glob 3.3.1.
The suggested npm audit fix --force would downgrade eslint-config-next to14,
which is not an accepted fix for this Next16 project. Dependency versions remain
unchanged; the audit command now evaluates the specific approved exception.

## Investigation and rejected approach

A scoped tinyglobby replacement removed the vulnerable chain and passed audit
with zero findings after npm ci. A compatibility adapter disabled implicit
recursive directory expansion. Eight focused tests, lint, typecheck and the
854-test coverage run passed after a bounded stress-test timeout adjustment.

Fresh-context independent review (eslint_audit_review, inherited model) found
that those tests did not establish behavioral equivalence. Confirmed P2 findings:

- Symlink root discovery returns no roots; the actual Next no-html-link-for-pages
  rule then silently stops reporting invalid page anchors.
- Numeric brace ranges omit valid roots such as app10 for app{1..11}; the same
  rule consequently misses invalid page anchors.

The reviewer reproduced both against original fast-glob3.3.1 in isolated scratch.
These findings invalidate the replacement despite passing audit and unit checks.
The adapter, override, lockfile changes and experimental tests were removed.
No dependency workaround or downgrade from that investigation ships.

## Approved exception and implementation

The user explicitly accepted the temporary risk on 2026-10-02. This is a lint-tool
chain, not an established exploitable application endpoint. Development tooling
still executes in CI: this acceptance is not a claim that development dependencies
cannot be exploited. Prefer an upstream patched dependency chain when available.

`security/audit-exception.json` records the exact advisory, approved reason,
five package versions and expiry at 2026-10-09 00:00 America/New_York (04:00 UTC).
`scripts/security-audit.mjs` runs separate production and complete npm audits,
explicitly includes dev dependencies in the complete audit regardless of NODE_ENV,
and validates npm's v2 report, summary and exit status before deciding acceptance.

Production high/critical findings have no exception. Full-audit high/critical
findings pass only when they belong to the exact captured five-package graph,
each at its reviewed lockfile path/version with dev=true and the exact advisory
as its only root cause. Additional advisories, severity escalation, changed paths
or versions, missing records and production exposure fail closed. Unrelated low
and moderate findings retain the existing nonblocking severity threshold.

Commands have bounded runtime/output, run without a shell, and use npm's own CLI
path. Registry/process errors, invalid JSON, changed report contracts, summary
mismatches and expired exceptions block CI. Logs explicitly disclose accepted
risk; the script never reports zero vulnerabilities when the exception is used.
There is no continue-on-error or global development-dependency exclusion.

## Evaluations and removal

- Original npm audit exits 1 on the captured five high findings.
- 33 focused tests passed, including expiry boundaries, unrelated high/critical
  findings, added advisory on an accepted package, graph/version/path changes,
  runtime classification, invalid reports, subprocess failures and actual CLI
  invocation of both scopes even under NODE_ENV=production.
- Live `npm run security:audit` passed with zero production high/critical findings
  and an explicit warning for five accepted development findings.
- Lint/typecheck passed (two pre-existing OpenGraph lint warnings). The initial
  full coverage run passed 877 tests and all coverage thresholds; final added
  severity-regression tests also pass in the focused suite.
- Independent review identified P2 AUDIT-01: malformed aggregate severity could
  understate a direct or inherited advisory. Confirmed by two failing regression
  tests before correction. Validation now rejects understated severity in either
  report. Fresh-context reviewer audit_exception_review independently reran all
  33 tests and resolved AUDIT-01 with no additional findings at snapshot
  20de6b871d986b0d515802655c843a4bf7ea8c3d4987f559d264b8972ac38b57.
  Hosted CI remains pending.

At expiry CI fails even if the exception is unused. Do not extend the date silently.
When upstream fixes the dependency chain, update dependencies, restore the raw
`npm audit --audit-level=high` script, remove the exception/checker/tests, and verify
lint, typecheck, full tests and build. Reverting this exception immediately restores
the original blocking audit without dependency or application changes.

Evidence source: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm and npm registry
metadata, checked 2026-10-02. No application, migration or production changes.
Graphify executable unavailable. No production mutation or application code changes.

## Separate production dependency repair (2026-10-06)

The liveness-only PR exposed GHSA-68fv-2mgg-jv7q in the existing locked
`next -> postcss -> source-map-js@1.2.1` dependency chain. The production audit
reproduced the blocking failure before this repair. Upgrade only the lockfile's
`source-map-js` entry to patched 1.2.2 within existing dependency ranges; do not
change the audit policy, package manifest, or temporary development exception.
This is a Standard-risk compatible patch, not a new exception or schema change.

Clean `npm ci --ignore-scripts`, security audit, typecheck and lint passed
(lint retains two pre-existing OpenGraph warnings). The production audit has no
high/critical findings; the five separately accepted development findings remain.
All 984 unit tests and `npm run build -- --webpack` passed on rerun after local
disk exhaustion interrupted their initial runs. Only ignored `.next-e2e` output
was removed to recover space; Playwright can regenerate it. Hosted CI remains
pending. The fix is prepared on `fix/nak-60-liveness-only-verification`.

Acceptance: only the intended package changes, clean installation resolves 1.2.2,
the unchanged production audit passes, and unit tests/build remain compatible.
Evidence: https://github.com/advisories/GHSA-68fv-2mgg-jv7q.

## PR 93 dependency re-audit (2026-10-09)

Reproduced the expired-exception failure on the current PR branch. A fresh
production-only npm audit reports zero findings. The full audit reports five
high findings, all inherited from GHSA-vfj7-8cjw-p6xm. The installed chain is
eslint-config-next and @next/eslint-plugin-next 16.3.4 -> fast-glob 3.3.1 ->
micromatch 4.0.8 -> braces 3.0.3.

Current npm registry evidence: braces latest remains 3.0.3, micromatch latest
remains 4.0.8 and requires braces ^3.0.3, and fast-glob latest 3.3.3 still
requires micromatch ^4.0.8. The latest stable Next ESLint plugin 16.4.0 and
canary 16.5.0-canary.6 both still require fast-glob 3.3.1. The GitHub advisory
still lists no patched release. A routine supported upgrade therefore does
not remove this vulnerability. npm's proposed major downgrade to
eslint-config-next 14.2.35 is not a compatible Next 16 repair.

Status: blocked, not fixed. No dependencies, lockfile, exception expiry or CI
enforcement were changed. The previously rejected tinyglobby substitution is
not revived: its symlink/numeric-range lint regressions remain relevant.
Next options require an explicit scope decision: a separately reviewed
lint-toolchain replacement preserving current rules, or renewed short-lived
risk acceptance after a fresh exposure review. Neither is established by
this dependency inventory. PR 93 remains unmergeable under the current gate.

## Authorized replacement contract (2026-10-09)

User approved investigating and implementing a replacement. Risk: Critical
(security CI gate and lint execution boundary); full evidence record retained
here with independent fresh review required. Current candidate: pin
eslint-config-next 16.3.4 and override only its matching Next plugin's fast-glob
dependency with tools/next-root-glob, a private local package backed by glob
13.0.6 with brace-expansion 5.0.12. This is not a general fast-glob implementation: only the string pattern
and onlyDirectories=true call observed in get-root-dirs is supported. Changed
API options fail visibly. Large/deep patterns are rejected before expansion.
All existing Next/React/TypeScript rule configurations remain untouched.

Acceptance and evaluations:

- Clean npm ci must reproduce a valid dependency tree with no braces or
  micromatch and a clean complete audit, not just production scope.
- Literal roots must not implicitly include descendants. Numeric brace ranges,
  alternatives, wildcards, dot handling, symlink directories and missing roots
  have independent expected-result tests in next-root-glob.test.ts.
- The actual Next no-html-link-for-pages rule must report invalid internal
  anchors for literal, numeric-range and symlink roots. Adapter-only tests
  cannot prove lint discovery.
- Audit no longer accepts any high/critical finding. Keep report/exit-status
  validation and bounded subprocess execution; test formerly exempt findings,
  production findings, severity understatement, malformed/failed reports and
  both CLI scopes under NODE_ENV=production in security-audit.test.ts.
- Lint, typecheck, full coverage and build must pass before publishing; fresh
  reviewer must inspect the real installed dependency resolution and tests.

Expired exception is removed rather than extended. Historical acceptance tests
are replaced with stricter no-exception regression tests; captured vulnerable
report stays as the negative fixture. No app, auth, database or production
mutation. Compatibility is pinned to the observed plugin API and Node 24/26
ESM interop; any Next tooling upgrade requires rerunning these regressions.
Rollback restores the blocking old dependency graph, not a renewed exception.
Local validation and independent review completed; hosted Linux/Node 26 CI
remains pending. No merge, deployment or release success claimed.

Dependency-resolution lesson: changing a local linked package's manifest can
leave a stale nested lock entry and installed node_modules inside that package.
The initial direct brace-expansion 5.0.8 pin was rejected by audit; its patched
5.0.12 replacement must be verified with clean install, npm ls, and both audits.
Obsolete generated nested dependencies were moved to temporary storage, not
committed. Official patch evidence: https://github.com/advisories/GHSA-q2hr-2g5m-vwhr.

### Completed replacement evidence

- Clean npm ci --ignore-scripts installed 514 packages and reported zero
  vulnerabilities. npm ls verified the real Next dependency reaches the local
  adapter; both production and complete security audits report zero findings.
- All 31 focused audit/adapter tests pass, including actual Next rule detection
  and filesystem-root preservation. Lint, typecheck and production build pass.
- Full coverage: 165 test files / 1,186 tests passed; statements 85.70%, branches
  79.42%, functions 84.91%, lines 89.23%. All 57 feature coverage checks and
  database fixture smoke checks pass. No migrations changed. Application browser
  regressions were not rerun for this tooling-only increment; hosted E2E pending.
- Fresh-context read-only reviewer pr93_dependency_replacement_review (Codex,
  exact model unavailable) returned no_material_findings at snapshot
  9133669c4ab50023ea2fa8ef64409195544e008aa103ce2db1827c750613deeb,
  base 10e2435daeece2290f253d93e9838d1d380e4aee. Start/end freshness passed.
  Reviewer independently reproduced offline clean installation and valid full
  npm tree, 31 focused tests, lint, and real-rule probes for literal, symlink,
  wildcard, array and numeric roots with an exclusive app10 route. Adversarial
  expansion/depth/length probes also passed. Live audits/full test execution/
  build/typecheck are coordinator-observed results, not independent reruns.
- Only result documentation is updated after that reviewed source snapshot.
  Unrelated nak-102 test-publication-access edits are excluded from this change.
