# Component loading and framework navigation

## Contract and execution context

User-approved follow-up to FH-I3/SS4 on 2026-10-17. Significant risk, full record:
shared server rendering, loading boundaries and navigation. Starting source is
`4022003` on `chore/nak-74-frontend-hardening-hybrid-lint`, clean working tree.
The earlier four-round review is historical; this newly approved implementation
has a separate, bounded review of its changed loading/navigation contract.

Goal: keep ready public content and authenticated navigation available while
data-dependent regions load, using the existing accessible Thinking Orbs.
Evaluate ordinary internal navigation for unnecessary document reloads.

## Design and scope

- Remove the root-wide loading fallback. Ready public/marketing/legal content
  must not be hidden behind unrelated page loading. Do not disable streaming
  globally or add a custom history manager/timing workaround.
- Dashboard/account/customer broker list: preserve the live server authentication
  gate, then render their navigation outside a nested Suspense data boundary.
  Preserve draft state, client keys, account-deletion rules and error recovery.
- Preview navigation should remain available independently of authorized preview
  data. Public/protected portfolios still wait for their projection/access checks;
  no identity, personal theme, media or privileged controls before authorization.
- Reuse LoadingStatus; no new animation package, fake progress, minimum delay,
  global request interceptor or changes to reduced-motion behavior.
- Ordinary in-app links use Next Link/router. Keep hash navigation, mail/tel,
  attachment/API downloads, provider OAuth/Didit handoffs, fresh-authentication
  reloads and intentional new tabs. No broad auth or disclosure refactor.

## Evaluations

| ID | Expected behavior / mistake rejected | Verification |
| --- | --- | --- |
| CN1 | Header and theme/navigation work during delayed dashboard/account/list data; no whole-page replacement | Loopback-only delayed session, real browser request transport and navigation during pending work |
| CN2 | Public Privacy → Login → Back restores the original position, native and enhanced; no relaxed bounds | Repeated existing SS4 and direct history/browser navigation regressions |
| CN3 | Ordinary internal clicks do not replace the browser document | Browser marker/document request checks; source inventory of anchors and location assignments |
| CN4 | Only actual pending work shows truthful accessible orbs, with no duplicate visible main/status | Unit fallback checks, delayed browser region checks and completion/error recovery |
| CN5 | Authentication, sharing and editor guards remain intact | Existing auth/server-page/client/modal/preview tests and affected browser journeys |

## Security, compatibility and rollout

No migrations, APIs, cookies, credentials, database authorization, cache policy or
provider integration changes. Test delays are recognized only in the loopback
fixture, never production code. Anonymous/revoked sessions retain existing
redirects; pending deletion/access state must never default to allowed. Preserve
protected-link no-store headers and intentional draft-preserving new-tab links.
No push/deployment/remote migration is implied by implementation.

## Verified locations and next step

Read: root loading/layout; customer pages and clients; LoadingStatus/PageLoading;
preview/shared-portfolio pages; framework loading/navigation docs; current
customer header and auth gate; BrokerDesk contract and representative pages.
Graphify graph/executable unavailable. Existing real-action orbs remain owned by
their components. Implementation and the local evaluation matrix below are
complete. Next release checks are hosted CI/Vercel Preview and the separately
recorded physical-device/assistive-technology journeys; no deployment is implied.

## Evidence and decisions

Implementation: removed root/dashboard/legacy-edit whole-page fallbacks. The
server-authenticated CustomerAppFrame owns stable navigation and a data-only
Suspense fallback. Dashboard/account clients own their existing data/interaction
state, not a second header. Broker-list copy/navigation also remain outside its
list boundary. Failed reads show a generic local retry rather than defaulting
unknown account state to enabled controls. Preview layouts own static navigation
outside their existing authorization/data-loading boundaries; no personal data
or owner-selected appearance moves into those layouts.

