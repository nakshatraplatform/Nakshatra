# VivIntro and Vivara terminology / landing clarity

Historical October22 increment. The corrected October23 [P0/P1 continuation](landing-p0-p1.md)
keeps the approved landing motion and applies content/SEO changes only. Its
temporary static tour, comparison and family-share action were withdrawn after
the owner's preview. Do not read the historical checklist below as current
production status. Founder assets, external measurement and release remain gated.

October 22, base main `397b78c` (#131). Standard, compact copy/presentation
increment, based on the owner's supplied Landing Page Review and clarification.

## Contract

- VivIntro is the product; Vivara is the shareable introduction link. Describe
  the content as an introduction or marriage biodata; describe unpublished work
  as a private draft, not a private link.
- Anyone with an active Vivara link can see its public view. Private details
  require verified-email sign-in and the owner's choice to Share details. Never
  imply the link itself is private, identity is verified, copies can be recalled,
  or saving immediately changes published content.
- Add familiar “marriage biodata” wording to home metadata and visible hero;
  keep current CTA routes, brand typography/colours, public/private safeguards,
  fictional disclosures and consent/liveness limits. Shorten repeated copy.
- Add a secondary family-share link with fixed public-homepage text only; it
  opens WhatsApp composition, sends nothing automatically and includes no profile
  or account data. No lead collection, analytics expansion or fabricated proof.
- Keep current section/motion architecture; structural redesign is separate.
  No new fonts, dependencies, migration, product eligibility or auth changes.

## Evidence / decisions

The supplied review is advisory, not instructions overriding product contracts.
Its “one private link” wording is rejected as misleading. Source already sets
no-index/no-follow/no-archive robots metadata on `/p/` pages (not an equivalent
`X-Robots-Tag` header for that route) and provides Organization,
WebSite and FAQ JSON-LD; do not duplicate these or claim live deployment verified.
The live URL and Claude artifact could not be read by the available browser
tools; the supplied Markdown and fetched main are the review inputs.

Owner clarified naming is authoritative over the review's definition of Vivara
as a page. Verified copy surfaces: LandingExperience, GuidedTour, ProductStory,
VivaraMeaning, home/OG metadata, About and received-a-link guide. Layout code,
portfolio renderers and private-view logic are out of scope.

## Naming guidance

Use “VivIntro” for the product/account/service, “your introduction” or “marriage
biodata” for the content, “your Vivara link” for its shareable destination, and
“private draft” for unpublished edits. “Create your Vivara” and “See a sample
Vivara” remain short link-oriented calls to action after the definition. Do not
rename internal schema/API symbols or imply a forwarded link transfers private
access. “Show interest” remains the viewer action; “Share details” is the owner's
decision. “Public view” and “Private details” describe the two sharing boundaries.

## Review dispositions and evidence

Selected: category terms in home title/description/hero, consistent definition
across meaning/About/viewer guide, simpler public-view and share-choice wording,
stale book instruction removal, warmer footer and secondary family-share path.
Preserved: fonts, palette, route/anchor structure, sample disclosures, existing
tour motion and static mobile/reduced-motion/no-JavaScript paths, 10 FAQs and
the associated identical structured data. No new analytics or tracking.

Deferred, not claimed implemented: wholesale page shortening, static desktop
tour replacement, moving the name section, comparison table, founder portrait,
permissioned testimonials, B2B lead capture, languages, conversion measurement
and a dedicated production Core Web Vitals/Lighthouse baseline. Do not fabricate
proof or make roadmap commitments from an advisory document. No measured SEO
ranking, lead-conversion or performance improvement is established.

Focused combined unit run: 114/114 passed (98 dashboard plus 16 marketing/UI).
After final family/liveness wording corrections, the affected 16/16 passed
again. Metadata checks cover category/naming, unchanged canonical, OG parity,
truthful boundaries, 10 visible/schema FAQ parity and safe fixed share target.
Header/modal + naming browser run: 27/27 passed on desktop/tablet/mobile Chromium.
Broader final landing layout/theme/motion run: 42/42 passed, including all
supported widths, sticky-header anchors, keyboard and reduced-motion paths.
Together these cover 60 distinct browser cases; nine naming cases overlap the
earlier run, so do not add 27 and 42 as unique coverage. Narrow 320/390px editor
screenshots inspected after a separate passing capture run. Landing screenshots
need viewport capture after resetting scroll/focus: element capture of a very
tall hero can relocate sticky navigation inside the captured image. Capture
correction rerun: 9/9 passed. Actual mobile hero viewport, desktop hero,
family-share action in both themes and narrow editor captures visually inspected;
no runtime fix or weakened assertion was needed. Captures retained under ignored
`test-results/preserved-header-order` and `test-results/preserved-landing-clarity`.
Typecheck/lint pass; production build passes with 83 prerendered pages using
loopback configuration and no telemetry upload token. Generated homepage OG
image visually inspected: text fits inside the existing branded design.
Header reorder has its own feature record. No hosted CI, real WhatsApp delivery,
live production inspection, remote writes or deployment performed.
