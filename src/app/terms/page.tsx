import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  const legalEntity = process.env.VIVINTRO_LEGAL_ENTITY_NAME?.trim();
  const registeredAddress = process.env.VIVINTRO_REGISTERED_ADDRESS?.trim();
  const governingLaw = process.env.VIVINTRO_GOVERNING_LAW?.trim();
  return (
    <PolicyLayout
      eyebrow="Terms"
      title="Clear expectations for using VivIntro."
      summary="VivIntro is a tool for controlled marriage introductions. It is not a matchmaking service, background-check service, or source of legal or astrological advice."
    >
      <PolicySection id="data-accuracy" title="Your account and content">
        <p>You are responsible for keeping account access private and for the accuracy, permission, and legality of the information and files you add. Do not share sign-in links or upload information you are not authorized to use.</p>
        <p>For the introduction you create and share through your own link, VivIntro displays selected published answers publicly and private details only after your approval. Your saved draft and unpublished edits remain private. Confirm publication consent before publishing and correct inaccurate information in Introduction details. Both previews are optional.</p>
      </PolicySection>

      <PolicySection title="Publishing and sharing">
        <p>You decide when to publish or publish an update. Anyone who receives an active personal link may open the public Introduction without an account or forward the link. Keep private details out of public answers and review the public preview before sharing.</p>
        <p>A viewer must sign in, confirm their email, and request your approval to open the Complete Portfolio. Approved access lasts 15 days and is bound to that requester&apos;s account. You can renew access for another 15 days or revoke it earlier. Review the protected contact, birth details, family, work and income information, photos, and optional horoscope included in that preview before agreeing to share it; owner-only notes and street address fields are not included.</p>
        <p>Publishing an update keeps the same personal link and preserves approvals that have not expired or been revoked, so approved viewers may see the updated Complete Portfolio. Unpublishing pauses viewing but keeps your saved portfolio, requests, and approvals. If you publish again, still-valid approvals can resume. Replacing the public link invalidates the old URL and revokes existing approvals; revoke access when you intend to end it rather than pause it.</p>
        <p>People may save or photograph information they can view, including protected details you approve for them. Unpublishing or ending access stops future portfolio viewing in VivIntro; it cannot remove copies already made outside the service. Temporary file links already issued may remain usable until they expire.</p>
      </PolicySection>

      <PolicySection title="Acceptable use">
        <p>Do not use VivIntro for harassment, impersonation, fraud, unlawful discrimination, unauthorized surveillance, or distribution of illegal or harmful content. Do not attempt to bypass access controls or interfere with the service.</p>
      </PolicySection>

      <PolicySection title="Current free personal portfolio features">
        <p>The current personal portfolio creation and sharing flow is free. It has no paid creator plan, checkout, or subscription to cancel. Any future paid features will have separate pricing and purchase terms presented before you choose to buy.</p>
      </PolicySection>

      <PolicySection title="Service availability">
        <p>Features may change as the product develops. We may limit access when needed for safety, maintenance, legal compliance, or misuse prevention. Where practical, material changes will be communicated clearly.</p>
      </PolicySection>

      <PolicySection title="Founders and responsibility">
        <p>VivIntro was founded by Nagarjun Mallesh and Rahul Gollapalli Rangnatha to help people create and share marriage portfolios while controlling access to their details.</p>
        <p>{legalEntity ? `VivIntro is operated by ${legalEntity}.` : "The founders currently operate the service as individuals; no entity has been registered for the service."}</p>
        {registeredAddress ? <p>Business/contact address: {registeredAddress}.</p> : null}
        {governingLaw ? <p>These terms are governed by the laws of {governingLaw}.</p> : null}
      </PolicySection>

      <PolicySection title="Questions">
        <p>For questions about these terms, contact <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href="mailto:hello@vivintro.com">hello@vivintro.com</a>.</p>
      </PolicySection>

      <p className="text-sm text-[color:var(--workspace-ink-muted)]">Last updated: October 15, 2026. Pilot wording is subject to legal review.</p>
    </PolicyLayout>
  );
}
