# NAK-88: frontend reflow and interrupted-request recovery

## Contract and execution context

User-authorized implementation, 21 October 2026. Linear: Phoenix works / Nakshatra,
NAK-88. Critical tier for the shared authentication transport; full record.
Work in the existing `vivara-landing-content/nakshatra` worktree based on
`6fda9be`, preserving prior landing/orb changes. The primary checkout is excluded.
No deployment, remote migration, push or PR is authorized. The 21 October
follow-up request authorizes the compatible Vite security patch described below.

**Delivery authorization update:** on 21 October the user explicitly requested a
branch push and PR into `main`, then confirmed including the earlier landing-page
and loading-orb work in the same PR. This authorizes the delivery below, not a
direct push to `main`, merge, deployment or additional independent review.

### Current correction scope — 21 October 2026

The third independent review found **FH-REV-5**, a confirmed medium-severity,
pre-existing FH1 acceptance gap: at 320×850 / 200% root text the interest
verification button remains clickable but its two-line label clips. Measured
client/scroll heights were 64/77px and the text extended beyond the dialog.
Report: `/tmp/nak88-verification-review.md`. Earlier no-finding conclusions are
historical, not acceptance of this state.

User requested both remaining fixes: verification-step intrinsic sizing/scrolling
and the compatible Vite patch. This bounded correction is Standard UI/tooling
work; shared authentication behavior remains unchanged and retains its earlier
Critical-tier release requirements. Extend the existing full feature record.

Plan: first add a real new-visitor email-step regression checking text ranges,
control content height and reachability at 320px, short landscape and desktop,
both themes. Reject the plausible wrong fix that only keeps the button clickable
or hides its overflow. Let the entire verification pane scroll and preserve
intrinsic row heights; retain copy, focus, dismissal and answers. Update only
the locked Vite dependency within supported consumer ranges, inspect lock churn,
and rerun the strict audit, full unit/coverage, static and affected browser gates.
No exceptions/suppressions, provider requests or server policy changes.

The three-round automated review budget is exhausted. No fourth review is
authorized; implement and self-verify these corrections, leaving fresh independent
review and other release gates pending rather than claiming merge readiness.

### Intended behavior / invariants

Authentication content must reflow at 320px with 200% root text, both themes,
without clipping controls or hiding overflow as the correction. Mobile input text
is at least 16px; primary fields retain 48px minimum height, secondary standalone
actions 44px. Inline legal links are intentional exceptions.

Interest requests have a 20-second deadline per network exchange, including body
reading. Close and Escape dismiss, not cancel, a submitted operation. Reopening
retains answers and pending state. No duplicate concurrent mutation or automatic
retry. A dismissed Google response must not navigate the browser; offer explicit
continuation on return. Unmount aborts local waiting and fences subsequent UI or
follow-up submissions. An aborted/timed-out request can still complete remotely;
feedback must not claim undo or definite failure. Existing database uniqueness,
server authentication, consent, rate limits and disclosure rules remain canonical.

Use existing brand tokens and components. Respect contrast/transparency
independently of motion on visible shared materials. No animation-engine redesign.
Classify WebKit failures from reproducible evidence, not browser failure counts.

## Architecture / affected consumers

`auth.api.ts` remains the same-origin gateway adapter. A small bounded JSON-fetch
helper owns transport timeout/body disposal only, not auth or interest policy.
`InterestRequestModal` owns dialog visibility, retained draft and navigation
intent; server routes/RPCs retain authorization and duplicate enforcement.
Auth and reset forms use the shared transport; their domain policy is unchanged.
Shared account CSS owns intrinsic sizing; portfolio chrome owns its appearance.
No schema/type generation is required: RPC and database contracts are unchanged.

Auth/reset fields and account controls wait for hydration using the same
`useSyncExternalStore` server/client-snapshot pattern already used by ThemeSwitch.
The shared `useHydrated` hook owns readiness only, not auth state. Native disabled
fieldsets retain visible guidance until handlers attach. Auth pages include
preparing/no-JavaScript guidance; this is not a test sleep.

## Evaluation plan (before implementation)

