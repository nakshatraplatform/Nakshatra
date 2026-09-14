# Dashboard relationship lifecycle

## Product decision

An introduction and its Full View access are one relationship lifecycle, not
unrelated dashboard records:

`Awaiting review -> Full View active -> Expired or ended`

An owner may also set an introduction aside and deliberately reopen it later.
Every Full View approval remains email-identity-bound, expires after seven
days, and can be renewed or ended by the portfolio owner.

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

## Full View card

Each grant shows the same relationship identity and source, plus:

- current access state;
- exact expiry date;
- whether and when Full View was opened; and
- renew or end-access actions.

The disclosure confirmation remains the final approval step and lists the
categories that the recipient will receive.

## Responsive behavior

At phone widths, introduction headings, fact grids, relationship actions,
Full View controls, and link sharing controls stack into full-width touch
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
- Full View cards preserve source, expiry, access-use, renewal, and revocation
  information.
- The relationship controls remain usable at 320 CSS pixels.
- WhatsApp sharing explains First View and owner-approved Full View without
  including sensitive profile details.
