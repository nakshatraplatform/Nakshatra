# Frontend hardening and hybrid lint integration

## Current integration — 2026-10-18

User approved merging current main into the published feature branch, resolving
the conflicts, validating the combined source and pushing the integration commit.
Full record retained for this Significant shared-UI/security-consumer integration.
Starting feature HEAD: `2dce19c`; target main: `46540e5` (PR112), re-fetched unchanged
after verification. **Combined-source local validation complete**, with final
evidence below. No force push,
PR merge, deployment, remote schema operation, credentials or provider testing.

Preserve both approved contracts: component-scoped loading/navigation and hybrid
lint from this branch; account-name projection, validation/autosave, deletion
accessibility, publication/privacy safeguards and Didit completion from main.
Consolidate the overlapping account modal lifecycles instead of running two
focus/scroll owners. Keep all test expectations unless their setup must compose
the intentionally moved server/client boundary. Do not accept ours/theirs wholesale.

| ID | Acceptance / wrong integration rejected | Evaluation |
| --- | --- | --- |
| MI1 | Stable authenticated frame plus own/self-only account names; no draft/client leakage or unknown-deletion controls | Server-page/account profile tests, delayed-data browser test, ownership query inspection |
| MI2 | Exactly one modal lifecycle, focus/scroll restoration, guarded Escape and single in-dialog feedback | Modal/account/dashboard units, keyboard/short-screen/review browser tests |
| MI3 | Onboarding validation/autosave and authoritative Didit completion retain their current main contracts | Existing full unit suite, onboarding/readiness/Didit browser consumers; compare auto-merged call sites |
| MI4 | Prior Back/native/enhanced and framework-navigation requirements still hold | Affected browser matrix plus repeated production-mode history cases |
| MI5 | Combined source has no conflict markers and retains strict lint/audit/security boundaries | lint/typecheck, coverage/feature gates, build, secret scan, independent review; no SQL delta against target main |

Baseline evidence: dry-run merge reproduced six textual conflicts in project map,
account page/client, dashboard client and their two test files. Existing standalone
branch passes are historical, not combined-source validation. Next: resolve these
paths and inspect semantic auto-merges, then run fresh checks and bounded review.
Graphify graph/executable unavailable. Main's migrations/types remain unchanged;
database execution and real provider delivery remain hosted/release evidence.

Resolution implementation: retain main's existing `activateModalLifecycle` as
the single account-dialog owner, including heading-first entry and explicit
Delete-trigger return after reauthentication. Route both Escape and close-button
dismissal through the branch's busy guard/typed-confirmation reset. Keep exactly
one in-dialog live region and main's focusable main landmark. Editor/final review
continue using their existing hook; no application-wide modal rewrite is implied.
Move the authenticated, explicitly owner-filtered name read into AccountControls;
only validated name parts enter client props. Failed name-source reads now use
the same safe regional retry instead of enabling a separate editable name source.

Initial integrated focused run: 151 passed, two failed because old Escape
fixtures tried to enter Story with incomplete Basics. Use a valid existing draft
and shareable photo for that independent keyboard scenario; retain main's forward
validation guard and every Escape assertion. The corrected six-suite run passed
153 tests. Older deletion browser setup now follows main's intentional heading
entry before testing the original Tab wrap. Full combined validation is pending.

Whitespace check against the pre-merge feature HEAD reports main's inherited
blank EOF line in `20261017203833_schedule_retention_with_health.sql:157`.
The migration blob exactly matches target main and is not rewritten. The actual
PR delta's `git diff --check origin/main` passes; no SQL delta is introduced.

### Main-integration independent review and correction

Round 1: fresh-context `/root/latest_main_frontend_integration_review`, exact
model unknown, instruction-based read-only shared-source access. Packet
`4b2e50f1e847eaf38780a1b2f03357602e3eadf038c755298f7e9d4b99cc4647`,
target base `46540e5`; freshness passed at both boundaries. Verdict changes_required.

MI-R1 (confirmed, introduced integration regression, medium/material): pending
CustomerAppFrame and Account/Dashboard error landmarks were not programmatically
focusable, violating main's skip-link contract outside the successful loaded
state. Independent isolated Chrome reproduced BODY versus MAIN focus with/without
tabindex. Reviewer independently verified the extracted-frame modal's normal and
reauthentication focus/scroll restoration and found no other material issue in
the inspected integration paths.

