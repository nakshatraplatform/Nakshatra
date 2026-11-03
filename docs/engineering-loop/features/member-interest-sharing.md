# Member interest and reciprocal sharing

Risk: Critical. Latest main c0bcb29; extends Draft DB #143 and app #144, preserving separate deployment order.

## Approved contract

A signed-in member with a currently published eligible portfolio sends interest and shares that published full portfolio with the target owner in one explicitly labelled action. No repeated identity/location form, OTP, or extra consent screen. The recipient can view the sender immediately and accept/share their own full published profile back. Both permissions expire after 15 days and remain independently revocable; rejection ends sharing attached to the declined request. Concurrent crossed interests must not duplicate permissions, notifications or fabricate interest from either person. Visitors retain accountless email verification and explicit owner approval. Unpublished member drafts are never disclosed.

Set aside is private deferral, not rejection; no declined notification. Decline and accepted-access revocation are distinct actions. Visitor details show submitted fields only; operational history stays in a separate collapsed activity disclosure.

## Design and evaluations

Private first-class sender disclosures bind a real incoming request to the sender portfolio and exact recipient user. They do not fabricate reverse interest rows or weaken existing reveal-grant constraints. Current publication, verified live session, request state, expiry and revocation authorize each read. Owner pagination/counts and existing Stop sharing controls include these disclosures. Signed media remain bounded to authorized descriptors and access expiry.

Evaluate wrong owner/session/scope/revision, no published profile, draft isolation, guest preservation, duplicate/crossed submissions, expiry/revoke/unpublish/rotation, separate defer/decline mail, owner counts/pagination, submitted-only visitor details, and Chrome/Firefox/WebKit responsive flows. Database replay, pgTAP/concurrency, generated-type parity and independent fresh review remain required. No production mutation is authorized by implementation.

## Execution context

Database commands/read contracts, one-action app form and separate defer/decline review are implemented in Draft #143/#144. Docker is unavailable locally; hosted CI supplies real SQL execution. Production maintenance workers remain a separate readiness gate.

Current runtime SQL snapshot ae9e0e0: migration parses (68 statements), local-target guard tests8/8 pass. Hosted migration replay passes but pgTAP still fails; logs blocked by unavailable GitHub connection and browser-control kernel-assets error. Concurrency runtime and generated-type parity remain pending, not passed.

Independent fresh-context DB and app reviews found and corrected opposite-permission revocation, duplicate direction after accept/cross, short readable-path override, and revoked approval replay. Keep active full-grant retries idempotent (already_approved), while inactive previous full grants cannot be restored by replaying old consent. Member pgTAP41 assertions; guest pgTAP42 exercises short abc path. Reviewer round3 found active guest retry interaction; final5-line correction awaits runtime and release review. Review budget exhausted; no fourth reviewer launched. Both PRs remain Draft. No production mutation performed.


## CI log diagnosis, November 2

The supplied log for head700c6fc shows2085 assertions across71 files, with only access_lifecycle54 and session_perimeter12 failing. Guest approved viewing and member sharing passed. Access lifecycle still expected Stop sharing to change the request to rejected and permit reopen; the agreed independent-permission behavior preserves approved, so reopening is now invalid while the existing earlier rejected-request reopen case remains. Rotation continues to use an explicitly privileged replacement-grant fixture.

The compatibility public approval wrapper delegated to a guarded command but omitted its own explicit live-session check. Added require_current_session directly without adding an allowlist exception or weakening the perimeter query. Added two revoked-session runtime assertions for that wrapper and member-send. Full SQL execution remains a hosted CI check because Docker is unavailable locally.
