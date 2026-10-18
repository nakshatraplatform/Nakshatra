import { CustomerAppFrame } from "@/components/navigation/CustomerAppFrame";
import { Suspense } from "react";
import { LoadingStatus } from "@/components/loading/LoadingStatus";
import { DataLoadError } from "@/components/loading/DataLoadError";
import { Building2, LockKeyhole } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { resolveCustomerBrokerRelationships } from "@/features/broker-relationships/server/customer-invitation.service";
import styles from "./brokers.module.css";
import { CustomerBrokerCard } from "./customer-broker-card";

export const metadata = { title: "My brokers · VivIntro", robots: { index: false, follow: false } };

export default async function CustomerBrokersPage() {
  const { supabase, user } = await getAuthenticatedUser();
  return <CustomerAppFrame currentPage="brokers" userEmail={user.email} className={styles.shell} loadingTitle="Loading your broker relationships">
    <main id="main-content" tabIndex={-1}>
      <p className={styles.eyebrow}>Privacy controls</p>
      <h1>My brokers</h1>
      <p className={styles.lead}>You can work with more than one broker. Each broker sees only its own relationship and never learns which other brokers you use.</p>
      <Suspense fallback={<LoadingStatus title="Loading your broker relationships" state="connecting" />}>
        <BrokerRelationships supabase={supabase} />
      </Suspense>
      <p className={styles.privacy}><LockKeyhole /> Only you can see this complete list.</p>
    </main>
  </CustomerAppFrame>;
}

async function BrokerRelationships({ supabase }: { supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"] }) {
  const result = await resolveCustomerBrokerRelationships(supabase).catch(() => null);
  if (!result) return <DataLoadError title="We could not load your broker relationships." />;
  return <section className={styles.list}>
    {result.relationships.length === 0 && <div className={styles.empty}><Building2 /><h2>No broker relationships yet</h2><p>A broker appears here only after you accept their private invitation.</p></div>}
    {result.relationships.map((relationship) => <CustomerBrokerCard key={relationship.relationshipRef} relationship={relationship} />)}
  </section>;
}