Correction: tabIndex=-1 on pending/error main targets, plus the existing customer
broker main for consistent shared navigation. Three newly strengthened unit
assertions failed before correction (`/tmp/nak74-main-integration-skip-red.log`);
all 31 affected tests passed afterward (`/tmp/nak74-main-integration-skip-green.log`).
Delayed-data browser tests now use the actual skip link before testing navigation.
Correction review and integrated browser/build checks remain pending. The earlier
1,529-test / 61-gate pass predates this attribute-only correction and is retained
as historical integration evidence, not a final-source whole-suite claim.

Round 2 packet `5795e0d2a467ed373dd9a62c598480be3b76a263ec1cda7813f6506f3fe96514`:
scoped verdict no_material_findings, MI-R1 resolved. Reviewer independently passed
four native Chrome skip-focus checks using current source tags and inspected the
added pending/error tests. Freshness passed before/after; no runtime changed since.

The broad integrated browser run passed all 159 cases in 9.3 minutes. It exposed
test-induced header hydration warnings: the completed-account test wrote an HTML
identity attribute before React hydration, and the warning named that exact
attribute. Replace only that instrumentation with an actual element-handle
identity comparison, retaining header-preservation assertions and adding a
hydration-console guard. The other 132 browser cases are unaffected; rerun all
27 loading/navigation cases for the corrected fixture. Final full coverage,
production build/history and this affected rerun are still pending here.

### Final combined-source evidence — 2026-10-18

Round 3 (final allocated round), packet
`5cace7de6e76e696d88376e703d34234cbe163593576ce0102a9e2ee760a201b`:
scoped verdict no_material_findings, MI-R1 remains resolved. Reviewer verified
the test-only element-reference correction and console guard, plus source
freshness and target-main whitespace checks. The actual model remains unknown;
this is fresh-context review, not claimed cross-model/human approval. Only these
results/documentation changes followed the reviewed runtime/test snapshot.

| Final check | Result / log |
| --- | --- |
| Full serial unit/coverage | 193 files / 1,529 tests passed; statements 86.57%, branches 81.67%, functions 85.65%, lines 90.21%; `/tmp/nak74-main-integration-coverage-final.log` |
| Feature coverage | All 61 gates passed; `/tmp/nak74-main-integration-feature-gates-final.log` |
| Broad affected browser matrix | 159 passed on desktop/tablet/mobile-sized Chromium; `/tmp/nak74-main-integration-browser.log`; retains the historical test-marker warnings described above |
| Corrected loading/navigation browser matrix | All 27 passed; header identity retained with no hydration-mismatch warning; `/tmp/nak74-main-integration-browser-corrected.log`; other 132 cases unchanged on the same runtime |
| Production build | Passed with loopback public configuration; `/tmp/nak74-main-integration-build.log` |
| Repeated production-mode history | All 27 passed: original wheel/keyboard/anchor/Back plus native/enhanced full-document Back, three repetitions across all three viewport projects; `/tmp/nak74-main-integration-production-history.log` |
| Lint and typecheck | Passed on final test/runtime source; `/tmp/nak74-main-integration-lint-reviewed.log`, `/tmp/nak74-main-integration-types-reviewed.log` |
| Dependency audit | Full report zero affected packages, no exceptions; production no high/critical findings; `/tmp/nak74-main-integration-audit.log` |
| Database fixture source smoke | Passed; `/tmp/nak74-main-integration-db-smoke.log`; not SQL execution |
| Pre-commit staged-source secrets | TruffleHog 3.97.0, repository detectors, all result classes, no provider verification: zero findings in 1,331 chunks; `/tmp/nak74-main-integration-secret-scan.log` |
| Merge/PR source integrity | No unmerged entries or conflict markers; whitespace against target main passes. SQL/types/auth/server/worker implementations remain identical to target main |

MI1–MI5 pass within the listed local evidence. Desktop account confirmation and
mobile dark pending-data screenshots were inspected together without a redesign.
No claim of physical-device, assistive-technology, universal contrast/performance,
provider delivery or production cleanup verification. Development logs retain
expected aborted-stream messages from intentionally leaving pending routes and
synthetic unavailable-provider cases; this is not a clean-production-log claim.
Production-mode tests use the repository start script; its existing standalone
output warning means deployment packaging is not certified by that invocation.