| ID | Expected / plausible wrong implementation rejected | Check |
| --- | --- | --- |
| FH1 | 320px/200% text fields/actions and text bounds stay reachable; document overflow alone can hide clipping | Browser geometry of actual children, both themes; nine-width regression |
| FH2 | Hung fetch AND hung JSON body settle once at deadline; abort is not undo | Fake-clock transport tests, timeout/abort/late-success cases |
| FH3 | Close/Escape work during pending; reopening retains answers and one request; late Google response never redirects a dismissed dialog | Component and intercepted real-browser tests |
| FH4 | Unmount fences later state/navigation and verify-to-send continuation; no automatic retry | Component deferred-response tests, shared auth regressions |
| FH5 | 16px mobile fields, 48px native select, 44px standalone actions | WebKit/Chromium computed geometry; keyboard/focus/error tests |
| FH6 | Contrast/transparency independent of motion, semantic tokens, visible materials | Media-emulation computed styles in both themes; existing motion tests |
| FH7 | WebKit failures resolved or reproducibly classified, no suppressed assertions/CSP changes | Existing 15-case WebKit/Firefox matrix, controlled HTTPS check |
| FH8 | No affected regression, maintain cohesive responsibility boundaries | Lint, types, unit/coverage/build, navigation/touch checks; fresh read-only review |

## Baseline and limitations

Prior audit on unchanged dirty source: 67 Chromium tests, 15 Firefox, 6/15 WebKit,
13 tour/touch and 18 focused units passed. Separate doubled-text and stalled-modal
observations exposed FH1/FH3. Country selector measured 25px in WebKit. Other
WebKit failures are undiagnosed (email sometimes blank before submit). Production
HTTP loopback asset failures under upgrade-insecure-requests are not production
bug evidence. Preserve CSP and distinguish self-signed local TLS from trusted
public-preview evidence. Physical devices, actual screen-reader speech, live
provider delivery and hosted CI are separate release gates, not inferred passes.

## Rollout / rollback

Application-only additive change; no migration or secret required. Validate locally
with loopback fixtures, review, then user-authorized delivery. Reverting these
specific source changes restores prior behavior without data conversion. Do not
revert unrelated landing/orb edits. Timeout feedback cannot establish whether the
remote request committed; existing server duplicate checks remain necessary.

## Implementation progress / results

Implementation in progress; not released. Regression-first transport/modal tests:
four intended failures and 40 passes, `/tmp/nak88-regression-red.log`. Initial
browser regressions: all four intended failures, `/tmp/nak88-browser-red.log`.
After focused fixes those four passed, `/tmp/nak88-browser-first.log`.

Controlled hydration regression held local JavaScript downloads: server-rendered
signup accepted input before handlers attached; test failed as intended,
`/tmp/nak88-hydration-red.log`. Initial cross-engine rerun still had eight WebKit
failures / 22 passes (`/tmp/nak88-engines.log`). After readiness guards and explicit
native select height, all **40 WebKit/Firefox checks passed** in
`/tmp/nak88-engines-second.log`; local HTTP development evidence, not a trusted
production preview. No assertion weakening or CSP changes. Replaced the old
intentional “Escape cannot dismiss pending” unit expectation with the new
contract: dismiss/reopen, retained answers, one request and eventual success.

Focused units: 80 passed (`/tmp/nak88-focused-third.log`), before the additional
verify-after-unmount regression. Final broad/static/coverage/build checks pending.
Graphify executable/graph unavailable in this worktree; direct source/caller
inspection is the fallback. Independent review pending (maximum three rounds).

### Fresh review and corrections

Round 1, fresh context/read-only, model unknown (not cross-model), snapshot
`7304d669cc9f9e933810e1b9108a205ef5202b73e802bc0a948bbb9cb81d8327`.
Source manifests matched before/after. Report `/tmp/nak88-review-round1.md`;
reviewer independently passed 98 focused tests and reproduced the following.

