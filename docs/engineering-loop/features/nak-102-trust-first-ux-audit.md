# NAK-102 follow-up — trust-first VivIntro UI audit

4 October 2026. Base: `origin/main` at `d2bab6c`. This is a presentation/content follow-up to the test-publication exception, not a change to eligibility, authorization, disclosure, consent, legal policy, analytics, routes, or data. No Linear update is part of this work. The unrelated NAK-81 checkout and its untracked review were left untouched.

## Product and journeys

A person owns one canonical portfolio. A guest with its opaque personal link may view the public Introduction; email confirmation and owner approval are required for the separate Complete Portfolio, normally for up to 15 days. The owner may set a request aside. BrokerDesk's authenticated broker Introduction and mutual-interest Complete grant are separate flows under `docs/vivintrodesk-mvp-contract.md`. A pilot test-publication exemption must never be represented as a Didit photo match or legal identity check.

First visit → fictional sample / invitation request → private draft → editor and previews → publication checks and disclosure → shared Introduction → Show interest and email confirmation → owner review → approved Complete access / set aside / expiry or revocation → account and privacy actions. The first slice addresses the trust claims encountered before and during the shared Introduction, without changing any step's authority.

## Evidence and audit

The local Next app was viewed with the repository's loopback-only Supabase fixture at 320, 375, 414, 768, 1024, and 1440 CSS pixels in Light and Dark. The matrix had no measured document-level horizontal overflow. Screenshots are in ignored `test-results/trust-ux-before/`; these are synthetic account and portfolio data, not Production. Source, feature records, and existing component/E2E tests were reviewed for the states the fixture does not expose. The fresh [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) were used for focus, semantics, forms, touch targets, responsive content, motion, and state feedback. Emil's interaction review is recorded below. Taste-skill applies only to the landing and public storytelling surfaces.

| Page or state | Functional, accessibility, or trust finding (severity) | Existing strength / proposed response |
| --- | --- | --- |
| Landing `/` | High: `LandingExperience.tsx` calls every creator “identity-checked” and “required before publication,” contrary to NAK-102's narrow test exemption and the actual Didit photo-match/liveness scope. Its fictional hero preview also wears a check claim. FAQ says a public link ends only on unpublish, omitting rotation. | Preserve the chosen headline, eyebrow, palette, CTA routes, Guided Tour, and Received a link path. Name the earned badge precisely, identify the fictional example, and make link lifecycle accurate. The page is long, but the tour and viewer path have distinct jobs; shortening is a preference, not this defect. |
| Invitation and sign-up `/waitlist`, `/signup` | High on signup: `AuthForm.tsx` repeats a universal “Didit identity verification is required” statement. Waitlist has a clear staged invitation flow; do not alter its data collection or eligibility. | Replace the universal claim with truthful publication-step and earned-badge guidance. Keep form fields, errors, and pilot controls. |
| New creator Dashboard `/dashboard` | Medium: the empty local fixture shows four zero activity metrics before a portfolio exists, and readiness shows a location validation message at 0%. This may come from fixture state and needs a separate validated first-run pass. | Keep the new shared header, sticky navigation, Start with the basics action, saved-state and explicit test-exemption notice. Do not weaken readiness or publish checks. |
| Portfolio editor | Medium preference: on a 375px viewport, the first screen contains section navigation, a Quick start card, and a “short first step” explainer before fields. This is comprehensible but dense. | Preserve seven-section flow, save feedback, review action, and legal footer. Test a more direct first-field hierarchy in a later slice; no redesign of a multi-step form under taste-skill. |
| Owner preview and review | No verified defect in this pass. Source keeps owner preview distinct from publication and provides saving/publishing states. | Preserve authorization and disclosure review. Test with a ready-to-publish account before any copy or flow adjustment. |
| Public Introduction `/p/[token]` | High: `CelestialUnion.tsx` accurately labels a real badge, but `globals.css` hides its visible words at mobile sizes. The remaining shield is ambiguous to touch users. The local fixture's signed photos appeared broken, so media fidelity was not judged. | Show “Live photo checked” beside/below the name at mobile widths. Preserve responsive navigation, Show interest, gallery, protected-content labels, and existing accessible description. |
| Show interest | No verified defect in the visible choice state. The modal names Google and new-visitor paths, supports Escape/focus restoration and status/error messages in source. | Keep label, email-confirmed request, owner privacy, and existing API. Test actual send/OTP failures separately; the fixture does not perform a real email delivery. |
| Approved Complete Portfolio | Could not render an actual approved grant: the loopback mock returns `null` from `resolve_approved_portfolio`. Source and `portfolio-view-disclosure.test.tsx` verify that approved values are separate and owner-only fields remain excluded. | No disclosure change in this slice. A real approved/expired/revoked visual pass belongs in the next authenticated test environment. |
| Viewer guide `/received-a-link` | No verified defect: it explains that forwarded links are readable and email confirmation is not a full identity guarantee. | Preserve the guide and sample route. |
| Trust and demo `/trust`, `/demo` | High: Trust page promises a hosted identity check for every publication and says the public link ends only when unpublished. Medium: fictional demo renders `identityVerified`, creating a synthetic checked-photo badge. | Make the limited exemption and badge boundary explicit, include rotation, remove the demo's simulated proof. Do not invent founder or social proof. |
| Verification `/verify/[token]`, `/verification/result` | The headings still use the broad term “identity verification” while the self-created candidate check is specifically live-photo matching and liveness. The detailed verification page explains that narrower scope. | Review these headings in a separate consent-sensitive copy pass; preserve the route, Didit consent text, and actual eligibility rule until approved. |
| About `/about` | The founder section is intentionally generic unless verified operator details are configured. This is a trust gap, not a defect to solve with invented biography. | Ask the owner for factual founder and legal-entity details before publishing a named profile. |
| Account/privacy and BrokerDesk | Source and local synthetic account inspection show the shared customer navigation and account controls; BrokerDesk's distinct contract was read but not visually re-audited in this personal-link slice. | Preserve legal/consent text and broker authorization. Separate broker device pass if requested. |

