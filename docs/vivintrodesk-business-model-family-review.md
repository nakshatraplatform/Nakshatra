# VivIntroDesk — business model for family and friend review

Status: current discussion baseline through NAK-78  
Last updated: 22 September 2026

## The simple idea

VivIntroDesk helps matrimonial brokers replace Excel sheets, biodata files, and
untracked WhatsApp messages with one simple system for customers,
Introductions, responses, and history.

It does not replace the broker. It gives the broker a safer and more organized
way to do the same relationship work.

VivIntro is the customer product underneath it. Each person owns one portfolio
and may use that same portfolio with brokers or share it personally.

## Who pays

The primary business is broker subscriptions. A broker pays for:

- a secure customer book;
- staff access and roles;
- customer invitations and time-bound consent;
- safe Introduction creation;
- response and history tracking; and
- reliable expiry, revocation, and audit records.

Plans should eventually scale by active customers, team seats, and monthly
Introductions. Prices should be validated with pilot brokers before they are
promised publicly.

Customers do not pay to create the portfolio needed for their broker service,
receive a broker Introduction, respond, decline, block, report, pause a broker,
or end consent.

Personal VivIntro sharing remains available outside the broker network. A paid
consumer plan may be tested later, but payments and personal usage limits are
not part of the current VivIntroDesk MVP. Core consent and response actions must
never become a paywall.

## What the broker controls—and does not control

A broker may invite a customer, review the published Broker Standard Profile,
create an Introduction between two eligible customers in that agency, and
follow the two responses.

The broker does not own or edit the customer's portfolio. The customer can
pause, renew, or terminate that broker's time-bound mandate. One customer may
have relationships with multiple brokers, and those brokers never see one
another's activity.

Broker packages remain the broker's business. VivIntroDesk can record the
package label, service dates, renewal date, and payment state, but it does not
define what “Gold” or another package includes.

## What is shared

For a broker Introduction, both people must already:

- be customers of that broker agency;
- own completed and published VivIntro portfolios;
- have current Didit identity verification; and
- have active broker mandates.

The broker selects two customers. Each customer signs in and sees the other
person's **Broker Standard Profile**. It is generated from the published
Complete Portfolio but excludes Protected Contact, financial data, exact birth
time, private questionnaire answers, security data, and other broker activity.
The broker cannot widen this view.

An opaque Introduction link is only an address. Forwarding it gives another
person no profile access and no ability to respond. There is no public Detailed
fallback on a broker link.

Personal VivIntro links are separate. They remain guest-viewable under the
existing B2C Detailed/Brief and approval rules and never inherit broker authority.

## What happens after responses

Today the system records each customer's independent Interested or Declined
response. The next planned phase will make mutual interest useful:

1. Before choosing Interested, each customer is clearly told that if the other
   person also chooses Interested, Complete Portfolio and Protected Contact will
   be shared for 15 days.
2. If both choose Interested, reciprocal identity-bound Complete access begins.
3. There is no second contact-approval step.
4. Either customer's revocation or a broken mandate/publication condition ends
   access according to the final NAK-79 contract.

## What is deliberately not in the first pilot

- broker-to-broker coordination or visibility;
- guest or email-only recipients for broker Introductions;
- linked-family accounts;
- custom agency questionnaires or financial-package fields;
- AI matching or compatibility scores;
- a general Tasks/CRM system;
- personal subscriptions, payments, or usage metering; and
- automatic interpretation of broker package benefits.

These may be explored after real brokers use the core loop. Keeping them out of
the first pilot makes the product easier to learn, safer to operate, and faster
to validate.

## Why this model can be defensible

The moat is not a large list of profiles. It is the trusted relationship graph
and the safety infrastructure around it: one customer-owned portfolio,
version-pinned disclosure, active consent, broker isolation, authenticated
responses, expiry, revocation, and auditable history.

The product succeeds if a broker can move a real Introduction from customer
selection to two trustworthy responses without returning to spreadsheets—and
if customers understand exactly who may see what.

## Questions for reviewers

- Would a broker understand the product in two minutes?
- Is the Broker Standard Profile useful enough without contact and financial data?
- Is requiring both customers to complete VivIntro realistic during a pilot?
- Does the Interested confirmation make future contact release clear and fair?
- Which broker workflow still forces a return to Excel or WhatsApp?
- What would convince a broker to pay after a short assisted pilot?
