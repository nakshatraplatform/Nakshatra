# Nakshatra

Nakshatra is a consent-based introduction platform for adult candidates and families. It replaces scattered wedding biodata PDFs, photographs, horoscope files, and WhatsApp context with one current marriage portfolio and a controlled path from a public Introduction to verified interest to an approved Complete Portfolio.

**Nakshatra is not a matrimony site.** It does not provide public profile search, match recommendations, compatibility ranking, or marketplace discovery.

For the current repository map, product journeys, architecture, design system,
security baseline, and launch constraints, read [CLAUDE.md](CLAUDE.md). The full
B2C review is in
[docs/b2c-pilot-product-assessment.md](docs/b2c-pilot-product-assessment.md).
For VivIntroDesk, begin with the
[document map](docs/vivintrodesk-document-map.md) and the
[authoritative MVP contract](docs/vivintrodesk-mvp-contract.md); do not derive
current requirements from an older BrokerDesk phase plan in isolation.

## B2C pilot contract

- Free, invite-only private beta for portfolio creators.
- Every pilot creator must complete Didit identity verification before first publication.
- Anyone with an active shared link may read its Brief or Detailed Introduction without creator access.
- A viewer may verify their email and express interest.
- The owner approves or rejects each request.
- An approved viewer receives identity-bound Complete Portfolio access for 15 days; the owner may revoke it earlier.
- Public portfolio links are active for 30 days by default and may be unpublished or replaced earlier.
- Payments and BrokerDesk are not part of the B2C pilot.
- Future paid-plan durations under consideration are 3, 4, 6, and 12 months. They are not implemented or available during the pilot.

Creator entitlement must remain separate from viewer authentication. Receiving or viewing a portfolio must never grant the right to create one.

## Core journey

```text
Private draft
  → preview the public Introduction and Complete Portfolio
  → complete Didit identity verification
  → publish one 30-day link
  → share through the existing family network
  → viewer reads the selected public Introduction
  → viewer verifies email and expresses interest
  → owner approves or rejects
  → approved viewer receives the Complete Portfolio for 15 days
  → owner can revoke access, rotate the link, unpublish, or update
```

Visible public Introduction information can still be saved or forwarded by a recipient. Nakshatra controls access to protected information; it cannot recall information somebody has already viewed.

## Technology

| Layer | Implementation |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript |
| Database | Supabase Postgres with migration-driven schema and RLS |
| Authentication | Supabase Auth: Google OAuth, password, email OTP/recovery |
| Files | Private Supabase Storage with access-scoped signed URLs |
| Validation | Zod contracts |
| Styling | Tailwind CSS v4, global styles, and CSS modules |
| Media processing | `sharp` decode, validation, resize, and re-encode |
| Tests | Vitest, Testing Library, Playwright, and Supabase pgTAP |
| Deployment | Vercel-oriented manual production workflow plus Docker support |

## Architecture

The product separates data by disclosure purpose rather than hiding private fields in the browser:

- Draft data is owner-only.
- Public snapshots are sanitized and resolved only through an exact active share token.
- Approved snapshots contain the permitted Complete Portfolio and require an authenticated approved viewer.
- Original protected media remains private; short-lived URLs are issued only after access resolution.
- Interest requests, access grants, revocation, link rotation, account export, and staged deletion have separate server/database controls.

The repository also contains the VivIntroDesk/B2B implementation through
NAK-78: broker onboarding and team access, customer mandates, Broker Standard,
customer consent controls, and bilateral authenticated Introductions. These
capabilities remain a separate launch context and must stay disabled for a
B2C-only pilot unless a bounded BrokerDesk pilot is explicitly activated.

## Important routes

| Route | Purpose |
|---|---|
| `/` | Pilot-aware marketing page |
| `/signup` | Invited pilot creator account entry |
| `/login` | Existing participant sign-in |
| `/dashboard` | Portfolio editor, publication, sharing, and interest management |
| `/preview` | Owner public Introduction preview |
| `/approved-preview` | Owner Complete Portfolio preview |
| `/p/[token]` | Shared Brief/Detailed Introduction or approved Complete Portfolio |
| `/access/[grantId]` | Identity verification landing page for emailed Complete Portfolio access |
| `/verify/[token]` | Viewer interest email verification |
| `/verification/result` | Creator identity-verification result |
| `/account` | Export, session, and deletion controls |
| `/privacy`, `/terms`, `/about` | Product and legal information |

See [CLAUDE.md](CLAUDE.md) for the full sitemap and domain-module map.

## Local setup

Requirements: Node.js 20+, npm, and a Supabase project for provider-backed flows.

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

Configure only the variables documented in `.env.local.example`. Keep service-role, database, Didit, and webhook secrets out of browser-visible `NEXT_PUBLIC_` variables.

Before changing Next.js application code, read the relevant installed documentation under `node_modules/next/dist/docs/`; this repository uses a version with breaking changes from older Next.js conventions.

## Verification commands

```bash
npm run security:audit
npm run lint
npm run typecheck
npm run test:unit:coverage
npm run db:smoke
npm run db:verify
npm run build
npm run test:e2e
```

`db:verify` requires Docker or Podman because it starts local Supabase, resets all migrations, and runs the pgTAP security suite.

## Relationship notification worker

Complete Portfolio approvals, renewals, revocations, expiry reminders, and Broker Introduction lifecycle messages are queued transactionally in the database. Configure a scheduler to send an authenticated `POST` request to `/api/internal/relationship-notifications` with `Authorization: Bearer $NOTIFICATION_WORKER_SECRET`. The worker uses `SUPABASE_SERVICE_ROLE_KEY` only on the server, revalidates a Broker Introduction recipient before resolving their email, delivers through Resend, and records accepted, retryable, or terminal outcomes through the durable outbox. Keep the scheduler disabled until the Resend sender/domain and credentials are configured and a real-inbox rehearsal succeeds.

For hosted Supabase Auth, keep both **Confirm signup** and **Magic Link or OTP** templates synchronized with `supabase/templates/confirmation.html` and `supabase/templates/magic_link.html`. Both templates must use `{{ .Token }}` so a new viewer and a returning viewer receive the same six-digit-code experience.

## Pilot launch status

Pilot-facing landing and signup copy now describe the free invite-only beta, mandatory Didit verification, 30-day public links, 15-day Complete Portfolio access, and open viewer-interest workflow.

This messaging update does **not** by itself make the pilot launch-ready. Remaining gates include creator-entitlement enforcement, viewer/creator privilege separation, BrokerDesk/payment gating, real-provider Didit rehearsal, disclosure confirmations, notifications, privacy-worker scheduling, exact production-environment verification, backup/restore testing, legal/contact accuracy, and real-device WhatsApp/email testing. Track the complete evidence and priorities in [docs/b2c-pilot-product-assessment.md](docs/b2c-pilot-product-assessment.md).

## License

Private — not open source.
