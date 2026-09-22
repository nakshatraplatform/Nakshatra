# BrokerDesk pilot test runbook

> **Paused historical runbook:** The seeded scenario and one-time `#pass=` URL
> below exercise the retired device-pass model and must not be used to approve a
> NAK-78 pilot. Before the next pilot, replace the seed with two same-agency
> customers who each have an active mandate, completed published portfolio,
> current Didit verification, and distinct owner account. Each owner must sign
> in to the same opaque Introduction URL, see the other pinned Broker Standard
> Profile, and respond independently. The current contract is
> [`vivintrodesk-mvp-contract.md`](./vivintrodesk-mvp-contract.md).

## Safe scope

The repository’s sample scenario is local-only. It uses the requested email
addresses as synthetic local Auth identities, but never provisions or changes
those accounts in the linked Supabase project. This prevents accidental email,
identity, entitlement, or customer-consent changes in production.

Start local Supabase, then reset with only the explicit demo seed:

```bash
npm run test:db:start
npm run demo:broker-pilot:reset
npm run dev
```

The reset is destructive to the **local** Supabase database. It cannot target a
linked project because the script includes `--local`.

All three local accounts use password `VivintroDemo!2026`:

| Role | Email | Workspace / expected view |
| --- | --- | --- |
| Broker A (Ravi Sharma) | `rahulgr3001@gmail.com` | Ravi Matchmaking; an accepted response awaiting review |
| Broker B (Suresh Reddy) | `gollapalliranganatha@gmail.com` | Suresh Matrimony; an unread portfolio update and an introduction expiring soon |
| Customer (Ananya Rao) | `ranganathaga64@gmail.com` | Published sample portfolio linked independently to both brokers |

The customer’s public local URL is
`http://localhost:3000/p/DemoCustomerLink00001`. Broker B’s seeded one-time
Complete Portfolio URL is
`http://localhost:3000/introductions/bir_55555555555555555555555555555552#pass=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`.

## Expected workflow checks

1. Sign in as Broker A and open `/brokerdesk`. The gateway must open Ravi’s
   dashboard. Only Ananya and Ravi’s response item should appear. Marking it
   complete must remove it from Ravi’s queue only.
2. Sign in as Broker B in a separate browser profile. Only Suresh’s workspace
   data should appear. A publication notice and the expiring Arjun-family link
   should be visible. Acknowledging the notice must not alter Ravi’s workspace.
3. Open Broker B’s seeded URL on one device. The first claim receives Complete
   Portfolio. Open the same fragment in another private window: it must receive
   Detailed Introduction only.
4. As a broker, create a new link from the Ananya customer page, activate and
   copy it, then send it manually. No customer approval prompt and no target
   broker selector should appear.
5. As a recipient, submit Accept or Decline once. A same-value retry is safe; a
   conflicting second answer is rejected. The source broker sees the response;
   no other broker receives it.
6. Revoke an active link, then confirm both Complete and Detailed views are
   unavailable. Run `npm run broker-introductions:process` with local service
   credentials to test scheduled expiry.

## Pilot exit criteria

- Each of the two pilot brokers can invite and view only their own five
  customer relationships.
- Every relationship has explicit customer consent and a current mandate.
- Forwarded or replayed Complete Portfolio passes fail closed to Detailed view.
- Revoked/expired credentials are scrubbed and all six audit events contain no
  raw token, recipient email, portfolio JSON, or other broker identity.
- Broker response/update acknowledgement is independent per workspace.
- Rate limits, no-store responses, no-referrer behavior, and worker host guards
  pass in the release environment.
- Support owners can reproduce and close a reported workflow issue without
  querying raw protected portfolio content.

## Remote test data

Do not run the SQL seed against `xizzzczzhqzabcipbgep.supabase.co`. For a shared
staging or production-like pilot, first have each person sign in normally, then
create the two verified BrokerDesk workspaces and customer consent records
through the application. This preserves Auth ownership, email verification,
consent evidence, and audit history. Use dedicated synthetic accounts rather
than personal accounts if automated staging fixtures are later required.