### Interaction review (Emil design engineering)

| Before | After | Why |
| --- | --- | --- |
| An icon-only checked-photo cue on phones, despite a text label on desktop. | Keep its short visible label at all sizes; retain the longer accessible explanation. | A trust cue must be understandable without hover or a screen reader; small-screen comprehension matters more than saving a line. |
| Landing/demo imply a fictional person earned a real check. | Mark the hero illustration as fictional and omit the demo's checked flag. | Immediate visual feedback must match the actual state; an example must not fabricate proof. |
| Universal verification and link-lifetime claims conflict with recent state transitions. | Describe standard publication, the narrowly scoped test exception, and unpublish/rotation accurately. | Credible feedback and predictable state language reduce uncertainty at a sensitive decision point. |
| Interest modal already announces success/errors and restores focus; editor already shows Saved/Saving feedback. | Preserve. | These are working interaction details, not decorative candidates for replacement. |

## Compact VivIntro UI system

- Layout: keep established responsive containers and the personal-portfolio template. Marketing may use wider editorial composition; the workspace and forms should keep shorter reading lines; the portfolio should prioritize the person's name and disclosure state. Never introduce horizontal scrolling at 320px.
- Spacing and hierarchy: retain the existing spacing scale and type families. One primary action for the current state; supporting actions stay secondary. Avoid duplicate headings or explanations in one viewport, especially in editor/onboarding.
- Color and contrast: retain teal/ink/cream/gold and theme tokens. Text and controls must be legible in both themes; state is never conveyed by color or icon alone.
- Navigation and controls: reuse the customer header, portfolio section navigation, buttons, and form controls. Aim for at least 44px touch targets, semantic labels, visible keyboard focus, and an obvious back/close path.
- Feedback: show saved/saving/error and pending/success states where action occurs. Name expired, unpublished, revoked, and protected states plainly without leaking private data.
- Motion: preserve restrained existing motion, avoid delayed frequent-control feedback and broad `transition: all`, and honor reduced-motion. No new marketing motion in this trust-copy slice.
- Content: “Introduction” is the guest-viewable share; “Complete Portfolio” is approval-gated. “Live photo checked” means photo match plus liveness, not legal identity or endorsement. A test exemption never earns this badge. Use family-inclusive wording without assumptions, and never invent reviews, founder details, or verification evidence.

## Prioritized sequence and decision

1. **This focused slice — high:** correct public trust claims in landing, trust, signup, tour, and demo; make the earned badge visibly legible on mobile. Add focused unit and browser coverage. No policy or backend change.
2. **Next — medium:** validate creator first-run with realistic empty and partial drafts; resolve duplicate zero-state activity and premature validation only if reproduced; improve editor first-field hierarchy while retaining workflow and consent wording.
3. **Then — medium:** authenticated approved, expired, revoked, and access-management device pass in a nonproduction environment with real state fixtures; audit Show interest OTP failure and retry feedback end to end.
4. **Separate scope:** BrokerDesk-specific UI device pass and any product-policy or legal change require their own decision.

## Verification and limits

The final UI-only diff changes marketing, signup and trust guidance, the fictional demo flag, the mobile checked-photo badge presentation, and regression tests. It leaves the owner's disclosure resolver, grant rules, consent text, route slugs, analytics identifiers, and the brand system untouched.

- `npm run lint -- --max-warnings=0`: passed.
- `npm run typecheck`: passed.
- Focused component suites: 36/36 passed; a separate frontend copy test passed 4/4.
- `npx vitest run --coverage --maxWorkers=2`: 946/946 passed; aggregate statements 85.47%, branches 78.91%, functions 85.41%, lines 88.88%. `npm run coverage:check:features`: passed for 53 files. An earlier load-contended run was discarded; a serial run exposed one stale copy assertion, corrected before this clean pass.
- `npm run build` with loopback-only Supabase placeholders: passed.
- `npx playwright test --workers=1`: 90 passed, 6 intentional project-specific skips. Its new badge matrix checked 320, 375, 414, 768, 1024, and 1440px in both portfolio appearances; the existing suite exercised Light/Dark, keyboard theme switching, touch gallery close/focus return, mobile navigation, reduced motion, and no-overflow checks.
- `graphify update .`: completed (1,904 nodes / 5,756 edges); SQL extraction still lacks optional `tree_sitter_sql` and was not needed for this UI-only change.

Screenshots were inspected at desktop and phone widths. Persistent 375px Light before/after captures of the landing, Trust page, fictional demo, and public Introduction badge, plus Dark public badge captures, are stored in the calling Codex task's local visualization artifact directory under `vivintro-trust-ux/`. Filenames use `<surface>-before-375-<theme>.png` and `<surface>-after-375-<theme>.png`; they are not committed to the repository. The local mock serves SVG media through a path the image optimizer did not display; do not infer a Production media failure or a clean media visual sign-off from those screenshots.

This audit does not assert a Production visual pass, a real Didit journey, real email delivery, or a real approved grant. No Production data or disclosure policy was changed.

The dependency install reported five high-severity advisories. This design slice did not update packages; determine whether any advisory affects the deployed dependency path in a separate security triage before release.
