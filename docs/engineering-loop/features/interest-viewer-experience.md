# NAK-105 interest and viewer experience

## Execution context

Full record; Critical risk (owner-only personal data, OAuth context, database commands and Storage authorization). User request 2026-10-12; base `f46ccf1` (merged PR95). Branch `fix/nak-105-interest-and-viewer-experience`; NAK-105 is the existing user-supplied issue context, not a newly created issue. Preserve the unrelated dirty NAK-102 document. Implemented locally; database verification and release pending. Current check/review results are retained separately in [the evidence ledger](interest-viewer-review.md). No deployment or live submissions authorized.

## Problem and goal

Approved-access dashboard records omit the retained interest submission. Visitor forms waste mobile space and do not collect decision-making context. Viewer navigation and link controls need polish. Approved galleries must contain every authorized photo, never hidden/owner-only originals.

## Change contract and acceptance evaluations

| ID | Required outcome | Evaluation / wrong implementation rejected |
| --- | --- | --- |
| IV1 | Remove Lifestyle navigation only; icon Show Interest before hamburger, accessible tooltip, keyboard focus | Component/responsive checks reject duplicate textual CTA, missing accessible name or wrong order |
| IV2 | Floating Top after 35% of scrollable page, smooth with reduced-motion alternative, hidden around footer/bottom CTA | Browser checks at short/long pages and footer; no content obstruction |
| IV3 | Discoverable compact Manage link action group, existing destructive confirmations preserved | Dashboard component checks and responsive inspection |
| IV4 | Owner can reopen retained full submission from pending, approved, expired/revoked access records, with actual submitted/verified/granted timestamps and current status | Owner-only detail read keyed by request ID; no 50-record projection dependence, no name-based joins or fabricated timestamps |
| IV5 | Approved gallery contains all permitted photos and no hidden/owner-only photos; expired/revoked/foreign viewers get none of the protected originals | Service mapping plus database/Storage authorization regression |
| IV6 | Visitor form compact, fully scrollable; explanations in in-form disclosure, not bulky action footer | Responsive modal/keyboard tests |
| IV7 | New visitors provide valid phone/email/name and canonical country/state/city, family context >=40 trimmed chars and message >=80 (both <=600) | Shared client/server schema and database command negative tests; reject invalid parent chain before persistence |
| IV8 | Non-self visitor additionally provides candidate name/email/phone/location and relationship; self branch ignores candidate payload | Conditional rendering and boundary cases; verification remains for viewer email, not candidate |
| IV9 | Existing account option asks registered email as Google login hint; profile is resolved only from verified authenticated account, with profession/core values shown for sharing | No email-based portfolio lookup or typed-identity trust; existing signed-in flow unchanged |
| IV10 | Inline errors/focus, keyboard tooltips/actions, accessible modal and no secret/customer-data logging | Component tests and fresh independent review |

## Design and boundaries

Preserve existing navy/teal tokens, Manrope/Playfair and Lucide icon system. Taste skill applies only to viewer chrome; product forms retain maintained form patterns. Minimal motion (2), visual variance (4), density (5). Location dropdowns use the main form's reference directory; anonymous access exposes only bounded reference options through an RPC, not table/customer access. Shared authoring schema owns new-visitor field rules; historical read schemas remain permissive.

Verified paths: `InterestRequestModal.tsx`, interest contracts/repository/service, `api/interest`, dashboard relationship rendering, public portfolio resolver/Storage signing, `PortfolioNavigation.tsx`, `PortfolioChrome.module.css`, reference endpoint and SQL submission/projection functions. Created retained owner-only details/history components, structured interest-location/visitor field components, floating Top and the migration `20261012180000_interest_details_and_photo_access.sql`. Tests: interest-request, interest-details-contract, interest-owner-details, interest-location-fields, existing-viewer-profile.service, repositories, public-portfolio.service, navigation/templates, auth-start-route/location-route and the responsive `interest-viewer-experience.spec.ts`.

## Security, compatibility and rollout

Keep current-session, same-origin, verified viewer email, rate limits, own-portfolio rejection, publication/liveness and full-grant expiry/revocation gates. Candidate details are shared only with the owner; explain permission to share. Historical missing fields display Not recorded; account deletion/retention rules remain authoritative. New fields are not browser-persisted. Existing-profile submissions remain supported through a separately guarded owned-profile command. The weaker `submit_public_interest` command's authenticated execution privilege is revoked: old open forms must reload. Coordinate the database migration immediately before the dependent app rollout; a schema-first delay would temporarily prevent old-app submissions. Rollback requires a deliberate compatible application/database plan; do not restore weaker validation or erase retained records merely to roll back. Existing lower-level command characterization tests temporarily grant execution only inside rolled-back test transactions; the new suite independently asserts its production denial. Fresh independent review and authoritative pgTAP/CI are required before release.

## Implementation plan and progress

1. Add meaningful regressions and confirm intended failures.
2. Implement chrome and compact visitor form with canonical validation.
3. Add authoritative new submission/detail/reference commands and photo authorization correction where evidenced.
4. Run focused/full tests, static checks, build and responsive checks; update graph.
5. Fresh read-only review (three-round limit), resolve confirmed findings and record evidence.

## Verification status

Initial full coverage run: 1,241 tests passed and 57 per-feature coverage gates passed. Focused responsive checks first exposed a skipped-threshold scroll-observer bug and error-focus render race; corrected cases passed. A later full browser run overlapped an intermediate API error-handling edit; final affected-case reruns are required and recorded in the ledger. Final typecheck, lint, coverage/build and full responsive results belong to the ledger, not the earlier PR95 evidence. `npm run db:verify` is blocked by missing Docker; no migration or pgTAP suite has been executed/applied locally. Mocked browser/gallery tests do not prove Storage RLS. Physical devices, real Google/OTP sessions, production data and deployment are excluded from routine checks. Legal compliance is not certified; primary audiences India/USA and business jurisdiction remains unknown.

## Evaluation method and findings history

Behavioral-change mode. New field and API/schema regressions, component tests and responsive workflows cover IV1–IV10. Not every initial edit was preceded by a failing test; the user screenshots/base source supplied the initial defect evidence. The observed scroll-jump and focus-race failures were used as meaningful reproductions before correcting those causes. SQL tests are meaningful but unavailable locally, not substituted with a passing source review.

Review policy: fresh-context independent review, three rounds maximum. Round 1 was a SQL-only frozen review, with finding IDB1 (P2/confirmed/introduced): tabs/newlines could satisfy `btrim`-based context/message minima. Corrected with JavaScript-compatible whitespace normalization, strict JSON text types, and negative SQL assertions; authoritative SQL rerun remains pending. Earlier review artifacts remain immutable in host scratch. Final full-manifest review and dispositions live in the evidence ledger. No claim of cross-model review or release approval.

Evidence-backed lessons: intersection observers can miss instant jumps across a sentinel; threshold state uses a passive binary scroll check and responsive browser regression. Validation focus runs after the error DOM commits, not an assumed timer. Supabase query builders are thenables rather than native promises; rejected-network handling must assimilate the builder before using `.catch`. Requirements and implementation remain unchanged by these lessons.