Historical baseline with the new delayed fixture: all three desktop pending-data
navigation cases failed before the runtime change. Initial changed-source browser
batch: 30 passed on desktop/tablet/mobile Chromium, including the original SS4
and native/enhanced full-document history cases. A first earlier diagnostic had
one click-before-hydration failure; the regression now awaits root hydration
and reasserts data is STILL pending before interaction. No production wait was
added. Final expanded browser/static/coverage/build and independent review remain
pending. Initial unit assertions were updated to render the new server boundary
and compose the moved header; no sharing/draft/deletion expectations were removed.

## Navigation inventory

First-party TS/TSX anchors, location writes, router calls and window-open sites
were inventoried. Existing navigation already largely uses Next Link/router.

| Category | Decision |
| --- | --- |
| Customer headers, policy/marketing links, dashboard actions, internal views | Preserve existing Next links/router; browser tests check retained document identity during pending navigation |
| Broker Introduction signed-out sign-in link | Replace native same-tab anchor with Next Link, retaining the exact encoded return path |
| Candidate/bearer/representative verification-management links | Next Link with prefetch disabled; retain server-issued destination and token rules |
| OAuth, Didit provider handoff, account/team fresh reauthentication | Retain browser document handoff; do not turn external authentication into SPA navigation |
| MFA completion | Retain existing deliberate document navigation after assurance-cookie update; changing that auth lifecycle is outside this presentation task |
| Hash links, skip links, contact tel/mailto, external provider/founder references | Native browser links remain intentional |
| Preview/new-tab policy links and signed attachments/API view endpoints | Retain new tabs/download behavior, especially the draft-preserving privacy help fix |

The AST guard catches known root-relative same-tab anchors, including template
prefixes. It is not proof of every dynamically computed URL's origin; those
callers were inspected separately. No global click interceptor was introduced.

## Boundaries intentionally not weakened

Protected public/Complete/agency projections still await authoritative data and
authorization. Their content is not a safe static shell to reveal early.
BrokerDesk membership/assignment gates, admin gates and provider redirects remain
unchanged. Existing action-level client orbs continue around their actual work.
This is not an authorization, cache or whole-BrokerDesk presentation rewrite.

Earlier FH-I3 attribution remains qualified until repeated final-source and
production-build checks finish. Passing a single post-change history sequence
is not a universal restoration guarantee.

### Independent correction review

Round 1, fresh-context `/root/component_loading_navigation_review`, exact model
unknown, instruction-based read-only shared-source access. Snapshot
`05f942351df12294f1c877ef1d5d354b2a6884aa45e0d15011299ad3574bd918`;
freshness checked at start/end. Verdict `changes_required`:

- CN-R1, introduced medium/material: the moved header became non-inert during
  final publication review. Reviewer independently reproduced background Account
  focus escaping while review remained open. Fix: use the existing shared modal
  lifecycle for final review as well as the editor, preserving the publication
  Escape guard. New browser regression failed at the exact header-inert assertion
  before the fix and passed unchanged on all three Chromium viewport projects.
- Anonymous-route test expected a bare login URL, rejecting the maintained
  proxy's return destination. Assert exact pathname and existing per-route return
  policy instead; no authentication implementation change.

The expanded pre-correction browser run was intentionally interrupted before
editing: 63 passed, 2 failed (the URL assertion), 1 interrupted, 18 not run. It
does not establish a full pass. An overlapping full coverage attempt was stopped
after test timeouts during host contention; no timeout budget or assertion was
relaxed. A corrected-source sequential run remains required.

The runtime production build passed during correction; final source review and
expanded validation were then pending. Unit error/retry checks preserve the same frame
through recovery, and a real delayed account-read browser case checks the orb
clears without replacing its header.

## Final local rerun — 2026-10-18

Tested dirty source, including new/untracked files, on base `4022003`. Source
review snapshot:
`5c33f87656cd3ba112ae9f011987814a5b02ce8b9ec320817dfb91c1e752ea98`.
Provenance was current before these results-only documentation updates. No
runtime, dependency, test or configuration changes followed the passing checks.