| Finding | Classification / correction / current evidence |
| --- | --- |
| FH-REV-1, medium | Confirmed pre-existing acceptance gap: sixth OTP digit clipped at 320px/200%. New regression failed in both themes (`/tmp/nak88-otp-red.log`). Intrinsic height and reduced letter spacing preserve all six digits. First spacing reduction still overflowed by 7px; measured width guided the final reduction. Current two-theme Chromium checks pass (`/tmp/nak88-corrections-confirm.log`). |
| FH-REV-2, medium | Confirmed pre-existing acceptance gap: validation module download precedes the fetch deadline. Shared deadline now also bounds that download and fences its late completion. New retained-answer/no-auth/no-send regression failed before the change (`/tmp/nak88-review-import-red.log`), passed afterward. |
| FH-REV-3, medium | Confirmed introduced preference gap: account shell has no product-background token, and contrast omitted blur reset. Use existing workspace tokens and both independent media queries. First correction exposed emitted CSS dropping standard backdrop-filter when the prefixed declaration followed it. Put vendor fallback first, standard property last; verify the compiled CSS behavior, not source intention. Both-theme account/login/public material checks now pass without reduced-motion (`/tmp/nak88-corrections-confirm.log`). |
| FH-REV-4, low | Confirmed introduced required-gate failure: 0.65rem padding violated eight-pixel scale. Restored 0.5rem spacing without fixed control height; maintained spacing gate passes in the 98-test correction run. |

After corrections: 98 focused tests passed (`/tmp/nak88-corrections-units.log`);
18 Chromium/mobile hardening checks passed (`/tmp/nak88-corrections-confirm.log`).
Earlier broad run: 159 passes / two preference failures / one intentional
desktop-touch skip (`/tmp/nak88-chromium-final.log`); earlier full coverage:
1,666 passes / one spacing failure (`/tmp/nak88-coverage-bounded.log`). These are
historical failing gates, not mislabeled final green results. Final coverage,
cross-engine, production build, emitted-asset/TLS checks and return review pending.

Separate gate discovered: installed Vite 8.1.5 (transitive test tooling) has a
high-severity advisory; `npm run security:audit` fails (`/tmp/nak88-audit.log`).
Compatible patch 8.1.6 exists. User asked whether to include this separate lockfile
maintenance or leave it to a security task; no exception or dependency edit made.

### Current local verification after corrections

- Cross-engine: **46 passed / two intentional CDP-only skips** (mobile WebKit and
  Firefox), `/tmp/nak88-engines-confirm.log`. Includes native selector, auth/error/
  pending/success, OTP 200% reflow, unmount/dismissal and destructive confirmation.
- Production build passed with synthetic loopback configuration and Vercel output
  mode, `/tmp/nak88-build-confirm.log`. No deployment. Build output was moved to
  `/tmp/nak88-compiled-production` after use; generated temporary tsconfig edits
  were restored exactly. Temporary build files interfered with one concurrent
  lint traversal (ENOENT); rerun after moving generated output is authoritative.
- Optimized production over **self-signed local TLS**, WebKit: **20 passed / one
  intentional CDP-only skip**, `/tmp/nak88-production-tls.log`. Production CSP is
  unchanged, including upgrade-insecure-requests. Local certificate errors were
  ignored only in the isolated test browser. This proves production assets and
  interactions over TLS, not a publicly trusted certificate or deployed preview.
- Batched visual check: 320px/200% OTP in both themes and desktop-dark signup;
  complete code visible, text/controls in flow, palette retained. Synthetic data
  only; screenshots `/tmp/nak88-otp-200-light.png`, `-dark.png` and
  `/tmp/nak88-signup-desktop-dark.png`. Actual screen-reader speech remains untested.

Full unit coverage passed: 200 files / 1,668 tests; statements 85.69%, branches
81.69%, functions 86.18%, lines 89.23% (`/tmp/nak88-coverage-confirm.log`).
Final feature gates/static checks and independent return review recorded below
when completed. No release-readiness claim while security audit, trusted deployed
preview, hosted CI and manual device/screen-reader evidence remain outstanding.

Full-source coverage passed, but the stricter auth-client branch floor initially
failed (75% vs required 100%): the new caller-abort response branch was not tested
through the auth adapter. Added that explicit negative case (no retry, safe code,
aborted fetch, timer cleanup); gate is not lowered. Final rerun pending.

### Final handoff — 21 October 2026

Implemented and locally verified; **not released / not yet merge-ready**.

