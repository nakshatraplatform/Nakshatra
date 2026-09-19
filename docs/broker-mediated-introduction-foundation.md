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
4. The v2 mandate permits the inviting broker to review the published Complete
   Portfolio and share it in time-limited broker-mediated introductions. The
   broker does not request approval for each introduction.
5. A broker can act only for customers connected to that broker's workspace by
   an active mandate. Brokers never discover another broker relationship.
6. No broker-to-broker communication, authorization, notification, lookup or
   customer-data exchange is part of this product.
7. A future introduction automatically references the latest published
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

## Deferred introduction journey

The next increment owns versioned disclosure references, broker-created
introduction records, one-time device passes, Detailed Introduction fallback,
responses, the six-event audit trail and notification delivery. It must not add
a per-introduction customer approval state or any recipient-broker lookup.

