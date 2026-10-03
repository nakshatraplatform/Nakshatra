# VivIntro responsive navigation standard

Status: adopted for authenticated customer pages in NAK-101; remaining page families are an implementation checklist, not a claim of completion.

## Page families

| Family | Routes | Header responsibility |
| --- | --- | --- |
| Public marketing and sign-in | `/`, `/login`, `/signup`, help/legal pages | Explain the product and offer one clear next action. Do not show customer account controls. |
| Public portfolio | `/p/[token]` | Keep VivIntro identity and Show interest visible. Section links are secondary, especially on phones. Never expose private account navigation or protected details. |
| Authenticated customer workspace | `/dashboard`, `/brokers`, `/account` | Use `CustomerAppHeader`: Dashboard, My brokers, Account, theme, sign out. Page-specific context belongs below it. |
| BrokerDesk workspace | `/brokerdesk/**` | Use `BrokerDeskHeader` with workspace-specific destinations and a clear route back to the customer dashboard. Do not silently reuse customer privileges. |
| Administration | `/admin/**` | Clearly identify operator context and preserve a return path; never mix admin-only actions into a customer menu without an explicit role label. |

## Layout and language rules

1. Use the approved VivIntro horizontal lockup once per header. At narrow widths, keep it visible and move secondary destinations into a labeled Menu before controls collide. Avoid icon-only navigation for unfamiliar destinations.
2. Use consistent destination names and order within a page family. Mark the current page with `aria-current="page"` and a visible selected state.
3. Keep the header to one row where possible. Do not place long explanations, account email, status prose, or page titles in the global header. Put the page title first in the main content, followed by one plain-language sentence explaining what the user can do.
4. Keep interactive targets at least 44 × 44 CSS px, with visible focus. Menu controls must work with keyboard and touch, and Escape should close an open transient menu.
5. Test at 320, 375, 414, 768, 1024, and 1440 CSS px, in light and dark themes, at normal and increased text size. No horizontal overflow, clipped action, or hidden primary task is acceptable.
6. Use short action labels: “My brokers,” “Account,” “Sign out.” Explain consequences near consequential controls (publish, unpublish, revoke, delete), not in the navigation.
7. Mobile pages should prioritize one primary action at a time and preserve a clear route back. Keep low-frequency or risky actions visually quieter than the primary task.

## Next audit passes

- Verify public portfolio header and Show interest placement on real phones without changing its disclosure contract.
- Review BrokerDesk destination density and labels using the same width/keyboard checks.
- Review admin header and account emails for context clarity and accidental role confusion.
- Check form pages, modal headers, error states, browser zoom, and screen-reader landmarks.

The NAK-101 implementation and checks are recorded in `docs/engineering-loop/features/nak-101-customer-navigation.md`.
