# NAK-200 Stage B — Soft Utility wireframes

> Historical design checkpoint. Active wireframe work continues under
> [NAK-208](./nak-208-vivintrodesk-ui-contract.md). NAK-208 supersedes this
> checkpoint where the approved family-assisted contract or side-specific
> sharing differs.

## Execution context

Design implementation, Standard risk, compact documentation. The dedicated `feat/nak-200-vivintrodesk-workflow-wireframes` worktree was advanced to latest `origin/main`, `eab2864`, on 13 October 2026. Stage A is preserved. Stage B is a separate local Next.js app under `design/prototypes/nak-200-stage-b`; it has no production routes, authentication bypass, backend client, provider credentials, or real customer data.

Requirement source: the user's 13 October brief. Design direction: Premium Stationery, Soft Utility, and visual person exploration for a 3–5 member broker team. Product authority remains the current MVP contract, document map, portfolio data classification, NAK-79, NAK-80 and current source. Latest-main geographic matching exists as a service-only RPC; it is not a complete BrokerDesk compatibility service.

## Before implementation: evaluation contract

| Criterion | Case and expected outcome | Verification |
| --- | --- | --- |
| B-1 | All six supplied colors map to Tailwind v4 theme variables; Inter and Plus Jakarta Sans, weights 400/500/600; no default color utilities or pure black | Source inspection, generated styles, browser computed styles |
| B-2 | Today → Customers → customer → Find Matches → pair review → create → activate/copy → track works with fictional data | Browser walkthrough; opening a new tab or Back retains opaque record context |
| B-3 | Visual cards and aligned pair rows; mobile keeps reference customer context and reachable sticky actions without covering content or bottom navigation | Browser at 1440, 768, 390 and 320 px; overflow and last-item visibility |
| B-4 | Blocked, missing-data, paused and duplicate-pair examples cannot be created; changing search filters never overrides pair checks | Browser negative cases; sample policy clearly marked as proposed |
| B-5 | Interested requires explicit 30-day Complete/Protected Contact confirmation; two independent responses; broker never renders contacts; 15-day and 30-day clocks remain distinct | Customer-preview walkthrough; one acceptance versus mutual interest |
| B-6 | Navigation, filters, dialogs, feedback, empty/loading/error and long-text states remain understandable and keyboard usable | Keyboard Escape/focus return; sample-state controls; browser console |
| B-7 | Admin versus Advisor/Coordinator/Viewer preview reflects assigned-book visibility and creation capability | Role walkthrough; fixtures only, never presented as real authorization |

Validation mode: browser interaction, build and structural checks. Production authorization, matching and delivery tests are outside this fictional wireframe app. No TDD suite is added for styling; the contract defines observable walkthroughs that can reject disconnected or misleading controls.

## Design decisions