Delivery: commit and push this integration on the existing branch, preserving
both parents and all main safeguards. Hosted required CI and actual Vercel Preview
remain before PR merge. No new SQL delta exists against main; main's existing
migration rollout requirements remain authoritative. No PR merge, deployment,
production mutation, real provider call or Linear write is authorized here.

## Historical integration contract (fc7f55c)

User authorized validating the conversation's outstanding implementation and
creating a remote branch. Significant shared-browser-lifecycle and security-gate
change. Integration target is `origin/main` at
`fc7f55c` (26 commits newer than the original working base `f86a001`).
Branch: `chore/nak-74-frontend-hardening-hybrid-lint`.

Retain the approved contracts in application-smooth-scroll.md,
frontend-priority-hardening.md and hybrid-lint-tooling.md. Historical Didit,
email, auth and CD work already merged into main is inherited, not reimplemented
or represented as newly production-tested. No remote database mutation,
credentials, workflow/environment changes, PR creation, merge or deployment.

## Integration decisions / issue-resolution ledger

- Preserve main's consumer wording, Inter/Plus Jakarta runtime fonts, publication
  safeguards, account settings, loading/image owners and extracted portfolio
  footer. Do not restore older layouts or obsolete JSON-download controls.
- Replace the editor's overlapping focus/Escape effects with one shared modal
  lifecycle. Keep its unsaved-draft confirmation and latest-state callback.
  Use main's reference-counted iOS-aware scroll lock rather than a second
  overflow-only implementation. Review/relationship dialog flows are unchanged.
- Preserve main's aria-activedescendant combobox model and non-tabbable options;
  consume option-focused Escape defensively without removing keyboard navigation.
  Browser regressions use current accessible names and legitimate anchors.
- Remove the now-unused Next root-glob adapter, override and adapter-only tests;
  actual-engine hybrid lint fixtures replace their retired execution boundary.
  Keep all 22 prior Next checks and official ESLint rules. Both lint engines
  ignore generated reports. High/critical findings still fail without exceptions.
- Nine unused legacy font binaries remain removed and recoverable in Git.
  Correct the inventory to current main's runtime fonts. Other asset licensing
  evidence is not established by deletion or this verification.

## Required evaluations / evidence status

Clean installation, strict full/production audit, dependency-tree inspection,
both lint engines, typecheck, full unit/coverage and feature gates, production
build, affected desktop/tablet/mobile browser tests, secret scan, whitespace
check and a fresh-context final-source review are required before pushing.

Database fixture smoke checks cover inherited contracts; there is no migration
delta against main. This is not a remote migration run or clean pgTAP replay.
Hosted CI and Vercel Preview remain separate post-push/pre-merge checks.
Physical devices, assistive technology and real Didit/Resend delivery are not
certified by local fixture browsers.

Initial clean installation stopped with ENOSPC; only this repository's ignored
`.next` and `.next-e2e` caches were removed and are regenerable. Preserve that
failure as history; report the retry's actual result, not a borrowed earlier pass.
## Validation and review ledger

This integration record supersedes older feature-record readiness claims for
the current source. Prior passes are retained as historical evidence, not reused
as a final-source browser or release pass.

- Clean `npm ci` retry passed after the recorded disk failure. Full/production
  security audit passed again with zero affected packages and no exceptions;
  the retired Next ESLint/glob chain is absent. Both lint engines and typecheck
  passed again after the latest runtime changes. Fixture smoke checks passed.
- Integrated baseline coverage passed: 188 files / 1,459 tests, all 59 feature
  gates. Production build passed. Those runs preceded the last history-lifecycle
  investigation; they are not a fresh whole-suite/build pass for that correction.
  The independent reviewer ran the current lifecycle/inertia tests: 11 passed.
- A pinned official TruffleHog 3.97.0 staged-source handoff scan found no results
  (1,273 chunks). Rescan any subsequent source changes before a push. No scanner
  allowlist was added, and no security gate was bypassed.
- The broad 405-case browser run was interrupted: 335 passed, 16 failed,
  1 interrupted, 6 intentionally skipped and 47 not run. It is not a passing run.
  A subsequent affected-subsystem run completed with 71 passes and 7 failures.
  These seven failures concern streamed-page test readiness, an obsolete section
  label and typing before hydration. Their assertions remain intact; the tests
  now await the single rendered main/initial editor focus and select section
  value `story`. The targeted rerun passed all 9 cases across desktop, tablet and
  mobile Chromium (`/tmp/nak-validation-readiness-final.log`). This plus the
  unaffected 71 passes is correction evidence, not a new full 78-case run.
