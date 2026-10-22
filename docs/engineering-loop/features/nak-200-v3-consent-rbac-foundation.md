# NAK-200 — V3 consent and RBAC foundation

## Execution context

- Risk: **Critical** — consent versioning, authorization capabilities, database
  migration, public RPC privileges, and compatibility with live invitations.
- Documentation mode: Full.
- Branch: `feat/nak-200-v3-consent-rbac-foundation`, synchronized with
  `origin/main` at `399bd23` after NAK-208 merged on 22 October 2026.
- Current step: local implementation and regression validation are complete;
  hosted migration replay and pgTAP remain the pull-request merge gate. No
  production deployment or mutation is authorized.
- Source of truth:
  [`vivintrodesk-mvp-contract.md`](../../vivintrodesk-mvp-contract.md) and the
  [`family-assisted data architecture`](../../vivintrodesk-family-assisted-data-architecture.md).

### Verified locations

| Path / symbol | Responsibility | NAK-200 effect |
| --- | --- | --- |
| `app_private.brokerdesk_capability` | Closed broker operation vocabulary | Add three explicit capabilities in a migration isolated from their first use |
| `app_private.brokerdesk_role_capabilities` | Role-to-scope mapping | Owner/admin organization scope; advisor/coordinator assigned-customer scope; viewer none |
| `app_private.broker_client_intakes` | Invitation-bound consent evidence | New invitations default to V3; existing live V2 invitations stay V2 |
| `app_private.broker_client_mandates` | Current time-bound customer authority | Add mandatory structured `consent_version`; never parse evidence strings at authorization time |
| `app_private.activate_broker_client_intake` | Activates the canonical agency relationship | Persist intake consent version and issue only that version's capabilities |
| `public.claim_brokerdesk_customer_invitation` | Exact-email invitation claim | Require the request version to equal the version pinned on the invitation |
| `public.manage_customer_broker_consent` | Pause, renew, terminate | Keep ordinary renewal on the current mandate version; it must not broaden V2 to V3 |
| `public.reconsent_customer_broker_relationship` | Owner-only command | Explicit V3 consent without extending the broker term or reviving old Introductions |
| customer invitation route/client | Consent presentation | Render and submit the invitation's pinned V2 or V3 consent version |

## Problem

The current mandate stores consent version only inside `evidence_reference`, and
the claim client always submits V2. Family-assisted access requires a new V3
scope, but parsing evidence strings or changing the default claim value would
silently broaden existing consent. Existing generic response/sharing
capabilities are also too ambiguous for family proposals, manual WhatsApp
operations, and agency-private family reports.

## Goal

Create the narrow authorization foundation for later Family Viewer work:

1. make mandate consent version typed, indexed, and mandatory;
2. issue V3 only after explicit V3 consent;
3. keep every existing V1/V2 record candidate-only;
4. preserve still-live V2 invitations without converting them;
5. provide a separate non-renewing V3 reconsent transaction; and
6. add least-privilege broker capabilities without building any family data or
   disclosure feature yet.

## Contract

### Consent and compatibility

- `broker-representation-v1`, `broker-representation-v2`, and
  `broker-representation-v3` are the only stored mandate versions.
- Migration backfill classifies each mandate from its own exact versioned
  evidence first. Only genuinely unversioned evidence may use a linked intake,
  and only when one consent version shares the mandate's exact start timestamp.
  An active mandate that cannot be classified aborts the migration for operator
  review; it is never guessed as V3. Unclassified revoked history receives the
  least-capable V1 value because it cannot authorize any operation.
- Invitations created after this migration pin V3. Existing V2 invitations keep
  V2 until claimed, expired, revoked, or replaced.
- The claim RPC compares the submitted version with the stored invitation
  version. It does not update the version selected at invitation creation.
- V2 activation and V2 renewal keep the existing capability set and never grant
  family-assisted authority.
- V3 activation issues the same core capabilities plus the three explicit V3
  capabilities below.
- Explicit reconsent changes only an active, unexpired owner-controlled
  relationship from V1/V2 to V3. It preserves the earlier of relationship and
  mandate end time, does not revive old Introductions, and does not extend the
  commercial term.
- Repeated identical reconsent is idempotent. Cross-owner, expired, terminated,
  malformed, or conflicting requests fail neutrally or with the existing safe
  validation error contract and write nothing.

### New capabilities

| Capability | Meaning | Role scope |
| --- | --- | --- |
| `family_viewers.propose` | Propose candidate-controlled family setup; never activate it | Owner/admin organization; advisor/coordinator assigned customer |
| `introductions.manage_sharing` | Record manual side-specific share/reminder operations | Owner/admin organization; advisor/coordinator assigned customers |
| `introductions.record_family_update` | Append agency-private family reports | Owner/admin organization; advisor/coordinator assigned customers |

The `viewer` preset receives none. Later two-sided commands must independently
require assignment to both participant relationships for assigned-customer
roles; NAK-200 only establishes the capability vocabulary and single-resource
scope mapping.