- Exact palette: Navy `#192A56`, Pearl `#FCFBFB`, Sand `#F7D794`, Rose `#EDA6A3`, Sage `#9DBEBB`, Structure `#E8E6E6`. Navy text is used on status accents. Derived `#596780` is used for secondary text because Structure on Pearl is unreadable. Functional input outlines use navy-derived contrast; Structure remains a subtle content divider. Palette proportions are visual hierarchy guidance, not a pixel quota.
- Macro spacing uses 8/16/24/32 px; 4 px is the user-approved micro-spacing exception. Touch controls use 48 px targets. Card radius is 16 px, controls 8 px, status badges pill-shaped. Shadows contain low-opacity navy, never pure black.
- An even grid governs substantive profile comparisons and card groups. Responsive layouts may show a single stacked column for readability. The action bridge is centered beneath the pair headers on desktop, rather than floating over data rows.
- Mobile bottom navigation and action bars reserve separate safe-area-aware space. A sticky reference header says who is being matched. “Skip for now” only navigates to another result; it does not reject, blacklist or store a new customer preference.
- Below 360 px, the visible Introduction tab reads “Pairs” while its accessible name remains “Introductions”; the full label is restored on larger screens. The review marker is available through Review controls at this size. This avoids unreadable text or overlapping tabs.
- The profile uses intentional photo placeholders. They represent the server-authorized Broker Standard media projection, not permission to expose every owner photo. No stock person's photo is represented as a customer.
- A successful liveness check is labelled “Liveness complete,” never “identity verified.” It is not proof of age or profile truth.
- Errors retain inline recovery. Success toast lasts four seconds, pauses on hover/focus, and is announced. Keyboard navigation and repeated list/filter operations do not animate. Occasional dialogs/toasts use 180 ms transform/opacity feedback and respect reduced motion.
- Single shared responsive components, Tailwind v4 CSS-first tokens, existing Lucide icon family at 1.5 px, Radix Dialog for focus trapping and Escape behavior. Next.js serves font assets locally. No heavy data client is needed for fictional in-memory fixtures.
- Broker user response simulation is clearly a separate customer preview, not an ability for employees to record Interested on the customer's behalf.
- A decline does not prevent the other customer recording an independent response while the response window remains open. A mixed Interested/Declined outcome never starts Complete access. New sample references are generated independently for each Introduction; duplicate/reversed active pairs still fail the sample check. Events follow response order and never fabricate activation of an Introduction revoked before sharing.
- Customer-book search and match search retain independent local state, so searching for Customer A does not accidentally eliminate Customer B results. Combined customer filters reset in one URL update. No search name is placed in the URL.
- The creation confirmation asks the broker to acknowledge reviewing both customers' preferences. It is a proposed UX check, not customer disclosure consent or a substitute for server validation.
- No general Tasks, custom questionnaires, linked-family login, AI ranking, percentages, cross-agency discovery or WhatsApp automation are introduced. Intro-specific reviewed responses and portfolio clarification are grounded in existing workflows. Follow-up ownership/date editing remains a later product decision.

## References inspected

All four Behance projects were inspected in the browser on 13 October 2026; the text-fetch tool returned 403, but the browser rendered their project images. These are visual references, not product authority:

