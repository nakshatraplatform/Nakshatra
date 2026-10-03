# Portfolio overview and disclosure decisions

Mode: full. Risk: critical for public/approved projection and publication consent. Status: local implementation; database runtime, device checks, and legal review pending. Not released.

## Decisions retained

- The portfolio is an Introduction, not a biodata file. The hero reads the canonical full name, current profession title, structured current location, and short description. No duplicate overview fields are stored.
- New pilot publications use one public Introduction (the former Detailed projection). Brief is retired from the form; historical published Brief snapshots remain readable without automatic widening. The four overview facts are Moon Sign (Rashi), Age, Height, and Marital Status. The owner sees the public Introduction and approval-only Complete Portfolio previews before publication.
- The product owner superseded the earlier per-field visibility proposal. There is **no verified-email audience tier** and no per-field Public / Verified / Private selector in this release. A confirmed email alone never grants Complete Portfolio access.
- Contact, exact birth details, income, and original horoscope are not public. The existing authenticated/email-OTP Show Interest flow remains; it is not replaced by an anonymous one-click request.
- Owner previews are authenticated draft views, not copyable public publication links. Publishing needs current versioned disclosure confirmation. Existing published snapshots are not silently widened by this migration.
- Current Didit photo/liveness is not legal-identity verification. Do not present the badge or policy copy as a legal identity guarantee.

## Source of truth

`BlueprintForm.tsx` edits canonical values; `src/types/portfolio.ts` parses stored data. `public-snapshot.service.ts` and `approved-snapshot.service.ts` create distinct serialized audiences. `publish.service.ts` and the database publication transaction enforce the public transition. `CelestialUnion.tsx` reads the resulting projection. The privacy and terms pages explain disclosure and correction.

## Implemented locally

- Full-name, profession/location, description, four-fact overview, section navigation, responsive interest affordance, and policy/correction links are represented in the worktree.
- Marital Status is required to publish, but historical values remain editable without silent rewriting.
- `publication-disclosure-v2` binds the review to the current draft; prior consent cannot authorize a newly broadened public introduction.
- The rejected verified-email field projection, preview route, selectors, and migration have been removed from the worktree. Neither a confirmed email nor a former selector choice can expand Complete Portfolio access.
- Section order is Basics, Personal story & lifestyle, Education & work, Family, Astrology & traditions, Match & future, Privacy & contact. Legacy reduced-disclosure drafts may still be saved, but cannot be republished until the owner explicitly updates the sharing setup and reviews the current public preview. The previous live snapshot is not rewritten.

## Release gates

1. Verify current public/approved serialization plus historical reduced-disclosure rendering, including negative checks for contact, precise birth data, income, and originals.
2. Run the database pgTAP suite against a fresh local instance with pending migrations; `db:smoke` checks fixture shape but not SQL runtime.
3. Run 320/375/414 px and desktop browser checks, keyboard/focus/contrast review, and policy legal review.
4. Confirm the form contract in `b2c-form-contract.md` before publishing or merging; this worktree is not production-ready solely because TypeScript or unit tests pass.

## October 3 verification and reset boundary

- Current local source: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run db:smoke`, and 76 focused Vitest cases passed. Full Vitest: 935 passed, with two separate failures in Didit sandbox journal location and security-audit CLI tests. `npm run test:db:local` could not start because Docker/Podman is unavailable. The added publication trigger and pgTAP assertions are therefore **not SQL-runtime verified**.
- Fresh-context review confirmed the existing authenticated publication RPC still accepts caller-supplied public-snapshot values; the allowlist validates keys, not equality with the consent-reviewed draft. This remains a high-severity pilot-release blocker.
- The owner requested resetting the permanent test account's portfolio and onboarding state while keeping the login. Production Supabase is signed out in the in-app browser, so no live records were modified. Reset scope must be inspected against actual portfolio, candidate, verification, introductions, grants, media, and storage rows before any deletion; a separate invited account is needed to retest first-time signup.
