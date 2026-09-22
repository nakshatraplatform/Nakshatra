# VivIntroDesk MVP contract

Status: approved implementation contract, reconciled through NAK-78.

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
- Contact release after mutual interest is not implemented in NAK-76; it needs a
  separate explicit consent contract before development.

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
