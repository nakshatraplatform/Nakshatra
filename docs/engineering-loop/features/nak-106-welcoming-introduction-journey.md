# NAK-106 welcoming introduction journey

## Execution context

2026-10-16. Implement and review, full record. Base `888b70e`, branch
`fix/nak-106-consent-publishing-flow`, with the earlier consent-first changes
still uncommitted. Preserve them and the unrelated NAK102 feature-document edit.
This increment changes copy and form recovery, not publication/access eligibility.
Risk: Critical for the bounded authentication return-path extension; no production
mutation, migration, commit, push, or release is authorized by this request.

## User contract

Make creating/sharing a live introduction easier and more welcoming than static
biodata PDFs. Apply the user's October 16 revised landing copy without changing
the existing layout, section/anchor structure, typography, artwork, themes,
spacing system, or interaction design. The supplied document is copy/design
input, not authority to change data visibility, promise features, or certify law.

The copy document proposes seven sections and a parent waitlist, which conflict
with preserving structure and introduce new data collection. Keep current
sections and anchors, fit the revised wording to their existing roles, and
explain current family help without collecting emails. The user confirmed that
only individuals can create now and family-started introductions are coming soon;
this permits that copy, not a launch date or a new waitlist.
The subsequent NAK-107 PR clarification makes this explicit: the upcoming feature
is a parent, sibling, or other family member creating a profile on behalf of the
individual getting married, not a profile for an entire family. Creation authority
and featured-person verification remain unchanged in this copy-only clarification.
Preserve precise public/protected/owner-private disclosure even when simplifying
the labels to introduction/private details. Do not imply screenshots can be
recalled or every saved answer becomes visible after approval.

Keep optional previews followed by fresh, explicit publication consent. Align
related instructions; preserve server readiness, saved-revision checks, liveness,
owner approval, account binding, expiry/revocation and rate limits.

For interest: About you; Who are you contacting for?; Introduce yourself. Candidate
fields appear only for a represented person; candidate name mandatory and other
candidate details optional as already implemented. Keep required phone/location/
family-context rules, as explicitly confirmed by the user. Make the extra message
clearly optional. Reuse authenticated details; expose normal account sign-in,
not Google-only reuse or a redundant typed email before Google. Preserve input
through back/close/reopen/errors in the current page session, without putting
personal details in local/session storage or URLs. Submission remains explicit;
verification or reopening must never silently send an incomplete request.

Preserve safe destinations through password recovery. Explain what happens after
verification and sending; retain resend cooldown, paste/autofill and failure
recovery. No parent-owned portfolios or reduced security/eligibility in this work.

## Design and responsibility map

Preserve mode, design variance 3 / motion 2 / density 4. Native existing CSS,
Inter/Plus Jakarta, ink/gold/sage, Lucide, portrait artwork and responsive split
modal remain. Taste guidance applies to landing chrome only; product forms use
the maintained flow patterns. No new imagery, animation, UI library or dependency.

- LandingExperience / GuidedTour / home metadata / OG image: copy in the existing
  wrappers and routes. Seven FAQ answers appear once; trust section retains
  concise assurances rather than another question list.
- AuthForm / dashboard / BlueprintForm / viewer guide / relevant notifications:
  consumer wording only; internal schema/API/event identifiers stay unchanged.
- InterestRequestModal / VisitorInterestFields: keep page-session form state
  mounted while hidden and during verification; close must not discard answers.
  Explicit successful submission clears the form; browser reload persistence is
  not promised. Hidden forms must not participate in keyboard focus traversal.
- Auth start gateway / auth client / password reset page and component: optional,
  bounded same-origin continuation, with existing default destinations retained.
  No provider credentials, authentication proof or authorization rule changes.

## Evaluations

