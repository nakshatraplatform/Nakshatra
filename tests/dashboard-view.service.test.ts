import { beforeEach, describe, expect, it, vi } from "vitest";

const repositories = vi.hoisted(() => ({
  dashboard: {
    findDashboardReviewSnapshot: vi.fn(),
    findDashboardPortfolioForUser: vi.fn(),
    countPortfolioViews: vi.fn(),
  },
  media: { findPortfolioPhotos: vi.fn() },
  horoscope: { findByPortfolio: vi.fn() },
  interest: { listForPortfolio: vi.fn() },
  access: vi.fn(),
  mediaUrls: vi.fn(),
}));
const canCreatePortfolio = vi.hoisted(() => vi.fn());
const loadPilotAccessState = vi.hoisted(() => vi.fn());
const getPublicationReadiness = vi.hoisted(() => vi.fn());

vi.mock("@/features/portfolio/server/dashboard.repository", () => ({
  DashboardRepository: class { constructor() { return repositories.dashboard; } },
}));
vi.mock("@/features/media/server/media.repository", () => ({
  PortfolioMediaRepository: class { constructor() { return repositories.media; } },
}));
vi.mock("@/features/horoscope/server/horoscope.repository", () => ({
  HoroscopeRepository: class { constructor() { return repositories.horoscope; } },
}));
vi.mock("@/features/interest/server/interest.repository", () => ({
  InterestRepository: class { constructor() { return repositories.interest; } },
}));
vi.mock("@/features/access/server/access.service", () => ({
  getPortfolioAccessSummary: repositories.access,
}));
vi.mock("@/features/media/server/photo-url.service", () => ({
  createOwnerPortfolioMediaPreviewUrls: repositories.mediaUrls,
}));
vi.mock("@/features/auth/server/portfolio-bootstrap", () => ({ canCreatePortfolio }));
vi.mock("@/features/pilot-access/server/pilot-access.service", () => ({ loadPilotAccessState }));
vi.mock("@/features/portfolio/server/publication-readiness.service", () => ({ getPublicationReadiness }));

import {
  loadDashboardView,
  mapDashboardPortfolio,
} from "@/features/portfolio/server/dashboard-view.service";

