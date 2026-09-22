import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import Link from "next/link";
import { Building2, LockKeyhole } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { resolveCustomerBrokerRelationships } from "@/features/broker-relationships/server/customer-invitation.service";
import styles from "./brokers.module.css";
import { CustomerBrokerCard } from "./customer-broker-card";

export const metadata = { title: "My brokers · VivIntro", robots: { index: false, follow: false } };

export default async function CustomerBrokersPage() {
  const { supabase } = await getAuthenticatedUser();
  const result = await resolveCustomerBrokerRelationships(supabase);
  return <div className={styles.shell}>
    <header><VivIntroBrand href="/dashboard" variant="horizontal" /><span>Your private broker relationships</span><Link href="/dashboard">Dashboard</Link><ThemeSwitch /></header>
    <main>
      <p className={styles.eyebrow}>Privacy controls</p>
      <h1>My brokers</h1>
      <p className={styles.lead}>You can work with more than one broker. Each broker sees only its own relationship and never learns which other brokers you use.</p>
      <section className={styles.list}>
        {result.relationships.length === 0 && <div className={styles.empty}><Building2 /><h2>No broker relationships yet</h2><p>A broker appears here only after you accept their private invitation.</p></div>}
        {result.relationships.map((relationship) => <CustomerBrokerCard key={relationship.relationshipRef} relationship={relationship} />)}
      </section>
      <p className={styles.privacy}><LockKeyhole /> Only you can see this complete list.</p>
    </main>
  </div>;
}

