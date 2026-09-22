# NAK-79 — Mutual-interest Complete Portfolio access

## Execution context

- Risk: Critical — migration, participant authorization, consent and Protected
  Contact disclosure.
- Documentation mode: Full, because this changes a stored authorization state
  and a customer-visible disclosure boundary.
- Branch: `feat/nak-79-mutual-interest-complete-access`.
- Base: merged NAK-78 checkpoint `e0d61ff`, plus the local documentation
  reconciliation commit `ab300bc`.
- Current implementation owner: the bilateral Broker Introduction in
  `app_private.broker_introductions`; personal B2C `reveal_grants` remain a
  separate workflow and are not repurposed.

## Goal

When both authenticated participants independently choose **Interested**, give
each participant 30 days to view the other participant's immutable, pinned
Complete Portfolio, including Protected Contact. There is no second contact
approval step.

## Contract

1. The original Introduction response window remains 15 days.
2. Choosing Interested requires an explicit confirmation that, if the other
   participant also chooses Interested, Complete Portfolio and Protected Contact
   will be shared with that participant.
3. The second accepted and disclosure-confirmed response atomically records
   mutual interest and starts a 30-day Complete Portfolio access period for
   both participants.
4. Before mutual interest, the participant sees only the opposite pinned Broker
   Standard projection. During the 30-day period, the same URL returns the
   opposite pinned Complete projection and Protected Contact.
5. Access is derived only from the current authenticated candidate owner and the
   two participant identities stored on the Introduction. URL possession,
   request fields and broker membership never select the viewer or disclosure
   level.
6. The access period may continue after the 15-day response deadline, but never
   after its own 30-day expiry or an earlier revocation.
7. Relationship pause/termination, mandate loss, unpublication, verification
   loss, collapsed ownership or explicit Introduction revocation fail closed.
8. A decline or an expired response window never creates Complete access.
   Responses remain immutable; identical retries are idempotent. An accepted
   response recorded before this contract existed does not count as disclosure
   consent until that participant explicitly confirms the new terms.
9. The broker sees response and mutual-access status only. Broker APIs never
   receive either customer's Complete Portfolio or Protected Contact.
10. Personal VivIntro approvals and `public.reveal_grants` retain their existing
    lifecycle. Broker mutual access does not create fake personal interest
    requests, consume personal allowances, or alter personal grants.

## Design basis

The Introduction remains the central business object and already pins both
disclosure versions and both participant identities. NAK-79 therefore adds the
mutual-interest access interval to that object instead of forcing a bilateral
broker workflow into the one-owner/one-viewer B2C `reveal_grants` schema. This
keeps the disclosure atomic with the second response and prevents current
portfolio updates from leaking into an older Introduction.

The server resolver remains the single disclosure decision point: it selects
Broker Standard or Complete data from the same opposite pinned version after
revalidating current ownership, relationships, mandates, publication and Didit
verification.

## Acceptance evaluations

| ID | Case | Expected evidence |
| --- | --- | --- |
| AC-1 | One participant accepts | Broker Standard remains visible; no Complete access timestamp exists |
| AC-2 | Accepted response without disclosure confirmation | Neutral rejection and no response write |
| AC-3 | Both participants accept within 15 days | Second response atomically starts one 30-day reciprocal access interval |
| AC-4 | Either participant resolves during that interval | Opposite pinned Complete data, including Protected Contact, is returned |
| AC-5 | Unrelated account or broker resolves the URL | Neutral unavailable result; no participant or Complete data leak |
| AC-6 | Portfolio changes after Introduction creation | Existing access still uses the pinned version |
| AC-7 | Response deadline passes after mutual interest | Complete access remains available until its separate 30-day expiry |
| AC-8 | Complete-access expiry or relationship/mandate/readiness loss | Access fails closed |
| AC-9 | One participant declines or response window expires | Complete access is never created |
| AC-10 | Identical response retry | No duplicate access interval or duplicate grant event |

## Compatibility, rollout and recovery

- The database migration is additive for stored rows. Existing Introductions
  start with no mutual access and no implied disclosure consent. A participant
  with a legacy accepted response may confirm the unchanged response terms
  during the original response window; this records a distinct audit event and
  cannot start access until both participants have confirmed.
- The legacy four-argument response RPC is revoked after the new confirmation-
  aware signature is installed; the application route and repository deploy in
  the same release.
- Rollback may remove application presentation, but must not reinterpret an
  accepted response as broader consent. Restoring the old RPC requires an
  explicit forward migration, not an ad-hoc privilege grant.
- No production data mutation or deployment is authorized by this task. Clean
  migration replay and pgTAP remain required before merge.

## Progress and evidence

- Contract locked on 22 September 2026 with a 30-day Complete access period.
- Relevant NAK-78 resolver, response transaction, revocation triggers, pinned
  version model, API route and customer UI inspected.
- Implemented the additive mutual-access state, confirmation-aware response
  command, pinned Complete resolver, broker/customer projections and explicit
  customer consent UI.
- Fresh review identified and the implementation corrected two material cases:
  legacy accepted responses no longer imply disclosure consent, and revoked
  responded rows now project as revoked without violating immutable response
  constraints.
- Corrected snapshot evidence: focused Introduction tests passed (5 files, 24
  tests); full Vitest/coverage passed (134 files, 795 tests, including the
  repository feature-coverage gate); TypeScript, ESLint, `db:smoke`, production
  build and dependency audit passed (zero reported vulnerabilities).
- Local clean migration replay and pgTAP are blocked because Docker, the
  Supabase CLI and a local PostgreSQL runtime are unavailable. Hosted CI is
  therefore a required merge gate; this branch is not release-ready until that
  replay and pgTAP evidence passes.
- Fresh-context re-review completed against snapshot
  `8592a32e91356878332d212abe3cdc5078f000ae130bf24ee3f8727d4b109487` with
  no remaining material findings. `NAK79-001` (legacy acceptance must not imply
  new disclosure consent) and `NAK79-002` (revoked responded rows must project
  as revoked without active-access metadata) are resolved by the migration,
  UI recovery path and regression coverage described above.
