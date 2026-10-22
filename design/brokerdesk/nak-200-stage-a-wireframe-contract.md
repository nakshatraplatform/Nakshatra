# NAK-200: VivIntroDesk Stage A wireframes

Status: low fidelity design proposal, based on `origin/main` at `fdc948a` (10 October 2026). No production route, database rule, or notification provider is changed by this artifact.

Prototype: [Open the Stage A walkthrough](../prototypes/vivintrodesk-nak-200-stage-a.html).

## Reference and authority

The Claude artifact supplied for reference currently requires a Claude sign-in in this environment, so its screens could not be inspected. The historical Phase 0B/0F prototypes were inspected for visual and navigation ideas only. Current rules come from `docs/vivintrodesk-document-map.md`, `docs/vivintrodesk-mvp-contract.md`, `docs/portfolio-data-classification.md`, NAK-76 through NAK-80 feature records, current source, migrations, and tests.

The authoritative contract takes precedence over the old prototypes. In particular, the Stage A flow uses one same-agency bilateral Introduction, a 15-day response window, authenticated participant access, and 30-day reciprocal Complete access after both customers choose Interested. Choosing Interested includes explicit confirmation of that disclosure consequence. There is no later approval step. The broker sees response status, never either customer's Protected Contact.

The contract's NAK-80 “in progress” sentence is stale relative to `origin/main`: the notification migration and worker have merged. Live provider configuration and delivery proof remain separate operational checks.

## Objective

Help one advisor in a 3–5 person agency move from a represented customer to a suitable second customer, a safely created Introduction, and a clear follow-up. Every screen answers one practical question. Agency data remains isolated, and every customer still owns their canonical VivIntro portfolio.

The clickable HTML uses fictional sample data and local browser state only. No button creates a real customer, Introduction, message, or disclosure.

The Aditi/Rohan frames are successive moments of one example, rather than simultaneous live records. Match review shows the moment before creation when Aditi's publication was version 3. Customer detail and Today show a later moment after she published version 4; the Introduction still references version 3.

## Inspiration translated to VivIntroDesk

