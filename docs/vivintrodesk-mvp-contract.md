# VivIntroDesk MVP product, business, and engineering contract

Status: **authoritative current contract**, reconciled through merged NAK-78 on
22 September 2026. When an older BrokerDesk plan, prototype, feature record, or
chat summary conflicts with this file, this file wins. See
[the document map](./vivintrodesk-document-map.md) before using historical plans.

## Product and business position

VivIntroDesk is the broker-facing extension of VivIntro. It helps matrimonial
brokers replace Excel sheets, biodata folders, untracked WhatsApp forwarding,
and personal memory with a small, accountable Introduction workflow. It is not
a general CRM and does not replace the broker's judgement or conversations.

The broker agency is the planned paying customer. The initial commercial
hypothesis is subscription pricing by active-customer capacity, team seats, and
Introduction volume. Exact plans and prices remain pilot hypotheses, not launch
commitments. Customers use the canonical VivIntro portfolio and all
broker-sponsored actions without a separate consumer charge.

VivIntro remains usable outside a broker relationship through its personal
sharing workflow. Personal monetization, VivIntro Plus, usage allowances, and
payments are deferred until the broker pilot and B2C usage produce evidence.
Decline, block, report, revocation, broker consent, and responding to a broker
Introduction must never be paywalled.

Broker package names and benefits remain agency-defined. VivIntroDesk may
record operational labels, dates, payment state, and renewal dates without
interpreting or enforcing what a broker's Silver, Gold, or other package means.
Custom agency questionnaires are deferred from the MVP; they must not expand
the canonical portfolio or Broker Standard projection accidentally.

## Product primitive

The Introduction is a bilateral relationship between two canonical VivIntro
customers selected from one broker workspace. Both customers must have an
active broker relationship and mandate, a completed and published portfolio,
and current Didit identity verification. Selecting one customer dynamically
shows every other eligible customer in that workspace; no label, email field or
fixed customer position defines the second participant.

One Introduction pins both customers' current disclosure versions and remains
active for 15 days unless revoked earlier. Each customer signs in, sees the
other customer's Broker Standard Profile and responds independently. A customer
may still be represented by multiple brokers, but every agency has independent
Introduction lineage and cannot discover another agency's activity.
Within one agency, the unordered customer pair has at most one active
Introduction, preventing duplicate or reversed sends by different employees.

## Disclosure contract

| Context | Data shown | Contact | Financial | Horoscope attachment | Response |
| --- | --- | --- | --- | --- | --- |
| Broker Introduction opened by either selected signed-in customer | Other customer's Broker Standard Profile | Hidden | Hidden | Visible when published | Independent accept/decline |
| Broker Introduction opened signed-out or by anyone else | Nothing; sign-in or neutral unavailable state | Hidden | Hidden | Hidden | Not allowed |
| Personal VivIntro link | Detailed Introduction; guest account not required | Hidden | Hidden | Per existing B2C rules | Existing B2C flow |
| Personally approved access | Complete Portfolio | Visible for the approved period | Existing Complete rules | Per existing Complete rules | Existing B2C flow |

Broker Standard is generated from the published Complete data. It is not an
editable copy and a broker cannot select its fields. It includes ordinary
personal, family, education, professional, lifestyle, preference and horoscope
information, but excludes:

- every contact, email and phone field;
- annual income, currency, wealth stage and credit information;
- owner-private notes and private package-questionnaire answers;
- exact birth time and other restricted identity details;
- internal identifiers and geographic reference identifiers.

The projection and media manifest are pinned to the publication version used by
the Introduction. A later portfolio update does not silently change an existing
Introduction.

## Consent and authority

- The customer owns the single canonical portfolio.
- An active, time-bound broker mandate authorizes Broker Standard sharing.
- The broker cannot edit, publish or unpublish the customer portfolio.
- No per-Introduction owner approval is required during the pilot.
- Creating an Introduction requires both customers to be publishable and
  identity-verified; completion automatically controls broker eligibility.
- Each customer's response is independent and immutable.
- Revocation, mandate termination, unpublishing and expiry fail closed.
- Contact release after mutual interest is not implemented through NAK-78. The
  next contract must make the meaning of **Interested** explicit: if both
  customers choose it, each receives the other customer's Complete Portfolio,
  including Protected Contact, for 15 days. There is no second contact-approval
  step, but this disclosure consequence must be confirmed at response time.

## URL and authorization contract

An opaque broker URL identifies a possible Introduction but grants no
disclosure. It contains no bearer pass. The server derives the participant from
the current live VivIntro session and the two stored candidate owners; changing
the URL or request body cannot select a customer, agency, version, side or
disclosure tier. Forwarding a broker URL grants no access and never falls back
to a public profile.

This restriction applies only to BrokerDesk Introductions. The personal
VivIntro `/p/<opaque-token>` flow deliberately remains guest-viewable and keeps
its existing B2C progressive-disclosure rules.

## Explicitly deferred

- cross-broker discovery, notification or coordination;
- linked-family accounts and email membership;
- custom agency questionnaires and sensitive package fields;
- mutual-interest Protected Contact release and split-representation resolution;
- VivIntro Plus entitlements, payments and usage metering;
- broker task management and general-purpose CRM functionality.

These items require separate validation and must not be added as incidental
extensions of the Broker Standard Profile.

## Current implementation checkpoint

Merged on `main`:

- broker organization onboarding, representative verification foundations,
  entitlement gates, team roles, invitations, MFA and fresh reauthentication;
- customer invitations, canonical portfolio ownership, agency relationships,
  time-bound mandates, and customer pause/renew/terminate controls;
- immutable disclosure versions and the generated Broker Standard projection;
- bilateral same-agency Introduction creation between two eligible customers;
- authenticated participant-only Broker Standard access and independent
  responses; and
- fail-closed revocation, cross-agency isolation, audit foundations, and
  customer-dashboard visibility.

The legacy one-recipient device-pass path is retired for new Introductions and
its active credentials are revoked/scrubbed by NAK-78.

## Recommended next implementation sequence

1. **NAK-79 — Mutual-interest Complete Portfolio release.** Confirm disclosure
   when each customer chooses Interested; after both accept, create reciprocal,
   identity-bound 15-day Complete access using existing Protected Contact and
   grant foundations. Rejection, expiry, revocation, and split/invalid ownership
   must fail closed.
2. **Notifications and recovery.** Deliver and retry Introduction, response,
   mutual-interest, expiry, and revocation notifications through the existing
   outbox without making email delivery the source of truth.
3. **Pilot operations.** Add only the minimum operator activation, expiry worker,
   monitoring, and two-broker staging evidence needed for a bounded pilot.
4. **Broker UX refinement.** Validate dashboard, customer selection, response
   follow-up, and mobile/WhatsApp handoff with real brokers before adding Tasks,
   analytics, recommendations, questionnaires, or payments.
