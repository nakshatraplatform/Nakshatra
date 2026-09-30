# NAK-60 — Document-free liveness and profile-photo match

- Status: **Proposed implementation plan; feasibility, policy and legal gates open**
- Baseline: `origin/main` at `33f9091` (2026-09-30); NAK-60 draft PR #59 is based on an older main and must be reconciled before implementation.
- Product direction: [approved 2026-09-22](../identity-verification/liveness-only-decision.md).
- Provider feasibility: [open technical spike](../spikes/api-didit-profile-photo-match-spike.md).

## Problem and intended claim

The current flow starts an ID-document Didit workflow, checks legal name and birth date, and grants a generic `identity_verified` result. VivIntro's approved direction is instead to confirm that a live person matches the profile photo they publish, without requesting or retaining an ID document. The public claim must therefore describe **a liveness and photo match**, not legal identity, name, age, marital status, background, or uniqueness of the person. A live-person check alone would not establish a match to the portfolio.

## Later-stage complications to resolve before implementation decisions

| Complication | Consequence | Design gate |
| --- | --- | --- |
| First-time reference photo | Didit docs describe `portrait_image`, but the current account/API path has not been proven for a portfolio image. | Complete the provider spike with real sandbox evidence before committing to the integration. |
| Mutable primary photo and broker edits | A later hero promotion/deletion can leave a valid-looking badge on a different person's photo. A broker or creator could substitute a photo. | Bind proof to candidate, portfolio, media row and immutable object version/hash; enforce invalidation at the database mutation boundary and prevent a broker from attesting for the candidate. |
| Reused `identity_verified` state | Existing ID-verified rows, public snapshots, publication gates and 365-day expiry can be misread as the new proof. | Version proof type and public claim; explicitly choose legacy treatment and in-flight-session handling before migration. No silent relabeling. |
| Shared BrokerDesk representative flow | The same reconciliation RPC currently sets organization `representative_identity` and onboarding progress. | Split candidate and representative assurance/policy. Do not let photo match satisfy a legal-representative identity check without a separate approved business decision. |
| Biometric privacy remains | The vendor still processes face/liveness media; session deletion does not clear separate blocklists, queued webhooks or audit records. | Named privacy/legal owner approves consent, notice, retention, cross-border processing, appeals and deletion evidence for each launch country. |
| Age and anti-fraud expectations | A photo match cannot establish legal age or prevent one person from opening multiple accounts, particularly after immediate provider deletion. | Decide minimum-age policy and separately label any unverified attributes; define abuse controls without implying a biometric uniqueness guarantee. |
| Accessibility and false rejects | Camera denial, lighting, disability, device/browser support and match errors can block genuine users. | Provide retry, manual appeal and an explicit publication-state policy; no hidden ID fallback. |
| Provider outage and workflow drift | A disabled module, changed workflow version, timeout or late webhook can produce an unjustified pass. | Pin/record expected workflow version and modules per attempt; validate signed callbacks, fetch authoritative decision, fail closed, reconcile idempotently and monitor backlog. |