| Gate | Final evidence |
| --- | --- |
| Full units/coverage | **200 files / 1,669 tests passed**; statements 85.69%, branches 81.7%, functions 86.18%, lines 89.23%; `/tmp/nak88-coverage-authoritative.log` |
| Feature / protected floors | All **61 feature files and 21 protected boundaries passed**, including 100% auth-client branches; `/tmp/nak88-feature-gates-authoritative.log` |
| Final negative cases | 15 passed, `/tmp/nak88-final-negatives.log` |
| Lint / types | Passed, `/tmp/nak88-lint-verified.log`, `/tmp/nak88-types-verified.log`; generated temporary build output moved outside source before final lint |
| Production build / TLS | Build passed; WebKit 20 passed / one deliberate CDP-only skip over self-signed local TLS, as qualified above |
| Cross-engine | 46 passed / two deliberate CDP-only skips, `/tmp/nak88-engines-confirm.log` |
| Corrected Chromium / mobile | 18 passed, including independent materials, `/tmp/nak88-corrections-confirm.log` |
| Nine-width affected auth matrix | Five checks passed after all runtime corrections, both themes across the existing nine widths, `/tmp/nak88-final-auth-matrix.log`; broader 159-pass navigation/touch/route evidence retained only for unchanged consumers |
| Diff / preservation | Whitespace passes; primary checkout remains on `test/nak-84-coverage-hardening`, untouched by this task; package/lock/tsconfig unchanged |
| Security audit | **Failed, pre-existing Vite 8.1.5 advisory**; patch decision outstanding, no exception/suppression |

Return review (round 2 of maximum 3): **no remaining material in-scope findings**,
FH-REV-1–4 resolved. Reviewer is fresh-context/read-only, actual model unknown;
procedural isolation plus matching manifests, not a filesystem sandbox or
cross-model claim. Reviewer independently passed 103 tests, loaded emitted
production CSS to verify opaque light/dark headers and no blur under each
preference, inspected both OTP screenshots, and verified manifest freshness.
Report `/tmp/nak88-review-round2.md`; reviewed snapshot
`ce9a900d78554b3307e1d0eec66ffa0fe9dff9129c688d18cdc8779f25810263`,
packet `/tmp/nak88-review-round2-final.json`. Only results/project documentation
changed after that review; no runtime, tests, dependencies or configuration edits.

Remaining gates: decide/apply the compatible Vite patch in authorized scope;
trusted deployed HTTPS preview and hosted CI; physical iOS/Android and actual
screen-reader journeys. No external provider tests, production data changes,
commit, branch push, PR or deployment performed. Linear remains In Progress
while these release gates are open.

Verified lessons: check the content inside bounded controls, not just document
overflow; a lazy prerequisite download needs the same bounded-wait contract as
its eventual mutation; inspect emitted CSS when fallback declaration order changes
behavior. Regressions above reject each demonstrated failure.

### Follow-up correction results — 21 October 2026

**Implemented, self-verified; independent return review and release still pending.**
This section supersedes the historical pending-patch decision and round-2
no-finding handoff, not their recorded evidence.

- **FH-REV-5:** `globals.css` now lets the verification main pane (including its
  tall header) scroll. Its form retains intrinsic `max-content` rows rather than
  compressing controls into leftover height. Scoped to `data-step="verify"`;
  details/choice/success layouts, dialog lifecycle and auth policy are unchanged.
  The new real-flow regression in `frontend-hardening.spec.ts` first failed on
  the clipped button (`/tmp/nak88-fix-reflow-red.log`), then all six theme/viewport
  cases passed (`/tmp/nak88-fix-reflow-green.log`). Tests inspect rendered text
  ranges, control scroll/content height and viewport reachability at 320×850,
  844×390 and 1440×900 with 200% root text; they also verify code-error focus,
  retained answers after Change details and Escape dismissal. Narrow light and
  desktop dark screenshots were visually inspected; no label overlap observed.
