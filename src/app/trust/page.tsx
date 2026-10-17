import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PolicyLayout } from "@/components/legal/PolicyLayout";
import type { ReactNode } from "react";
import styles from "./TrustPage.module.css";

export const metadata: Metadata = { title: "Trust", description: "What VivIntro’s liveness check and personal sharing controls establish—and their limits.", alternates: { canonical: "/trust" } };

export default function TrustPage() {
  return <PolicyLayout eyebrow="Trust and safety" title="What VivIntro can and cannot protect." summary="VivIntro limits access to private details. It cannot stop someone from saving information they can already see.">
    <div className={styles.list}><TrustDisclosure title="Liveness checks" defaultOpen>
      <p>Standard creator publication requires Didit liveness checks. These checks do not establish identity or photo ownership. A limited pilot test exemption can allow publication without that check; exempt introductions do not receive the Liveness checked badge.</p>
      <p>This is not a legal-ID check, a check of profile statements, or an endorsement of a match. VivIntro records consent and result, not the live camera capture.</p>
    </TrustDisclosure>
    <TrustDisclosure title="Sharing boundary"><p>Anyone who receives or is forwarded a personal link can open its public introduction. There is no public directory, and Introduction pages are marked not to appear in search results. Contact details and private documents require the person’s choice to share on a personal link. People can save or photograph information they can see, including details when shared. Ending access cannot erase those copies.</p></TrustDisclosure>
    <TrustDisclosure title="Sharing and control"><p>You can unpublish or replace your personal public link at any time. Private details are shared for up to 15 days, and you can stop sharing earlier. You can share details or quietly set an interest aside.</p><p>Unpublishing pauses viewing. If you publish again, sharing periods that have not ended or been stopped can resume. Stopping sharing or replacing the link ends that sharing; replacing the link also stops the old URL from working. You can share details for another 15 days.</p></TrustDisclosure>
    <TrustDisclosure title="Service providers"><p>VivIntro uses service providers for hosting, authentication, database and storage, identity checks, and transactional email. See the Privacy Policy for the current list and contact hello@vivintro.com with a privacy or grievance request.</p></TrustDisclosure></div>
  </PolicyLayout>;
}

function TrustDisclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className={styles.item} open={defaultOpen ? true : undefined}><summary><h2>{title}</h2><ChevronDown aria-hidden="true" /></summary><div className={styles.answer}>{children}</div></details>;
}
