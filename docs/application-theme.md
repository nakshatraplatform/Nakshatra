# Application appearance (NAK-63)

Nakshatra's application is Light by default, independently of the device theme.
The header Sun/Moon button switches to the other appearance. The only stored
value is `light` or `dark` under `localStorage.nakshatra-app-theme`; there is no
account preference, cookie, API, database change or new environment variable.
Blocked storage leaves switching available in the current document; a full reload
falls back to Light if the preference cannot be read. Storage events
keep tabs synchronized; deleting or corrupting the preference selects Light.

## Design and implementation contract

Preserve the cream Light identity, page layout, typography, content and artwork.
Dark uses slate surfaces, light text and restrained teal/gold accents. Theme
controls belong beside existing navigation, remain visible on mobile, have a
44px minimum target and name the action for assistive technology. No animation
or theme library is added.

`src/lib/app-theme.ts` contains a static, allowlisted initialization script that
runs in the document head before body paint. `AppThemeProvider` re-applies it
before the development StrictMode remount paint and supplies a hydration-safe
server snapshot. It never turns server-rendered children into client modules.
The existing CSP is unchanged; never insert storage values into script source.

`src/app/app-theme.css` defines semantic dark roles. Existing application color
declarations use `light-dark(original-light, semantic-dark-role)` so Light keeps
its incumbent palette. CSS `color-scheme` is explicitly Light or Dark, never
System. This uses the modern CSS browser baseline already required by Tailwind
4; no user-agent or OS inference is involved. Filled actions keep their contrast
pair separate from text/accent colors. New application styles should reuse these
roles instead of introducing light-only colors.

## Semantic roles and design ownership

The existing [design direction](../DESIGN.md#4-shared-visual-system) remains the
incumbent baseline. This appearance extension retains its cream, ink, teal and
restrained gold identity in Light, along with the existing fonts, layout, copy
and artwork. It does not adopt the baseline's proposed token consolidation or
change unrelated product guidance. No design-document migration or new
Impeccable sidecar is part of this extension.

The implemented Dark palette is defined in
[`src/app/app-theme.css`](../src/app/app-theme.css). That file is the source of
truth for values; use the following roles in application declarations:

| CSS custom property | Application use |
| --- | --- |
| `--app-dark-canvas` | Slate page background |
| `--app-dark-surface` | Cards, fields and dialogs |
| `--app-dark-surface-soft` | Secondary panels and hover surfaces |
| `--app-dark-ink` | Primary text on dark surfaces |
| `--app-dark-muted` | Secondary text and placeholders |
| `--app-dark-border` | Borders and control outlines |
| `--app-dark-accent` | Teal links and accent text |
| `--app-dark-gold` | Restrained editorial accent |
| `--app-dark-success`, `--app-dark-success-surface` | Success foreground and surface |
| `--app-dark-warning`, `--app-dark-warning-surface` | Warning foreground and surface |
| `--app-dark-danger`, `--app-dark-danger-surface` | Error/destructive foreground and surface |
| `--app-focus` | Theme-aware keyboard focus outline |

Select foreground and background together. Light accent text is not an automatic
replacement for the dark text on a filled action. The editor's Attach horoscope
action and Hero label use `--app-dark-ink` with `--app-dark-surface-soft`; the
paused-access notice uses `--app-dark-accent` with
`--app-dark-success-surface`, retaining its existing Light pair. Keep readable
text or an icon alongside status colors.

## Portfolio boundary

Published and preview portfolios retain their owner's appearance. Their root
sets its own `color-scheme`, and portaled interest dialogs receive the same
appearance explicitly. Do not add an application switch inside a portfolio or
write its saved `style.appearance` from the application preference.

The application portfolio editor follows the browser's application preference;
the portfolio being authored or viewed follows the owner's saved appearance.
An owner-Light portfolio must stay Light when the application is Dark, and an
owner-Dark portfolio must stay Dark when the application is Light. This boundary
also applies to native fields and interest forms rendered outside the portfolio
root through a portal.

## Verification

- Unit: default/invalid values, keyboard operation, persistence, blocked storage,
  tab synchronization/removal, SSR snapshot and static initialization.
- Browser: initial paint with stored Dark and delayed hydration, navigation,
  both themes at desktop/tablet/mobile, readable controls, portfolio isolation,
  no hydration console errors and no horizontal overflow.
- Before merge: lint, typecheck, unit/coverage, build, Playwright, required CI,
  and both themes on the actual Vercel Preview. Do not treat a local build as
  evidence of deployment success.

Roll back via a normal revert PR if needed. The inert local preference requires
no cleanup or data migration.
