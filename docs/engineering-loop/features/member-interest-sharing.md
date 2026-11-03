# Member interest sharing and relationship review

Risk: Critical. Extends Draft app PR #144; requires DB PR #143 migrations before app release. Base main c0bcb2956037dcc044cbcfec02e8bcad4610cac6.

## Contract

A signed-in member with an eligible published profile sends interest and shares that published full profile in one clearly labelled action. No repeated identity form, OTP or second consent dialog. Recipient views that profile and can accept/share back inline. Independent permissions expire in 15 days and can be stopped separately. Duplicate retries and crossed sends must not renew or duplicate permissions. Unpublished members fall back to the accountless visitor form; no guest account or Supabase session is created. Visitors require explicit owner approval for full portfolio viewing.

Set aside is private deferral; Decline is separate. Incoming visitor details show submitted fields only, with operational history in collapsed Activity. Drafts, owner notes and street addresses stay private. Approved portfolio design, typography and validation remain unchanged.

## Implementation

- Member contract, authenticated context/send route, narrow RPC service, and published-profile consent form.
- Existing modal chooses member flow only after server eligibility; transient failure offers retry, never silently changes sharing consent. Guest verification and browser-scoped access remain intact.
- Relationship review uses current server disclosure revision for inline member approval, explicit workflow version for old-tab safety, separate defer/decline, and authoritative returned queue counts.
- Existing new-introduction email gains an identity-bound full-profile link only after exact-recipient server validation; no extra notification or private email payload.
- Privacy/help copy and bounded readable paths align with the shared-link contract.

## Evaluation

192 focused tests passed before final notification/path additions. Lint and typecheck passed before final test additions. New responsive member and recipient journeys plus existing guest and owner regressions are being run. Full coverage/build and independent final review pending. SQL replay passed remotely; pgTAP failed and its private log remains inaccessible until GitHub connection/browser control is restored. No production change or email send performed.

## Release gates

Keep both PRs Draft. Require clean SQL replay, all pgTAP and real concurrency scenarios, generated type parity, app checks and mobile review. Merge/apply/verify DB prerequisite before app release. Production maintenance workers and notification delivery receipts remain separate operational checks; do not replay queued emails or activate deletion workers as part of this implementation.
