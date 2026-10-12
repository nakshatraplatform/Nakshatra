# Published dashboard and portfolio navigation

## Execution context

Source: owner's 2026-10-12 request. Full documentation, Significant risk because the shared viewer and verification presentation have multiple consumers. Base `fdc948a` (latest fetched main). Branch `fix/nak-105-published-portfolio-experience`. Preserve the unrelated dirty NAK-102 test-publication document. No issue was created.

Current step: implemented locally, original three-round fresh review and approved fourth-round correction review completed. Unit/UI/build checks pass. Not pushed or deployed. The local simulated mobile LCP target remains unmet; do not claim performance sign-off. Broad lifecycle validation audit is still the next increment.

## 2026-10-12 validation and performance follow-up

Owner now requests remaining mobile performance work, a thorough form-validation audit, push and PR (not merge/deploy). Primary legal audiences are India and USA; operator registration remains unknown. This follow-up uses full documentation, Significant risk for shared authoring/input contracts and performance. Authentication is inspected without changing its policy; any authentication/authorization change requires escalation to Critical and additional review. Review budget: three fresh rounds for this new follow-up, retaining prior findings as history.

Plan: inspect customer authentication/start/verify/password, account names, all seven portfolio sections and draft/publish boundaries, geography parent integrity, photo/horoscope input limits and interest submission/reuse; record inspected surfaces and gaps. Add negative regression cases for demonstrated discrepancies, then correct canonical authoring rules rather than making historical read schemas stricter. Preserve optional drafts, legacy names, existing verified-email identity and publication consent/Didit gates. No database or live-account mutation. Reduce proven unnecessary first-render resources without replacing typography or hiding content. Benchmark anonymous fictional `/demo` using local production Lighthouse, sequential idle-machine runs; target simulated mobile LCP below 2.5s and CLS below 0.1, and distinguish field metrics from lab measurements.

| ID | Expected behavior | Wrong implementation rejected | Verification |
| --- | --- | --- | --- |
| AC7 | Optional authoring inputs reject impossible clock times and punctuation-only/oversized phone numbers; errors identify fields | Length/shape-only acceptance; stricter historical read parsing | Draft/publish schema boundary tests and route tests |
| AC8 | Interest validates contact/location bounds before sending an OTP or persisting; existing-profile identity remains server-owned | Wasted verification for an invalid phone; trusting hidden name/email | Modal and guarded route negative tests |
| AC9 | Adult date bound agrees with calendar years even on leap days | JavaScript year rollover permits tomorrow's birthday | Fixed-time date tests and shared input max |
| AC10 | Mobile load resource reduction preserves all themes, content, print and navigation across entry routes | Removing needed fonts/styles or delayed above-fold content | Production build, browser checks and repeated Lighthouse |
| AC11 | Audit documents inspected journey boundaries, unchanged protections and unresolved policy questions; release patch is fresh-reviewed | Claiming complete/legal certification from mocks or stale checks | Source coverage ledger, full gates, independent snapshot review |

Next step: regression cases and bounded corrections. No follow-up checks have passed yet. Original UI check results remain historical until applicable final checks run on the combined patch. Rollback is a normal code revert; no schema changes planned. Unicode portfolio names currently have an ASCII database publication gate, unlike international account-holder names; do not silently loosen only the client or invent a database policy change.

## Problem and goal

The verified dashboard repeats a completed liveness task, separates sharing from the link and repeats an active badge. Portfolio navigation wraps unpredictably and combines Family with an education/work anchor; footer padding reserves an unnecessary 104px. Make completion quiet and ongoing actions obvious, preserving brand, published content and all access rules.

## Scope and design

- Dashboard: move active-link Edit details and WhatsApp sharing into the link card, alongside Copy link. Separate routine actions from Rotate link/Unpublish. Preserve editing and reactivation when sharing is unavailable. Remove only the redundant active badge.
- Verification: keep the mounted recovery controller and authoritative refresh/polling. Hide completed dashboard presentation, not the controller. Result/verification pages retain their completion messages. Pending, failure, cleanup and status-outage states remain actionable.
- Viewer: one compact responsive header, explicit navigation destinations generated only for rendered sections, independent education/work and family links, accessible mobile disclosure, existing Show interest destination. Keep all existing anchor IDs and projection/redaction rules.
- Footer: compact responsive help/policy navigation; preserve existing policy destinations and add readable liveness limitations when the badge is present. No claim of government/legal certification.
- Review typography, spacing, interaction/focus states and both portfolio appearances within changed surfaces. Existing photos and brand artwork remain; no generated portraits or redesign of user-authored content.
- Follow-up: lifecycle input-validation audit across authentication, account, portfolio and interest boundaries follows this UI increment. Do not claim exhaustive edge-case coverage or silently change policy during presentation work.

## Invariants and boundaries

