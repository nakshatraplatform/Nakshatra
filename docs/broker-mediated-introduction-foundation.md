# Broker-mediated introduction foundation

## Approved product rules

This increment covers customer invitation, customer-owned onboarding and the
broker representation consent boundary. It deliberately does not implement an
introduction transaction or recipient device pass yet.

1. A broker can invite a customer by email but cannot create, edit, publish or
   unpublish that customer's portfolio.
2. The invitation email opens an email-bound, single-use setup capability. It
   is not a public portfolio link.
3. The customer signs in with the invited verified email, retains canonical
   ownership and explicitly accepts `broker-representation-v2`.
4. The v2 mandate permits the inviting broker to review and share the published
   Broker Standard Profile in time-limited broker-mediated introductions. This
   is a generated Complete-like projection that excludes contact, financial and
   owner-private questionnaire fields. The broker does not request approval for
   each introduction.
5. A broker can act only for customers connected to that broker's workspace by
   an active mandate. Brokers never discover another broker relationship.
6. No broker-to-broker communication, authorization, notification, lookup or
   customer-data exchange is part of this product.
7. An introduction automatically references the latest published
   disclosure version at creation. Existing introductions remain pinned to the
   version with which they were created.
8. Every broker holding an independent active mandate receives an independent
   heads-up when that customer publishes a new version. The future optional
   `flag for clarification` action starts an off-platform phone or WhatsApp
   conversation and never blocks publication or sharing.
9. Future audit events are limited to `created`, `shared`, `claimed`,
   `response_submitted`, `revoked` and `expired`.
10. Hashed tokens, single-use claims, rate limits and authorization isolation
    are mandatory for the pilot.

## Implemented journey

`Broker enters email -> invitation persisted -> email attempted -> customer
opens private link -> signs in with that email -> reviews consent -> accepts ->
customer-owned portfolio is created or linked -> broker relationship activates`

Provider acceptance is reported as `sent`; it is not proof of inbox delivery.
If email delivery is unavailable, the invitation remains valid and BrokerDesk
shows the private copy-link fallback. A retry with the same invitation reference
uses the same provider idempotency identity.

## Implemented introduction journey

Phases 4–8 originally added one-recipient device passes. NAK-78 retires that
authority model: new BrokerDesk Introductions are bilateral, require two
same-workspace customers with published and Didit-verified portfolios, pin both
versions, and authorize each side only through their live VivIntro identity.
The personal VivIntro guest-sharing flow remains separate and unchanged. See
`docs/vivintrodesk-mvp-contract.md` for the current contract; the earlier device
pass material in `docs/broker-introduction-system-design.md` is retained only as
historical design context.