- FH-I1 (introduced, medium): same-tab privacy navigation could lose an unsaved
  editor draft following a failed autosave. Use a labelled new-tab privacy link;
  route/browser regression verifies the failed save and retained draft.
- FH-I2 (introduced, medium): Shift+Tab from the initially focused, non-sequential
  editor heading could leave the modal. Include that starting-focus case in the
  shared focus trap; unit and actual browser regression cover both directions.
  Both findings were independently resolved in round 3.
- FH-I3 / SS4 (historically unresolved; follow-up resolution below): Privacy at scroll position 400 → Login → browser Back
  can return to zero. The final-source repeated development check failed 2/6.
  Independent native/reduced-motion checks also failed, while static HTML
  controls passed. An existing production build reproduced zero in 8/8 enabled
  and 8/8 reduced-motion checks. Lenis is therefore not necessary for the failure;
  introduced-versus-existing origin is not established without an executable
  `origin/main` comparison. A briefly short, hidden streamed layout was observed,
  but observation changed timing; this is not a proven causal diagnosis.
  No safe runtime fix was established. Do not call the initial-mount/visibility
  lifecycle corrections a verified history fix or weaken the Back assertion.

Independent reviewer: fresh-context subagent
`/root/frontend_hybrid_integration_review`, actual model unknown, shared source
read-only by instruction rather than filesystem isolation. Rounds 1–3 inspected
integration and corrected FH-I1/FH-I2. The user explicitly authorized round 4;
it inspected the final lifecycle and test-readiness corrections. Runtime/test
snapshot: `82dae902e7f74af481f83070e2618d079ab2acc06fb3eaa525fa46bb551cbcd7`.
Results-only documentation added afterwards does not change runtime inputs.
The round-4 final verdict was `blocked` on FH-I3, with FH-I1/FH-I2 resolved;
the final packet provenance and whitespace checks passed.

## Follow-up resolution / current handoff — 2026-10-18

The user subsequently approved component-scoped loading and a navigation audit.
See [the follow-up contract and evidence](component-loading-navigation.md). This
supersedes the earlier blocked handoff, not its recorded failed-run history.
Root-wide loading was removed; authenticated customer headers and preview
navigation now sit outside their data waits. The original SS4 assertion remains
unchanged and passes alongside native/enhanced full-document history tests.
The rebuilt production-mode app passed all 27 repeated history cases. This
resolves FH-I3 in the tested conditions, without claiming universal restoration
or proving every earlier timing hypothesis.

Current local rerun: 1,464 unit tests, 59 coverage gates, 90 affected browser
cases, lint/typecheck, production build, strict dependency audit and fixture
source smoke all passed. The follow-up's bounded independent review resolved the
moved-header modal isolation regression and ended with no material findings.
Runtime/test snapshot `5c33f87656cd3ba112ae9f011987814a5b02ce8b9ec320817dfb91c1e752ea98`;
only results documentation changed afterwards. This is not a rerun of every
repository browser test, real database migration/pgTAP or release approval.

Before any push, rescan the subsequent source delta for secrets. Hosted CI and
Vercel Preview remain pre-merge checks; physical-device, assistive-technology and
previously stated licensing limitations remain separate.

### Publication preparation — 2026-10-18

User authorized committing/pushing this branch and requested a description for
manual PR creation. The staged-source TruffleHog 3.97.0 scan used repository
detectors and all verified/unknown/unverified result classes, without contacting
credential providers; 1,281 chunks scanned with zero findings. No allowlist or
push-protection bypass was added. Git hooks remain enabled.

Fetching before publication found `origin/main` advanced to `a5fcea6` (four new
commits after integrated `fc7f55c`), including overlapping onboarding/security
work. This push preserves the reviewed branch; it does not merge those newer
changes or establish combined-source readiness. Integration with current main,
conflict resolution if needed, and affected CI/Preview checks remain before merge.

Local work is preserved on `chore/nak-74-frontend-hardening-hybrid-lint`;
no remote branch, PR, deployment, database migration or Linear write has been
performed by this validation task.
