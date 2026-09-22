# VivIntroDesk document map

Last reconciled: 22 September 2026

This map tells contributors and agents which VivIntroDesk documents are current
contracts and which are retained only for history. Do not combine incompatible
rules from multiple generations of the design.

## Read first

1. [`vivintrodesk-mvp-contract.md`](./vivintrodesk-mvp-contract.md) — the
   authoritative product, business, disclosure, authorization, and next-phase
   contract.
2. [`portfolio-data-classification.md`](./portfolio-data-classification.md) —
   current projection and sensitive-data boundaries.
3. The relevant current feature record:
   [`NAK-76`](./engineering-loop/features/nak-76-broker-standard-profile.md),
   [`NAK-77`](./engineering-loop/features/nak-77-customer-broker-consent-controls.md),
   or [`NAK-78`](./engineering-loop/features/nak-78-authenticated-broker-introduction-access.md).
4. Current source, migrations, and tests. Documentation never overrides the
   implemented security boundary silently; reconcile any mismatch explicitly.

## Current supporting documents

- [`creator-publication-and-introduction-lifecycle.md`](./creator-publication-and-introduction-lifecycle.md)
  defines publication readiness shared by personal and broker flows.
- [`dashboard-relationship-lifecycle.md`](./dashboard-relationship-lifecycle.md)
  defines the personal B2C approval lifecycle; it is not the broker response
  state machine.
- [`vivintrodesk-business-model-family-review.md`](./vivintrodesk-business-model-family-review.md)
  is a plain-language explanation for family, friends, and pilot brokers.
- [`design/brokerdesk/BROKERDESK_MASTER_PLAN.md`](../design/brokerdesk/BROKERDESK_MASTER_PLAN.md)
  is the historical planning index and implementation log. Its current-status
  section points back to the authoritative contract.

## Historical documents

The Phase 0A–0F plans, Phase 1 plan, clickable prototypes, and
`broker-introduction-system-design.md` preserve earlier research and decisions.
They contain superseded concepts including a global pair case with private
broker routes, 30-day broker-route clocks, device-pass claims, Detailed fallback,
linked-family access, early Tasks/CRM scope, custom questionnaires, and premature
pricing or metering. These are not current MVP requirements unless the
authoritative contract reintroduces them explicitly.

`broker-mediated-introduction-foundation.md` is partially historical: its
customer invitation, ownership, and mandate boundaries remain useful, while
its claim-token/device-pass Introduction delivery rules are retired.

Feature records are evidence of what a phase intended and learned. Later feature
records may supersede parts of earlier ones; for example, NAK-78 supersedes the
NAK-76 device-pass and Detailed-fallback transport while retaining its Broker
Standard projection.

## Conflict rule

When documents disagree, use this order:

1. explicit current user/product decision recorded in the authoritative MVP contract;
2. merged migrations, authorization code, and security tests;
3. current feature record for the affected capability;
4. current supporting documents;
5. historical phase plans and prototypes.

Do not resolve a material conflict by guessing. Record the question and obtain a
product decision before changing disclosure, consent, pricing, identity, or
cross-agency behavior.