The [monday CRM presentation](https://monday.com/ap/crm) and [SmartMatchApp feature catalogue](https://smartmatchapp.com/en/features) were reviewed on 10 October 2026 as interaction references, not as product specifications. The third reference is the common ATS pattern of search → assess → decide. Their promotional animations and screenshots are not copied.

| Reference pattern | Keep for a 3–5 person broker team | Do not import |
| --- | --- | --- |
| Lightweight CRM | Scannable customer rows, readable status chips, and a Today queue ordered by action rather than charts | Sales pipeline stages, forecasting, endless columns, and configurable boards |
| Matchmaking CRM | Pair-specific review, explicit reasons a person is ready/blocked, and an Introduction history in one place | Compatibility percentages, AI ranking, arbitrary profile-field selection, and sharing to outside companies |
| ATS | Search within one agency, narrow candidates with optional filters, inspect a pair, then make one Introduction decision | Applicant stages, bulk shortlists, and a second shadow copy of a customer's portfolio |

This iteration puts **Needs attention** before summary counts. The matching workspace starts with name and location; age, height, marital status, diet, community, sub-caste, Manglik, and visa/relocation are under **More filters**, with an active-filter count and one clear action. Result status is a separate quick switch, defaulting to **Ready to review** while keeping **Needs information** and **Blocked** one tap away. Counts update as the sample list is narrowed. Filters narrow fictional sample results in the prototype; they do not determine eligibility. The live server must make that decision.

Motion is reserved for occasional feedback: a subtle press response and a short dialog entrance. Repeated row navigation, keyboard actions, and status changes remain immediate. Reduced-motion preference removes movement. The visual language remains VivIntro's restrained ink, paper, and teal rather than monday's sales-pipeline colors or SmartMatchApp's marketing gradient.

## Primary path

1. **Today:** identify a response, expiry, or portfolio update that needs work.
2. **Customers:** find a represented customer or send one email invitation.
3. **Customer detail:** verify active mandate, publication, liveness, and agency assignment. Review the permitted Broker Standard portfolio.
4. **Find matches:** select from the same agency's eligible customers. Apply proposed deterministic filters and inspect human-readable exclusions.
5. **Match review:** compare the pair and confirm there is no active Introduction for the unordered pair in this agency.
6. **Create Introduction:** review both pinned publication versions and the 15-day response deadline, then create.
7. **Share:** activate the opaque participant-only URL, then use the broker's trusted WhatsApp conversation or supported notification channel. Provider choice stays behind the notification boundary.
8. **Introductions and detail:** track both independent responses, expiry, revocation, mutual access, and broker follow-up.

The participant response inset is included to validate the disclosure explanation: before Interested, the participant is told that reciprocal Complete Portfolio and Protected Contact will become available for 30 days if the other participant also chooses Interested.

## Screen inventory

| Frame | Main question | Primary action | Important states |
| --- | --- | --- | --- |
| Today | What needs my attention? | Open the next customer/Introduction | Empty, expiring, response, update |
| Customers | Who is in my agency book? | Invite customer | Search, invited, ready, paused, expired |
| Customer detail | Is this customer ready and who helps them? | Find matches | Missing publication, mandate or verification; new version |
| Find matches | Who can I consider for this customer? | Review a pair | Eligible, needs information, blocked, previously introduced |
| Match review | Why is this pair suitable? | Continue to Introduction | Explicit rule reasons, permitted portfolio preview |
| Create and share | Exactly what will be shared, to whom, and until when? | Create, then activate and copy | Created versus shared; notification method and failure |
| Introductions | Which pairs need follow-up? | Open Introduction | Waiting, one response, mutual interest, declined, expired |
| Introduction detail | What happened and what should I do next? | Follow up or revoke | Version pin, both responses, separate 30-day access clock |

## Current implementation and design dependencies

| Capability | Current evidence | Stage A treatment |
| --- | --- | --- |
| Today queue and metrics | `BrokerdeskDashboardClient`; `brokerdeskDashboardSchema` | Keep the action-first pattern. |
| Customer invitation/list/detail | Customer invitation and detail contracts/routes; customer pages | Reframe into a searchable list and readiness-led detail. Search and assignee filters require API support. |
| Team roles and assignments | Organization access and team contracts; `assignedTeam` on customer detail | Show assignee in customer detail. Assignment editing is a later implementation dependency. |
| Broker Standard and immutable versions | `portfolio_disclosure_versions`; Introduction creation and resolver | Show preview and pinned version labels. Do not render Complete or contact in broker frames. |
| Same-agency Introduction creation | `createBrokerIntroduction` and database RPC | Preserve separate create and activate/share states. |
| Bilateral response and mutual access | NAK-79 migration, response schema, participant resolver | Show independent status and explicit Interested disclosure consequence. |
| Durable notification | NAK-80 outbox and Resend worker | Show a generic communication state. WhatsApp/AiSensy is a future provider adapter, not implemented on main. |
| Match filters and rules | Gotra, Manglik, age, height, marital status, community, sub-caste, diet, location, visa and preference fields exist in portfolio data; recipient API returns only name, gender and location | Mark the workspace as a proposal. Server-side normalization, rule evaluation, explanations and tests must precede a live match screen. |
| Workspace-wide Introduction list/detail | Introduction resolver is customer-scoped; broker detail is embedded in customer detail | New navigation and projections are needed before implementing the standalone frames. |

## Matching design decision needed before implementation

The earlier product brief calls same-gotra a hard exclusion and calls for Manglik, age, height, marital status, community, sub-caste, diet, location, visa and preference checks. The current MVP contract does not yet specify a matching policy. Stage A illustrates these rules but does not claim they are enforced. Before development, record the exact policy, which fields are mandatory, how unknown values behave, and whether a broker can override any non-safety preference. The server must make the final decision; client filters are only a view of that decision.

Proposed display vocabulary:

- **Eligible:** required facts are present and current policy allows an Introduction.
- **Needs information:** a required fact is missing or ambiguous. The broker asks the customer to update their own portfolio.
- **Blocked:** a non-overridable rule fails, a customer is not ready, or an active same-pair Introduction already exists.

No compatibility percentage or AI ranking is shown.

## Information architecture and component rules

Primary navigation: Today, Customers, Introductions, Team, Settings. “Find matches” begins within a customer record. In Stage A, Team and Settings appear as orientation destinations; their detailed frames follow the core flow.

Use one primary action per page. Desktop lists favor rows over card grids. On narrow viewports, rows stack in reading order with actions still visible. Status always includes text. Empty and blocked states explain the next useful action. All buttons and links are keyboard reachable, have visible focus, and maintain practical touch targets. Dates should be local and explicit in production; sample dates are fixed for review.

The Stage A palette is intentionally restrained. Production visual design should reuse the maintained VivIntro tokens and brand assets rather than copying historical prototype colors. High-frequency row navigation does not animate. Drawers and dialogs may use a short, reduced-motion-aware transition during later fidelity work.

Production navigation should use real links, with search and filter state in the URL so refresh and Back preserve the broker's place. The standalone prototype changes local panels and does not exercise production routing, authorization, notification delivery, or database mutations.

### Source anchors for development handoff

- `src/app/brokerdesk/w/[workspaceRef]/dashboard/brokerdesk-dashboard-client.tsx` and `brokerdeskDashboardSchema`: current action queue and metrics.
- `src/app/brokerdesk/w/[workspaceRef]/customers/[relationshipRef]/page.tsx`: current customer detail and assigned team.
- `src/app/brokerdesk/w/[workspaceRef]/customers/[relationshipRef]/broker-introduction-panel.tsx`: current create, activate/copy, notice, and history actions.
- `src/features/broker-introductions/server/broker-introduction.service.ts`: `listEligibleBrokerIntroductionRecipients`, `createBrokerIntroduction`, and `listBrokerIntroductions`.
- `src/features/broker-introductions/server/broker-introduction.contract.ts`: recipient, Introduction, dashboard, participant and response schemas.
- `src/features/notifications/server/relationship-notification.service.ts`: current email worker and neutral message rendering.
- `supabase/migrations/20260919170000_broker_introduction_lifecycle.sql` and `20260925120000_mutual_interest_complete_access.sql`: pinned bilateral Introduction and reciprocal disclosure state.

## Stage A review tasks

Ask a broker to complete these without explanation:

1. Find which Introduction expires next.
2. Find a customer and explain why they are or are not ready.
3. Find one eligible match and explain why a same-gotra result is blocked.
4. Review both pinned portfolio versions, create the Introduction, and locate the share action.
5. Identify which participant has responded and whether contacts are available.

Record confusing labels, unnecessary navigation, missing facts, and any point where the broker reaches for Excel or WhatsApp to understand state. Stage B should revise these frames, add full mobile and exception-state coverage, then move to visual polish.

## Prototype validation

Checked on desktop and at 390 px and 320 px widths with no horizontal overflow. The Today → Customer → Find matches → Review pair → Create Introduction path remains clickable. Name search, quick result states, optional filters, empty state, clear action, and blocked-gotra explanation were exercised against the sample data. The inline script parsed and the browser reported no console errors. These checks validate only the prototype; they do not establish backend matching, WhatsApp delivery, or production accessibility.

## Open decisions

- Approve the exact deterministic matching policy and missing-value behavior.
- Decide whether invitation remains email-only in the pilot or gains WhatsApp delivery after separate communication opt-in exists.
- Decide whether an agency needs a primary assignee or a set of equal assignees. Current detail data supports a set.
- Define the broker's follow-up recording action after mutual interest without introducing a general Tasks module.
- Confirm notification delivery signals available from a future WhatsApp provider; provider acceptance cannot be displayed as customer delivery.
