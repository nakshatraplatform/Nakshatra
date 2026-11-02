# Member interest and reciprocal sharing

Risk: Critical. Latest main c0bcb29; extends Draft DB #143 and app #144, preserving separate deployment order.

## Approved contract

A signed-in member with a currently published eligible portfolio sends interest and shares that published full portfolio with the target owner in one explicitly labelled action. No repeated identity/location form, OTP, or extra consent screen. The recipient can view the sender immediately and accept/share their own full published profile back. Both permissions expire after 15 days and remain independently revocable; rejection ends sharing attached to the declined request. Concurrent crossed interests must not duplicate permissions, notifications or fabricate interest from either person. Visitors retain accountless email verification and explicit owner approval. Unpublished member drafts are never disclosed.

Set aside is private deferral, not rejection; no declined notification. Decline and accepted-access revocation are distinct actions. Visitor details show submitted fields only; operational history stays in a separate collapsed activity disclosure.

## Design and evaluations

Private first-class sender disclosures bind a real incoming request to the sender portfolio and exact recipient user. They do not fabricate reverse interest rows or weaken existing reveal-grant constraints. Current publication, verified live session, request state, expiry and revocation authorize each read. Owner pagination/counts and existing Stop sharing controls include these disclosures. Signed media remain bounded to authorized descriptors and access expiry.

Evaluate wrong owner/session/scope/revision, no published profile, draft isolation, guest preservation, duplicate/crossed submissions, expiry/revoke/unpublish/rotation, separate defer/decline mail, owner counts/pagination, submitted-only visitor details, and Chrome/Firefox/WebKit responsive flows. Database replay, pgTAP/concurrency, generated-type parity and independent fresh review remain required. No production mutation is authorized by implementation.

## Execution context

Next: implement database commands/read contracts and member form; then regression tests, independent review and update the existing Draft PRs. Docker unavailable locally; hosted CI supplies real SQL execution. Production maintenance workers remain a separate readiness gate.