Server snapshots/publication readiness remain authoritative. Hiding a panel never grants verification or access. No API, SQL, stored data, credentials, third-party request, roles, publishing restriction or admin change. No live profile edits, interest submission, WhatsApp sending, link rotation, unpublishing or deployment while inspecting the user's browser. Approved extension adds presentation-only media semantics/portrait fetch priority, font preload configuration and CSS chunking; access and security headers remain unchanged.

Verified locations: `src/app/dashboard/dashboard-client.tsx` owns dashboard actions/readiness; `src/features/identity-verification/client/identity-verification-dashboard.tsx` owns recovery lifecycle; `src/components/templates/CelestialUnion.tsx` constructs rendered chapters; `src/app/globals.css` contains current shared styling. New chrome components/CSS are planned beside existing templates. Existing tests: dashboard-client, templates, identity-verification-dashboard; Playwright uses loopback mock Supabase only.

## Acceptance and verification

| ID | Expected behavior | Wrong implementation rejected | Check |
| --- | --- | --- | --- |
| AC1 | Exactly one edit/WhatsApp action associated with the active URL; copy works; inactive/expired URLs are not shareable | Duplicate hero actions or expired sharing | Dashboard component + responsive E2E |
| AC2 | Completed liveness UI disappears but status refresh and return-to-incomplete still work; result page completion remains | Unmounting controller or hiding unfinished work | Recovery component tests + E2E |
| AC3 | Family and education/work target distinct existing sections; missing/private sections have no dead links | Combined label or revealing protected values | Template/projection tests |
| AC4 | Single-line desktop and compact mobile header, keyboard disclosure/Escape/focus return, no overflow; anchors visible below sticky header | Wrapped CTA, clipped focus, dead mobile menu | Navigation component + 320/375/768/1024/1440 E2E |
| AC5 | Footer keeps viewer guide, terms, privacy, corrections, readable liveness caveat without excess blank padding | Missing policies or false identity claim | Template + browser inspection |
| AC6 | Typecheck, lint, affected tests/build and fresh review pass | Regressed shared callers/redaction | Repository-native checks |

Framework basis: installed Next docs for client boundaries/CSS; existing Lucide/Tailwind/brand/theme tokens, no new dependencies. Design read: trust-first, preserved editorial brand; variance 4, motion 2, density 5. Navigation state is local disclosure state, not a permission decision. WCAG 2.2 target/focus/reflow guidance informs checks, not certification.

## Compatibility, rollout and rollback

No migration/env requirements. Preview and normal app release only after review/CI; no release authorized by this request. Revert UI commit to roll back; no data reversal. Preserve old anchor links. Physical Safari and applicable-jurisdiction legal review remain distinct from emulated-browser evidence. Operating jurisdiction/business registration requested from owner before asserting new mandatory disclosures.

## Progress and evidence

Live dashboard and shared Introduction inspected; completed panel, displaced actions, combined nav target and mobile wrapping confirmed. Story, gallery, astrology, family, education/work, partnership and access sections inspected through live DOM/screenshots and supplied desktop captures. The in-app surface remained 448px wide despite a viewport override; automated browser widths, not that override, establish desktop evidence.

Implemented: grouped link actions; mounted-but-hidden completed verification presentation; new portfolio Navigation/Footer and scoped chrome CSS; focusable anchor destinations; in-flow Back to top replacing the floating component. Existing public/protected content and anchor IDs retained. A new `portfolio-top` target restores actual page-top navigation. Light-theme teal changed from `#477b77` (4.41:1 against canvas) to `#42736f` for small-text contrast.

Regression-first baseline: three new expectations failed for the intended missing grouping, separate navigation and hidden completion. Focused component tests then passed 103/103. Browser iteration caught a logo minimum-width specificity issue and a top-anchor scroll-position bug; corrected without relaxing expectations. Full unit suite passed 1,200/1,200 (167 files). Fifteen responsive browser scenarios passed; after the print correction the six owner/viewer cases and three print cases passed again. Final lint, typecheck, production build and diff whitespace checks passed. No live actions or release.

The owner confirmed intended audiences in India, the US, Europe, Australia and Canada. Operating business registration remains unknown. Existing policy source still has conditional operator/address/grievance placeholders and explicitly pending legal review; presentation improvements do not resolve those disclosures. Lifecycle validation audit remains the next increment after UI, per owner's requested order.

Final source before print correction: full unit suite 1,200/1,200 (167 files), production build and 15 responsive browser scenarios passed. Fresh-context reviewer `/root/published_portfolio_ui_review` (model unknown) inspected snapshot `07b41b16494a8432542178aec5ccc3d828898e499410d347524e917e0c45dca7`; freshness checks passed. It independently ran provenance/diff checks and inspected source/callers, not the reported browser/unit/build commands. Finding PPE-001: new CSS-scoped header no longer matched the old global print hiding selector. Module-scoped print hiding and an explicit print-media browser regression were added; correction recheck pending. All other inspected acceptance criteria had no material findings.