- **Security gate:** lockfile-only Vite **8.1.5 → 8.1.6**, using registry-verified
  integrity metadata. Both Vitest and the React plugin support this version;
  their dependency metadata and all other locked packages are unchanged. An
  initial broad npm resolution was discarded before installing the narrow patch.
  `npm install --ignore-scripts`, `npm ls vite` and `npm ci --dry-run
  --ignore-scripts` validate the lock/resolution. Strict full and production audit
  passes with **zero affected packages and no exceptions**,
  `/tmp/nak88-fix-audit.log`. Source: the reviewed
  [upstream advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm)
  lists 8.1.6 as the fixed 8.1-line release (checked 21 October 2026). No runtime
  package, audit policy or suppression changed.
- Full fresh unit/coverage run on patched tooling: **200 files / 1,669 tests
  passed**, all **61 feature / 21 protected-boundary floors passed**;
  statements 85.69%, branches 81.7%, functions 86.18%, lines 89.23%.
  `/tmp/nak88-fix-coverage.log`.
- Fresh WebKit/Firefox: **58 passed / two intentional CDP-only skips**,
  `/tmp/nak88-fix-engines-final.log`, including the new verification cases.
- Chromium: **22 passed**, `/tmp/nak88-fix-chromium-final.log`, including the
  affected nine-width auth matrix, verification/recovery, mobile visitor fields
  and retained draft/error/keyboard journeys. Total fresh final browser checks:
  **80 passed / two intentional skips**. Lint, non-incremental TypeScript and
  whitespace checks pass (`/tmp/nak88-fix-lint-final.log`,
  `/tmp/nak88-fix-types-final.log`). No source changes followed those checks
  except this results record and project index.
- Production build passed, `/tmp/nak88-fix-build.log`; both scoped rules are
  present in emitted CSS. Output moved to `/tmp/nak88-fix-compiled-production`.
  Generated tsconfig changes were restored exactly. A concurrent browser run
  was interrupted after Tailwind scanned temporary custom build output and
  emitted invalid CSS; it is not a passing run. The authoritative cross-engine
  rerun above ran sequentially after moving that output outside source.
- Impeccable preserved the incumbent design and guided the scroll/intrinsic-size
  correction. Its single mechanical scan reported nine existing aesthetic
  warnings in unchanged declarations; none points to these four added CSS lines.
  `/tmp/nak88-fix-detector.json`. No incidental style redesign was made.

Changed in this correction only: `src/app/globals.css`,
`e2e/frontend-hardening.spec.ts`, `package-lock.json`, this record and its project
index. Earlier landing/orb work and the primary NAK-84 checkout are preserved.
Graphify remains unavailable. Current final snapshot is captured in
`/tmp/nak88-fix-final-source.json`; older review snapshots are historical.

Third independent review is retained as **changes_required**; do not rewrite it
as approval. FH-REV-5 is locally resolved by the regression above, pending fresh
review of the correction. The default three rounds are exhausted; an additional
review was requested but is not assumed approved. Trusted deployed HTTPS, hosted
CI, physical-device and actual screen-reader evidence remain pending. No commit,
push, PR, deployment, live provider call or production data mutation performed.

### Combined delivery preparation — 21 October 2026

Branch `feat/nak-88-vivara-frontend-hardening` includes the approved landing/demo,
orb and NAK-88 work. Implementation commit `e11928d` was merged with latest main
`66cfc64` (NAK-87 readable links) in `d6b5b63`. The sole conflict was the project
index; both feature entries are retained. Dashboard changes merged without
discarding either the newer share-link wording or upload-control labels.
No new migration or server-domain change is added relative to that main.

Fresh integrated checks at `d6b5b63`:

- **201 files / 1,683 unit tests**, all 61 feature / 21 protected coverage floors;
  `/tmp/nak88-delivery-coverage.log`.
- **70 Chromium browser checks** covering the landing/story/bookshelf, orb theme,
  no-JavaScript content, keyboard/navigation, auth/interest recovery and readable
  link compatibility; `/tmp/nak88-delivery-chromium.log`.
- Lint, non-incremental TypeScript, strict zero-finding dependency audit, database
  fixture smoke (not live SQL execution), production build and whitespace pass;
  `/tmp/nak88-delivery-{lint,types,audit,db-smoke,build}.log`.