## Non-goals

- No Family Viewer roster or invitation tables.
- No family dashboard, profile read, response authority, or Complete grant.
- No side-specific share-state or family-update tables.
- No WhatsApp OTP, AiSensy delivery, or automated WhatsApp messages.
- No changes to personal VivIntro sharing.
- No deployment, hosted migration, or production data backfill.

## Evaluations

| ID | Representative case | Required result / evidence |
| --- | --- | --- |
| AC-1 | Clean migration with classifiable V1/V2 mandates | Every mandate has a checked structured version and the active index supports version predicates |
| AC-2 | Unclassifiable active mandate | Migration aborts rather than granting V3 or silently guessing |
| AC-3 | New invitation | Intake is pinned V3 and the consent client submits/display V3 terms |
| AC-4 | Pre-existing live V2 invitation | Resolver returns V2; claim succeeds only with V2 and creates a V2 mandate |
| AC-5 | Caller changes submitted consent version | Claim is neutral and intake version remains unchanged |
| AC-6 | V2 relationship renews | Fresh mandate remains V2 and has no V3 capabilities |
| AC-7 | Owner explicitly reconsents | One V3 mandate replaces current authority without extending its end time or reviving access |
| AC-8 | Wrong owner or expired relationship reconsents | Neutral failure and no mandate, relationship, audit, or idempotency write |
| AC-9 | Role capability checks | Owner/admin and assigned advisor/coordinator pass; viewer and unassigned staff fail |
| AC-10 | Direct table/function access | Authenticated users retain no private-table privileges; only intended public RPCs execute |
| AC-11 | Existing BrokerDesk behavior | Focused invitation/consent tests, DB smoke, types, lint, coverage, and build pass |
| AC-12 | Critical review | Fresh reviewer has no unresolved material finding on the final snapshot; hosted replay/pgTAP remains a merge gate if unavailable locally |

Plausible wrong implementations rejected by these checks include changing every
pending V2 invitation to V3, deriving authority from `evidence_reference`,
letting renewal broaden consent, extending the broker term during reconsent,
giving the viewer preset mutation authority, or granting a family capability
through a V2 mandate.

## Migration, rollout, and recovery

Capability enum values are added in an earlier migration than the migration
that first casts or inserts them, avoiding PostgreSQL enum visibility problems
inside one transaction. Deploy database changes before the application begins
submitting V3. The application reads the invitation's pinned version so a
rolling deployment can still claim a V2 invitation accurately.

Rollback may stop V3 application entry points and revoke new capability use.
It must not rewrite V3 mandates as V2, restore revoked mandates, extend terms,
or reinterpret old consent. If the structured column must later change, use a
forward migration with an evidence-preserving transition.

## Progress and evidence

- Main synchronization: rebased by fast-forward onto the merged NAK-208
  wireframe contract (`399bd23`) on 22 October 2026. NAK-208 remains the UI
  authority; this slice changes only the consent/RBAC foundation and related
  invitation compatibility.
- Baseline `npm run db:smoke`: passed on 21 October 2026.
- Baseline focused Vitest: 5 files and 18 tests passed with the repository's
  locked dependencies.
- Implementation: typed mandate consent, V3 capability mappings, immutable
  invitation versions, version-aware claim UI/API, renewal preservation, and
  owner-only non-extending V3 reconsent are implemented in the isolated branch.
- Focused application regression: 5 files and 19 tests passed.
- Full application regression and coverage: 201 files and 1,684 tests passed;
  all 61 feature and 21 protected-boundary coverage gates passed.
- Post-sync validation on 22 October 2026: focused invitation and lint-parity
  regression passed (4 files / 46 tests), then the isolated full regression
  passed again (201 files / 1,684 tests). `npm run lint`, `npm run typecheck`,
  `npm run db:smoke`, `git diff --check`, and a production build against
  placeholder public Supabase values also passed.
- `npm run db:smoke`, `npm run typecheck`, `npm run lint`, production build,
  and dependency security audit: passed. The build used local placeholder public
  Supabase values because this isolated worktree intentionally has no secrets.
- PostgreSQL parser (`pglast`) accepted all three NAK-200 migration files.
- Graphify SQL support was installed and the final refreshed graph indexed
  migrations and pgTAP (3,661 nodes / 8,590 edges) without the prior SQL-skip
  warning.
- Local Supabase replay/pgTAP: blocked because this host has neither Docker nor
  Podman. The new 31-assertion pgTAP suite and the full existing database suite
  must pass in hosted CI before merge.
- Fresh independent review found one material backfill risk: choosing a
  relationship's latest intake could relabel an older V1 mandate as V2. The
  migration now classifies each mandate from its own unambiguous evidence,
  permits timestamp-exact intake fallback only when unique, and asserts that
  stored versions cannot conflict with versioned evidence. Narrow re-review
  confirmed the correction and found no remaining material defect. Runtime
  replay and pgTAP execution remain the hosted-CI merge gate.
