# Landing P0/P1: content and search clarity within the approved design

October 23, 2026. Base main `397b78c`; preserve preceding local editor-header changes on `fix/nak-107-editor-header-order`. Proposed as a dependent Draft app PR after the database-only feedback prerequisite. No production mutation, merge or deployment.

## Corrected contract

The owner clarified that this increment changes landing **content and SEO**, not the approved presentation. Keep the original scroll-driven four-book tour, three-phase portfolio phone story, Vivara name reveal, fonts, palette, sample portfolio renderer, section architecture and mobile/reduced-motion/no-JavaScript fallbacks. The temporary static tour, new comparison section, homepage family-share action and native-scroll substitution were withdrawn. The two visible hero lines must not repeat “marriage biodata.”

VivIntro names the product; Vivara names the shared link to an introduction. Private saving is distinct from publishing; a preview is optional. Family and Astrology remain optional. A living public link can be updated or unpublished, but a recipient's saved copy cannot be recalled. The fictional sample is disclosed. No founder photo, testimonials, fabricated proof, personal quotation, mandatory fields, auth/OTP, database, consent, portfolio, or eligibility changes.

## Implementation

- One typed source for public terminology, landing FAQs and metadata. The hero keeps the familiar category phrase in its H1 once, with a non-repeating eyebrow; sample and create CTAs distinguish the introduction from its Vivara link.
- The existing animated ProductStory phone, GuidedTour books and VivaraMeaning name reveal retain their original structure and interaction. Copy in those sections is shortened or clarified without replacing the UI. Existing keyboard, touch, reduced-motion and JavaScript-off paths remain.
- Six concise homepage FAQs use the same source as the FAQ structured data; `/faq` provides ten answers. The existing public canonical, metadata, Open Graph and Twitter cards are clarified. About, Trust and received-link pages have relevant breadcrumbs; no Person, rating or review claims are added. Existing profile robots metadata remains and `/p` gets an additive `X-Robots-Tag`.
- Existing Vercel Analytics can receive only two fixed public-homepage button events (create, sample), with no properties. They are disabled by default through `NEXT_PUBLIC_MARKETING_EVENTS_ENABLED=false` until availability and privacy-notice review. Signup/account events and private-route tracking remain excluded. No provider, table or database write was added.

The analytics SDK `beforeSend` callback exposes type and URL, not event properties; safety relies on the fixed-name caller with no properties and public-route gating. Do not claim it sanitizes arbitrary event payloads. Production Search Console, real-device experience, performance and actual conversion effect remain unverified.

## Verification and review ledger

Before the owner correction, the superseded static-layout variant passed its local unit/coverage, build and browser checks and received an independent correction review. Those checks do **not** validate the restored motion contract. The owner reviewed its local preview and requested the correction above.

Current corrected variant: focused landing unit tests pass; desktop Chromium landing animation/layout/critical-path reruns pass (the final 19-case affected rerun is green). The restored book and phone suites pass 20/20 on tablet and mobile Chromium, including touch scrolling and no-JavaScript fallback. Full unit coverage passes 1,769/1,769 tests in 210 files; 63 feature and 21 protected-boundary coverage floors pass. Typecheck, lint and the production build (84 static pages) pass. The first unconstrained full test run had one unrelated `IntersectionObserver` test-environment failure in a broker client test, which passed isolated and in the bounded-worker full rerun; no test or safeguard was weakened. The local preview returns HTTP 200 and shows the original phone, books and name explanation. Graphify AST was refreshed. No hosted CI, production analytics activation or live release has occurred.

Remaining release gates: hosted CI, physical mobile/desktop and representative-family review, production no-index inspection, Search Console, Lighthouse/performance budgets, measurement-provider and notice approval, founder photo/testimonials when supplied.

## October 23 guide continuation

The owner asked to proceed after reviewing the simplified phone and book story. A compact, public marriage-biodata-format guide now gives families a suggested order and a clear public/private boundary. It uses the existing marketing layout, canonical metadata and breadcrumb; one text link sits beside the homepage questions, with no new hero CTA or change to the book/phone/portfolio visuals. The previously withdrawn homepage family-share button remains out of scope, pending an explicit decision to revisit it. No quotes are displayed before separate review and approval.

Checks on this continuation: focused guide and landing tests pass (4/4), typecheck and lint pass, and the guide link/route/canonical/overflow browser check passes at desktop and mobile widths (2/2). A development client navigation retained two canonical elements in one run; a direct route reload produced exactly one correct canonical. The production build passes with loopback-only test environment values, and the guide is statically rendered. `db:smoke` passes. A later full unit run made no useful progress after unrelated broker-introduction and Didit-worker timeouts and was interrupted; this is not a full-suite pass. Hosted CI and the production preview remain release gates. This guide is app-only and does not change the feedback form's database-first rollout.

## Family-language and browser follow-up

The owner asked for plainer purpose-first words. The hero eyebrow now says "A simple way to introduce yourself" while the H1 keeps the marriage-biodata category phrase once for search and orientation. The lead states that Vivara is the shared link, and keeps saving separate from publishing. The founder story, viewer explanation, book steps, phone story and first FAQs use shorter, familiar wording. The Show interest wording preserves the select-then-email-confirmation flow. The guide stays as one text link near Questions, not a new competing block after the hero.

Focused landing/guide/metadata tests pass (11/11), lint and typecheck pass. The affected Chromium desktop, tablet and mobile browser suite had 42/48 pass initially; the six failures were old exact-copy assertions and pass on a focused 6/6 rerun. A separate three-engine smoke pass covered 320, 390, 768 and 1280 px in Chromium and Firefox (4/4 each), and WebKit at all four widths after hydration (4/4). It checked horizontal overflow, four book and three phone sections, FAQ opening and guide navigation. One immediate desktop-WebKit click in the development server did not navigate before hydration; the same click worked after hydration. This smoke is not complete cross-browser functionality or physical iOS Safari evidence. Full suite/CI and real devices remain pending.

## Draft PR preparation

The database-only prerequisite is isolated in Draft PR #132. The dependent app branch contains landing content, search metadata, the guide, FAQs, optional fixed public CTA events, and the private feedback form with its server boundary and retention-worker call. Unrelated editor/dashboard changes remain unstaged and outside this app PR. The repository's guarded push completed `db:smoke`, typecheck and the full 212-file/1,774-test unit suite. Hosted CI, database replay/pgTAP, exact generated-type parity, the production preview and physical-device review remain gates; this record does not claim release readiness.

The app review found that scheduled production retention did not yet invoke the feedback purge, although the manual command did. The scheduled path now calls the private purge independently of the existing retention classes and treats its failure as an incomplete run. The targeted retention and maintenance tests pass 29/29. After updating stale exact-copy and section-order expectations, the full focused landing browser suite passes 60/60 on desktop, tablet and mobile Chromium, including reduced-motion and no-JavaScript fallbacks. This is not a claim of complete Safari/Firefox or real-device coverage. The app PR remains Draft until its dependency is merged and applied, its own CI passes after retargeting to main, and the owner reviews the preview.