- TruffleHog 3.97.0 with repository custom detectors: zero staged-file findings
  and zero findings in the explicit `66cfc64..d6b5b63` commit range. Verification
  disabled to avoid contacting providers; no scanner exclusion/bypass added.
  Logs `/tmp/nak88-delivery-secrets-{precommit,final}.log`.

Earlier 58 WebKit/Firefox passes remain pre-integration evidence, not a newly
executed check of the merged revision. Build output is outside source at
`/tmp/nak88-delivery-compiled-production`; generated tsconfig edits restored.
The font licence has whitespace-only normalization. The local `.impeccable/`
critique output is preserved untracked and excluded from delivery; marketing
context and licensed/disclosed demonstration assets are included. No credentials,
environment files or dependency/build folders are staged.

Open a draft PR: final independent correction/integration review, hosted CI,
trusted deployed HTTPS and physical-device/screen-reader evidence remain pending.
This delivery record changes documentation only after the tested runtime revision.

### CI correction contract — clean-checkout type generation

PR #122 quality job failed at its pre-build TypeScript step with TS2307 for all
three tracked Ananya PNG imports. The job name includes audit/unit/build, but
this failure is the TypeScript step; it does not establish three separate failures.
Local development/build had generated ignored `next-env.d.ts`, which references
Next's static-image declarations. A Git-only export without generated files
reproduces the same three errors (`/tmp/nak88-ci-types-red.log`).

Standard tooling fix: make the canonical npm `typecheck` command run Next 16.3.8's
documented `next typegen && tsc --noEmit`. Preserve static imports/content hashes,
strict compiler checks, CI order and ignored generated files. Do not commit
`next-env.d.ts`, add wildcard `any` declarations, suppress TS errors, or move the
typecheck behind the build. Existing fresh-checkout CI is the continuing automated
regression gate. Verify the command before any dev/build in an isolated Git export,
then run affected units/lint and push the correction to the same PR. No new review
round, deployment, database or provider action is authorized by this correction.

Correction verified: Git-only export of `3062816` plus the package-script edit,
using the already installed locked dependencies and no `next-env.d.ts`/`.next`
artifacts. Original command failed with exactly the three PNG TS2307 errors;
`next typegen && tsc --noEmit` passed and generated both route validators and the
framework image declaration reference. Logs: `/tmp/nak88-ci-types-{red,green}.log`.
Lint and 20 affected frontend/metadata unit tests pass
(`/tmp/nak88-ci-typegen-{lint,units}.log`). No runtime, asset, dependency, lockfile,
compiler strictness or CI-order change. Existing clean-checkout hosted typecheck
remains the regression gate; the hosted rerun is pending the corrected push.
Scoped lesson: do not use a previously generated local `next-env.d.ts` as evidence
that a pre-build compiler command works from a clean checkout.

### CI browser correction contract — full integrated suite

Hosted run `39626961973` at `9bb05e6` passes quality (audit, lint, generated
types, full unit coverage and build), pgTAP and secret scanning. The required
aggregate gate fails because all three browser projects fail. Earlier focused
browser checks did not exercise the full integrated suite.

Correct stale legacy assertions for the approved Vivara headings, CTA, synthetic
demo portrait and explicitly scoped Kannada calligraphic font. Preserve signup
navigation, reduced-motion, primary font preload, disclosure and contrast checks;
the existing empty-photo unit regression remains required. Fix actual intrinsic
width overflow in anonymous access verification and BrokerDesk metric cards at
320px, and restore the desktop login's 720px fit through compact spacing, without
shrinking controls or clipping reflow. No authentication or disclosure rules change.

Verify all three complete Chromium projects, not just the prior selected files.
Retain CI's one-worker, 15-minute per-project budget, retries and aggregate gate.
Do not increase overflow tolerances, hide overflow, skip failing routes or remove
the font/contrast audit. This correction does not authorize another independent
review round, production calls, migrations or deployment.

Correction evidence (21 October 2026):

- Complete desktop Chromium run executed all 250 cases with one worker, no local
  retries and the unchanged 900-second global budget: **245 passed / four existing
  skips / one stale title assertion failed**, in 8.3 minutes. Both overflow routes,
  nine-width inventory, enlarged-text auth, theme/contrast audits and demo image
  checks passed. Log: `/tmp/nak88-ci-repair-chromium.log`.
