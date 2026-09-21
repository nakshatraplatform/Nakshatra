import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";

export const metadata: Metadata = { title: "Trust and safety", description: "How VivIntro handles identity checks, sharing, consent, and protected access.", alternates: { canonical: "/trust" } };

export default function TrustPage() {
  return <PolicyLayout eyebrow="Trust and safety" title="What VivIntro protects—and what no shared link can promise." summary="Trust starts with accurate boundaries. VivIntro controls disclosure inside the product; it cannot control conversations or screenshots outside it.">
    <PolicySection title="Identity check"><p>A creator completes a hosted identity check before publishing. VivIntro records consent and verification status, but does not copy identity-document images or numbers into the product. A badge is not a guarantee that every introduction statement is accurate.</p></PolicySection>
    <PolicySection title="Sharing boundary"><p>Anyone who receives or is forwarded a link can open its public introduction. There is no public directory, and introduction pages are marked not to appear in search results. Sensitive contact details and protected documents require owner approval.</p></PolicySection>
    <PolicySection title="Access and control"><p>Public introductions remain active until their owner unpublishes them. Approved access to protected details lasts 15 days and can be ended earlier. Owners can approve or set aside each request privately.</p></PolicySection>
    <PolicySection title="Service providers"><p>VivIntro uses service providers for hosting, authentication, database and storage, identity checks, and transactional email. See the Privacy Policy for the current list and contact hello@vivintro.com with a privacy or grievance request.</p></PolicySection>
  </PolicyLayout>;
}
