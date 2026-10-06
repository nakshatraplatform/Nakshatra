import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PolicyLayout } from "@/components/legal/PolicyLayout";
import type { ReactNode } from "react";
import styles from "./TrustPage.module.css";

export const metadata: Metadata = { title: "Trust and safety", description: "How VivIntro handles identity checks, sharing, consent, and protected access.", alternates: { canonical: "/trust" } };

export default function TrustPage() {
  return <PolicyLayout eyebrow="Trust and safety" title="What VivIntro protects—and what no shared link can promise." summary="Trust starts with accurate boundaries. VivIntro controls disclosure inside the product; it cannot control conversations or screenshots outside it.">
    <div className={styles.list}><TrustDisclosure title="Liveness checks" defaultOpen>
      <p>Standard creator publication requires Didit liveness checks. These checks do not establish identity or photo ownership. A limited pilot test exemption can allow publication without that check; exempt introductions do not receive the Liveness checked badge.</p>
      <p>This is not a legal-ID check, a check of profile statements, or an endorsement of a match. VivIntro records consent and result, not the live camera capture.</p>
    </TrustDisclosure>
    <TrustDisclosure title="Sharing boundary"><p>Anyone who receives or is forwarded a personal link can open its public Introduction. There is no public directory, and Introduction pages are marked not to appear in search results. Contact details and protected documents require the owner’s approval on a personal link.</p></TrustDisclosure>
    <TrustDisclosure title="Access and control"><p>Owners can unpublish or rotate a personal public link at any time. Approved access to protected details lasts up to 15 days and can be ended earlier. Owners can approve or set aside each personal-link request privately.</p></TrustDisclosure>
    <TrustDisclosure title="Service providers"><p>VivIntro uses service providers for hosting, authentication, database and storage, identity checks, and transactional email. See the Privacy Policy for the current list and contact hello@vivintro.com with a privacy or grievance request.</p></TrustDisclosure></div>
  </PolicyLayout>;
}

function TrustDisclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className={styles.item} open={defaultOpen ? true : undefined}><summary><h2>{title}</h2><ChevronDown aria-hidden="true" /></summary><div className={styles.answer}>{children}</div></details>;
}