Final review ledger: round 2 snapshot `a9a6f0e1847befcc1c6088f7207a669609fc20bd4bc060c3b1228c7dc3c52db4` found PPE-002, a medium/material introduced test-setup failure: `/demo` nests the template within an outer main, so its header lacks an implicit banner and main queries are ambiguous. Retargeted the print test to the same template at the loopback fixture `/p/e2e-portfolio-token`; all three print scenarios passed. Round 3 snapshot `e392ed9ddca8c91ff501989bf1cfe79bd4e98f79bf7965eb21f6faf5e0548097` resolved PPE-001 and PPE-002 with no material findings. Reviewer independently checked callers, source and provenance at start/end; executable test results are coordinator evidence. Final coordinator freshness check passed before this documentation-only progress update. No code changed after final review. AST graph update completed with no topology changes; existing SQL parser dependency remains unavailable, and no SQL changed.

Lighthouse 13.5.0 ran against the local production `/demo`, not the owner's live page: performance 89, accessibility 96, best practices 96, SEO 100; LCP 3.7s, TBT 110ms. These are one simulated lab run, not field metrics or compliance certification. Existing no-photo `div aria-label` in `AdaptivePortfolioMedia.tsx` is flagged for missing semantic role; confirmed identical at base `fdc948a`. Local Vercel Analytics script 404 explains console best-practice failure (no Vercel adapter on localhost). The fictional `/demo` wrapper has nested main landmarks, as previously confirmed. Performance target is not met in this sample; investigation and placeholder correction are pending approval to extend the three-round review budget. Do not claim overall page sign-off or PR readiness from the passing UI tests alone. Preserve report at `C:/Users/Lenovo/AppData/Local/Temp/published-portfolio-lighthouse.json`.

## Approved correction extension

Owner replied "Yes—fix and recheck both" to extending review after three rounds. Permit the additional correction review; no additional release authority. Media placeholder now has `role="img"` with the existing descriptive name, and the active hero image has high fetch priority without changing URLs, privacy projection or gallery priority. Two new unit checks and a sample browser check cover these contracts.

Load investigation: repeat pre-correction lab score 85, LCP 3.8s, TBT 190ms. Root layout was preloading five font files on every route, despite body/portfolio using Manrope, Playfair and Tenor; disable only Geist/Geist Mono preload while retaining variables/fonts and on-demand support for OTP's `font-mono`. Installed Next font guide supports this setting. Font-only lab score 92, LCP 3.3s, TBT 60ms, accessibility 100, CLS 0.

Production CSS inspection confirmed the default merged brand chunk also included unrelated LandingExperience, BrokerDeskHeader, CustomerAppHeader, MFA, brokers and TrustPage modules. Enabled installed Next's graph CSS strategy with request cost 5KB; preserve ordinary cached stylesheets rather than globally inlining a large stylesheet. Local production check across `/demo`, `/login`, `/privacy` at 375/1440 verifies no overflow, primary typography preloads, theme rendering and mobile menu; all pass. Sample imported CSS decreased from 376,915 to 272,671 uncompressed bytes (five rather than four stylesheet requests); no unrelated page module rules in its imported styles. This is a byte reduction, not a claimed 28% latency gain. Graph-mode lab score 91, LCP 3.3s, TBT 90ms, accessibility 100, CLS 0. Local adapter analytics 404 remains baseline, not a production outage. The 2.5s LCP design target remains unmet in this local simulated sample: retain as explicit remaining performance concern; production/preview field evidence is not available in this non-release task.

Extended verification: 27 template unit tests pass; affected five-file suite 108/108 passes; full final unit suite 1,202/1,202 (167 files) passes. Twelve browser scenarios pass including all three projects for login contrast, pre-hydration theme, sample semantics/font preloads and viewer widths/themes. Final build and lint pass. Typecheck initially hit a corrupted ignored Next dev route-type file during concurrent generation; regenerated route types with `next typegen`, then typecheck passed, and removed only the generator's incidental tsconfig formatting/extra include. No change to committed TypeScript configuration. Latest local production checker additionally verifies print header hiding/content and policy preservation at 375/1440. Graph AST updated after corrections.

Extended final reviewer `/root/published_portfolio_ui_review` returned `no_material_findings` for source/correction work on snapshot `677af7e40d5fc5d5d2af8880167ee73ca23df7ab2eb88f42d4515c8910eb231d`, with performance sign-off explicitly pending. Freshness checked independently at start/end and by coordinator before this documentation-only update. It independently inspected code/callers, installed framework guidance, tests and Lighthouse artifacts; reported test execution was not independently repeated. A final successful Lighthouse run scored performance 83, LCP 3.6s, TBT 320ms, accessibility 100, CLS 0; it ran alongside the AST update, so do not cherry-pick the earlier 91–92 scores or infer a stable latency gain. One failed recording (NO_NAVSTART) is retained as tooling history, not a passing measurement. Raw successful local reports range 83–92 after corrections. Proven reduced resources and repaired semantics stand; 2.5s LCP target, physical Safari checks and deployed/field measurements remain outstanding. No release or PR was created in this increment.
