# NAK-84 test coverage hardening

Linear: [NAK-84](https://linear.app/phoenix-works/issue/NAK-84/close-remaining-automated-test-coverage-gaps-and-stabilize-browser)

Mode: full record for repository-wide test coordination and external security
boundaries. Current implementation increment is test-only; it does not deploy,
change production data or call live providers.

## Goal and ordered contract

Close the remaining risk-based coverage gaps without treating aggregate 100%
as proof of correctness. Work proceeds in this order:

1. Stabilize the authenticated theme browser scenario without retries.
2. Directly cover high-risk zero/low-covered repositories and clients.
3. Make runtime MJS and operational-script instrumentation explicit.
4. Add per-file protection for high-risk modules.
5. Add authorized non-production provider contract checks.
6. Add a small deployed critical-path smoke suite.

Production credentials, customer data and production mutation are excluded.
Denied authorization checks must prove no write occurred. Mocked provider tests
must not be represented as real provider integration evidence.

## Execution context

Branch: `test/nak-84-coverage-hardening`; starting main `d92275f`.
Graphify graph was unavailable. The next incomplete step is priority 2's
remaining large UI modules, followed by authorized provider/deployed checks.

Verified locations:

- `e2e/app-theme.spec.ts` — authenticated theme regression and viewport checks.
- `tests/repositories.test.ts` — direct repository RPC/storage construction.
- `tests/auth-client-api.test.ts` — same-origin authentication gateway clients.
- `tests/identity-verification-client-api.test.ts` — verification/recovery routes.
- `tests/brokerdesk-mfa-api.test.ts` — MFA completion boundary.
- `vitest.config.ts` — source plus import-safe runtime/tooling coverage scope.
- `scripts/check-feature-coverage.mjs` — feature and protected-boundary per-file gates.

## Implemented and verified

- The flaky E2E case no longer relies on a persisted Dark state while a streamed
  editor hydrates. It establishes Light explicitly after the first editor, then
  actively switches the replacement-session editor to Dark.
- Added direct mapping tests for owner access RPCs and verified-webhook receipt
  persistence; only identifiers/digests cross the webhook repository boundary.
- Exercised every horoscope repository database/private-storage operation,
  including the empty-remove no-op.
- Covered BrokerDesk MFA completion/action-security starts and safe malformed/
  error responses.
- Covered auth verification/password recovery/provider continuation and
  candidate current/resume/cancel/result client routes.
- Covered account profile persistence and deletion reauthentication, customer
  consent management, applicant redirect/token rules, location malformed-body
  fallbacks, and the remaining dashboard repository operations.
- Added malformed-response coverage for access, onboarding, team, introduction,
  location, account, and pilot client gateways so private response contents are
  never required for a safe failure.
- Added import-safe runtime `.mjs` and worker modules to V8 coverage without
  executing self-starting database or production command wrappers.
- Added file-specific regression floors for 18 high-risk client, repository,
  provider, and worker boundaries. The gate fails closed if a protected file
  disappears from the report, and its tests include a below-threshold negative
  control.
- Added a correlation-safe discovery case for deleted-provider cleanup before
  provider deletion; the worker's previously unexecuted discovery predicate is
  now covered.

Evidence on the current working tree:

| Check | Result |
| --- | --- |
| Focused theme case, retries disabled, five repetitions | 5 passed |
| Full `e2e/app-theme.spec.ts`, desktop/tablet/mobile | 26 passed, 4 intentional skips |
| Initial focused repository/client unit tests | 22 passed |
| Expanded boundary regression set | 12 files, 79 tests passed |
| Runtime/tooling instrumentation set | 12 files, 133 tests passed |
| Protected-boundary coverage gate | 18 files, 0 failures |
| Last complete full unit coverage before concurrent landing work | 194 files, 1,539 tests passed |
| Statements | 86.88% (7,933/9,130) |
| Branches | 81.77% (7,184/8,785) |
| Functions | 86.78% (1,773/2,043) |
| Lines | 90.53% (7,030/7,765) |
| Feature coverage gate | 61 files passed at 80% per metric |

Compared with the audited baseline, 23 additional functions and 25 additional
lines are executed. Zero-function files fell from 20 to 17, and files with any
uncovered function fell from 72 to 67. This is an incremental result, not
completion of NAK-84. Those aggregate values predate the newly instrumented
runtime/tooling scope; a fresh aggregate is pending a clean full-suite run.

The current shared workspace also contains separate uncommitted landing/bookshelf
work. A full run on that mixed working tree reached 1,547 passing tests but was
blocked by two landing/brand failures from that work, and later high-load runs
exposed existing dashboard focus/timing flakes. Those failures were not changed
or attributed to NAK-84. Focused NAK-84 checks remain green.

## Remaining work

- Complete priority 2 for material low-covered UI modules, prioritizing
  `BlueprintForm`, dashboard workflows, onboarding, interest and verification
  state transitions rather than trivial render-only wrappers.
- Refactor only self-starting operational scripts whose core logic can be made
  import-safe and meaningfully unit tested; keep environment orchestration as
  subprocess/integration evidence.
- Keep sandbox/deployed checks separate from deterministic PR checks and record
  exactly which provider boundary each one establishes.
- Rerun required lint, typecheck, clean full unit coverage, browser/CI and
  database gates before delivery; current database evidence belongs to
  unchanged main.