| ID | Outcome and cases | Check / wrong implementation rejected |
| --- | --- | --- |
| WJ1 | Revised hero, honest privacy/price/family scope, seven FAQ answers, metadata/OG match; all current section anchors/order/styles remain | Landing component and browser checks; reject layout replacement, old duplicate FAQ or unsupported family launch promise |
| WJ2 | Previews optional; consent initially unchecked; incomplete/stale/unverified publication denied | Existing dashboard/server tests plus copy inventory; reject fabricated preview visits or skipped readiness |
| WJ3 | Familiar labels, conditional candidate, optional message; same validated payload and signed-in reuse | Component/API contracts; reject making candidate contacts mandatory or changing identity from typed email |
| WJ4 | Incomplete text/phone/candidate/location survive close, Escape, verification back and failure; no duplicate sends | Regression-first component/browser journeys; reject payload-only snapshots, hidden-tab focus, or localStorage persistence |
| WJ5 | Account sign-in resumes the personal introduction; recovery returns there; unsafe return destinations fall back | Auth component/route/reset tests; reject loss of nested destination/hash or an external redirect |
| WJ6 | Mobile/desktop, both themes, keyboard/reverse Tab, actionable OTP errors, no clipping | Affected responsive browser checks and screenshot inspection; real-device/provider limits explicit |

## Verification and progress

Implementation complete locally; verification results and review provenance follow.
The landing CSS module, section anchors/order, four tour cards, artwork and fonts
are unchanged. Consumer-visible terminology is aligned across the affected
dashboard/editor, previews, viewer guide, access landing, auth, and personal-link
notifications. BrokerDesk terminology is intentionally not changed.

Regression evidence: the initial new journey checks failed on the old account
choice/labels; these early failures do not independently establish every later
state-retention assertion. Recovery destination tests separately failed before
the return-path implementation. The first broad unit run passed 1,322/1,363;
failures included old-copy assertions and a real case-sensitive privacy-hint
regression. The hint is restored; checks still assert approval-only disclosure.
An intermediate focused run passed 178/183 before the remaining copy assertions
were corrected. No eligibility rule, test threshold or timeout was relaxed.

The first desktop/mobile browser run passed 43/48, including the new retained
answers/OTP-error/keyboard journeys and structure/theme checks. Four failures
used stale label selectors loaded before corrections; one loopback route fetch
reset during concurrent development. These are historical results, not the
final pass; the later broad batch, corrected-case rechecks and responsive runs
are accounted for below.

Graphify AST refresh completed: 2,167 nodes/6,552 edges; CSS is unsupported and
SQL extraction lacks tree_sitter_sql. No semantic/API update or new dependency.
Public rendering already reads cookies through the server client, and next.config
sets private/no-store headers for /p routes; the production build confirms dynamic
rendering. This increment does not change caching or signed-media expiry.
Real provider delivery, physical
iPhone Safari, hosted CI and production release are not locally verified.

Fresh-context review budget: three rounds maximum. No Linear write: the available
route has not been verified as Phoenix works / Nakshatra. No migration, production
write, commit, push or PR creation in this task. The unrelated NAK102 document
keeps its pre-task hash 70427AFB1F6B15FC5A45F374AB3934CCDED3F2D235F2ECBCA256F50AF8A24DF4.

### Current verification (2026-10-16, local)

- Standalone `npx vitest run --coverage --maxWorkers=1`: **179 files, 1,367 tests
  passed**. Statements 85.78%, branches 80.61%, functions 84.72%, lines 89.43%.
  All original global thresholds remain. `coverage:check:features`: all **59**
  mapper/service/contract per-metric gates passed.
- `npm run lint`, `npm run typecheck`, `npm run db:smoke`, `npm run build` passed.
  Build used installed Next.js 16.3.8. No real database replay was needed/run for
  this migration-free increment.
- The earlier overlapping coverage run passed 1,356/1,367 and had eight timeouts,
  an async follow-on missing-link assertion, an old WhatsApp phrase, and an
  ambiguous success-heading query. The two copy/query expectations were corrected;
  the standalone full pass above establishes resolution without relaxed limits.
