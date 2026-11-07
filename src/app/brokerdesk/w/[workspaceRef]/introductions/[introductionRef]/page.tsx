import Link from "next/link";
import { redirect } from "next/navigation";
import { BrokerDeskHeader } from "@/components/brokerdesk/BrokerDeskHeader";
import { DataLoadError } from "@/components/loading/DataLoadError";
import { introductionWorkspacePathSchema } from "@/features/broker-introductions/server/introduction-workspace.contract";
import { resolveIntroductionAction } from "@/features/broker-introductions/server/introduction-workspace.service";
import { getApiUser } from "@/lib/auth";
import { IntroductionActionWorkspace } from "./introduction-action-workspace";
import styles from "../introductions.module.css";

export const metadata = { title: "Introduction actions · VivIntroDesk", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function IntroductionActionPage({ params }: {
  params: Promise<{ workspaceRef: string; introductionRef: string }>;
}) {
  const path = introductionWorkspacePathSchema.safeParse(await params);
  if (!path.success) return <main><h1>Introduction unavailable</h1><Link href="/brokerdesk">Return to BrokerDesk</Link></main>;
  const { workspaceRef, introductionRef } = path.data;
  const base = `/brokerdesk/w/${workspaceRef}`;
  const auth = await getApiUser();
  if (auth.status !== "authenticated" && auth.status !== "service_unavailable") redirect(`/login?redirect=${encodeURIComponent(`${base}/introductions/${introductionRef}`)}`);
  const data = auth.status === "authenticated"
    ? await resolveIntroductionAction(auth.supabase, path.data).catch(() => null) : null;
  return <div className={styles.shell}>
    <BrokerDeskHeader homeHref={`${base}/dashboard`}><Link href={`${base}/dashboard`}>Dashboard</Link><Link href={`${base}/introductions`}>Introductions</Link><Link href={`${base}/customers`}>Customers</Link></BrokerDeskHeader>
    <main id="main-content" tabIndex={-1} className={styles.main}>
      <p className={styles.eyebrow}>Introduction actions</p>
      {!data ? <DataLoadError title="We could not load this Introduction." />
        : !data.available ? <section className={styles.card}><h1>Introduction unavailable</h1><p>Your access or the customer mandates may have changed.</p></section>
          : <IntroductionActionWorkspace workspaceRef={workspaceRef} initial={data} />}
    </main>
  </div>;
}