- [Realtiq](https://www.behance.net/gallery/247462635/Realtiq-Real-Estate-CRM-Dashboard-UI): visual exploration cards, search near results, readable administrative shell.
- [VaultIq](https://www.behance.net/gallery/244774129/VaultIq-SaaS-Dashboard-Ui-Design): grouped information, stable navigation, compact summary rhythm. Financial charts and AI features are not relevant to the pilot.
- [Applying UX Laws](https://www.behance.net/gallery/244537483/Applying-UX-Laws-in-Real-Design): accessible targets, limited immediate choices, familiar navigation and grouped profile sections. Scanning-pattern heuristics are design aids, not guarantees about every user's gaze.
- [MoveNest](https://www.behance.net/gallery/242692889/MoveNest-Smart-Packer-Movers-SaaS-Platform): human presentation and clear progression from an offline workflow to digital interactions.

## Production handoff anchors

| Existing file / function | Required future integration |
| --- | --- |
| `src/features/broker-introductions/server/broker-introduction.service.ts` — `listEligibleBrokerIntroductionRecipients`, `createBrokerIntroduction`, `markBrokerIntroductionShared` | Safe card projection, approved authoritative compatibility explanations, create-time revalidation, real activation state |
| `src/features/broker-introductions/server/broker-introduction.contract.ts` — `eligibleBrokerIntroductionRecipientSchema` | Currently only reference/name/gender/location; extend through authorized projection, not raw portfolio rows |
| `supabase/migrations/20261013210000_hierarchical_location_matches.sql` — `get_hierarchical_matches` | Geographic candidate expansion requires agency/assignment authorization and safe projection before any client response |
| `src/app/brokerdesk/w/[workspaceRef]/customers/[relationshipRef]/page.tsx` | Actual Broker Standard viewer and staff assignment presentation |
| `src/features/broker-introductions/server/broker-introduction.service.ts` — `listBrokerIntroductions`, `markBrokerIntroductionResponseReviewed` | Workspace-wide list/detail projection and existing reviewed-response action |
| NAK-79 mutual-interest resolver/response transaction | Preserve pinned versions, immutable responses, explicit consent and separate expiry clocks |
| NAK-80 provider-neutral outbox | Queued/accepted/delivered/read are distinct signals; future AiSensy integration requires separate opt-in and approved delivery contract |

## Status and checks

Implemented as a local design artifact on 13–14 October 2026. Latest remote main was rechecked and remains `eab2864`. Nothing is committed, pushed, published or written to Linear. The original checkout's user changes remain untouched.

| Before | After | Why |
| --- | --- | --- |
| Stage A customer table and text-first results | Cards/list switch and visual candidate exploration | Familiar administration plus recognition of people |
| Independent pair summaries | Shared two-column fact rows and a centered action bridge | Reduces the need to remember values across profiles |
| Mobile navigation at the top | Bottom tabs, persistent reference context and a separate sticky action bar | Keeps actions reachable while preserving reading space |
| Generic status feedback | Distinct creation, activation, notification queue, two responses and two expiry clocks | Avoids implying delivery, consent or contact release from the wrong event |
| One shared search value and separate reset calls | Independent search contexts and atomic filter reset | Fixes actual walkthrough cases that produced misleading empty results |

| Check | Result |
| --- | --- |
| B-1 palette/fonts | Passed: browser computed Pearl `rgb(252,251,251)`, Navy `rgb(25,42,86)` and Inter; source contains all six exact theme colors, Jakarta heading font, only 400/500/600 weights and navy-tinted shadows |
| B-2 workflow | Passed in development and compiled preview: customer → match → pair → create confirmation → activation → share dialog → independent responses → mutual-interest status |
| B-3 responsive | Passed at 1440, 768, 390 and 320 px: no horizontal overflow; 320 px header stays on one row; primary action remains above mobile navigation |
| B-4 negative cases | Passed: same gotra creation disabled, missing Manglik explanation, active duplicate-pair explanation, paused/invited portfolios unavailable, no-result recovery, full filter reset |
| B-5 disclosure | Passed: Interested disabled without confirmation; one acceptance leaves contact access closed; second confirmed acceptance starts the separate 30-day interval; mixed response and revocation do not release contact; broker frames contain no contact values |
| B-6 exception/accessibility | Passed selected checks: named native controls, loading `aria-busy`, actionable empty/error states, long-name layout at 320 px, Escape focus return, heading focus when a response opener becomes disabled, restrained/reduced-motion variants inspected |
| B-7 roles | Passed: Admin sees 8 fictional customers; Advisor/Coordinator/Viewer see Maya's 5 assigned records; Advisor can find matches; Coordinator/Viewer cannot create; Viewer cannot flag clarification |
| Prototype lint | Passed from repository root with `--max-warnings=0 --rule 'no-undef: error'`; a missing Settings icon import found during the walkthrough was corrected and compiled Settings retested |
| Compiled prototype | `npm run build` passed; `npm run start` serves the isolated app locally |
| Repository TypeScript | `npm run typecheck` passed with the prototype present |
| Clipboard | Browser reports successful example-link copying; the browser tool's separate clipboard read returned empty, so OS clipboard readback is not claimed |
| Code graph | `graphify update .` completed; SQL remains outside AST coverage because `tree_sitter_sql` is absent. SQL dependencies were inspected directly, not inferred from graph coverage |

Fresh compiled-preview console checks and final screenshots are recorded after the final UI pass. These are selected prototype checks, not a full accessibility certification, production security audit, live worker/provider test or evidence of broker usability. Broker testing remains the next design validation step.

Run locally from `design/prototypes/nak-200-stage-b` with `npm ci`, then `npm run dev`; open `http://127.0.0.1:3100`. The sample scenario is fixed at 13 October 2026 and resets on reload. The sharing example uses `.invalid` and an opaque reference; no message is sent. Review controls expose sample loading, empty, error, long-text and role states.

Screenshots: [Customer book](evidence/nak-200-stage-b/customers-desktop.jpg), [desktop pair](evidence/nak-200-stage-b/pair-desktop.jpg), [mobile pair](evidence/nak-200-stage-b/pair-mobile.jpg), [320 px layout](evidence/nak-200-stage-b/pair-mobile-320.jpg). The photos are wireframe placeholders, not real customer media.
