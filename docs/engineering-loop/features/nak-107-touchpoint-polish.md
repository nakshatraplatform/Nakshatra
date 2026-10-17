# NAK-107 consumer touchpoint polish

## Contract — October 17, 2026

Compact, Standard-risk follow-up on merged `d99e14c`. User approved portfolio
logo home links opening a new tab, warm terminology, WhatsApp text and consistent
tab titles. Full published name is preferred. Omit all promises that the link
is continually maintained or includes unpublished edits.

Preserve CSS, layout, font/palette tokens, required fields, publication consent,
readiness/liveness checks, account binding, permission decisions, expiry and
revocation. Keep internal enum/API/route names and precise legal text unchanged.
Google branding/custom domains, paid services and production changes are excluded.
Preserve the unrelated local NAK-102 document edit. No push or deployment requested.

## Evaluations and implementation context

1. Portfolio navbar/footer/modal home links open a safe new tab and announce it;
   ordinary application home links remain same-tab. Unit and browser checks must
   reject missing `_blank`/`noopener` and navigation away from the introduction.
2. WhatsApp summary is generated on the server from the canonical public projection
   of published data only: full name, age, public profession/location if present.
   Never fall back to draft or include contact, birth date, street/postal details.
   Unit checks cover missing/private fields, full name and no maintenance promise.
3. Consumer copy uses Share details/Interest/Private details/Stop sharing without
   changing statuses, action payloads, conditions or 15-day timing. Existing owner
   decision and viewer-access tests retain their assertions with approved labels.
4. Titles use the root `%s | VivIntro` template exactly once; public introductions
   use first name and unavailable pages remain generic/noindex. Browser checks
   verify rendered titles and unchanged responsive/theme presentation.

Verified entry points: `VivIntroBrand.tsx`, `PortfolioNav.tsx`, `PortfolioFooter.tsx`,
`InterestRequestModal.tsx`, dashboard server page/client, public portfolio metadata,
landing/guides/editor/viewer copy. Reuse `resolvePublicPortfolio` rather than
adding a second disclosure policy. Pure share formatting lives at the portfolio
boundary; no new database or external API contract.

Status: implemented and verified locally on `fix/nak-107-consumer-touchpoint-polish`.
Regression-first brand navigation and share-message
checks failed on the old behavior as intended. Account title browser coverage now
uses the account fixture and requires real account content rather than accepting
an error page that happens to retain metadata.
Canonical public resolver output supplies full name, age, public career/location;
the client fallback contains only the link and neutral text, never draft identity.
The additional dashboard RPC reads public data only. Customer display status labels
are shared by dashboard and retained-interest panels; stored statuses are unchanged.
No CSS, palette/font configuration, migration or provider settings changed.
Actual email/provider/physical-device and hosted release checks are outside this
local task. There is no migration to apply for this change.

## Verification and review

- Initial full coverage run: 1,381 tests passed, global statements 85.84%, branches
  80.80%, functions 84.71%, lines 89.45%; all 59 feature gates passed unchanged.
  Two subsequently added dashboard-boundary tests also passed, using distinct
  unpublished, stored-private and public-resolver identities. Focused 35 tests
  passed after the final marketing/metadata copy delta.
- Final complete run after all copy and assertion updates: 1,383 tests passed in
  181 files, zero failures; statements 85.87%, branches 80.82%, functions 84.76%,
  lines 89.48%. All 59 feature gates passed again. One old Didit-return sentence
  expectation was updated to the new non-authoritative wording, and an additional
  assertion retains secure result-checking semantics. No verification rule changed.
- Browser batch 1: 39 passed; three expired-heading expectations still used old
  wording. Corrected to “Sharing period ended”, keeping expiry, recipient binding,
  unavailable-state and guide-link assertions. The expanded batch then passed all
  75 cases on desktop/tablet/mobile, covering the corrected paths, authentication,
  publication refusal, public/private boundaries, focus and draft recovery.
- Final editor/shared-brand batch: all 27 cases passed with the existing contrast,
  keyboard, responsive, hover, focus and modal thresholds. Earlier new touchpoint
  cases passed in all projects, exercising a real separate-tab home navigation,
  rendered titles and locally intercepted WhatsApp popup text (nothing sent).
- Lint and typecheck passed. Production `npm run build` passed, including typecheck
  and generation of all 81 static pages. CSS/font/palette and API/SQL diffs are empty.
- Fresh-context `touchpoint_review` reviewed source and tests read-only from packet
  `8a4a0ad63f2386afd129abae0e28617e1802cf2d53255998e41d09ce7e2c4687`, base
  `d99e14c`; core, test-strengthening and final copy-delta rounds found no material
  findings. Actual model identifier unavailable; not a cross-model review. The
  reviewer’s minor remaining tour-caption wording was subsequently corrected by
  the coordinator; final browser contrast/layout checks include that correction.
- Graphify code update completed; SQL extraction remains unavailable because the
  optional `tree_sitter_sql` dependency is absent. No SQL changed in this task.
- The unrelated NAK-102 document remains byte-identical to its initial dirty
  snapshot (SHA256 `70427AFB1F6B15FC5A45F374AB3934CCDED3F2D235F2ECBCA256F50AF8A24DF4`).

The user has now authorized committing, pushing and opening PRs. Package these
changes with the approved PDF application feature; keep its database migration
in a separate PR. Hosted CI, real email/provider flows and physical-device checks
are not asserted by local fixtures. No production deployment or provider-console
configuration is authorized by this packaging step.
