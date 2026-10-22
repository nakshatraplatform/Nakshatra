# NAK-208 VivIntroDesk UI system and wireframes

Status: ready for product review

## Problem

VivIntroDesk has working BrokerDesk surfaces and earlier prototypes, but the
older wireframes predate the approved family-assisted contract and use one
global Introduction sharing action. Installing complete UI kits would also
risk conflicting components and a disconnected B2B visual language.

## Goal

Produce one owned, responsive VivIntroDesk UI contract and clickable prototype
that makes the core broker workflow understandable without changing production
behavior.

## Contract

- Use the existing Next.js, React, Tailwind and Lucide stack.
- Use Radix only for selected accessible interaction behavior.
- Treat Astro themes as page-composition references, not source packages.
- Keep personal B2C production routes and components unchanged.
- Model A-side and B-side sharing independently.
- Show family proposals as non-authorizing setup records.
- Keep family reports distinct from candidate responses.
- Preserve 15-day response and 30-day Complete clocks.
- Show no Protected Contact, financial data, raw email, phone or cross-agency
  activity in broker frames.

The detailed contract is
[`design/brokerdesk/nak-208-vivintrodesk-ui-contract.md`](../../../design/brokerdesk/nak-208-vivintrodesk-ui-contract.md).

## Scope

- preserve the Stage A and Stage B design evidence;
- move active wireframe ownership from the conflicting NAK-200 branch name to
  `feat/nak-208-vivintrodesk-ui-wireframes`;
- update the clickable prototype to current family and sharing rules;
- document the internal component system and page reference policy;
- validate build, keyboard-critical interactions and key desktop/mobile paths.

## Non-goals

- production route replacement;
- database, RPC, RLS or API changes;
- real authentication or provider integration;
- sending email or WhatsApp messages;
- implementing an unapproved matching policy;
- personal B2C UI changes; or
- deploying or publishing the prototype.

## Expected files

- `design/brokerdesk/nak-208-vivintrodesk-ui-contract.md`
- `design/prototypes/nak-200-stage-b/`
- `design/brokerdesk/evidence/nak-208/`
- `docs/vivintrodesk-mvp-contract.md`
- `docs/vivintrodesk-document-map.md`
- `docs/engineering-loop/PROJECT.md`

## Acceptance criteria

- [x] prototype is clearly labeled NAK-208 and fictional;
- [x] one component and token system is used;
- [x] customer details show candidate-controlled family setup status;
- [x] broker can exercise separate share actions for both sides;
- [x] family updates do not mutate candidate responses;
- [x] Interested copy states current opposite viewer count and freeze behavior;
- [x] mutual interest records frozen counts and 30-day access;
- [x] build and applicable static checks pass;
- [x] core path is verified at desktop, 390 px and 320 px; and
- [x] no production or B2C source files are changed.

## Progress

- Existing Stage A/B prototype and evidence recovered from the isolated
  worktree and synchronized to `origin/main` at `d88f14e`.
- Working branch renamed to `feat/nak-208-vivintrodesk-ui-wireframes` so NAK-200
  remains reserved for the V3 consent/RBAC foundation.
- UI reference policy and owned component contract documented.
- Family roster summaries, side-specific sharing, family reports and
  viewer-aware Interested confirmation added to the fictional prototype.
- The authoritative MVP contract and document map now state the bounded
  candidate-authorized Family Viewer model; the previous blanket deferral is
  removed.
- Independent review corrections make candidate response controls explicit
  prototype-only simulations, remove invented astrology blockers and retire
  the remaining global-activation wording.

## Validation

- `npm run build`: passed with Next.js 16.3.8; `/` and `/_not-found`
  prerendered successfully.
- ESLint over the prototype `app`, `components` and `lib`: passed with zero
  warnings.
- Browser walkthrough: passed for separate A/B sharing, explicit
  broker-confirmed sharing, candidate disclosure consent, mutual interest,
  frozen family-viewer counts and the 30-day Complete-access state.
- Candidate-response simulation check: passed; both the workspace and dialog
  state that the controls are fictional and must not become broker actions.
- Pair-policy check: passed; readiness and duplicate-pair rules may block,
  while horoscope differences are presented only as advisory facts.
- Family proposal walkthrough: passed; a proposal remains labelled
  `Candidate approval needed` and does not become active access.
- Responsive checks at 1440 px, 390 px and 320 px: no horizontal page
  overflow or page errors.
- Dialog keyboard check at 390 px and 320 px: Escape closes the dialog and
  focus returns to the triggering action.
- Failed-resource check on the customer route: no HTTP responses at 400 or
  above.
- Evidence:
  `design/brokerdesk/evidence/nak-208/customer-family-desktop.png` and
  `design/brokerdesk/evidence/nak-208/introduction-mobile.png`.

## Review handoff

This is a workflow and visual contract, not authorization implementation. The
prototype may be approved for production translation only after reviewers can
explain the difference between:

1. broker-proposed and candidate-approved Family Viewers;
2. a broker-recorded family report and the candidate's final response;
3. opening a WhatsApp share sheet and confirming that one side was actually
   sent the Introduction; and
4. the 15-day response window and the separate 30-day Complete-access window.

Residual gaps are intentional for a wireframe: there is no real candidate
session, second-workspace isolation fixture, server authorization, RLS,
notification delivery, expiry worker or frozen-viewer enforcement. Physical
mobile devices, WhatsApp handoff, full screen-reader use, high zoom and
reduced-motion behavior remain production validation work.
