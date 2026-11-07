# VivIntroDesk MVP product, business, and engineering contract

Status: **authoritative current contract**, reconciled through merged NAK-201
and the approved family-assisted V1 decisions, reconciled with main on 5 November 2026. When an older
BrokerDesk plan, prototype, feature record, or chat summary conflicts with this
file, this file wins. See
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
and current approved biometric/liveness verification. Selecting one customer dynamically
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
| Personally approved access | Published approved portfolio after explicit owner review; accountless viewer verifies the approved email | Visible for the approved period | Existing approved projection rules | Per existing approved rules | Existing B2C flow; 15-day grant |

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
- NAK-79 makes the meaning of **Interested** explicit: if both customers choose
  it within the 15-day response window, each receives the other customer's
  pinned Complete Portfolio, including Protected Contact, for 30 days from the
  second acceptance. There is no second contact-approval step; each customer
  confirms this disclosure consequence when choosing Interested.

### Family-assisted broker workflow

V1 supports candidate-authorized Family Viewers for broker-linked candidates.
This reflects the normal broker workflow in which parents or close family help
review profiles, while preserving the candidate's final authority.

- A candidate has one family roster across all active broker relationships,
  with at most three active Family Viewers excluding the candidate.
- A broker may collect family details during in-office registration and may
  propose a viewer, but the proposal grants no access.
- Broker proposal acknowledgements are generic. Proposal insertion and history
  are withheld from brokers so email deduplication cannot expose private roster
  membership. Brokers see only the permitted active-viewer aggregate.
- The candidate must approve the proposal and re-enter the family member's full
  email. VivIntro hashes it and requires an exact match with the broker's
  proposal before sending an invitation; the raw address is request-scoped and
  is not stored in the roster or invitation. The family member must then sign
  in with that exact invited Google email before access becomes active.
- An active Family Viewer may view the same opposite Broker Standard Profile as
  the candidate before mutual interest while responses are still open.
- Candidates may respond directly. A scoped broker may also record a final
  response received from the candidate or a parent the candidate authorized
  for that decision. The broker attests to the source and, for Interested,
  explicit consent to disclose the Complete Portfolio and Protected Contact
  to the other candidate and their eligible Family Viewers for 30 days if
  interest is mutual. No repeat in-app response is required.
  Informal family feedback and private broker notes remain separate.
- When both sides confirm Interested and Complete disclosure, the existing
  candidate Complete access window begins. Eligible Family Viewers with
  consent from the candidate whose portfolio they would see are frozen at that
  moment. Older candidate-only consent never opens family Complete access.
- Adding a Family Viewer later does not grant access to an already-mutual
  Introduction. Removing a viewer, revoking an Introduction or expiring its
  window ends the affected access. A pause on either mandate closes the old
  Complete window permanently, including after mandate renewal.
- Before mutual interest, each candidate may see the count of active Family
  Viewers authorized by the opposite candidate, but never their names, email
  addresses or phone numbers.
- Broker users remain limited to Broker Standard. Family access never reveals
  Protected Contact or Complete Portfolio data to the broker workspace.

Personal VivIntro users may still store Protected Contacts for later Complete
Portfolio disclosure. Family Viewer accounts outside an active broker-linked
relationship are not part of V1; a future paid personal capability requires a
separate product decision.

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

PR #144 adds accountless approved personal viewing with email verification and
a browser-scoped proof. That proof is restricted to its personal portfolio
grant. It cannot activate a Family Viewer or authorize a BrokerDesk Introduction.
Broker participants and Family Viewers retain their authenticated-session rules.

## Explicitly deferred

- cross-broker discovery, notification or coordination;
- WhatsApp/phone-only Family Viewer authentication and WhatsApp OTP;
- paid personal Family Viewer access outside broker-linked relationships;
- custom agency questionnaires and sensitive package fields;
- split-representation resolution across different brokers;
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
  customer-dashboard visibility; and
- 30-day reciprocal pinned Complete Portfolio access, including Protected
  Contact, after both customers explicitly confirm Interested; and
- transactionally queued Broker Introduction, response, mutual-interest,
  revocation and expiry notifications through the provider-neutral outbox.

Merged in NAK-201: the private candidate-owned Family Viewer roster, broker
proposal/candidate approval lifecycle, exact Google-email activation,
three-viewer limit, sole-primary rule, revocation and bounded owner projection.
This foundation grants no Introduction or portfolio access; those remain later
authorization phases. NAK-202 implements the assisted-onboarding application
slice on the combined feature branch, with local database validation complete
and human review remaining before merge.

NAK-203 implements a read-only family Introduction metadata dashboard on its
feature branch carrying NAK-202. It shows supported candidate labels, lifecycle
states and dates under live V3 authority. NAK-206 adds the private profile resolver and frozen Complete grants. The combined NAK-202/203/204 branch
passed the Supabase PostgreSQL 17 database job locally.

## Verification provider decision

The intended Didit workflow is a hosted facial biometric and liveness check,
without an ID-document verification module. VivIntro must not request or copy a
physical identity card, identity-document image, or document number. This is a
locked product/privacy direction, but it is not yet production-ready: the
candidate provider implementation already uses liveness-only sessions. Older
runbooks still contain superseded face-match and document guidance. Verify
provider sandbox, signed decisions, retention/deletion and worker evidence before
pilot activation. Representative verification has a separate contract; do not
infer candidate identity-document collection from its provider configuration. See
[the liveness-only decision](./identity-verification/liveness-only-decision.md).

The legacy one-recipient device-pass path is retired for new Introductions and
its active credentials are revoked/scrubbed by NAK-78.

## Recommended next implementation sequence

1. **Review NAK-202 assisted onboarding.** The local migration replay and pgTAP
   passed on the combined branch. The
   application implementation includes candidate and broker proposal screens,
   exact-email approval, Google-only activation, honest delivery status and a
   manual WhatsApp handoff without portfolio access or raw-email persistence.
2. **Build NAK-203 read-only family dashboard.** Resolve only the activated
   viewer's bounded cross-broker Introduction list; keep candidate responses
   authoritative.
   NAK-203 is implemented locally and passed the combined database job.
   NAK-204 now adds the broker's bounded Introduction list and action workspace,
   sharing attempts and manual confirmations for each side, waiting-side
   reminders and safe history. Opening WhatsApp never proves delivery/read.
   NAK-205 records off-app responses. NAK-206 adds read-only family portfolio
   access and closes old Complete windows permanently on mandate pause. See the current feature records for validation and rollout gates.
3. **Verify existing Didit liveness-only operations.** Reconcile stale runbooks
   against the current candidate workflow, validate sandbox decisions and worker
   recovery, and complete retention/deletion and consent evidence before pilot
   activation. Representative verification remains a separate workflow.
4. **Pilot operations.** Add only the minimum operator activation, expiry worker,
   monitoring, and two-broker staging evidence needed for a bounded pilot.
5. **Broker UX refinement.** Validate dashboard, customer selection, response
   follow-up, and mobile/WhatsApp handoff with real brokers before adding Tasks,
   analytics, recommendations, questionnaires, or payments.
