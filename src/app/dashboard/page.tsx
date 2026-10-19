import { loadAccountHeaderProfile } from "@/features/account/server/account-header-profile";
import { headers } from "next/headers";
import { getAuthenticatedUser } from "@/lib/auth";
import type { Metadata } from "next";
import DashboardClient from "./dashboard-client";
import { loadDashboardView } from "@/features/portfolio/server/dashboard-view.service";
import { isProfileFullyComplete } from "@/features/portfolio/readiness";
import { isShareablePrimaryPhoto } from "@/features/media/portfolio-photo";
import { resolvePublicPortfolio } from "@/features/portfolio/server/public-portfolio.service";
import { buildWhatsAppShareMessage } from "@/features/portfolio/whatsapp-share";
import { CustomerAppFrame } from "@/components/navigation/CustomerAppFrame";
import { DataLoadError } from "@/components/loading/DataLoadError";

export async function generateMetadata({ searchParams }: {
  searchParams: Promise<{ edit?: string | string[] }>;
}): Promise<Metadata> {
  const query = await searchParams;
  return { title: query.edit === "1" ? "Edit introduction" : "Dashboard" };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const query = await searchParams;
  const session = await getAuthenticatedUser();
  return <CustomerAppFrame currentPage="dashboard" userEmail={session.user.email} accountProfile={loadAccountHeaderProfile(session)}
    className="dashboard-shell flex flex-1 flex-col" loadingTitle="Getting your portfolio and requests ready">
    <DashboardContent session={session} initialEditorOpen={query.edit === "1"} />
  </CustomerAppFrame>;
}

async function DashboardContent({ session: { supabase, user }, initialEditorOpen }: {
  session: Awaited<ReturnType<typeof getAuthenticatedUser>>;
  initialEditorOpen: boolean;
}) {
  const dashboard = await loadDashboardView({ supabase, userId: user.id }).catch(() => null);
  if (!dashboard) return <main id="main-content" tabIndex={-1}><DataLoadError title="We could not load your dashboard." /></main>;
  const { portfolio } = dashboard;
  // One request clock keeps expiry labels identical during server rendering and hydration.
  // eslint-disable-next-line react-hooks/purity -- evaluated once per server request
  const renderedAt = Date.now();

  let shareUrl: string | null = null;
  if (portfolio?.is_published && portfolio.share_token
    && isProfileFullyComplete(portfolio.published_data, dashboard.media.some(isShareablePrimaryPhoto))) {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    shareUrl = `${proto}://${host}/p/${portfolio.share_token}`;
  }

  let isExpired = false;
  // Use the same public-only projection as a recipient, not draft or owner-only data.
  const publicIntroduction = shareUrl && portfolio?.share_token
    ? await resolvePublicPortfolio(supabase, portfolio.share_token) : null;
  const whatsappMessage = shareUrl ? buildWhatsAppShareMessage(shareUrl, publicIntroduction?.data) : null;
  let daysLeft: number | null = null;
  if (portfolio?.expires_at) {
    const expiresAt = new Date(portfolio.expires_at).getTime();
    isExpired = expiresAt < renderedAt;
    daysLeft = Math.max(0, Math.ceil((expiresAt - renderedAt) / 86_400_000));
  }

  const dashboardRevision = [
    portfolio?.updated_at ?? "new",
    // Verification refreshes update props, not portfolio content. Remounting
    // here would discard edits still waiting for autosave after Didit returns.
    String(dashboard.publicationReadiness?.paymentActive ?? false),
    dashboard.publicationReadiness?.reviewFingerprint ?? "unversioned",
    dashboard.interests[0]?.id ?? "no-interest",
    dashboard.accessSummary.events[0]?.id ?? "no-access-event",
    dashboard.receivedBrokerIntroductions?.[0]?.introductionRef ?? "no-broker-introduction",
  ].join(":");

  return (
    <DashboardClient
      renderedAt={renderedAt}
      key={dashboardRevision}
      portfolio={portfolio}
      canCreatePortfolio={dashboard.canCreatePortfolio}
      pilotAccessState={dashboard.pilotAccessState}
      viewCount={dashboard.viewCount}
      userEmail={user.email ?? ""}
      shareUrl={shareUrl}
      whatsappMessage={whatsappMessage}
      isExpired={isExpired}
      daysLeft={daysLeft}
      media={dashboard.media}
      mediaUrls={dashboard.mediaUrls}
      horoscope={dashboard.horoscope}
      initialEditorOpen={initialEditorOpen}
      interests={dashboard.interests}
      accessSummary={dashboard.accessSummary}
      publicationReadiness={dashboard.publicationReadiness}
      brokerIntroductionResponses={dashboard.brokerIntroductionResponses}
      receivedBrokerIntroductions={dashboard.receivedBrokerIntroductions ?? []}
    />
  );
}