const row = {
  id: "portfolio-1",
  user_id: "owner-1",
  candidate_id: null,
  share_token: "share-token",
  draft_data: { personal: { name: "Aditi Rao", dob: "1996-08-12", gender: "female" } },
  published_data: null,
  template_id: 1,
  theme_color: null,
  sun_sign: null,
  is_published: false,
  published_at: null,
  expires_at: null,
  last_renewed_at: null,
  privacy_mode: "balanced",
  visibility_settings: { family: "approved" },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const projectedInterest = {
  id: "11111111-1111-4111-8111-111111111111",
  viewer_name: "Rohan Mehta",
  viewer_phone: "+1 555 010 2200",
  viewer_email: "rohan@example.com",
  viewer_family_context: null,
  message: null,
  status: "new",
  requester_user_id: "22222222-2222-4222-8222-222222222222",
  metadata: { city: "Boston" },
  created_at: "2026-08-09T12:00:00.000Z",
  email_verified: true,
  source_type: "direct",
  broker_name: null,
  broker_representative_name: null,
  requester_portfolio_token: null,
};

describe("dashboard view service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositories.dashboard.findDashboardReviewSnapshot.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    canCreatePortfolio.mockResolvedValue(true);
    loadPilotAccessState.mockResolvedValue({
      canCreatePortfolio: true,
      isPilotAdministrator: false,
      application: null,
    });
    getPublicationReadiness.mockResolvedValue({
      portfolioExists: true,
      lastEditorSection: "foundation",
      previewedAt: null,
      selectedPlanCode: null,
      verificationStatus: "required",
      paymentStatus: "none",
      paymentExpiresAt: null,
      paymentActive: false,
      disclosureConfirmed: false,
      published: false,
      missingRequired: [],
    });
    repositories.dashboard.findDashboardPortfolioForUser.mockResolvedValue({ data: row, error: null });
    repositories.dashboard.countPortfolioViews.mockResolvedValue({ count: 7, error: null });
    repositories.media.findPortfolioPhotos.mockResolvedValue({ data: [{ id: "media-1" }], error: null });
    repositories.horoscope.findByPortfolio.mockResolvedValue({ data: { id: "horoscope-1" }, error: null });
    repositories.interest.listForPortfolio.mockResolvedValue({
      data: [projectedInterest], error: null,
    });
    repositories.access.mockResolvedValue({ grants: [{ id: "grant-1" }], events: [] });
    repositories.mediaUrls.mockResolvedValue({ "media-1": "https://signed.test/media-1" });
  });

  it("returns an empty projection without issuing child reads for a new owner", async () => {
    repositories.dashboard.findDashboardPortfolioForUser.mockResolvedValue({ data: null, error: null });
    canCreatePortfolio.mockResolvedValue(false);
    loadPilotAccessState.mockResolvedValue({
      canCreatePortfolio: false,
      isPilotAdministrator: false,
      application: null,
    });
    getPublicationReadiness.mockResolvedValue({
      portfolioExists: false,
      lastEditorSection: null,
      previewedAt: null,
      selectedPlanCode: null,
      verificationStatus: "required",
      paymentStatus: "none",
      paymentExpiresAt: null,
      paymentActive: false,
      disclosureConfirmed: false,
      published: false,
      missingRequired: [],
    });

    await expect(loadDashboardView({ supabase: {} as never, userId: "owner-1" })).resolves.toEqual({
      portfolio: null,
      canCreatePortfolio: false,
      pilotAccessState: {
        canCreatePortfolio: false,
        isPilotAdministrator: false,
        application: null,
      },
      viewCount: 0,
      media: [],
      mediaUrls: {},
      horoscope: null,
      interests: [],
      brokerIntroductionResponses: [],
      receivedBrokerIntroductions: [],
      accessSummary: { grants: [], events: [] },
      publicationReadiness: {
        portfolioExists: false,
        lastEditorSection: null,
        previewedAt: null,
        reviewFingerprint: null,
        publicPreviewReviewed: false,
        completePreviewReviewed: false,
        selectedPlanCode: null,
        verificationStatus: "required",
        paymentStatus: "none",
        paymentExpiresAt: null,
        paymentActive: false,
        disclosureConfirmed: false,
        published: false,
        missingRequired: [],
      },
    });
    expect(repositories.media.findPortfolioPhotos).not.toHaveBeenCalled();
  });

  it("keeps the dashboard available when the optional pilot status read fails", async () => {
    repositories.dashboard.findDashboardPortfolioForUser.mockResolvedValue({ data: null, error: null });
    loadPilotAccessState.mockRejectedValue(new Error("pilot status unavailable"));

    await expect(loadDashboardView({ supabase: {} as never, userId: "owner-1" }))
      .resolves.toMatchObject({
        portfolio: null,
        canCreatePortfolio: true,
        pilotAccessState: null,
      });
  });

  it("loads and validates the complete dashboard projection", async () => {
    const result = await loadDashboardView({ supabase: {} as never, userId: "owner-1" });

    expect(result).toMatchObject({
      portfolio: { id: "portfolio-1", privacy_mode: "balanced" },
      canCreatePortfolio: true,
      viewCount: 7,
      mediaUrls: { "media-1": "https://signed.test/media-1" },
      horoscope: { id: "horoscope-1" },
      interests: [{ id: projectedInterest.id, metadata: { city: "Boston" } }],
    });
    expect(repositories.interest.listForPortfolio).toHaveBeenCalledWith("portfolio-1");
    expect(repositories.mediaUrls).toHaveBeenCalledWith(expect.objectContaining({ media: [{ id: "media-1" }] }));
  });

  it("normalizes nullable child results and valid published data", async () => {
    repositories.dashboard.findDashboardPortfolioForUser.mockResolvedValue({
      data: {
        ...row,
        published_data: row.draft_data,
      },
      error: null,
    });
    repositories.dashboard.countPortfolioViews.mockResolvedValue({ count: null, error: null });
    repositories.media.findPortfolioPhotos.mockResolvedValue({ data: null, error: null });
    repositories.horoscope.findByPortfolio.mockResolvedValue({ data: null, error: null });
    repositories.interest.listForPortfolio.mockResolvedValue({
      data: [{ ...projectedInterest, metadata: "legacy-value" }],
      error: null,
    });
    repositories.mediaUrls.mockResolvedValue({});

    await expect(loadDashboardView({ supabase: {} as never, userId: "owner-1" }))
      .resolves.toMatchObject({
        portfolio: { published_data: row.draft_data },
        viewCount: 0,
        media: [],
        mediaUrls: {},
        horoscope: null,
        interests: [{ id: projectedInterest.id, metadata: null }],
      });
    expect(repositories.mediaUrls).toHaveBeenCalledWith(expect.objectContaining({ media: [] }));
  });

  it("falls back safely for malformed persisted JSON and non-object metadata", () => {
    expect(mapDashboardPortfolio({
      ...row,
      draft_data: "invalid",
      published_data: "invalid",
      privacy_mode: "unknown",
      visibility_settings: [],
    } as never)).toMatchObject({
      draft_data: { personal: {} },
      published_data: null,
      privacy_mode: "balanced",
      visibility_settings: {},
    });
    expect(mapDashboardPortfolio(null)).toBeNull();
  });

  it("uses one authoritative snapshot rather than mixing earlier answers with a later review hash", async () => {
    const readiness = { ...await getPublicationReadiness(), reviewFingerprint: "a".repeat(64), publicPreviewReviewed: true, completePreviewReviewed: false };
    getPublicationReadiness.mockResolvedValue({ ...readiness, reviewFingerprint: "b".repeat(64) });
    repositories.dashboard.findDashboardReviewSnapshot.mockResolvedValue({ data: {
      portfolio: row, media: [], horoscope: null, readiness,
    }, error: null });
    getPublicationReadiness.mockClear();
    const result = await loadDashboardView({ supabase: {} as never, userId: "owner-1" });
    expect(result.portfolio?.draft_data).toEqual(row.draft_data);
    expect(result.publicationReadiness).toEqual(readiness);
    expect(repositories.dashboard.findDashboardPortfolioForUser).not.toHaveBeenCalled();
    expect(getPublicationReadiness).not.toHaveBeenCalled();
    expect(repositories.media.findPortfolioPhotos).not.toHaveBeenCalled();
    expect(repositories.horoscope.findByPortfolio).not.toHaveBeenCalled();
  });

  it("keeps legacy editing available but never adopts separately loaded review evidence", async () => {
    getPublicationReadiness.mockResolvedValue({ ...await getPublicationReadiness(), reviewFingerprint: "b".repeat(64), publicPreviewReviewed: true, completePreviewReviewed: true, disclosureConfirmed: true });
    const result = await loadDashboardView({ supabase: {} as never, userId: "owner-1" });
    expect(result.portfolio?.id).toBe(row.id);
    expect(result.publicationReadiness).toMatchObject({ reviewFingerprint: null, publicPreviewReviewed: false, completePreviewReviewed: false, disclosureConfirmed: false });
  });

  it.each([
    { data: {}, error: null },
    { data: null, error: { code: "42501" } },
    { data: { portfolio: { ...row, user_id: "other-owner" }, media: [], horoscope: null, readiness: { portfolioExists: true, lastEditorSection: null, previewedAt: null, reviewFingerprint: "a".repeat(64), selectedPlanCode: null, verificationStatus: "required", paymentStatus: "none", paymentExpiresAt: null, disclosureConfirmed: false, published: false, missingRequired: [] } }, error: null },
  ])("rejects malformed, denied or foreign-owner snapshot responses without legacy fallback", async (result) => {
    repositories.dashboard.findDashboardReviewSnapshot.mockResolvedValue(result);
    await expect(loadDashboardView({ supabase: {} as never, userId: "owner-1" })).rejects.toThrow(/safely/);
    expect(repositories.dashboard.findDashboardPortfolioForUser).not.toHaveBeenCalled();
    expect(getPublicationReadiness).not.toHaveBeenCalled();
  });

  it("returns an atomic empty-owner snapshot without separately fetching readiness", async () => {
    const readiness = { ...await getPublicationReadiness(), portfolioExists: false, reviewFingerprint: null };
    repositories.dashboard.findDashboardReviewSnapshot.mockResolvedValue({ data: { portfolio: null, media: [], horoscope: null, readiness }, error: null });
    getPublicationReadiness.mockClear();
    expect((await loadDashboardView({ supabase: {} as never, userId: "owner-1" })).portfolio).toBeNull();
    expect(getPublicationReadiness).not.toHaveBeenCalled();
    expect(repositories.dashboard.findDashboardPortfolioForUser).not.toHaveBeenCalled();
  });

  it("loads bound attachments but rejects attachments belonging to another portfolio", async () => {
    const media = { id: "photo", portfolio_id: row.id, storage_path: "owner/photo.webp", thumbnail_path: null, media_type: "hero", visibility: "public", sort_order: 0, alt_text: null, metadata: {} };
    const horoscope = { id: "horoscope", portfolio_id: row.id, storage_path: "owner/horoscope.webp", mime_type: "image/webp", file_extension: "webp", byte_size: 1000, language_label: null, page_count: null, published_at: null, created_at: row.created_at, updated_at: row.updated_at };
    const readiness = { ...await getPublicationReadiness(), reviewFingerprint: "a".repeat(64) };
    const snapshot = { portfolio: row, media: [media], horoscope, readiness };
    repositories.dashboard.findDashboardReviewSnapshot.mockResolvedValue({ data: snapshot, error: null });
    expect(await loadDashboardView({ supabase: {} as never, userId: "owner-1" })).toMatchObject({ media: [media], horoscope });
    expect(repositories.media.findPortfolioPhotos).not.toHaveBeenCalled();
    expect(repositories.horoscope.findByPortfolio).not.toHaveBeenCalled();
    for (const data of [
      { ...snapshot, media: [{ ...media, portfolio_id: "foreign" }] },
      { ...snapshot, horoscope: { ...horoscope, portfolio_id: "foreign" } },
      { ...snapshot, readiness: { ...readiness, portfolioExists: false } },
      { ...snapshot, readiness: { ...readiness, reviewFingerprint: null } },
    ]) {
      repositories.dashboard.findDashboardReviewSnapshot.mockResolvedValue({ data, error: null });
      await expect(loadDashboardView({ supabase: {} as never, userId: "owner-1" })).rejects.toThrow(/safely/);
    }
  });
});
