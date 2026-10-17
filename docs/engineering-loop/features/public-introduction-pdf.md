# Public introduction PDF

## Execution context

- Approved 2026-10-17: editorial design 01, one fixed light A4 template, Inter / Plus Jakarta Sans, supplied vector brand and faint portrait arch. No template controls or integrations.
- Mode: full; Critical risk (bearer-link lifecycle, owner authorization, migration).
- Starting tree: `fix/nak-107-consumer-touchpoint-polish`, main base `d99e14c`, with pre-existing uncommitted touchpoint changes and unrelated NAK102 document. Preserve both; do not attribute them to this feature.
- No issue number assigned to this feature. Only `linear_phoenix` is authorized for durable Linear writes; the available generic connector has not been verified as that connection, so no Linear write is made.
- Current stage: implemented locally; application checks passed, database execution blocked. No production actions authorized/performed. Next: clean Supabase replay/pgTAP and generated-type verification in a Docker-enabled environment, then coordinated migration/application PR release.

## Contract / decisions

1. Dashboard Download PDF adjacent to Manage link; use existing action styles at all screen sizes. Loading locks the action; accessible errors allow retry. No account JSON replacement endpoint or template picker.
2. Owner-only POST; current live session and same-origin checks. Published public resolver is authoritative, not draft, approved view or `is_published` alone. Expired, incomplete, unpublished, gated or deleted profiles cannot generate/download.
3. Closed runtime PDF allowlist: public full name, coarse location, integer age, permitted facts, public roots/astrology, education/work, values/interests, optional short introduction. No contact, DOB/time, private relatives, address/postal code, private photos or verification badges. Unsupported fields are omitted, not inferred. Unknown name glyphs fail clearly, never disappear silently.
4. Public hero only, clear presentation; retrieve the RPC-authorized object via Storage, not arbitrary remote URLs. Size/pixel bounds, orientation normalization, metadata-free JPEG conversion, timeout and initials fallback. No PDF persistence.
5. Separate random PDF code maps internally to portfolio; public QR grants no extra permission. No redirects to main URL; reuse the public page and existing interest/contact authorization. HTML may contain the canonical web token for those existing flows (it is not a private user ID).
6. Edits/republication preserve QR. Existing Rotate link revokes previous QR codes atomically; next PDF creates the replacement without additional user controls. Unpublish pauses both references; republish resumes a non-revoked QR. Delete leaves only unassociated retired random-code reservations. Link replacement retains existing private-grant revocation.
7. Codes are CSPRNG-generated, unique, never reused; one active code per portfolio. Existing web tokens are reserved from migration onward (no claim to recover earlier retired tokens). Conflicts fail/rollback; web service retries bounded unique violations.
8. Revalidate session, active channel, canonical public payload/media revision after rendering. Concurrent changes return retry rather than a stale file. A file already delivered cannot be recalled. No absolute atomicity claim between final authorization and delivery.
9. Dated snapshot, matching QR/printed/clickable URL, public-only metadata, safe attachment filename, no-store/noindex/no-referrer. Light print design irrespective of dashboard theme. On-demand generation quota 10/hour per authenticated owner; no pricing or plan changes.

## Architecture / location map

- Canonical read gate: `public.resolve_public_portfolio`, `public.is_published_portfolio`, published completeness and pilot/liveness checks in existing SQL.
- New migration: private channel/reservation tables, owner preparation/revalidation RPCs, anonymous narrow active-code resolver, rotation/deletion triggers. No changes to publication eligibility or existing grant logic.
- PDF contract: `src/features/portfolio/pdf-snapshot.ts` projects validated public data into a strict closed shape. Renderer receives only this object, URL/date and sanitized public-photo bytes; no Supabase imports.
- Server orchestration: `src/features/portfolio/server/pdf-download.service.ts`; route `/api/portfolio/pdf`.
- QR entry: `/i/[code]`; existing public-page renderer remains responsible for viewer authorization.
- Server assets: `assets/portfolio-pdf`, traced explicitly for serverless packaging. OFL notices retained; no runtime font downloads.
- Dashboard action: isolated client component reuses existing classes, aborts/cleans temporary browser resources.

## Evaluation contract

| ID | Cases / wrong implementation rejected | Evidence |
|---|---|---|
| PDF1 | Full, sparse, long/unbroken names; one A4 page, real embedded brand fonts, no clipping, optional fields omitted | Renderer tests + rendered PNG inspection |
| PDF2 | Private sentinels, contact/DOB/address, audience locks; approved photo cannot enter file | Projection and orchestration negative tests |
| PDF3 | Missing/revoked session, cross-origin, quota/service error; no generation on denial | API/service tests |
| PDF4 | Stable concurrent creation, rotation, unpublish/republish, delete, reserved-code collision/reuse, canonical gate closure | pgTAP + local replay if available |
| PDF5 | Snapshot/media/session changed while rendering -> no delivered buffer; bounded image failure -> initials | Service tests |
| PDF6 | Exact QR/annotation/printed URL, date and safe filename; no stored PDF | Renderer/HTTP tests + independent QR decoder |
| PDF7 | Single action, loading, retry, responsive overflow/focus in light/dark across mobile/tablet/desktop | Component tests + Playwright |
| PDF8 | Packaged fonts/SVG available without network in production artifact | Build/tracing inspection |

## Rollout / recovery

