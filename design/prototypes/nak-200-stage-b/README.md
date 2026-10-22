# VivIntroDesk NAK-208 workflow wireframes

Local responsive wireframe app preserved from Stage B and continued under
NAK-208. Product and design decisions, source references, component-system
rules, and validation are in [the NAK-208 UI contract](../../brokerdesk/nak-208-vivintrodesk-ui-contract.md).

The app uses fictional local state only. It is not connected to production
routes, authentication, Supabase, Resend, WhatsApp, or real customer data.

From this directory:

```powershell
npm ci
npm run dev
```

Open [the preview](http://127.0.0.1:3100). For a compiled local preview, stop the development server first, run `npm run build`, then `npm run start`.

The initial screen is Customers. Follow **Open customer → Find matches → Review
pair → Create Introduction → Share separately with each side**. Introduction
detail includes a clearly labelled candidate-response simulator for design
review only; it is not a broker runtime action. Review controls switch
Admin/Advisor/Coordinator/Viewer and normal/loading/empty/error/long-text
examples. The sample scenario is fixed at 13 October 2026; it is not a live
clock. All changes reset on reload. Photos are intentional placeholders; all
people and agency data are fictional. The share example uses `.invalid`; no
email or WhatsApp message is sent.

This app has its own Next.js layout, Tailwind v4 configuration, dependency lock and Radix Dialog primitive. It imports no production services and installs no route into VivIntro. Component ownership:

- `components/workspace.jsx`: sample session, navigation, dialogs, role preview and lifecycle actions.
- `components/workspace-screens.jsx`: customer book/detail, Today, Introduction list/detail, Team and Settings.
- `components/matching.jsx`: pinned-reference discovery and shared responsive pair comparison.
- `components/ui.jsx`: accessible controls, status badges, portraits, panels, dialogs, feedback and exception views.
- `lib/sample-data.js`: bounded synthetic data and proposed compatibility fixtures. Never reuse its client checks as production authorization or matching policy.
- `app/globals.css`: exact named palette, font and motion tokens through Tailwind v4 `@theme`.

From the repository root, check the JavaScript prototype with the existing linter and explicit undefined-symbol checking:

```powershell
npx eslint design/prototypes/nak-200-stage-b/app/*.jsx design/prototypes/nak-200-stage-b/components/*.jsx design/prototypes/nak-200-stage-b/lib/*.js design/prototypes/nak-200-stage-b/*.mjs --max-warnings=0 --rule 'no-undef: error'
```

No deployment, real matching decisions, external delivery or production readiness is established by this prototype.
