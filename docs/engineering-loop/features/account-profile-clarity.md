# Account profile and portfolio-label clarity

## Contract

Account settings adds editable account-holder first and last names (required), middle name (optional, explicitly approved by the user), read-only email and linked sign-in providers. Names do not rename or publish the portfolio. Existing export, device revocation and deletion safeguards remain intact. Payment controls remain absent until a real saved-payment integration exists; never store card details in Auth metadata or expose fake billing actions.

Names are stored in three dedicated, non-privileged Auth user metadata keys. No migration is needed. Same-origin, live-session authentication, bounded strict input and existing dashboard-save throttling guard the own-user PATCH route. Arbitrary IDs, roles, email, credentials and provider updates are rejected. No privileged Auth client is used. Metadata must never be used as proof of identity or authorization. Concurrent account-name saves are last-write-wins; portfolio draft rules are unchanged.

Form section IDs remain stable. Labels become Astrology & horoscope and Appearance & contact. Protected field locks lead the label in a non-wrapping flex row while question text can wrap normally. The shared screen-reader privacy explanation remains. Earlier editor viewport and email/phone alignment changes are retained.

## Risk and acceptance

Significant: new authenticated metadata mutation boundary. Independent fresh review required before release. Verify valid Unicode names and optional middle name, exact three-key own-user writes, strict mass-assignment rejection, origin/auth/rate/body limits, safe failures, profile save UI, preserved deletion behavior, renamed form navigation and responsive layout. Verify no billing controls and no verification or admin exceptions. Live hosted Auth persistence and physical Safari are separate release smoke checks, not established by mocked tests.

## Status

Implemented locally. Focused independent review passed 11 suites / 99 tests, followed by an 8-test account UI recheck after the save-button style correction. Final packet `f3d03c0eb6c7f6154b7bbf8ba49359ad45618067afac70d296eb6dd66f79e455` had no material findings and passed freshness checks. Coordinator checks: account layout at 320/768/1440, editor layout at 320/390/768/1440, focused lint, typecheck, production build and diff whitespace passed. Visual inspection corrected a save button whose primary color depended on a variable outside the account shell. Graph AST refreshed; SQL extraction remains unavailable because tree_sitter_sql is not installed. Hosted Auth persistence and physical Safari remain release smoke checks. Not committed, pushed or deployed.

## PR preparation (2026-10-09)

Latest-main comparison is unchanged. Production build, lint and typecheck passed; 24 browser regressions passed across desktop, tablet and mobile Chromium. Review navigation restores Back to editing without discarding the draft; dashboard unit expectations now match that approved behavior and the Appearance & contact heading. The existing dependency-audit exception has expired: the security audit is a known merge blocker, and this patch does not extend the exception or weaken its enforcement. No PDF export or mockup implementation is included; existing data export remains unchanged for the separate design phase. No database migration or verification/admin bypass is introduced.
