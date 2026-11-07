import Link from "next/link";
import { redirect } from "next/navigation";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { DataLoadError } from "@/components/loading/DataLoadError";
import { familyDashboardQuerySchema, type FamilyDashboard } from "@/features/family-viewers/server/family-dashboard.contract";
import { resolveFamilyDashboard } from "@/features/family-viewers/server/family-dashboard.service";
import { getApiUser } from "@/lib/auth";
import styles from "./family.module.css";

export const metadata = {
  title: "Family introductions · VivIntro",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

const statusLabels = {
  active: "Awaiting responses",
  awaiting: "Awaiting the other response",
  mutual: "Both interested",
  expired: "Response period ended",
  closed: "Closed",
} as const;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function FamilyIntroductionList({ data }: { data: FamilyDashboard }) {
  if (!data.available) {
    return <section className={styles.empty}>
      <h2>Family access is unavailable</h2>
      <p>Ask the candidate to check your family invitation and broker relationship.</p>
    </section>;
  }
  if (data.introductions.length === 0) {
    return <section className={styles.empty}>
      <h2>No introductions to show yet</h2>
      <p>Eligible introductions will appear here when the broker shares them.</p>
    </section>;
  }
  const cursor = data.nextCursor;
  const nextHref = cursor ? "/family?" + new URLSearchParams({
    beforeCreatedAt: cursor.createdAt,
    beforeRef: cursor.introductionRef,
  }).toString() : null;
  return <>
    <ul className={styles.list} aria-label="Family introductions">
      {data.introductions.map(item => <li className={styles.card} key={item.introductionRef}>
        <div className={styles.cardHeading}>
          <h2>Introduction {item.introductionRef.slice(-6)}</h2>
          <span className={styles.status}>{statusLabels[item.status]}</span>
        </div>
        <p>Supporting {item.candidateNames.join(" and ")}</p>
        <dl className={styles.dates}>
          <div><dt>Created on</dt><dd><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></dd></div>
          <div><dt>Response period ends</dt><dd><time dateTime={item.responseDueAt}>{dateLabel(item.responseDueAt)}</time></dd></div>
        </dl>
      </li>)}
    </ul>
    {nextHref && <Link href={nextHref} prefetch={false} className={styles.next}>Older introductions</Link>}
  </>;
}

export default async function FamilyDashboardPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getApiUser();
  if (auth.status !== "authenticated" && auth.status !== "service_unavailable") {
    redirect("/login?redirect=%2Ffamily");
  }
  const input = familyDashboardQuerySchema.safeParse(await searchParams);
  const data = auth.status === "authenticated" && input.success
    ? await resolveFamilyDashboard(auth.supabase, input.data).catch(() => null)
    : null;
  return <div className={styles.shell}>
    <header className={styles.header}>
      <VivIntroBrand href="/family" variant="horizontal" />
      <nav aria-label="Family navigation"><Link href="/family" prefetch={false}>Family introductions</Link><Link href="/account">Account</Link><ThemeSwitch /></nav>
    </header>
    <main id="main-content" tabIndex={-1} className={styles.main}>
      <p className={styles.eyebrow}>Family support</p>
      <h1>Your family introductions</h1>
      <p className={styles.lead}>Follow the introductions for the family members who invited you. The candidate decides whether to show interest or decline.</p>
      <p className={styles.note}>This dashboard shows introduction progress. Portfolio viewing will be available in a later update.</p>
      {!input.success
        ? <section className={styles.empty}><h2>This page link is incomplete</h2><Link href="/family">Return to the first page</Link></section>
        : data ? <FamilyIntroductionList data={data} />
          : <DataLoadError title="We could not load family introductions." />}
    </main>
  </div>;
}
