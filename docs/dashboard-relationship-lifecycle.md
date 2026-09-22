# Dashboard relationship lifecycle

> **Scope clarification:** This document describes the personal B2C interest and
> owner-approved Complete Portfolio lifecycle. Broker-sponsored bilateral
> Introductions use the separate NAK-78 authenticated response model documented
> in [`vivintrodesk-mvp-contract.md`](./vivintrodesk-mvp-contract.md). Do not
> apply B2C guest-link or owner-approval behavior to broker URLs implicitly.

## Product decision

An introduction and its Complete Portfolio access are one relationship lifecycle, not
unrelated dashboard records:

`Awaiting review -> Complete Portfolio active -> Expired or ended`

An owner may also set an introduction aside and deliberately reopen it later.
Every Complete Portfolio approval remains email-identity-bound, expires after 15
days, and can be renewed or ended by the portfolio owner.

The owner dashboard presents these records inside one **Introductions and
access** surface. Awaiting and set-aside requests, active/expired/ended access,
and the immutable activity history are stages of the same owner workflow. The
request and grant remain separate backend records because they have different
authorization and audit responsibilities; visual consolidation does not weaken
that boundary.

The page-level primary action follows the portfolio lifecycle:

- incomplete draft: continue the portfolio;
- complete unpublished draft: review and publish;
- active public link: share the portfolio; and
- expired public link: renew the link.

Portfolio editing has one page-level entry per state. The readiness tracker
reports progress and offers preview without duplicating the editor action.

## Introduction card

The collapsed card shows only the information needed to scan the queue:

- requester name;
- direct or broker-network source;
- who the requester is contacting for;
- location, when supplied; and
- request date and current state.

The expanded card shows:

- verified email and optional phone;
- family introduction and personal message;
- broker organization and representative when attribution exists;
- the requester's Nakshatra portfolio only when the server resolves a current
  published portfolio from the authenticated requester's database user ID; and
- call, email, view-portfolio, set-aside, and disclosure-review actions as
  applicable.

Caller-supplied portfolio URLs are not accepted by the application and are
removed from existing request metadata. This prevents a requester from
claiming somebody else's profile or presenting an arbitrary external link as
their identity.

## Complete Portfolio card

Each grant shows the same relationship identity and source, plus:

- current access state;
- exact expiry date;
- whether and when the Complete Portfolio was opened; and
- renew or end-access actions.

The disclosure confirmation remains the final approval step and lists the
categories that the recipient will receive.

## Responsive behavior

At phone widths, introduction headings, fact grids, relationship actions,
Complete Portfolio controls and link sharing controls stack into full-width touch
targets. Desktop retains the denser two-column fact presentation.

## Synthetic scenarios

Automated component and pgTAP fixtures cover one direct introduction with an
authenticated Nakshatra portfolio and one broker-network introduction with an
organization and representative. These fixtures deliberately do not seed a
linked remote database. Remote sample records should be created only with
dedicated synthetic Auth accounts in a non-production Supabase project, then
deleted after acceptance testing.

## Acceptance criteria

- Owners can distinguish direct and broker-network introductions.
- A broker name may be empty without breaking a direct introduction.
- A requester portfolio link is derived from authenticated database ownership.
- Untrusted metadata cannot produce a dashboard hyperlink.
- Complete Portfolio cards preserve source, expiry, access-use, renewal, and revocation
  information.
- Introduction review, Complete Portfolio access, and history share one lifecycle surface.
- The page-level primary action matches draft, ready, active, and expired states.
- The relationship controls remain usable at 320 CSS pixels.
- WhatsApp sharing explains the public Introduction and owner-approved Complete Portfolio without
  including sensitive profile details.
