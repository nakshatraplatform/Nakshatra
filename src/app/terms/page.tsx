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
      <PolicySection title="Your account and content">
        <p>You are responsible for keeping account access private and for the accuracy, permission, and legality of the information and files you add. Do not share sign-in links or upload information you are not authorized to use.</p>
      </PolicySection>

      <PolicySection title="Publishing and sharing">
        <p>You decide when to publish. Anyone who receives an active public link may open or forward it, so review the public preview and privacy mode before sharing. You can unpublish or replace the link from the dashboard.</p>
      </PolicySection>

      <PolicySection title="Acceptable use">
        <p>Do not use VivIntro for harassment, impersonation, fraud, unlawful discrimination, unauthorized surveillance, or distribution of illegal or harmful content. Do not attempt to bypass access controls or interfere with the service.</p>
      </PolicySection>

      <PolicySection title="Service availability">
        <p>Features may change as the product develops. We may limit access when needed for safety, maintenance, legal compliance, or misuse prevention. Where practical, material changes will be communicated clearly.</p>
      </PolicySection>

      <PolicySection title="Operator and governing terms">
        <p>{legalEntity ? `VivIntro is operated by ${legalEntity}.` : "The legal operator name will be added here when the pilot entity is formally confirmed."} {registeredAddress ? `Registered address: ${registeredAddress}.` : "A registered address has not yet been published."} {governingLaw ? `These terms are governed by the laws of ${governingLaw}.` : "The governing-law and jurisdiction clause will be published before general availability."}</p>
      </PolicySection>

      <PolicySection title="Questions">
        <p>For questions about these terms, contact <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href="mailto:hello@vivintro.com">hello@vivintro.com</a>.</p>
      </PolicySection>

      <p className="text-sm text-[color:var(--workspace-ink-muted)]">Last updated: September 21, 2026.</p>
    </PolicyLayout>
  );
}
