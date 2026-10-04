# NAK-102 follow-up: disclosure clarity and first-run focus

Status: implemented locally on `fix/nak-102-public-trust-clarity`; not released. Compact record for a bounded presentation/interaction change. This pass does not change publication rules, projection, consent, identity checks, access grants, routes, or pricing.

## Contract and evidence

- Personal sharing has one current public **Detailed Introduction** and an owner-approved **Complete Portfolio**. New publication rejects legacy `privacy_mode: "private"` in `form-contract.ts` and `publish.service.ts`; `CelestialUnion.tsx` retains a Brief renderer for historical data. This compatibility code is not a current marketing tier and is not removed in a UI pass.
- BrokerDesk is separate: its authenticated Broker Standard disclosure and mutual-interest Complete access do **not** use the B2C per-request approval rule. The landing and Trust answer therefore qualify that rule as personal-link behavior. The authoritative business contract is `docs/vivintrodesk-mvp-contract.md`; the plain-language family review had one stale “Detailed/Brief” reference, now corrected.
- The screenshot supplied by the owner and Marriage Profile's current public site show substantial commodity overlap: editable biodata link, WhatsApp/PDF/QR sharing, passcode controls, templates, analytics, and low-cost one-time plans. VivIntro should not claim an editable link itself is unique. It should explain its canonical, person-owned portfolio and separate disclosure/approval path accurately. No competitor wording or visual assets were copied.

## Audit and sequence

| Priority | Evidence | Action |
| --- | --- | --- |
| High, content trust | Landing FAQ's “owner-designated” phrase suggests arbitrary field-level configuration; personal and broker access have different rules. | Name representative protected categories and qualify personal-link approval. Preserve the user-approved hero, Guided Tour, viewer guide, and demo. |
| Medium, accessibility/interaction | Landing Trust cards are static, while FAQ is technically native `<details>` but has weak visual affordance. `/trust` uses four open text cards. | Use native expandable summaries with visible hover, focus, open, and reduced-motion states. Leave the first photo-check boundary open on `/trust`. |
| Medium, first-run UX | An invited creator with no portfolio sees four zero activity counters, an eight-step 0% tracker, and four empty relationship queues below the single onboarding action. | Show activity and relationship queues after publication or when historical records exist; show the readiness tracker only after a draft exists. Preserve historical activity after unpublishing. |
| Low, editor clarity | Mobile repeats its step count above the first field, and an extra “short first step” card pushes the name input down. Two labels still say “Full” or imply two published Introduction views. | Hide the duplicate step label on mobile, remove the redundant card, and name the public/Complete views correctly. Preserve fields and save/review flow. |

## Evaluations

1. Landing Trust, FAQ, and `/trust` disclosures toggle by keyboard/click, retain the questions as visible labels, and expose a clear focus indicator. Check: `tests/landing-experience.test.tsx`, `e2e/landing-layout.spec.ts`.
2. At first run, no activity metrics, empty relationship queues, or 0% publishing tracker competes with “Start with the basics”; a historically published portfolio still shows activity. Check: `tests/dashboard-client.test.tsx` and existing dashboard tests.
3. Only current Detailed + Complete are marketed, while historical Brief reading and backend gating remain unchanged. Check: source/contract comparison and existing public snapshot/template/form tests.
4. No overflow or interaction regression at target widths and Light/Dark. Check: landing E2E matrix, customer theme tests, manual screenshots.

## Boundaries and next step

Do not remove the historical private/Brief renderer or normalize its stored data without a separate migration and disclosure decision. Do not advertise paid tiers, AI writing, family collaboration, passcodes, PDF export, view geography, or live legal-identity verification as VivIntro features. Pilot broker pricing remains a hypothesis. The exact “business diagram” was not separately supplied; this pass uses the authoritative MVP contract and linked business-model review.

Next: visually validate the editor with an actually empty invited account and a partially completed draft, then test approved/expired/revoked Complete states with a nonproduction authenticated fixture. Real invite delivery and Production disclosure were not exercised here.

## Verification (4 October 2026)

- `npm run lint -- --max-warnings=0`, `npm run typecheck`: passed on the final source.
- `npm run test:unit`: 948/948 passed. One prior run exposed a stale test expecting a Trust-card heading; the final assertion checks its new disclosure summary.
- `npx playwright test e2e/landing-layout.spec.ts e2e/app-theme.spec.ts --workers=1`: 53 passed, 4 project-specific skips after aligning first-run assertions with the empty creator fixture. A final targeted run after the empty-relationship and policy-header corrections passed 7, with 2 project-specific skips.
- `npm run build` with loopback-only Supabase placeholders: passed. `graphify update .`: passed (1,906 nodes, 5,759 edges); optional SQL parser remains unavailable and was not required for these UI changes. `git diff --check`: passed.
- Local screenshots in ignored `test-results/` were inspected: the 375px Dark Trust page now has a visible adaptive logo, the mobile accordion fits and toggles, and the desktop Dark first-run dashboard has one primary onboarding action without empty relationship queues. The live deployed site, real invite flow, partial-draft authenticated state, and actual approved Complete state were not validated.

## Landing copy and pilot-pricing follow-up (4 October 2026)

The owner confirmed that broker-sponsored customers have no compulsory VivIntro fee, matching the authoritative MVP contract. Personal pricing and any usage allowance remain post-pilot hypotheses. This follow-up does not add a pricing tier, trial clock, approval quota, payment requirement, or broker fee to the landing page. It makes the current free invited pilot explicit near the first CTA and in the FAQ, including that future personal pricing would be explained before payment is requested.

The chosen eyebrow and headline, sample Introduction, Guided Tour, viewer guide, anchors, and CTA destinations stay intact. The hero lead now states the link/PDF alternative and protected-detail decision in fewer words. The forwarding story, solution explanation, and audience section use familiar terms before introducing the named Introduction and Complete Portfolio views. The FAQ asks what a link recipient can see and distinguishes the shared first view from protected Complete information. Personal-link approval is still qualified separately from broker-mediated mutual-interest access.

The design target is not a claimed universal conversion deadline. NN/g's first-seconds research is a reason to make the initial value legible quickly; actual comprehension and conversion need pilot testing with families and brokers. No new imagery, motion, styling system, invented proof, or product capability was added.

Verification: `npx vitest run tests/landing-experience.test.tsx` passed (4 tests); `npm run test:unit` passed (948 tests); `npm run lint -- --max-warnings=0` and `npm run typecheck` passed. `npx playwright test e2e/landing-layout.spec.ts --workers=1` passed (27 tests across desktop, tablet, and mobile projects, including eight-width Light/Dark overflow checks). The first browser run found one stale case-sensitive assertion for the replaced problem paragraph; it was updated to assert the new text and the final run passed. `npm run build` first stopped because no local Supabase environment was supplied; it passed with loopback-only Supabase placeholders. `graphify update .` passed without code-graph topology changes; its optional SQL parser remains unavailable. PR status is reported at handoff.
