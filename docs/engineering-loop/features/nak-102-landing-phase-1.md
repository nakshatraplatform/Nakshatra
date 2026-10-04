# NAK-102 Phase 1: landing-page clarity

Status: implemented and locally verified on `fix/nak-102-public-trust-clarity`; not released. Mode: compact, because this is a bounded marketing-copy and metadata change using established routes and components. No product-policy, eligibility, disclosure, legal, consent, or database behavior changes were made.

## Intent and scope

The first visitor should understand within the first screen that VivIntro is a current marriage Introduction link for a person and their family network, not a search or matchmaking service or PDF-template tool. The page should then make the familiar forwarding problem relatable, show the practical outcome, state the public-versus-protected boundary honestly, and let visitors try a fictional example before requesting a pilot invitation. Preserve the user-chosen hero wording and eyebrow, Guided Tour, Received a link path, brand, routes, anchor IDs, and controls.

The audience is people and families already exchanging introductions through their own networks, including relatives, friends, community contacts, and matchmakers. VivIntro improves **how an introduction is shared and continued**, not how a match is discovered.

## Evidence and decision

The live DOM on 4 October 2026 still showed the older universal “identity-checked creator” and fictional checked badge. The current branch has already corrected those claims; this phase builds on that pending branch, not on the deployed page. The branch's `LandingExperience.tsx`, `GuidedTour.tsx`, `/demo`, `/received-a-link`, `/waitlist`, metadata, CSS, and browser tests were inspected. The product contract in `b2c-pilot-invitations-candidate-consent.md` says the current pilot permits **self-created and self-published** candidate portfolios; family assistance is not delegated publication. The landing copy now makes that distinction.

Search-result and competitor-page inspection on 4 October 2026 showed “marriage biodata maker,” “matrimonial biodata,” PDF, WhatsApp sharing, and private link as common language. These are qualitative vocabulary signals, not keyword-volume data or proof of demand. Some alternatives already offer links, so “one link” alone is not a defensible uniqueness claim. VivIntro's clearer distinction is a current shared Introduction plus a separate owner-approved Complete Portfolio. The SEO title targets “private marriage introduction link”; the description uses “biodata PDFs” as the familiar problem without calling VivIntro a biodata maker.

## Audit and narrative

| Page moment | Before | After | Why |
| --- | --- | --- | --- |
| Hero | User-chosen eyebrow, headline, lead, demo and invitation paths already work. | Preserve. | These communicate the offer and have been explicitly approved by the user. |
| Problem | Old-copy and uneditable-file cards repeated the same PDF consequence. | Show a familiar family forwarding sequence: version drift, premature personal disclosure, and an awkward next step. | Gives the visitor a situation they recognize rather than three variants of one complaint. |
| Solution | Correct boundaries, but the headline and cards restated the hero. | “Share the introduction. Decide on the rest.” Follow with one current view, later approval, and private set-aside. | Shows what improves in the actual exchange. |
| Viewer/demo | Viewer route and demo existed; “complete fictional introduction” could imply the gated Complete Portfolio was demonstrated. | Keep both paths, clarify that the demo shows the public Introduction and where a real request starts. | The CTA must deliver its stated experience. |
| Trust/FAQ | The link forwarding limitation existed, but was easy to miss; link rotation and expiry were in FAQ. | Name forwarding/capture plainly and distinguish updating a current URL from unpublishing or rotation. | Avoids a false security impression behind “always current.” |
| Pilot and invitation | Long explanation repeated “not a marketplace”; family-help wording could imply delegated creation. Landing and waitlist also said no account existed before invitation. | State the specific audience and self-created portfolio rule. Explain that email/Google sign-in creates an account for the request, while portfolio and creator access require an invitation. | Matches the actual OTP/OAuth flow and avoids a trust-damaging surprise. |
| Metadata | Broad “private marriage introductions” title. | “Private Marriage Introduction Link” title; current-link/approval description and matching social title. | Matches the page's actual job and qualitative search vocabulary. |

## Acceptance and evaluation

1. Hero wording and its `/demo` and `/waitlist` links remain intact. Check: `e2e/critical-paths.spec.ts`, `e2e/landing-layout.spec.ts`.
2. A visitor can find the family problem, solution boundary, Guided Tour, viewer guide, sample, and FAQ in the same page. Check: new landing narrative browser test and visual review at mobile/desktop widths.
3. Copy never claims the link is secret, the fictional sample is verified, family members can publish for the candidate, the demo reveals a Complete Portfolio, or no account exists before invitation. Check: source and rendered DOM review; product and auth flow cross-check.
4. SEO title and social metadata describe a marriage Introduction link, not a maker or matching service. Check: browser title assertion, source and rendered metadata review.
5. The page remains usable in Light/Dark and reduced-motion modes with no horizontal overflow. Check: existing theme and landing layout browser tests plus visual inspection.

## Boundaries and next step

The page still needs verified founder/operator and legal-entity facts before a named founder or stronger legal trust claim can be published. Do not invent testimonials, customer counts, success rates, or reviews before pilot evidence exists. A “social proof” block should be added only after consented, attributable evidence is available. No new image, motion library, palette, or product UI is part of this copy pass; the existing fictional product preview is retained because it represents the actual Introduction format and was previously approved.

The waitlist's account-creation flow may need a separate legal/consent review: the OTP start path uses `shouldCreateUser: true` before an invitation is granted, while the current waitlist does not show the signup Terms acknowledgement. This phase corrects the factual marketing and confirmation copy only; it does not alter auth, consent, or legal policy.

Next phase after this landing slice: validate the creator's first-run Dashboard and editor with realistic empty and partial drafts, as described in `nak-102-trust-first-ux-audit.md`. Keep security, identity policy, and BrokerDesk changes separate.

## Verification (4 October 2026)

- `npm run lint -- --max-warnings=0`: passed.
- `npm run typecheck`: passed.
- `npm run test:unit`: 946/946 passed after updating assertions for the approved copy. The first run reported five stale copy/metadata assertions; no product failure was found, and the corrected full rerun passed.
- `npx playwright test e2e/landing-layout.spec.ts e2e/critical-paths.spec.ts --workers=1`: 60/60 passed after scoping duplicate sample-CTA assertions to the hero. The first run exposed only that selector ambiguity.
- A final targeted browser run after the waitlist clarification and navigation label change passed 9/9 across desktop, tablet, and mobile. The landing width matrix checked 320, 375, 414, 768, 1024, 1081, 1200, and 1440px in Light and Dark with no document-level overflow or wrapped desktop navigation.
- `npm run build` with loopback-only Supabase placeholders: passed.
- `graphify update .`: passed with no topology change; the known optional SQL parser warning remains.
- Visual inspection in the local browser covered the desktop hero, 320px Light hero and problem section, and the 320px Dark problem section. This copy-only phase did not capture a persistent exact-base before/after screenshot pair; the existing trust-clarity audit retains screenshots for its earlier material visual change.

The live site was observed but not changed or deployed. Real OTP delivery, invitation issuance, and Production behavior were not exercised by this phase.