- The previously unreached `touchpoint-polish` title check still expected the
  pre-Vivara home title. Corrected only that expectation and reran the full title
  journey on all three projects: **three passed**, including protected-page tab
  titles. `/tmp/nak88-ci-repair-titles.log`. Do not describe the earlier desktop
  run as an entirely green run; the immutable pushed revision still needs hosted
  full-matrix evidence.
- **61 affected unit tests** pass, including empty-photo fallback and access
  verification. Lint, canonical generated-type check, strict zero-exception
  dependency audit and production build pass. Logs:
  `/tmp/nak88-ci-repair-{units,lint-final,types,audit,build}.log`.
- Batched rendered inspection confirms 1280x720 login fit, zero overflow on the
  corrected 320px screens, and retained 44/48px controls. Metric cards stack at
  360px and below to preserve readable labels. Access email/code inputs now
  constrain intrinsic width rather than clipping content. No domain rules change.
- Single Impeccable scan reports nine existing aesthetic warnings on unchanged
  global declarations, none on the correction. Graphify is unavailable.
  `.impeccable/` remains untracked and excluded. Review-round budget remains
  exhausted; final independent approval and physical/screen-reader checks remain
  separate outstanding gates. No CI timeout, retry, tolerance, skip or required
  gate change is made.

Scoped lesson: an integrated browser run must include legacy presentation tests
as well as new feature specs. A focused pass is not full-suite evidence, and a
failed aggregate check does not mean its already-green quality dependency failed.

### Spacing-contract follow-up

Hosted run `39633148944` at `6010333` passed audit/lint/types and database
verification but failed one unit: `shared-presentation.test.ts` correctly rejects
12px panel padding and 4px divider margins against the eight-pixel spacing scale.
The 61 selected units did not include this cross-cutting contract. This is a
deterministic correction defect, not a flaky test. Build was skipped in that job.

Restore 16px panel padding and use zero divider margins. The combined vertical
space is unchanged from the tested compact form; every spacing value now follows
the existing scale. Do not amend/relax the design-system test. Full local unit
coverage now passes **201 files / 1,683 tests**, all **61 feature / 21 protected
floors** (`/tmp/nak88-ci-repair-coverage-final.log`). Login fit and doubled-text
regressions pass in both themes across all three projects: **nine passed**
(`/tmp/nak88-ci-repair-spacing-browser.log`). Require the new immutable hosted
revision's full quality/browser gates, not a rerun of only the failed assertion.
Fresh lint and production build also pass
(`/tmp/nak88-ci-repair-{lint-last,build-final}.log`).

### Hosted runtime distribution correction

Run `39634165343` at `c26a387` passes quality (all 1,683 units/coverage/build),
database checks, secrets and desktop Chromium (**246 passed / four existing
skips**, 14.2 minutes). Tablet and mobile have **zero assertion failures** but
reach the unchanged 900-second global deadline: tablet 219 passed / three skips /
28 not run; mobile 209 passed / 41 not run. Local desktop's 8.3-minute runtime
did not predict hosted emulated-device runtime. Do not call these complete passes.

Distribute each of the same three projects into two Playwright shards on isolated
hosted runners. Retain one worker per runner, all tests, existing skips/retries,
15-minute global and 30-minute job budgets, unconditional uniquely named report
uploads, fail-fast false and the fail-closed `needs: [quality, browser]` gate.
The live main ruleset was read: required contexts are the aggregate
`Lint, Test, Coverage & Build`, `Supabase migrations and pgTAP`, and
`TruffleHog Secret Scan`; none is renamed or weakened. No branch-rule write.

Before pushing, extend workflow-contract regressions and compare actual
Playwright discovery for unsharded versus both shards of every project: equal
test identity unions, disjoint partitions, no missing or extra cases. Then require
all six hosted shard jobs and the unchanged aggregate gate to pass. This changes
CI distribution, not runtime application code or release/review requirements.

