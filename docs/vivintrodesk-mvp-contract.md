# VivIntroDesk MVP contract

Status: approved implementation contract for NAK-76 and subsequent MVP phases.

## Product primitive

The Introduction remains a one-recipient transaction. A broker selects one
customer under an active mandate, enters a recipient family label and optionally
an email, and shares an opaque link active for 15 days unless revoked earlier.
The recipient does not need
to be an existing VivIntro customer. This avoids making broker adoption depend
on both sides completing onboarding.

There is no target-customer, target-agency or target-broker lookup. A customer
may be represented independently by multiple brokers; each agency remains
isolated and cannot discover the others.

## Disclosure contract

| Context | Data shown | Contact | Financial | Horoscope attachment | Response |
| --- | --- | --- | --- | --- | --- |
| Broker link with active pass | Broker Standard Profile | Hidden | Hidden | Visible when published | Allowed |
| Broker link without active pass | Detailed Introduction | Hidden | Hidden | Hidden | Not allowed |
| Personal VivIntro link | Detailed Introduction | Hidden | Hidden | Per existing B2C rules | Existing B2C flow |
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
- Revocation, mandate termination, unpublishing and expiry fail closed.
- Contact release after mutual interest is not implemented in NAK-76; it needs a
  separate explicit consent contract before development.

## URL and authorization contract

An opaque URL identifies a possible Introduction but grants no disclosure by
itself. The current MVP retains the single-use pass and HttpOnly device session.
The server derives disclosure from stored Introduction state and the validated
pass; a URL or request-body change cannot select a customer, agency, version or
disclosure tier.

Identity-bound verified-email access and linked-family membership are later
phases. Until then, a forwarded or unclaimed broker URL fails down to Detailed
Introduction rather than attempting to infer family identity.

## Explicitly deferred

- two-party/pair Introduction records and mutual broker selection;
- cross-broker discovery, notification or coordination;
- linked-family accounts and email membership;
- custom agency questionnaires and sensitive package fields;
- automatic contact release and split-representation resolution;
- VivIntro Plus entitlements, payments and usage metering;
- broker task management and general-purpose CRM functionality.

These items require separate validation and must not be added as incidental
extensions of the Broker Standard Profile.
