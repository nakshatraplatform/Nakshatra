import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";

export const metadata: Metadata = { title: "Trust and safety", description: "How VivIntro handles identity checks, sharing, consent, and protected access.", alternates: { canonical: "/trust" } };

export default function TrustPage() {
  return <PolicyLayout eyebrow="Trust and safety" title="What VivIntro protects—and what no shared link can promise." summary="Trust starts with accurate boundaries. VivIntro controls disclosure inside the product; it cannot control conversations or screenshots outside it.">
    <PolicySection title="Live photo check">
      <p>Standard creator publication requires Didit to match a live camera capture to the current primary portfolio photo and check liveness. A limited pilot test exemption can allow publication without that check; exempt introductions do not receive the Live photo checked badge.</p>
      <p>This is not a legal-ID check, a check of profile statements, or an endorsement of a match. VivIntro records consent and result, not the live camera capture.</p>
    </PolicySection>
    <PolicySection title="Sharing boundary"><p>Anyone who receives or is forwarded a link can open its public introduction. There is no public directory, and introduction pages are marked not to appear in search results. Sensitive contact details and protected documents require owner approval.</p></PolicySection>
    <PolicySection title="Access and control"><p>Owners can unpublish or rotate a public link at any time. Approved access to protected details lasts up to 15 days and can be ended earlier. Owners can approve or set aside each request privately.</p></PolicySection>
    <PolicySection title="Service providers"><p>VivIntro uses service providers for hosting, authentication, database and storage, identity checks, and transactional email. See the Privacy Policy for the current list and contact hello@vivintro.com with a privacy or grievance request.</p></PolicySection>
  </PolicyLayout>;
}