| Check | Result / evidence |
| --- | --- |
| Focused existing test consumers | 10 passed; `/tmp/nak-component-test-consumers-rerun.log` |
| Both lint engines, typecheck, whitespace | Passed; `/tmp/nak-component-lint-rerun.log`, `/tmp/nak-component-typecheck-rerun.log`, `git diff --check` |
| Full unit and configured coverage thresholds | 190 files / 1,464 tests passed; statements 86.14%, branches 81.06%, functions 84.87%, lines 89.71%; `/tmp/nak-component-coverage-rerun.log` |
| Feature coverage | All 59 gates passed; `/tmp/nak-component-feature-coverage-rerun.log` |
| Affected development-browser matrix | 90 passed across desktop/tablet/mobile-sized Chromium; `/tmp/nak-component-browser-rerun.log` |
| Production build | Passed; `/tmp/nak-component-build-rerun.log` |
| Repeated production-mode history | 27 passed: original wheel/keyboard/anchor/Back case plus native and enhanced full-document Back, each repeated three times on all three viewport projects; `/tmp/nak-component-production-history-rerun.log` |
| Dependency audit | Full audit: zero affected packages, no exceptions; production: no high/critical findings; `/tmp/nak-component-audit-rerun.log` |
| Database fixture source smoke | Passed; `/tmp/nak-component-db-smoke-rerun.log`; not database execution or pgTAP |

The initially failed full run remains at
`/tmp/nak-component-coverage-final.log` (three failed tests, one unhandled error).
Two existing broker-page tests needed the async Server Component test helper;
the sign-in client test needed the canonical IntersectionObserver fixture restored
after global cleanup. Both corrections retained the original assertions and real
Next Link. No timeout, coverage threshold or runtime behavior was weakened.

CN1/CN3: real pending-data browser interactions retained a document marker and
observed zero main-frame document navigation requests. CN4: delayed account
completion cleared the orb while retaining its header; error/manual-retry unit
checks preserve the frame. Desktop and mobile dark pending-data screenshots were
inspected together: header/navigation and status remained visible without sampled
overflow. This is not an exhaustive contrast or animation/performance audit.

CN2/FH-I3: the original Back assertion is unchanged. It and direct full-document
native/enhanced checks pass in development and the rebuilt production-mode app.
The observed failure is resolved under these conditions. No custom history
manager, restoration timeout, forced reload or global streaming disable was
added. Earlier timing observations are not promoted to a universal causal claim.

### Final independent review / resolution

Round 2 snapshot
`0a603424db2db4075d5f277650454065bcf6c56c5b2c4ca93117eff25727eafd`:
the same fresh-context reviewer independently verified header isolation across
editor/review transitions, reverse Tab, attempted background focus, Escape during
pending publication and dismissal after refusal. CN-R1 is confirmed, introduced,
medium/material and resolved using the shared modal lifecycle. The new browser
regression and the final 90-case matrix pass at the resolved source snapshot.

Round 3 (third/final allocated round), snapshot `5c33f876…`: scoped verdict
`no_material_findings`. Only the two existing test-consumer corrections differed
from round 2; runtime source was unchanged. Reviewer inspected setup/helper/test
assertions and packet deltas, and independently passed freshness checks and
`git diff --check`. Coordinator test logs were inspected, not independently rerun
by the reviewer; broader gates still running at review time subsequently passed
as recorded above. Actual reviewer model remains unknown; this is fresh-context,
instruction-based read-only review, not a claimed cross-model or isolated review.

Local implementation/verification is complete for CN1–CN5. Hosted CI, Vercel
Preview, physical devices and assistive technology are not established by these
checks. Production-mode checks use the repository's `npm run start`; its existing
standalone-output warning means deployment packaging is not certified by this run.
No remote branch push, deployment, provider call, migration or Linear write occurred.
