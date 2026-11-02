# Accountless approved portfolio viewing — app increment

Risk: Critical. Base main: c0bcb29. Database prerequisite: PR #143, migration 20261102120000_guest_approved_portfolio_viewing.sql.

## Contract and boundaries

The visitor verifies an email without an Auth account or general VivIntro session. A random, HttpOnly, SameSite=Lax, production-Secure cookie remembers one portfolio on that browser for up to 15 days. Only its hash reaches the database. Every private read still requires an active grant, matching verified recipient, current publication eligibility and unexpired proof. Approval links alone convey no authority; another browser verifies the approved email.

The owner reviews published disclosure categories, media and horoscope presence before explicitly granting full published viewing for 15 days. Old contact-only confirmation tabs lack the new approval scope and must refresh. Existing contact-only decisions do not turn into full grants automatically. Existing Auth-bound access retains its expiry and revocation rules. Private photos/horoscope use the canonical authorized descriptor and grant-bounded signed URLs (at most five minutes). Already downloaded information cannot be recalled.

No portfolio layout, fonts, colours, optional fields or mandatory-field requirements change. Public metadata stays public-only. Owner notes, street addresses and excluded private preference notes remain excluded by the existing approved projection.

## Implementation map

- access/server/guest-viewing-proof and guest-viewing-cookie: random proof, hashing, scoped cookie and narrow separately deployed RPC adapter.
- api/interest/guest: atomic submission plus remembered browser; api/interest/viewing and p/[token]/view: independent email reverification.
- public-portfolio.service and token/horoscope pages: live authorization, approved projection and protected signing.
- interest-decision.service, interest decision route and RelationshipLifecycle: explicit full-disclosure review, scope/revision fencing and existing grant management.
- guest-interest-mail and production-maintenance: approval-link delivery, current-job guard, visible permanent failures and guest backlog/configuration health.
- Public copy/privacy/terms: full approved viewing and essential cookie notice, preserving historic contact-only mail renderer for old jobs.

## Evaluation and evidence

Local lint, typecheck and production build passed with loopback configuration. Eighteen focused Chrome checks passed across desktop/tablet/mobile. Initial broader coverage run passed 1869/1875 but six unchanged telemetry tests timed out during concurrent build/browser load; a bounded-worker rerun is pending. No timeout or assertion was relaxed.

Browser testing caught pre-hydration email input loss on WebKit. The new verification form now uses the existing useHydrated fieldset guard; two client regression tests pass. Cross-browser rerun and final CI are pending.

Fresh-context independent app review of add54cb found no material issues and independently passed 53 focused tests. Hydration correction requires follow-up review. DB review corrected legacy grant duplication and historical unverified request recovery; clean CI replay, pgTAP and approval/retry concurrency passed. Generated types were replaced with the clean CI artifact after one no-argument type mismatch.

## Rollout and remaining release checks

Keep database and app PRs Draft until their final checks/reviews pass. Merge/apply the database prerequisite first and verify migration history; then refresh app against main and release. Do not enable the app before the new RPCs exist. No production write, merge, deployment or email send is part of this implementation.

Production mail workers remain a separate release gate: check worker enablement, matching Vault secret, scheduler, delivery/suppression/webhook state and a consented inbox smoke test. Do not bulk replay old queued emails or claim delivery without provider evidence. No new secret is introduced: the existing GUEST_INTEREST_OTP_SECRET is reused with a separate viewing-code purpose.
