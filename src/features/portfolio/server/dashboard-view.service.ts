import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.generated";
import {
  normalizePortfolioPrivacyMode,
  portfolioDataSchema,
  portfolioDraftSchema,
  type Portfolio,
  type PortfolioHoroscope,
  type PortfolioMedia,
} from "@/types/portfolio";
import { getPortfolioAccessSummary } from "@/features/access/server/access.service";
import { HoroscopeRepository } from "@/features/horoscope/server/horoscope.repository";
import { InterestRepository } from "@/features/interest/server/interest.repository";
import { dashboardInterestsSchema } from "@/features/interest/server/interest-dashboard.contract";
import { PortfolioMediaRepository } from "@/features/media/server/media.repository";
import { createOwnerPortfolioMediaPreviewUrls } from "@/features/media/server/photo-url.service";
import { DashboardRepository } from "./dashboard.repository";
import { canCreatePortfolio } from "@/features/auth/server/portfolio-bootstrap";
import { loadPilotAccessState } from "@/features/pilot-access/server/pilot-access.service";
import { getPublicationReadiness } from "./publication-readiness.service";
import { dashboardReviewSnapshotSchema } from "./dashboard-review.contract";
import { listOwnerBrokerIntroductionResponses, listReceivedBrokerIntroductions } from "@/features/broker-introductions/server/broker-introduction.service";

type PortfolioRow = Database["public"]["Tables"]["portfolios"]["Row"];

function jsonObject(value: Json): Record<string, Json | undefined> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/** Validates persisted JSON before returning the owner dashboard projection. */
export function mapDashboardPortfolio(row: PortfolioRow | null): Portfolio | null {
  if (!row) return null;
  const draft = portfolioDraftSchema.safeParse(row.draft_data);
  const published = portfolioDataSchema.safeParse(row.published_data);
  return {
    ...row,
    draft_data: draft.success ? draft.data : { personal: {} },
    published_data: published.success ? published.data : null,
    privacy_mode: normalizePortfolioPrivacyMode(row.privacy_mode),
    visibility_settings: jsonObject(row.visibility_settings) ?? {},
  };
}

/** Loads and validates every owner dashboard read through feature repositories. */
export async function loadDashboardView({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const dashboardRepository = new DashboardRepository(supabase);
  const [snapshotResult, creatorEntitled, pilotAccessState] = await Promise.all([
    dashboardRepository.findDashboardReviewSnapshot(),
    canCreatePortfolio(supabase),
    loadPilotAccessState(supabase).catch(() => null),
  ]);
  const parsedSnapshot = dashboardReviewSnapshotSchema.safeParse(snapshotResult.data);
  // Only a missing additive RPC permits legacy reads. Other failures must not
  // turn invalid/foreign-owner/session-denied responses into trusted evidence.
  const legacyDatabase = snapshotResult.error?.code === "PGRST202";
  if (!legacyDatabase && (snapshotResult.error || !parsedSnapshot.success
    || (parsedSnapshot.data.portfolio && parsedSnapshot.data.portfolio.user_id !== userId))) {
    throw new Error("We could not load your saved portfolio safely. Please try again.");
  }
  const snapshot = !snapshotResult.error && parsedSnapshot.success ? parsedSnapshot.data : null;
  const portfolioRow = snapshot ? snapshot.portfolio
    : (await dashboardRepository.findDashboardPortfolioForUser(userId)).data;
  const portfolio = mapDashboardPortfolio(portfolioRow as PortfolioRow | null);
  const publicationReadiness = snapshot?.readiness ?? {
    ...await getPublicationReadiness(supabase),
    reviewFingerprint: null,
    publicPreviewReviewed: false,
    completePreviewReviewed: false,
    disclosureConfirmed: false,
  };

  if (!portfolio) {
    return {
      portfolio: null,
      canCreatePortfolio: creatorEntitled,
      pilotAccessState,
      viewCount: 0,
      media: [] as PortfolioMedia[],
      mediaUrls: {} as Record<string, string>,
      horoscope: null as PortfolioHoroscope | null,
      interests: [],
      accessSummary: { grants: [], events: [] },
      publicationReadiness,
      brokerIntroductionResponses: [],
      receivedBrokerIntroductions: [],
    };
  }

  const mediaRepository = new PortfolioMediaRepository(supabase);
  const horoscopeRepository = new HoroscopeRepository(supabase);
  const interestRepository = new InterestRepository(supabase);
  const [views, mediaResult, horoscopeResult, interestsResult, accessSummary, brokerIntroductionResponses, receivedBrokerIntroductions] = await Promise.all([
    dashboardRepository.countPortfolioViews(portfolio.id),
    snapshot ? Promise.resolve({ data: snapshot.media }) : mediaRepository.findPortfolioPhotos(portfolio.id),
    snapshot ? Promise.resolve({ data: snapshot.horoscope }) : horoscopeRepository.findByPortfolio(portfolio.id),
    interestRepository.listForPortfolio(portfolio.id),
    getPortfolioAccessSummary(supabase),
    listOwnerBrokerIntroductionResponses(supabase).catch(() => []),
    listReceivedBrokerIntroductions(supabase).catch(() => []),
  ]);
  const media = (mediaResult.data ?? []) as PortfolioMedia[];
  const mediaUrls = await createOwnerPortfolioMediaPreviewUrls({ supabase, media });
  const parsedInterests = dashboardInterestsSchema.safeParse(interestsResult.data ?? []);
  const interests = parsedInterests.success ? parsedInterests.data : [];

  return {
    portfolio,
    canCreatePortfolio: creatorEntitled,
    pilotAccessState,
    viewCount: views.count ?? 0,
    media,
    mediaUrls,
    horoscope: (horoscopeResult.data as PortfolioHoroscope | null) ?? null,
    interests,
    accessSummary,
    publicationReadiness,
    brokerIntroductionResponses,
    receivedBrokerIntroductions,
  };
}
