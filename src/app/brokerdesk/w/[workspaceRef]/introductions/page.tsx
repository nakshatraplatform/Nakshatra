import Link from "next/link";
import { redirect } from "next/navigation";
import { BrokerDeskHeader } from "@/components/brokerdesk/BrokerDeskHeader";
import { DataLoadError } from "@/components/loading/DataLoadError";
import { introductionWorkspaceQuerySchema } from "@/features/broker-introductions/server/introduction-workspace.contract";
import { resolveIntroductionWorkspaceList } from "@/features/broker-introductions/server/introduction-workspace.service";
import { workspaceRefSchema } from "@/features/security/public-reference";
import { getApiUser } from "@/lib/auth";
import styles from "./introductions.module.css";

export const metadata = { title: "Introductions · VivIntroDesk", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function IntroductionWorkspaceListPage({ params, searchParams }: {
  params: Promise<{ workspaceRef: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workspace = workspaceRefSchema.safeParse((await params).workspaceRef);
  if (!workspace.success) return <main><h1>Workspace unavailable</h1><Link href="/brokerdesk">Return to BrokerDesk</Link></main>;
  const base = `/brokerdesk/w/${workspace.data}`;
  const auth = await getApiUser();
  if (auth.status !== "authenticated" && auth.status !== "service_unavailable") redirect(`/login?redirect=${encodeURIComponent(`${base}/introductions`)}`);
  const query = introductionWorkspaceQuerySchema.safeParse(await searchParams);
  const data = auth.status === "authenticated" && query.success
    ? await resolveIntroductionWorkspaceList(auth.supabase, workspace.data, query.data).catch(() => null) : null;
  const cursor = data?.available ? data.nextCursor : null;
  return <div className={styles.shell}>
    <BrokerDeskHeader homeHref={`${base}/dashboard`}><Link href={`${base}/dashboard`}>Dashboard</Link><Link href={`${base}/customers`}>Customers</Link></BrokerDeskHeader>
    <main id="main-content" tabIndex={-1} className={styles.main}>
      <p className={styles.eyebrow}>Your workspace</p><h1>Introductions</h1>
      <p>Open an Introduction to share it with each family and follow their responses.</p>
      {!query.success ? <section className={styles.card}><h2>This page link is incomplete</h2><Link href={`${base}/introductions`}>Return to the first page</Link></section>
        : !data ? <DataLoadError title="We could not load Introductions." />
          : !data.available ? <section className={styles.card}><h2>Introductions are unavailable</h2><p>Your workspace, assignments or customer mandates may have changed.</p></section>
            : data.introductions.length === 0 ? <section className={styles.card}><h2>No Introductions to show</h2><p>Choose a ready customer to create an Introduction.</p><Link href={`${base}/customers`}>Open customers</Link></section>
              : <ul className={styles.list}>{data.introductions.map(item => <li className={styles.card} key={item.introductionRef}>
                <div className={styles.cardHeading}><h2>{item.sourceName} &amp; {item.recipientName}</h2><span className={styles.badge}>{item.status === "created" ? "Ready to share" : item.status === "shared" ? "Awaiting responses" : item.status === "responded" ? "Response received" : item.status === "revoked" ? "Closed" : "Response period ended"}</span></div>
                <p>Created {new Date(item.createdAt).toLocaleDateString("en", { timeZone: "UTC" })} · Respond by {new Date(item.expiresAt).toLocaleDateString("en", { timeZone: "UTC" })}</p>
                <Link className={styles.actionLink} href={`${base}/introductions/${item.introductionRef}`}>Open Introduction</Link>
              </li>)}</ul>}
      {cursor && <Link className={styles.actionLink} prefetch={false} href={`${base}/introductions?${new URLSearchParams({ beforeCreatedAt: cursor.createdAt, beforeRef: cursor.introductionRef })}`}>Older Introductions</Link>}
    </main>
  </div>;
}
