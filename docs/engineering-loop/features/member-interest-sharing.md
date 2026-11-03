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

## Evaluation and review

App runtime snapshot 7d955b4: all 1,896 tests in 223 files passed; global coverage statements 85.87%, branches 82.21%, functions 85.66%, lines 89.53%. Feature coverage passed 67 files and 21 protected boundaries. Lint, typecheck and production build passed; build used only loopback public configuration because no local environment file is present. Initial build without that configuration failed the existing required-env validation; no validation was relaxed.

Chrome desktop/tablet/mobile: member send, inline recipient accept, guest refresh/revoke and forwarded-link verification, owner responsive light/dark journey, failed revocation and old-grant paging passed (21 initial passes plus 3 successful consent-test reruns). The consent fixture now asserts the new relationship_v2 workflow discriminator, retaining503/stale-revision rejection checks. Firefox, desktop WebKit and mobile WebKit passed all 24 selected browser checks, including the same member/guest/owner and error scenarios. These use loopback service fixtures; they do not prove production provider delivery or physical-device behavior.

Fresh-context read-only reviewer /root/member_sharing_final_review reviewed app7d955b4 and DBbf85c54, following initial DB review. Two SQL behavior findings were corrected: short readable-path resolver override, and stale approval replay restoring revoked access. SQL now preserves active-grant idempotency separately from sticky inactive-grant rejection. Reviewer additionally identified the active guest retry interaction; final 5-line guard was corrected after the third reviewer round and awaits runtime evidence and release review. App review found no material runtime defect; two new test arity errors were corrected and full suite subsequently passed.

Database snapshot ae9e0e0: 68 outer SQL statements parse; 8 local-target concurrency guard tests pass. Hosted clean migration replay passed, but pgTAP still fails. Failure log is blocked by unavailable GitHub connection and browser kernel-assets error. This is not a passing database result. Actual concurrency scenarios and generated-type parity cannot run until pgTAP passes. Docker is absent locally.

## Release gates

Keep both PRs Draft. Require clean SQL replay, all pgTAP and real concurrency scenarios, generated type parity, app CI and mobile review. The independent review budget was three rounds; no further automated reviewer was launched. Latest SQL correction still needs the pending runtime/release review. Merge/apply/verify DB prerequisite before app release. Production maintenance workers and notification delivery receipts remain separate operational checks; do not replay queued emails or activate deletion workers as part of this implementation. No production change or email send performed.
