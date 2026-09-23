# Didit liveness-only verification decision

Status: **approved product/privacy direction; implementation and provider
validation pending**. Decision recorded 22 September 2026.

## Decision

VivIntro intends to use a hosted facial biometric and liveness check to confirm
that a live person corresponds to the profile being published. The intended
workflow does **not** include physical ID-card or identity-document verification.
VivIntro must not ask Didit to collect an identity-document image or document
number, and must not store either category locally.

This reduces identity-document exposure, but it does not make the workflow
non-sensitive. Selfies, face scans, liveness evidence and derived biometric
templates remain sensitive processing. Provider retention, deletion, regional
processing, consent, appeal and incident handling are still release gates.

## Required implementation reconciliation

The current application is not yet compliant with this decision:

- `didit.provider.ts` sends document-oriented expected details, including
  country and document types;
- customer and broker verification copy refers to legal-name, birth-date and
  India-document checks; and
- older provider/readiness documents require an ID-document module.

Do not enable live Didit verification until a separate implementation:

1. verifies from current official Didit documentation or an approved provider
   agreement that the selected workflow can perform the intended liveness and
   profile-face comparison without an ID document;
2. defines which existing VivIntro profile photo is used as the comparison
   reference and prevents a broker from substituting it;
3. removes document-country/type fields and document-oriented copy from the
   request, consent, UI, tests and runbooks;
4. validates signed webhook decisions without retaining raw provider evidence;
5. proves deletion/retention behavior for facial and liveness evidence; and
6. rehearses success, mismatch, retry, outage, withdrawal and appeal paths in
   the provider sandbox before production activation.

If Didit cannot provide the required profile-face comparison without document
verification, the team must select another supported verification mode/provider
or explicitly revisit this product decision. It must not silently re-enable ID
document collection.

NAK-80 notification messages deliberately use neutral “verified” wording and
contain no identity, document, facial or biometric data.
