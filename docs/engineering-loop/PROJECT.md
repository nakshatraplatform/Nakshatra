# VivIntro / Nakshatra project map

Product: VivIntro lets marriage prospects create, publish and selectively share portfolios. The repository and Linear project are named Nakshatra. This map covers the areas inspected for NAK-60, not a whole-repository audit.

## Observed stack and boundaries

- Next.js 16.3.4 App Router, React 19, TypeScript 6, Vitest and Playwright; npm lockfile controls dependencies. Consult `node_modules/next/dist/docs/` before modifying framework behavior.
- Supabase Postgres, Auth and private Storage store portfolio and normalized verification state. Forward-only SQL migrations are in `supabase/migrations`; pgTAP tests are in `supabase/tests/database`. Protected CD applies production migrations.
- Didit hosted sessions use server-only API credentials. `src/features/identity-verification/server/` owns candidate/representative session creation, signed webhooks and repositories. `scripts/identity-verification-worker.mjs` fetches decisions and deletes provider sessions; database RPCs own authoritative state transitions.
- `src/features/media/server/` stores private portfolio photos. A `portfolio_media` hero row is the primary photo and can change after verification.
- `src/features/portfolio/server/` and `src/components/templates/` consume publication and public-badge state. BrokerDesk representative verification is a separate subject type that currently shares the provider worker/RPC.

## Relevant feature status

- [NAK-60 document-free verification](features/nak-60-document-free-verification.md): in development; provider Sandbox and biometric privacy gates open.
- [Document-free product decision](../identity-verification/liveness-only-decision.md): approved direction, implementation pending.
- [Production readiness](../identity-verification/production-readiness.md): live workflow disabled pending gates; older ID-document portions need reconciliation.

## Checks and limits

`npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:db:local`, `npm run build`, and `npm run test:e2e` are repository commands. Focused tests run with `vitest run <path>`. Docker was unavailable during the first NAK-60 implementation pass, so local pgTAP was not established. A source inspection or mocked unit test does not certify a Didit Sandbox session, provider deletion, production deployment or jurisdiction-specific biometric compliance.