Partition verification passes for all three projects: **250 = 125 + 125** in
each, zero overlapping/missing/extra test identities. Discovery uses the actual
installed Playwright CLI with `--list --reporter=json`, not a file-count estimate.
`/tmp/nak88-ci-shards-discovery.log`. Workflow regression fails before the YAML
change and passes afterward; **19 workflow/type-verification unit tests** and lint
pass (`/tmp/nak88-ci-shards-{red,green,lint}.log`). Runtime source and dependency
versions are unchanged from `c26a387`'s passing hosted quality/build. The next
hosted run must execute all six shards; partition discovery is not execution.

### No-JavaScript navigation regression

The sharded run `39637291748` exposes a single desktop no-JavaScript test timeout.
Trace of the initial attempt shows `page.goto("/")` beginning at 511103ms and
never completing before the 30-second test deadline; **no content assertion ran**.
Two Next image-optimizer requests remain pending. The `finally` context-close
error is secondary, not evidence that content assertions completed or that the
browser crashed. Do not change CSP in response to unrelated analytics warnings.

Use the existing bookshelf test's project-managed `test.use` / `page` fixture
pattern, retaining actual device options for every project. Wait for
`domcontentloaded` and then explicitly assert every existing SSR section and
native FAQ keyboard action. Retain real no-JavaScript coverage and add a separate
held-image regression that fails under load-event navigation, so image work cannot
prevent testing already-available copy. Do not raise test timeouts, drop content
checks or mock away images in the real no-JavaScript case.

Mobile shard 2 also exposes an incorrect total-write assumption in onboarding:
its trace records a valid incomplete draft (`first_name: ""`) at 16:46:34.659Z,
then the final `first_name: "Mary Jane"` draft at 16:46:37.056Z. Those are different
revisions, not duplicated writes. Capture persisted names, deliberately exercise
the earlier autosave in the 1440px cases, wait for acknowledgement of the final
name and require exactly one write for that name plus zero additional writes
from manual Save. Do not weaken application revision guards or alter autosave.

That mobile shard's nine-width inventory alone took 8.5 minutes. Use three
shards per project to separate more of the heavy onboarding/presentation work
from that inventory, preserving the same budgets and all device scale factors.
Recheck discovery identity unions after the additional delayed-image regression.

Artifact inspection also confirms each 3840px mobile diagnostic PNG is
**10080x5670 (57 million pixels)** because the emulated DPR is 2.625. Export only
the two heavy audit files' diagnostic screenshots at CSS resolution; retain the
actual browser DPR, viewport/theme matrix and every interaction/geometry check.
Add an explicit inventory assertion of the configured DPR. These are diagnostic
captures, not pixel-comparison baselines; no image-comparison tolerance changes.

Verification of this correction:

- Held-image navigation regression reproduces the same default-load timeout
  (`/tmp/nak88-ci-nojs-red.log`); all **27 repeated landing/no-JavaScript executions**
  pass across all three projects after the fix (`/tmp/nak88-ci-nojs-green.log`).
- The deliberate earlier-autosave case reproduces the erroneous global-write
  assertion (`/tmp/nak88-ci-save-red.log`); all **12 repeated 1440px/theme/project
  onboarding executions** pass with final-revision and no-extra-manual-write
  assertions (`/tmp/nak88-ci-save-green.log`).
- After CSS-resolution diagnostic export, **five focused mobile checks** pass,
  including both onboarding themes, access, BrokerDesk metrics and every editor
  section across nine widths/two themes. The DPR assertion remains 2.625 while
  the 3840px capture is now 3840x2160. `/tmp/nak88-ci-capture-green.log`.
- Full local coverage: **201 files / 1,683 units**, all 61 feature / 21 protected
  floors pass. Lint, canonical types and 112 focused dashboard/workflow units
  pass. `/tmp/nak88-ci-lifecycle-{coverage,lint-final,types-final,units}.log`.
- Actual discovery rechecked: **251 = 84 + 84 + 83** per project, no overlap,
  missing or extra test identities. `/tmp/nak88-ci-lifecycle-discovery.log`.
  The three new executions are the delayed-image case across three projects;
  no original test was removed. Nine hosted shards must all pass on the pushed
  revision. Application source is unchanged from the passing hosted quality/build.
