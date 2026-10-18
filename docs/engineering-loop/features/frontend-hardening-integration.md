# Frontend hardening and hybrid lint integration

## Contract and scope

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
- FH-I3 / SS4 (unresolved): Privacy at scroll position 400 → Login → browser Back
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

## Current handoff / next incomplete step

**Blocked, not merge-ready.** The authorized extra review and two attempted
history corrections did not resolve SS4; stop speculative runtime changes.
Before pushing as validated, establish an executable main baseline, isolate
full-document versus client navigation and streamed-layout restoration, choose
an evidence-backed minimal fix, retain the native/enhanced regression assertion,
and obtain renewed review authorization for that correction. Then rerun affected
browsers, final coverage/build/static/secret checks. Hosted CI/Preview and the
previously stated physical-device/licensing limitations remain separate.

Local work is preserved on `chore/nak-74-frontend-hardening-hybrid-lint`;
no remote branch, PR, deployment, database migration or Linear write has been
performed by this validation task.
