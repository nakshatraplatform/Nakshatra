import Link from "next/link";
import { redirect } from "next/navigation";
import { BiodataTemplate } from "@/components/templates";
import { resolveFamilyIntroduction } from "@/features/family-viewers/server/family-introduction.service";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { getApiUser } from "@/lib/auth";
import styles from "../../family.module.css";

export const metadata = {
  title: "Family introduction · VivIntro",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function FamilyIntroductionPage({ params }: { params: Promise<{ introductionRef: string }> }) {
  const ref = brokerIntroductionRouteRefSchema.safeParse((await params).introductionRef);
  const auth = await getApiUser();
  if (ref.success && auth.status !== "authenticated" && auth.status !== "service_unavailable") {
    redirect(`/login?redirect=${encodeURIComponent(`/family/introductions/${ref.data}`)}`);
  }
  const portfolio = ref.success && auth.status === "authenticated"
    ? await resolveFamilyIntroduction(auth.supabase, ref.data).catch(() => null)
    : null;

  if (!portfolio?.available) return <main className={styles.main}>
    <h1>This introduction is unavailable</h1>
    <p>Ask the candidate you support to check your access.</p>
    <Link href="/family" prefetch={false}>Back to family introductions</Link>
  </main>;

  const horoscope = portfolio.horoscope;
  return <>
    <aside className={styles.main}>
      <Link href="/family" prefetch={false}>Back to family introductions</Link>
      <h1>{portfolio.disclosureLevel === "complete" ? "Complete Portfolio" : "Broker Standard Profile"}</h1>
      <p>Private family view. Access ends <time dateTime={portfolio.expiresAt}>{new Date(portfolio.expiresAt).toISOString().slice(0, 10)}</time>.</p>
    </aside>
    <BiodataTemplate templateId={portfolio.templateId} data={portfolio.data} sunSign={portfolio.sunSign}
      accessMode="approved" accessExpiresAt={portfolio.expiresAt}
      photos={portfolio.media.map(item => ({
        id: item.key, src: item.accessPath, alt: item.altText || "Portfolio photo", mediaType: item.mediaType,
        width: item.width, height: item.height, aspectRatio: item.aspectRatio,
        orientation: item.orientation || "unknown", presentation: item.presentation,
      }))}
      horoscopeAttachment={horoscope ? {
        href: horoscope.accessPath, formatLabel: horoscope.fileExtension.toUpperCase(),
        languageLabel: horoscope.languageLabel, pageCount: horoscope.pageCount,
      } : undefined}
    />
  </>;
}
