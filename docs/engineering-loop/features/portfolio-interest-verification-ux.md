# Portfolio-interest verification UX

Mode: full (authentication boundary plus responsive interaction). Status: implemented locally on `feat/nak-60-liveness-integration`; production verification pending.

## Goal and scope

The public Show Interest journey must remain usable at mobile, laptop and desktop viewport heights. An outside click must not discard an in-progress email verification, every step must expose its actions through an internal scroll region, and the OTP screen must explain that requesting a new code invalidates earlier codes. The existing same-origin API, application rate limit and Supabase Auth verification boundary remain authoritative.

## Acceptance and evaluation contract

| ID | Expected behavior | Evidence |
| --- | --- | --- |
| PIR-1 | Clicking the dimmed backdrop does not close the dialog or clear an entered OTP. The explicit close button and Escape remain available. | `tests/interest-request.test.tsx` backdrop regression |
| PIR-2 | Choice, verification, success and detail steps shrink and scroll inside the viewport; the detail action footer remains reachable on small screens. | Responsive CSS inspection plus browser/device validation before release |
| PIR-3 | Returning from verification to details retains the submitted values, and reopening an explicitly closed verification resumes the in-memory challenge while the page remains mounted. | Component state/default-value review; focused component suite |
| PIR-4 | The screen states that delivery may take time and that only the newest code works after a resend. A successful resend clears the old entry, announces the replacement and refocuses the code field. | `tests/interest-request.test.tsx` copy regression; component review |
| PIR-5 | Viewer OTP verification continues to call Supabase with `{ type: "email" }`; malformed, expired, mismatched, cross-origin and rate-limited requests fail without submitting interest. | `tests/auth-verification-routes.test.ts`, `tests/auth-start-route.test.ts` |

## Design and security basis

- The modal remains a focused client component. The server routes continue to validate input, enforce same-origin requests and apply rate limits.
- Progress is retained only in React memory for the current page. No phone number, message or other introduction data is added to browser persistence.
- Backdrop dismissal is disabled because it is an ambiguous, destructive gesture during a delayed email challenge. The labelled close button and keyboard Escape preserve explicit dismissal and accessibility.
- Supabase documents email OTP verification with `verifyOtp({ email, token, type: "email" })`. A resend creates a replacement challenge, so the interface directs the viewer to use the newest email rather than weakening server verification.

## Files and boundaries

- `src/components/portfolio/InterestRequestModal.tsx`: step state, explicit dismissal, resend recovery and retained form defaults.
- `src/app/globals.css`: bounded viewport layout and per-step scrolling.
- `src/app/api/auth/start/route.ts`: unchanged OTP creation and application rate limit.
- `src/app/api/auth/verify/route.ts`: unchanged authoritative Supabase verification.
- `tests/interest-request.test.tsx`: interaction regressions.

The same pilot integration pass also corrects the candidate bearer-link consent copy in `src/app/verify/[token]/verification-link-client.tsx`. It now describes the configured primary-photo comparison and passive-liveness workflow, disclaims legal-identity/profile verification, and no longer asks candidates to consent to the legacy document-based fields that remain specific to BrokerDesk representatives.

## Release evidence still required

- Test a new viewer and an existing viewer against the deployed Supabase project. The hosted Confirm signup and Magic Link or OTP templates must both contain `{{ .Token }}`.
- Confirm the first code succeeds when no resend occurs, and that after a resend the earlier code fails while the newest code succeeds.
- Exercise 320×568, 360×800, 412×924, 1366×768 and 1920×1080 browser viewports with browser zoom at 100% and 125%.
- This change does not certify SMTP delivery latency, hosted-template deployment, or the provider's production rate limits.

## Validation and review (2026-10-02)

- Intended red/green regressions: backdrop dismissal and newest-code guidance failed before the change, then the focused interest/auth suite passed 49/49 on the final code.
- `npm run typecheck`, repository ESLint, and `next build --webpack` passed. The build used non-secret placeholder public Supabase values because this isolated worktree intentionally has no deployment environment.
- Full unit suite: 827/828 passed. The sole failure is the pre-existing Windows inability to represent the Sandbox journal's POSIX owner-only mode; it is unrelated to this change.
- Fresh-context independent review reported no P0/P1 findings. Its webpack browser checks passed at 320×568, 360×800, 412×924, 1366×768 and 1920×1080, including internal action reachability, backdrop preservation, and restored details.
- The default Turbopack build remains unavailable in this worktree because its ignored `node_modules` junction points outside Turbopack's filesystem root; the repository's Webpack production build passed.
