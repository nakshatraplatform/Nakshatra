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
