import { BrokerDeskHeader } from "@/components/brokerdesk/BrokerDeskHeader";
import Link from "next/link";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { resolveBrokerdeskDashboard } from "@/features/broker-introductions/server/broker-introduction.service";
import { getAuthenticatedUser } from "@/lib/auth";
import { BrokerdeskDashboardClient } from "./brokerdesk-dashboard-client";
import styles from "./brokerdesk-dashboard.module.css";

export const metadata = { title: "Workspace · VivIntro BrokerDesk", robots: { index: false, follow: false } };

export default async function BrokerdeskDashboardPage({ params }: {
  params: Promise<{ workspaceRef: string }>;
}) {
  const { workspaceRef } = await params;
  const { supabase } = await getAuthenticatedUser();
  const dashboard = await resolveBrokerdeskDashboard(supabase, workspaceRef);

  if (!dashboard.available) return <main className={styles.unavailable}>
    <ThemeSwitch />
    <h1>Workspace unavailable</h1>
    <p>Your membership, assignment, or pilot entitlement may no longer be active.</p>
    <Link href="/brokerdesk">Return to BrokerDesk</Link>
  </main>;

  return <div className={styles.shell}>
    <BrokerDeskHeader sticky>
      <Link href={`/brokerdesk/w/${workspaceRef}/customers`}>Customers</Link>
      <Link href={`/brokerdesk/w/${workspaceRef}/settings/team`}>Team</Link>
    </BrokerDeskHeader>
    <BrokerdeskDashboardClient dashboard={dashboard} />
  </div>;
}