Removing document capture does not remove biometric-law exposure. For example, [Illinois BIPA section 15](https://www.ilga.gov/legislation/ilcs/fulltext?DocName=074000140K15) sets notice, release and retention duties for covered biometric collection, while [GDPR Article 9](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) treats biometric data used for unique identification as a special category. The [Indian DPDP commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) phases provisions in over time. Applicability and exact obligations depend on the launch footprint and processing design, so they require jurisdiction-specific review before release.

## Proposed implementation sequence

1. **Freeze the proof contract.** Complete the Didit spike and choose the exact reference: the candidate's currently designated primary `hero` photo. Require candidate-owned session and explicit consent before transferring that image. Define copy such as “Live photo match checked” and an accessible explanation of what was checked. Agree on legal jurisdictions, age policy, legacy proof treatment, broker scope, appeals and deletion policy with named owners. Keep the production workflow disabled until these gates pass.
2. **Model proof provenance.** Add a forward-only Supabase migration for a candidate photo-match proof type/version, candidate and portfolio IDs, hero media ID, immutable Storage object identity or cryptographic content digest, provider workflow/version, checked/expiry timestamps, consent version and normalized status. Keep raw selfies, face templates, document numbers, provider decision payloads and signed image URLs out of the database. Migrate read paths to distinguish legacy document proof from the new photo proof. Define whether old proof can temporarily satisfy publication, with explicit presentation and sunset date.
3. **Enforce photo binding in the database.** At `portfolio_media` insert/delete/hero change/storage-path change, invalidate or suspend the candidate's active photo-match proof and recompute publication eligibility. Ensure published snapshots and public badges stop asserting a current match when the hero changes. Handle the race between session creation, callback, photo mutation and publication in a transaction or compare-and-set RPC; the callback must only complete for the unchanged bound photo version. Inspect direct database/RLS mutations and broker flows so service-layer checks cannot be bypassed.
4. **Replace the candidate provider workflow.** Configure a separate ID-free Didit workflow in sandbox/production. Change `src/features/identity-verification/server/didit.provider.ts` and `session.service.ts` to send only required candidate/portfolio binding and the server-resolved reference photo; remove candidate document-country/type, legal-name/DOB expected details and related HMAC use where unnecessary. Keep the representative flow separate. Do not log the image or provider payload; bound URL/token lifetime must be minimal if the API requires a URL.
5. **Reconcile and purge safely.** In `scripts/identity-verification-worker.mjs`, validate the expected liveness and face-match modules, threshold/warnings, workflow version, session/subject binding and exact hero-version binding before granting the photo proof. Preserve signed webhook verification and idempotent retry/redaction. Reject missing modules and late decisions after photo replacement. Update the relevant `app_private` RPCs via new migrations; do not edit applied migrations. Prove provider deletion and document separately retained audit/blocklist records.
6. **Update all consumers and claims.** Adjust publication/readiness rules, public snapshots and badges, dashboard/consent/auth copy, BrokerDesk copy only where its separate policy applies, notifications, runbooks and privacy notice. Avoid the phrase “identity verified” for a candidate photo match. Ensure the user can see what is and is not verified and how to appeal or delete the check.
7. **Migrate and release in stages.** Rebase or supersede NAK-60 PR #59 against latest main, preserving useful timeout/error-classification fixes but removing document assumptions. Deploy additive schema and dual-read behavior first, then candidate provider/worker changes, then new UI/public claim, then enable the ID-free workflow behind a flag. Drain or explicitly cancel old ID sessions; do not misclassify their late callbacks. Rollback disables new starts/claims without re-enabling ID collection. Follow the repository's protected Supabase migration/CD workflow.

## Acceptance and verification

- Sandbox confirms same-person pass, different-person fail, no/multiple-face photo fail, photo change during a pending session, replay/late webhook, duplicate callback, provider timeout/outage, withdrawal, deletion and appeal. No ID module is requested or present in decision data.
- Automated tests cover database-level photo invalidation (including direct authorized RLS writes), candidate versus BrokerDesk policy separation, proof-version migration, publication and public badge visibility, session binding and recovery. Browser tests cover mobile camera permissions and accessible error/retry states.
- Operational evidence records provider configuration, data flow, retention/deletion exceptions, approved consent/notice, country and age policy, monitoring and incident owner in the private compliance store. Do not store test faces or secrets in GitHub/Linear.
- Production remains disabled until the provider spike, engineering checks and named privacy/legal gates are complete.

## Open decisions for product and privacy owners

1. Which countries and age groups are in the first release? This determines the applicable biometric consent, retention, age and transfer requirements.
2. What happens to existing ID-verified candidates and in-flight ID sessions: retain the old proof until expiry with a distinct label, ask for photo match at next publication, or require migration immediately?
3. Does BrokerDesk representative onboarding keep its existing document-level requirement, adopt a separately approved alternative, or remain unavailable while that policy is decided?
4. What is the appeal/fallback when the camera or match fails, and may such a portfolio be published without the photo-match claim?

No new ID-document collection should be enabled while these decisions are open. This plan does not authorize a production biometric launch.
