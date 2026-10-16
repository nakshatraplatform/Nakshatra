# NAK-107: welcoming journey integration

## Scope and authority

2026-10-16. User requested one PR containing the pending work from the prior
NAK-106 follow-ups, using NAK-107 for this integration. Fetched `origin/main` is
`888b70e0d789c2309029b24ae67805e0bd0d5588`, identical to the checkout base.
Branch: `fix/nak-107-welcoming-introduction-journey`.

The family clarification means a father, mother, sibling, or other family member
creating a profile for the individual getting married, not an entire-family
profile. That creator flow remains upcoming under the user's earlier explicit
decision. Landing FAQ and family copy now say so directly; this PR does not
implement representative ownership or change eligibility.

## Included work

- [Consent-first publishing follow-up](nak-106-consent-publishing-followup.md):
  optional previews, one fresh publication consent, home-linked portfolio logos,
  aligned concise interest fields, and temporary removal of account JSON-download
  UI without removing the authenticated API.
- [Welcoming introduction journey](nak-106-welcoming-introduction-journey.md):
  revised landing/supporting copy and metadata in the existing design, conditional
  candidate details, optional message disclosure, in-page interest answer recovery,
  normal account sign-in and safe password-recovery continuation.
- Explicit parent/sibling-on-behalf wording and corresponding unit/browser checks.

Required fields, readiness/liveness, explicit consent, owner approval, account
binding, expiry/revocation and rate limits remain. No new migration, dependency,
CI configuration, font configuration or landing stylesheet change. Preserve the
unrelated local NAK-102 publication-access document edit outside the commit.

## Evidence and release limits

The prior integration record contains the complete review and verification
receipt: 1,367 unit tests, 59 coverage gates, 89 affected browser passes across
the broad run and corrected rechecks, lint/typecheck/build/static DB smoke, and
fresh-context review with no material findings. These are local evidence, not
hosted CI or production validation.

The NAK-107 delta is copy, corresponding assertions and this documentation only.
Focused landing/metadata tests: 9 passed in 2 files. The landing structure,
routes, four tour cards, seven FAQs, both themes and overflow checks: 3 browser
cases passed on desktop, tablet and mobile. No test limit or control relaxed.
Commit/push hooks must also pass without bypass. Hosted checks run on the PR.

This task authorizes committing, pushing a feature branch and opening a PR, not
merging, deploying, applying production migrations or promising a release date.
Physical-device and actual email/provider journeys remain separate release QA.
No new database deployment is required by this migration-free PR; earlier
production migration status is not re-certified here.

## PR105 browser-check correction

Compact Standard correction, October 16, based on PR head `abc9eb4`. The user
reported four failed checks on NAK-107 (GitHub PR105). Hosted run `38978710937`
passed quality/build and Supabase replay/pgTAP/type drift. Desktop and tablet each
had one browser failure (119 passed, three existing project-specific skips);
mobile had two (121 passed). The aggregate correctly failed closed because the
browser matrix failed; its workflow is not changed.

- NAK107-CI01, confirmed introduced test drift: `loading-feedback.spec.ts` still
  filled the intentionally removed Registered email field. Require its absence
  and exercise the unchanged Google request/loading/failure lifecycle. Google
  is now secondary, so assert the spinner inherits its button's themed color
  instead of requiring a light primary-action color. Preserve busy/disabled,
  visible SVG, stroke, animation, 24px sizing, portal theme and overflow checks.
- NAK107-CI02, confirmed introduced test drift: `public-trust-clarity.spec.ts`
  expected portfolio photo ownership instead of introduction photo ownership.
  Keep the semantic limit and additionally require the profile-statement and
  non-endorsement disclaimer. All six widths and both themes remain.
- NAK107-CI03, confirmed introduced presentation regression, reproduced locally
  after CI01 exposed later assertions: the secondary-action descendant SVG rule
  shrank the nested loading spinner to 15.1875px, violating the existing 24px
  assertion. Limit that icon rule to direct child icons. Nested progress owns
  its original size/animation; direct-arrow icons remain unchanged. Do not lower
  the size assertion or override reduced-motion behavior.

No authentication, publication, database, dependency or CI-policy changes.
No retries, timeouts, skip conditions or assertion thresholds relaxed. Focused
browser replay, lint/type/build checks and a fresh review of this shared CSS
correction passed locally. Earlier targeted
browser selection omitted these two existing files; full hosted CI caught that
coverage gap. Retain these callers in checks for future interest-entry/copy edits.

Correction verification: `npx playwright test e2e/loading-feedback.spec.ts
e2e/public-trust-clarity.spec.ts --workers=1` passed 16 cases across all three
configured projects, with the same two project-specific badge-matrix skips.
The six-width/two-theme badge matrix executed on mobile. Trace/video settings
and repository test configuration were unchanged. `npm run lint`,
`npm run typecheck`, `npm run build` and diff hygiene passed. Build generated
all 81 static routes. Graphify AST update completed without topology changes;
its existing SQL/CSS extraction limitations do not certify those file contents.

Fresh-context, instruction-based read-only review on the shared checkout found
no material findings at snapshot
`3604f5b6bebef50c8819ad56f9521544fd6b1ed7182cedb2f662e7da41c52a3a`.
Reviewer model identity is unknown. Start/end provenance and preserved NAK102
hash passed; reviewer inspected source/test contracts but did not rerun runtime
checks. This final receipt is the only post-review change. Hosted CI for the new
commit remains required; no merge/deployment is authorized.
