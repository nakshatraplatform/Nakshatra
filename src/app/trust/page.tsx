import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PolicyLayout } from "@/components/legal/PolicyLayout";
import type { ReactNode } from "react";
import styles from "./TrustPage.module.css";
import { MarketingBreadcrumb } from "@/components/marketing/StructuredData";

export const metadata: Metadata = { title: "Trust", description: "What VivIntro’s liveness check and personal sharing controls establish—and their limits.", alternates: { canonical: "/trust" } };

export default function TrustPage() {
  return <PolicyLayout eyebrow="Trust and safety" title="What VivIntro can and cannot protect." summary="VivIntro limits access to private details. It cannot stop someone from saving information they can already see.">
    <MarketingBreadcrumb name="Trust" path="/trust" />
    <div className={styles.list}><TrustDisclosure title="Liveness checks" defaultOpen>
      <p>Standard creator publication requires Didit liveness checks. These checks do not establish identity or photo ownership. A limited pilot test exemption can allow publication without that check; exempt introductions do not receive the Liveness checked badge.</p>
      <p>This is not a legal-ID check, a check of profile statements, or an endorsement of a match. VivIntro records consent and result, not the live camera capture.</p>
    </TrustDisclosure>
    <TrustDisclosure title="Sharing boundary"><p>Anyone who receives or is forwarded a personal link can open its public introduction. There is no public directory, and Introduction pages are marked not to appear in search results. Contact details and private documents require the person’s choice to share on a personal link. People can save or photograph information they can see, including details when shared. Ending access cannot erase those copies.</p></TrustDisclosure>
    <TrustDisclosure title="Sharing and control"><p>You can unpublish or replace your personal public link at any time. After a new Show interest request, you may email your chosen published contacts or quietly set the request aside. That email cannot be recalled after delivery.</p><p>Existing private access grants from the earlier flow continue only until their scheduled expiry, unless you revoke them sooner. Unpublishing pauses their viewing; replacing the link revokes those grants and stops the old URL from working. Copies already saved cannot be erased.</p></TrustDisclosure>
    <TrustDisclosure title="Service providers"><p>VivIntro uses service providers for hosting, authentication, database and storage, identity checks, and transactional email. See the Privacy Policy for the current list and contact hello@vivintro.com with a privacy or grievance request.</p></TrustDisclosure></div>
  </PolicyLayout>;
}

function TrustDisclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className={styles.item} open={defaultOpen ? true : undefined}><summary><h2>{title}</h2><ChevronDown aria-hidden="true" /></summary><div className={styles.answer}>{children}</div></details>;
}
