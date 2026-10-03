# NAK-73 B2C dashboard pilot readability

Status: implemented locally on `fix/nak-73-dashboard-mobile-readability` from `main` `b5cfea5`; not pushed or deployed.

Mode: compact; standard-risk presentation and metadata change. Owner authorization, publication, access grants, and Didit requests are out of scope.

## Evidence and goal

On 2 October 2026, the signed-in production dashboard at 320 and 375 px squeezed three overview cards into columns too narrow for link status, exposed four small header actions in one row, and made the relationship heading compete with a redundant badge. The mobile access-detail dialog remained usable. The dashboard had a page title and a robots.txt exclusion but no page-level `noindex` metadata.

Make the dashboard readable and operable at 320, 375, 414, 768, and desktop widths while preserving all account, sharing, relationship, and verification actions. Keep private dashboard content out of search results.

## Acceptance checks

1. Phone navigation shows branding, theme, and an accessible account menu containing My brokers, Account and privacy, and Sign out; larger screens retain direct actions.
2. All three overview statistics can be read without clipping at phone widths; link, preview, rotate, and unpublish actions remain available.
3. The page has one primary heading, the global skip link has a valid target, and relationship queues remain understandable at phone widths.
4. The verification explanation is plain-language and retains the no-ID-document and no-selfie-storage claims plus explicit consent.
5. Dashboard metadata requests `noindex` and `nofollow`; no user data is added to metadata.

## Evaluation plan

- Component tests: dashboard copy, navigation actions, accessible heading/skip target, published-link controls, and verification consent.
- Browser checks: dashboard header and menu at common phone widths, tablet/desktop layout, keyboard interaction, overflow, and both themes. Live production is read-only; no share rotation, publication, access change, or Didit request is submitted.
- Static checks: lint, typecheck, production build, and diff review.

## Result and coverage

- Mobile header now keeps the brand and theme action visible, with account actions in a keyboard-operable menu. Phone overview cards stack to preserve readable labels and status values; relationship names and messages wrap to two lines. The direct-interest summary no longer implies that a separate broker response queue is empty. Share and verification copy is shorter and explains the public/approved access distinction.
- Private dashboard metadata is `noindex, nofollow, noarchive`; the page has one H1 and the existing skip link now lands on `main-content`.
- Focused component tests: 30 passed. Responsive Playwright browser tests: 2 passed across 320, 375, 414, 768, and 1280 px. Lint, TypeScript, and a production build passed. Browser tests use a loopback-only synthetic published portfolio; the signed-in production dashboard was inspected read-only.
- No live sharing, access approval, link rotation, publication, or Didit submission was performed. Those workflows still need owner-led staging/pilot smoke tests. The existing no-expiry share-link option and already-active portfolio with pending liveness check need separate product/security review; this presentation change does not alter either policy.
