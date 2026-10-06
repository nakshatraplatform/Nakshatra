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
