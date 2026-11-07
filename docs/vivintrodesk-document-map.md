# VivIntroDesk document map

Last reconciled: 7 November 2026

This map tells contributors and agents which VivIntroDesk documents are current
contracts and which are retained only for history. Do not combine incompatible
rules from multiple generations of the design.

## Read first

1. [`vivintrodesk-mvp-contract.md`](./vivintrodesk-mvp-contract.md) — the
   authoritative product, business, disclosure, authorization, and next-phase
   contract.
2. [`portfolio-data-classification.md`](./portfolio-data-classification.md) —
   current projection and sensitive-data boundaries.
3. The relevant current feature or design record:
   [`NAK-76`](./engineering-loop/features/nak-76-broker-standard-profile.md),
   [`NAK-77`](./engineering-loop/features/nak-77-customer-broker-consent-controls.md),
   [`NAK-78`](./engineering-loop/features/nak-78-authenticated-broker-introduction-access.md),
   [`NAK-79`](./engineering-loop/features/nak-79-mutual-interest-complete-access.md),
   [`NAK-200`](./engineering-loop/features/nak-200-v3-consent-rbac-foundation.md),
   [`NAK-201`](./engineering-loop/features/nak-201-family-viewer-identity-foundation.md),
   [`NAK-202`](./engineering-loop/features/nak-202-assisted-customer-onboarding.md),
   [`NAK-203`](./engineering-loop/features/nak-203-family-introduction-dashboard.md),
   [`NAK-204`](./engineering-loop/features/nak-204-introduction-action-workspace.md),
   [`NAK-205`](./engineering-loop/features/nak-205-broker-recorded-responses.md),
   [`NAK-206`](./engineering-loop/features/nak-206-frozen-family-introduction-access.md),
   or [`NAK-208`](./engineering-loop/features/nak-208-vivintrodesk-ui-wireframes.md).
4. Current source, migrations, and tests. Documentation never overrides the
   implemented security boundary silently; reconcile any mismatch explicitly.

## Current supporting documents

- [`NAK-202 database evidence`](./engineering-loop/features/nak-202-database-validation.md)
  records supplemental PostgreSQL execution and the B2C baseline comparison.
  The [NAK-204 validation record](./engineering-loop/features/nak-204-introduction-action-workspace.md#supabase-postgresql-17-database-validation-7-november-2026)
  contains the passing Supabase PostgreSQL 17 database job for the combined branch.

- [`creator-publication-and-introduction-lifecycle.md`](./creator-publication-and-introduction-lifecycle.md)
  defines publication readiness shared by personal and broker flows.
- [`dashboard-relationship-lifecycle.md`](./dashboard-relationship-lifecycle.md)
  defines the personal B2C approval lifecycle; it is not the broker response
  state machine.
- [`guest-approved-portfolio-viewing-app.md`](./engineering-loop/features/guest-approved-portfolio-viewing-app.md)
  describes the merged accountless personal viewing flow from PR #144. Personal
  browser proofs do not authorize BrokerDesk or Family Viewer access.
- [`structured-location-capture.md`](./engineering-loop/features/structured-location-capture.md)
  defines the coordinate-free India/US location-entry and persistence contract.
- [`hierarchical-location-matching.md`](./engineering-loop/features/hierarchical-location-matching.md)
  defines the service-only country-safe geographic expansion RPC and index strategy.
- [`vivintrodesk-family-assisted-data-architecture.md`](./vivintrodesk-family-assisted-data-architecture.md)
  defines the planned family-assisted tables, constraints, indexes, RPCs,
  endpoints, query shapes, migration order, and performance evidence. NAK-200
  is merged; NAK-201 implements only its candidate-owned identity and roster
  foundation. NAK-201 is merged; NAK-202 implements the assisted onboarding
  pages, delivery handoff and application adapters on the combined feature
  branch, with local database validation complete.
  NAK-203 adds the authenticated family metadata dashboard on the combined
  feature branch. Family portfolio disclosure remains deferred to NAK-206.
  NAK-204 adds the broker Introduction action list/workspace, per-side manual
  sharing records and reminder attempts locally on the combined branch.
- [`vivintrodesk-business-model-family-review.md`](./vivintrodesk-business-model-family-review.md)
  is a plain-language explanation for family, friends, and pilot brokers.
- [`design/brokerdesk/nak-208-vivintrodesk-ui-contract.md`](../design/brokerdesk/nak-208-vivintrodesk-ui-contract.md)
  defines the current B2B component, navigation, family-assistance and
  side-specific Introduction wireframe contract. It does not grant runtime
  authority or supersede server authorization.
- [`design/brokerdesk/BROKERDESK_MASTER_PLAN.md`](../design/brokerdesk/BROKERDESK_MASTER_PLAN.md)
  is the historical planning index and implementation log. Its current-status
  section points back to the authoritative contract.

## Historical documents

The Phase 0A–0F plans, Phase 1 plan, clickable prototypes, and
`broker-introduction-system-design.md` preserve earlier research and decisions.
They contain superseded concepts including a global pair case with private
broker routes, 30-day broker-route clocks, device-pass claims, Detailed
fallback, earlier linked-family variants, early Tasks/CRM scope, custom
questionnaires, and premature pricing or metering. Only the bounded
candidate-authorized Family Viewer model now stated in the authoritative MVP
contract is current.

`broker-mediated-introduction-foundation.md` is partially historical: its
customer invitation, ownership, and mandate boundaries remain useful, while
its claim-token/device-pass Introduction delivery rules are retired.

Feature records are evidence of what a phase intended and learned. Later feature
records may supersede parts of earlier ones; for example, NAK-78 supersedes the
NAK-76 device-pass and Detailed-fallback transport while retaining its Broker
Standard projection, and NAK-79 adds the explicit mutual-interest Complete
Portfolio release that NAK-78 deliberately deferred.

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