Migration is separate from deployment. Clean database CI/replay and fresh independent review are release gates. Apply the additive migration before enabling the matching application. On rollback remove/hide the application entry first; retain revoked-code tombstones. Do not run production SQL or deploy automatically. Previous issued PDFs are irrevocable static files; the QR remains gated on live availability.

## Verification / progress

- Approved static proof only is historical design evidence, not a test of production generation.
- Dependency installation: pinned PDFKit 0.20.2, qrcode 1.5.4, SVG-to-PDFKit 0.1.8; npm reported zero vulnerabilities at install. Existing pending install-script policy was not changed.
- Implemented the mapped server/client/SQL files, narrow generated RPC declarations, runtime font assets and OFL notices, explicit Next asset tracing, collision retry, 33 pgTAP assertions, and focused unit/browser evaluations. The generated declarations are additive hand-maintained entries until actual local type generation is available; do not claim schema-generated parity.
- `npx vitest run --coverage --maxWorkers=2 --reporter=dot --reporter=json --outputFile.json=C:/Users/Lenovo/AppData/Local/Temp/pdf-feature-final-tests.json`: **1,409 tests / 186 files passed**. Production source includes both review corrections. Coverage: statements 86.06%, branches 80.85%, functions 84.88%, lines 89.63%; unchanged configured thresholds passed. Two additional public-photo tests were added afterwards and passed in a separate 16-test renderer/service run (no production source changes).
- `npm run coverage:check:features`: **60 feature gates passed** at unchanged 80% per metric.
- Focused API/projection/renderer/service/component/rotation batch: 30 passed before the two extra photo cases. Photo-positive checks verify orientation normalization, EXIF stripping, JPEG output and real image embedding.
- `npx playwright test e2e/portfolio-pdf.spec.ts --workers=1`: **12 passed**, desktop/tablet/mobile, light/dark action states, retry/focus/overflow, unpublished/incomplete absence, actual HTTP-generated attachment, QR entry without redirect, neutral invalid-code outcome. Uses isolated loopback fixtures, not a real Supabase database; does not certify SQL behavior or physical Safari downloads.
- `npm run build`: passed (82 static pages), including new API and QR route. Traced artifact includes all fonts, vector marks, OFL notices and PDFKit AFM data; no runtime font network dependency.
- `npm run lint`, `npm run typecheck`, `npm run db:smoke`, `npm run security:audit`, `git diff --check`: passed. Dependency audit: zero affected packages, no exceptions.
- Production renderer PDFs visually checked for standard, 55-character natural and 160-character unbroken names. All stay on one A4 page, full name preserved; compact spacing/full-width name row is exceptional fallback, not a template choice. QR independently decoded to the exact destination at 150 and 300 DPI. Source/application assets remain separate from earlier static proofs under `output/pdf`.
- First broad coverage run under simultaneous build/browser load had one dashboard timeout and a pilot-test timeout/cascade (7 failures); lower-worker full rerun passed without increasing timeouts, skipping tests or weakening assertions. First extended browser batch found inherited generic404 copy, fixed with a dedicated neutral unavailable page; all 12 reran successfully.
- `graphify update .`: completed (2,217 nodes / 6,693 edges). SQL extraction unavailable because `tree_sitter_sql` is absent; migration inspection was direct, not inferred from the graph.
- **Blocked:** Docker command is unavailable, so real migration replay, 33 pgTAP assertions, concurrent SQL execution and regenerated Supabase types are not verified. `db:smoke` is static fixture validation only, not a substitute. Hosted database CI and actual schema checks are mandatory before rollout. Never execute this migration directly in production as a test.
- **Limits:** bundled fonts do not cover every script. Unsupported characters return `PDF_FONT_UNSUPPORTED`, preserving saved names. No automatic romanization, silent letter removal, fabricated public values or private-photo fallback. Real provider/storage and physical iPhone/Safari checks remain release validation.

## Fresh review / finding dispositions

Fresh-context read-only reviewer `/root/pdf_feature_review`; exact model identities unknown (not a cross-model claim). Initial manifest `03911d5b6f4c740720a6ec43eccb4be2e4f6de411592a7d7532da3a63f8f86ba` was current at initial review, then superseded by parent corrections. Reviewer independently re-executed the corrected renderer against actual current source; no source edits or nested review were performed.

- **PDF-R1, medium, introduced/confirmed/resolved:** combined dense-profile + long-name layout rejected otherwise valid profiles. Added failing full-content/55-/160-character regression, then a measured name-size/whitespace/full-row fit ladder. Reviewer independently verified natural55, spaced139 and unbroken160 cases; parent inspected new PNGs.
- **PDF-R2, low, introduced/confirmed/resolved:** glyph regex over serialized JSON skipped escaped/quoted body values. Added failing quoted-emoji regression, replaced it with recursive checks on actual string values. Reviewer independently verified quoted emoji/Kannada now fail clearly.
- No other confirmed privacy/lifecycle findings. Database release readiness remains **blocked**, not approved. Test-only pgTAP additions for quota exhaustion, reserved-token rollback and revoked session were self-reviewed after the core review; none has been executed against Postgres.

## Scoped lesson

Glyph validation must traverse actual decoded values, not regex-match serialized JSON; escaping changes what a regex sees. A one-page template must test a long name together with the densest supported sections, not only a long sparse profile. Both failures now have renderer regressions.
