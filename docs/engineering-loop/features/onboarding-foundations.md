# Onboarding foundations and real-user feedback

## Contract and source

October 17, 2026, based on merged main `fc7f55c` (PR #108). Branch:
`fix/nak-107-onboarding-save-stability`. This record extends the consumer
onboarding work without changing the existing visual system or restoring PDF.
Significant review depth for editor state/persistence interactions. The first
increment is application-only; changes to publishing requirements remain separate.

User-confirmed decision: incomplete private autosave and Save draft remain
available. Continue and publication should validate required answers. A strict
publication rule is not a reason to discard incomplete private work.

## First increment — editor/save stability

1. Routine save/media refreshes must not remount an active editor/final review.
   Reconcile queued server refreshes after explicit exit. Retain fail-closed,
   intentional stale-review recovery and authoritative publication checks.
2. Preserve whitespace while typing a multi-word first/middle/last name; existing
   save normalization and validation remain. This does not yet add Unicode names.
3. Show the Basics count as Basics checks, not requirements for every section.
   Mobile optional sections show their own status rather than the Basics count.
4. An untouched empty location must not generate a contradictory-location error.
   Missing required answers and genuinely inconsistent locations remain invalid.
5. Preserve fonts, colors, layout structure, authentication, liveness, publication
   consent, public/private projections and revoked/expired access behavior.

Verified locations: `BlueprintForm.tsx` owns editable values and navigation UI;
`dashboard-client.tsx` owns draft/media mutations, review and refresh; dashboard
`page.tsx` intentionally keys server revisions; `form-contract.ts` validates
drafts/publication. Do not remove the revision key to hide refresh problems.

## Evaluations

| Criterion | Check | Wrong implementation rejected |
| --- | --- | --- |
| Multi-word names | Stateful BlueprintForm typing regression | Trailing space trimmed on each render |
| Editor survives save | DashboardClient save/exit regression | Server refresh issued before leaving editor |
| Privacy and freshness | Existing stale-review, failed-save, liveness, consent tests | Deferring stale-revision recovery or accepting stale consent |
| Empty location | Authoring contract empty/mismatched cases | Empty draft reports mismatch, or nonempty mismatch accepted |
| Responsive interaction | Loopback Playwright desktop/tablet/mobile, both themes | Lost input, refresh while editing, overflow, wrong section count |

Initial regressions observed: a typed `Mary ` became `Mary`; saving issued a
server refresh before exit. Both failed before correction and pass afterward.

## First-increment verification

- Focused form/dashboard/contracts/readiness: 122 passed. Full unit suite:
  1,410 passed across 185 files on the final runtime source. After that run,
  the existing save/exit regression was strengthened to request two deferred
  refreshes, enter final review, return to editing and exit with one refresh;
  the strengthened regression and normalized-name autosave regression pass.
- Focused ESLint, typecheck and diff whitespace checks pass. Production build
  passes with loopback configuration (81 static pages). The first build caught
  an unsupported Testing Library `exact` selector option in the strengthened
  test; removing that invalid option restored the build without changing any
  application behavior, test assertion, timeout or threshold.
- Loopback Playwright: 10 passed (320, 390, 768, 1024 and 1440px, light/dark),
  traversing all seven sections and recording 70 screenshots. Representative
  screenshots inspected: small-mobile Basics, mobile dark Contact, tablet Story,
  laptop Preferences and desktop dark Family. No stylesheet/font changes.
  Save transport is mocked; actual database persistence, OAuth and provider
  delivery are not established by these browser checks. These are Chromium
  responsive checks, not physical iPhone/Safari evidence.
- Fresh-context static review used an isolated source copy; model identity
  unknown, no execution by reviewer. No confirmed material regression. Runtime
  hashes match the reviewed snapshot. Subsequent changes strengthen one test
  and clarify this record only. Reviewer observation OFR-N1 is resolved by
  clarifying that requested refreshes are queued: autosave itself still uses
  `refresh:false`, as before. It does not introduce periodic server refreshes.
- Existing stale-review, consent, liveness and newer-edit/in-flight-save tests
  remain intact. No authorization bypass or CI threshold/timeout changes.
- Graphify AST updated; optional SQL parser is unavailable, so SQL was inspected
  directly rather than claiming graph coverage of migrations.

Evidence lesson: never normalize controlled-name values on every keystroke or
replace active input with a normalized save response. Similarly, a keyed server
projection must not remount an active editing session for a routine mutation.
Preserve intentional conflict recovery instead of simply removing revision keys.

## Second increment — approved contract (October 17, 2026)

Critical review depth because the canonical SQL publication checklist changes;
full contract/evaluation detail is retained here. Family and Astrology remain
optional. No new two-per-section quota or additional mandatory contact in this
increment. Existing owner/liveness/consent/session/photo/location safeguards stay.

- Validate forward navigation consistently (Continue, mobile arrows/select and
  desktop section navigation). Allow backward correction and incomplete private
  saves. Before final review/publishing validate all required answers. Never
  submit/publish through a client-only gate when the backend rejects the data.
- Show an actionable error summary with field links, open/focus the affected
  section, associate inline messages/aria-invalid, and retain API field errors.
  Missing text/select answers say `This field is required.`; invalid supplied
  answers have specific correction guidance. No errors on untouched startup.
- Remove street-address collection from the onboarding UI and its required
  checklist entry. Preserve any historical stored address values without
  disclosing/deleting them. Remove only the three optional narrative minimums;
  retain maximum lengths and validation of genuinely invalid supplied values.
- Add a forward-only migration replacing the latest canonical checklist, removing
  only private_address and the three 1–79-character checks. Preserve every other
  SQL guard, grants, privacy projection and publication transaction. Database
  deployment remains separate and is NOT authorized by local implementation.
- Account settings derives names from the authenticated owner's validated,
  complete self-created saved draft. Make that source explicit and provide the
  existing Edit introduction route instead of a second editable name record.
  Accounts without that complete self-created name retain the existing account
  metadata/name editor. No Auth metadata writes on autosave and no candidate-name
  override for a delegated/non-self portfolio. Only own records may be queried.
- Document dropdown standards and exact inventory/proposals separately from
  implemented choices. Do not silently change sensitive taxonomy, eligibility,
  legacy stored values or add matching behavior. Report an honest audit ledger.

Evaluation plan: reproduce Continue/sidebar bypass and absent inline errors;
check empty/invalid/corrected answers, keyboard field links, backward navigation,
incomplete save preservation, optional sections, short optional narratives,
missing address versus real DOB/location/photo failures; field-path API retention;
own/self account name derivation/fallback and read-only source indication; pgTAP
short-narrative/address guard tests plus migration replay when available; responsive
light/dark browser passes, full unit/static/build checks and fresh isolated review.

## Second-increment implementation and review evidence

Implemented locally: `editor-validation.ts` combines schema issues and the
canonical readiness checklist; Dashboard applies the same forward guard to
Continue/sidebar/mobile controls, and validates before review/publication.
`PortfolioFieldValidation.tsx` supplies field guidance to existing inputs and
composite location/photo/phone controls. API errors retain every dotted field
path; location aliases target one stable composite control in search, manual
and confirmed modes. Missing required answers never prevent an incomplete
private Save draft. Existing provided-value validity rules still apply.

Street inputs and the required checklist item are removed; legacy values are
not erased or disclosed. Three narrative minimums are removed from authoring and
the forward-only `20261017220000_simplify_portfolio_publication_fields.sql`.
Maximum lengths, adult dates, canonical location, photo, function privileges,
consent, revision and public/private projection rules remain. The Basics checklist
now has ten checks; that is not a field quota for other sections.

Account settings reads only the authenticated owner's draft, passes only explicit
complete self-created name parts, and makes the source read-only with an Edit
introduction names link. No Auth/provider identity update or privileged write is
performed. Incomplete/delegated/absent names retain the existing Account flow.

Before implementation, two regression checks failed as expected: navigation
escaped Basics despite missing answers, and concise optional narrative text was
rejected. Both pass after the intended contract change. Tests requiring old
address/minimum rules were changed to assert the approved new rules, not skipped.
Failed-save recovery tests now edit Short description rather than a removed
street field, retaining their discard/latest-successful-save assertions.

Fresh-context independent review (Codex, exact model unknown) used immutable
isolated copies, not the implementer's conversation or a HEAD-only worktree.
Original review snapshot: `vivintro-onboarding-validation-review-a2239b7febcc40f2917de620d7c42792`
under the host temporary directory; comparison base archive is `fc7f55c`.

| Finding | Classification / origin | Evidence and resolution |
| --- | --- | --- |
| OVF-1, P2 | Confirmed, introduced | Composite photo focus selected the sr-only file input. Preferred visible primary/visibility actions now receive focus and describe the actual error; no-photo and gallery-photo regressions pass. A first attempted selector correction selected Delete photo; the stronger test rejected that and the final preferred-target selector avoids deletion. |
| OVF-2, P2 | Confirmed, introduced | Split phone and location controls lacked error anchors/associations. Phone wrapper passes the exact error; local/API location paths collapse to the group, whose search/manual/confirmed corrective controls describe it. Phone and both location-mode regressions pass. |

Return review round 2 independently rendered no-photo/gallery/private-hero,
invalid-phone and search/manual location controls and resolved both findings.
Final round 3 reviewed the narrow API location alias/confirmed Change correction,
independently mapped API city/state errors and checked its rendered description.
No further material finding confirmed. Reviewers did not run pgTAP or deploy.

Final reviewed runtime snapshot:
`vivintro-onboarding-validation-review-api-2e9cc000bbe8497f950e5870b8c0dd70`.
Core SHA256 hashes (uppercase/lowercase immaterial):

- Dashboard: `f8f9cb5954142c1829824a6feb6846b2388228934812c65b15b55096c716366b`
- Blueprint: `5cf1b76b270418e4895ad0f065941cc002600179a9f08991c891cdefa0fc6380`
- LocationFields: `daf6cfba5868efb300ce19f083cd0ecc561a5200ff91adaf762ab75f6fa39153`
- Editor validation: `5302466b5ff27e4d5a0c5c0b2e55267b2ccfa1e40516b47d5fca273da6444278`
- Forward SQL: `b2d9ce70b45de496344d5445a15dded37db39b596a0be03bf9c1948aa77a1cd2`

Final-snapshot validation (runtime hashes match the reviewed copy):

- `npx vitest run --coverage --maxWorkers=2 --reporter=dot`: **1,423 passed**
  across 185 files. Coverage: statements 86.11%, branches 81.22%, functions 85.11%,
  lines 89.72%; existing thresholds are unchanged.
- `npm run coverage:check:features`: passed for 59 feature mapper/service/contract
  files at the existing 80%-per-metric gate.
- Final Dashboard/Blueprint/shared location focused checks: 113 passed.
- `npm run lint`, `npx tsc --noEmit`, `git diff --check`: passed.
- `npm run build` with loopback public configuration: passed, 81 static pages.
  Temporary custom build-cache output was moved to a host temporary folder and
  generated configuration edits were removed; no source configuration change
  is part of the feature.
- `npx playwright test e2e/onboarding-foundations.spec.ts --project=chromium --workers=2`:
  **10 passed**, 320/390/768/1024/1440px × light/dark, including missing first-name
  focus/correction, saves, all seven sections and explicit exit. Recorded 80
  screenshots. Final run emitted Next dev closed-stream/ECONNRESET logs around
  navigation/teardown; assertions passed. These logs are not a database/provider
  check and are not described as a clean production runtime.
- `npm run db:smoke`: passed (migration names/order and test fixtures/assertion
  counts; not SQL execution).
- `graphify update .`: passed; optional SQL parser remains unavailable. SQL
  parity was inspected directly by implementer and fresh reviewer.

Database replay and pgTAP are **blocked locally**: Docker is not installed/on PATH.
Added SQL cases cover absent addresses, blank/concise narratives, retained maxima
and future DOB; existing geography/privacy/photo tests are preserved. Static
comparison confirms the replacement SQL body changes only the agreed checks,
but this does not establish successful execution. Release remains pending
authoritative database CI. Do not deploy app-only loosening against an unchanged
production checklist and describe it as complete. After passing CI, coordinate
the forward database change before the dependent app release; no production
deployment is authorized here. Do not roll back by silently reintroducing minima
that newly published introductions no longer satisfy.

Design comparison: no font, stylesheet, token, portfolio navigation or photo-art
changes. Existing form surfaces/focus styles host the new guidance. Responsive
screenshots were inspected at mobile light and tablet dark; browser checks are
Chromium with loopback/mocked persistence, not physical Safari/OAuth evidence.

| Before | After |
| --- | --- |
| Generic/missing correction guidance and forward section bypass | Linked field guidance, visible correction focus and forward checks |
| Street address and optional 80-character narrative gate | No street collection; concise optional answers within unchanged maxima |
| Account name record could drift from self-created form | Saved self-created name parts displayed with one editing route |

## Remaining user requests — not represented as completed

The exact dropdown inventory, recommended changes and consolidated status ledger
are in [onboarding options and feedback](onboarding-options-and-feedback.md).
The follow-on [options/save-efficiency increment](onboarding-options-and-save-efficiency.md)
implements the bounded dropdown/Other, sibling protection and request-coalescing
subset. The list below is the earlier backlog; consult that ledger for current status.
The requests below remain backlog, not implicit additions to this increment.

- Review the new-account OAuth landing state: an untouched initialized record
  should not be presented as a meaningful saved introduction; give one start CTA.
- Propose useful required answers per section, not an arbitrary count. User wants
  stronger non-descriptive detail; exact matrix needs approval before adding
  requirements that can invalidate existing published profiles. Story remains
  optional; do not force sensitive religion/community/astrology answers.
- Propose familiar marital-status options and handle older stored values.
  Separate relationship status from publication eligibility; do not invent law.
- Improve profession capture with work-status choice plus contextual title.
- Refine optional story questions/examples without filler or hard minimums.
- Audit every dropdown; community becomes a controlled choice with conditional
  Other text. No universal/exhaustive community taxonomy is assumed.
- Respect Indian/diaspora religion and community sensitivity with opt-out choices.
- Remove Only Child from sibling-position choices; zero siblings conveys it.
  Protect sibling-row answers when count changes.
- Improve primary-photo selection, private visibility explanation and deletion
  confirmation/undo. Align HEIC support without removing safe decoding limits.
- Require one usable private contact only after agreeing contact identity,
  verification expectations and fallback; extra contacts optional. Never public.
- Audit email/phone boundaries application-wide; distinguish syntax from verified
  ownership. Do not add duplicate OTP steps or reject valid international numbers.
- Location preferences: scope saved preference capture versus automatic matching
  separately; no location-based ranking/eligibility change inferred.
- Remove the editor's early Preview action; keep optional review previews.
- Successful publication returns to Dashboard; preserve clear saved/public state.
- Clear liveness success message and confirmation email: inspect existing
  completion-notification/outbox implementation before adding another sender.
- Registration/OAuth name defaults for accounts without a complete self-created
  name remain separate; this increment uses saved self-created form names only.
- Compare 320/390px mobile, tablet, small laptop and desktop; light/dark themes,
  keyboard/focus, validation, slow/offline saves and recovery. Physical iPhone
  and actual OAuth/provider/email delivery remain separate evidence.

## Delivery boundaries

No push/PR, merge, deployment, production SQL, new account action, or external
email is part of this increment. No claimed live production verification.
Linear updates require verified `linear_phoenix` / Phoenix works / Nakshatra;
this local record does not claim an unverified Linear write.