- Final browser coverage: **89 passing cases across the broad run and targeted
  rechecks**: 71 desktop, 16 mobile/tablet core journeys, and the two mobile-only
  navigation matrices. The broad desktop batch had 64 passes, seven failures and
  two intentional mobile-project skips; all seven failed cases subsequently pass,
  and both skipped cases pass in their intended mobile project. No timeout,
  contrast, geometry or eligibility assertion was lowered and no skip was added.
  Commands selected the 14 changed/untracked E2E files on desktop, the three core
  journey files on mobile/tablet, and the two app-theme mobile-only cases.
- The three-case corrected recheck passed metadata/logo, seven-size review and
  contact alignment. The four-case final recheck passed bounded footer/modal
  cycling, the published-owner journey, and both publishing themes. Later local
  rechecks used `--trace=off` to reduce recording overhead; repository/CI trace,
  video and screenshot configuration stays unchanged. The interrupted run also
  contained a >1-hour host execution pause; it is not counted as passing evidence.
- New browser checks retain the original section order, four tour cards, seven
  FAQs, public/private/only-you boundary, form answers, and OTP-error recovery.
  Logo screenshot checks now wait for loaded artwork rather than only its wrapper.
  Light/dark modal screenshots were inspected; loaded logo, aligned fields and
  the existing split-pane layout are preserved. Real email delivery, physical
  iPhone/low-end Android and throttled-4G checks remain manual release evidence.

### Review and resolution ledger

Fresh-context source review round 1 checked snapshot
`73cf9dc5b00e8a8c4fa30f59d7d815cfc7872438bd1b5c2ace13fc109c8d56bc`
against base `888b70e`: no material findings. Reviewer model identity was unknown;
this was not cross-model review. Read-only behavior was instruction-enforced on
the shared filesystem, with successful start/end fingerprint checks. The reviewer
did not independently rerun tests or inspect screenshots. Test/copy assertion and
documentation updates since that snapshot were checked in round 2, snapshot
`9cdec50c13c9a8caae181b923a9a4ed263bd3d8bab9e68a108636a19cfe254dd`:
no material findings. Its eight-file delta contained only documents and tests;
production source, dependencies, CI and coverage configuration were unchanged.
Start/end fingerprint checks and diff hygiene passed. The reviewer independently
checked the coverage totals and preserved privacy-hint regression, but did not
rerun runtime checks. WJ-HINT-01 and WJ-TEST-01 are resolved within this scope.
This receipt-only update is the final bounded review delta; physical-device,
provider, hosted-CI and production verification remain separate release evidence.

WJ-HINT-01: confirmed, introduced, low severity, non-security visual regression.
Changing the displayed audience to `Optional · private details` broke a
case-sensitive help-text comparison in BlueprintForm. Case-insensitive matching
restores the existing approval hint; `blueprint-form` and the full coverage run
pass, including the explicit hint assertion. Data authorization never depended
on this helper. Lesson: when renaming displayed audience terms, check hint
consumers as well as field labels; retain the privacy-hint regression.

WJ-TEST-01: confirmed, introduced test/contract mismatch, resolved by the passing
rechecks above. The old footer cycle expected the visitor-choice screen after
every close; the required retention behavior resumes the details form instead.
The test now enters details once and asserts that state on later cycles. The old
review test expected checklist text at the scroll end; optional previews now
follow the checklist. It now scrolls the checklist item into view and separately
asserts that the disabled publish action stays visible at the end. Logo/home and
Review-and-publish selectors also match the approved flow. Focus, footer bounds,
minimum content height, contrast and disabled-action assertions remain in place.

The reviewer's reset-error link observation is a nonblocking copy refinement:
it also appears for local password-validation errors, but does not prevent
correction or discard input. No new logo-selection defect was confirmed.
