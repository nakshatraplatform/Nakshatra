import { describe, expect, it, vi } from "vitest";
import { AccessRepository } from "../src/features/access/server/access.repository";
import { IdentityVerificationWebhookRepository } from "../src/features/identity-verification/server/webhook.repository";
import { PortfolioMediaRepository } from "../src/features/media/server/media.repository";
import { DashboardRepository } from "../src/features/portfolio/server/dashboard.repository";
import { HoroscopeRepository } from "../src/features/horoscope/server/horoscope.repository";
import { InterestRepository } from "../src/features/interest/server/interest.repository";

type QueryResult = { data?: unknown; error: unknown; count?: number };

function query(result: QueryResult = { data: { id: "row" }, error: null }) {
  const value: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "order", "limit", "insert", "update", "upsert", "delete"]) {
    value[method] = vi.fn(() => value);
  }
  value.single = vi.fn().mockResolvedValue(result);
  value.maybeSingle = vi.fn().mockResolvedValue(result);
  value.then = (resolve: (result: QueryResult) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return value as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<QueryResult>;
}

describe("PortfolioMediaRepository", () => {
  it("builds all database and storage operations", async () => {
    const q = query({ data: { id: "media" }, error: null, count: 2 });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const download = vi.fn().mockResolvedValue({ data: new Blob(), error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.test/photo" }, error: null });
    const from = vi.fn(() => q);
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const supabase = { from, rpc, storage: { from: vi.fn(() => ({ upload, remove, download, createSignedUrl })) } } as never;
    const repository = new PortfolioMediaRepository(supabase);

    await repository.findOwnedPortfolio("portfolio", "owner");
    await repository.countProfilePhotos("portfolio");
    await repository.upload("path.webp", Buffer.from("image"));
    await repository.download("path.webp");
    await repository.remove([]);
    await repository.remove(["path.webp"]);
    await repository.createMedia({ portfolio_id: "portfolio" });
    await repository.updateMedia("media", { visibility: "public" });
    await repository.findMedia("media");
    await repository.findPortfolioPhotos("portfolio");
    await repository.setPrimaryHero("media");
    await repository.deleteMedia("media");
    await repository.createSignedPhotoUrl("path.webp", 3600);

    expect(from).toHaveBeenCalledWith("portfolios");
    expect(from).toHaveBeenCalledWith("portfolio_media");
    expect(upload).toHaveBeenCalledWith("path.webp", expect.any(Buffer), { contentType: "image/webp" });
    expect(remove).toHaveBeenCalledWith(["path.webp"]);
    expect(download).toHaveBeenCalledWith("path.webp");
    expect(createSignedUrl).toHaveBeenCalledWith("path.webp", 3600);
    expect(rpc).toHaveBeenCalledWith("set_portfolio_hero", { p_media_id: "media" });
    expect(q.in).toHaveBeenCalledWith("media_type", ["hero", "gallery"]);
  });
});

describe("DashboardRepository", () => {
  it("builds portfolio and snapshot persistence operations", async () => {
    const q = query({ data: { id: "portfolio" }, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: { status: "ok" }, error: null });
    const supabase = { from: vi.fn(() => q), rpc } as never;
    const repository = new DashboardRepository(supabase);

    await repository.findPortfolioForUser("owner");
    await repository.findDashboardPortfolioForUser("owner");
    await repository.findDashboardReviewSnapshot();
    await repository.findOwnerPreviewPortfolioForUser("owner");
    await repository.countPortfolioViews("portfolio");
    await repository.probeStructuredLocationSchema();
    await repository.saveDashboardDraftTransaction({
      portfolio: { draft_data: {} },
      candidate: null,
      details: null,
      visibilityRules: [],
      familyMembers: [],
      education: null,
      career: null,
    });
    await repository.publishPortfolioTransaction({
      actorUserId: "owner",
      actorSessionId: "session",
      portfolioId: "portfolio",
      draftData: {},
      publicData: {},
      approvedData: {},
      shareToken: "123456789012345678901",
      expiresAt: "2099-01-01",
      templateId: 1,
      themeColor: "#fff",
      sunSign: "kanya",
    });
    await repository.findShareablePrimaryPhoto("portfolio");
    await repository.renewPortfolioTransaction("2099-01-01");
    await repository.rotatePortfolioTransaction("123456789012345678901");
    await repository.unpublishPortfolioTransaction();

    expect(rpc).toHaveBeenCalledWith("save_dashboard_draft_transaction", {
      p_payload: expect.objectContaining({ portfolio: { draft_data: {} } }),
    });
    expect(rpc).toHaveBeenCalledWith("get_owner_dashboard_review_snapshot");
    expect(rpc).toHaveBeenCalledWith("service_publish_portfolio_transaction", expect.objectContaining({
      p_actor_user_id: "owner", p_actor_session_id: "session", p_portfolio_id: "portfolio",
    }));
    expect(rpc).toHaveBeenCalledWith("renew_portfolio_transaction", { p_expires_at: "2099-01-01" });
    expect(q.in).toHaveBeenCalledWith("visibility", ["public", "interest_required"]);
    expect(q.limit).toHaveBeenCalledWith(1);
  });

});

describe("dashboard read repositories", () => {
  it("does not fall back to the retired weaker submission command", async () => {
    const rpc = vi.fn();
    const repository = new InterestRepository({ rpc } as never);
    await expect(repository.submit({ portfolioToken: "portfolio-token", name: "Mira Rao", profileFor: "self", phone: "+1 617 555 0123", email: "mira@example.test" } as never)).resolves.toMatchObject({ error: { code: "22023" } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("builds guarded interest and horoscope owner reads", async () => {
    const q = query({ data: { id: "row" }, error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.test/horoscope" },
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = {
      from: vi.fn(() => q),
      rpc,
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    } as never;

    const interests = new InterestRepository(supabase);
    const horoscopes = new HoroscopeRepository(supabase);
    await interests.listForPortfolio("portfolio");
    await horoscopes.findPortfolioForOwner("owner");
    await horoscopes.findByPortfolio("portfolio");
    await horoscopes.createSignedUrl("owner/chart.webp", 300, "horoscope.webp");

    expect(rpc).toHaveBeenCalledWith("list_dashboard_interests", { p_limit: 50 });
    expect(createSignedUrl).toHaveBeenCalledWith(
      "owner/chart.webp",
      300,
      { download: "horoscope.webp" }
    );
  });
});

describe("AccessRepository", () => {
  it("uses only the owner-scoped access RPCs and forwards the requested lifecycle action", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "ok" }, error: null });
    const repository = new AccessRepository({ rpc } as never);

    await repository.listPortfolioAccess();
    await repository.manageGrant("grant-1", "renew");
    await repository.manageGrant("grant-2", "revoke");

    expect(rpc).toHaveBeenNthCalledWith(1, "list_portfolio_access");
    expect(rpc).toHaveBeenNthCalledWith(2, "manage_reveal_grant", {
      p_grant_id: "grant-1",
      p_action: "renew",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "manage_reveal_grant", {
      p_grant_id: "grant-2",
      p_action: "revoke",
    });
  });
});

describe("IdentityVerificationWebhookRepository", () => {
  it("persists only verified webhook identifiers and digests through the service-role RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { accepted: true }, error: null });
    const repository = new IdentityVerificationWebhookRepository({ rpc } as never);
    const event = {
      attemptId: "11111111-1111-4111-8111-111111111111",
      eventHash: "a".repeat(64),
      payloadDigest: "b".repeat(64),
      providerSessionRef: "22222222-2222-4222-8222-222222222222",
      providerSubjectRef: "33333333-3333-4333-8333-333333333333",
      workflowId: "44444444-4444-4444-8444-444444444444",
    };

    await repository.record(event);

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("record_identity_verification_webhook", {
      p_attempt_id: event.attemptId,
      p_payload_digest: event.payloadDigest,
      p_provider_event_hash: event.eventHash,
      p_provider_session_ref: event.providerSessionRef,
      p_provider_subject_ref: event.providerSubjectRef,
      p_workflow_id: event.workflowId,
    });
  });
});

describe("HoroscopeRepository", () => {
  it("builds every database and private-storage operation", async () => {
    const q = query({ data: { id: "horoscope" }, error: null });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.test/horoscope" }, error: null });
    const from = vi.fn(() => q);
    const rpc = vi.fn(() => q);
    const storageFrom = vi.fn(() => ({ upload, remove, createSignedUrl }));
    const repository = new HoroscopeRepository({ from, rpc, storage: { from: storageFrom } } as never);
    const body = Buffer.from("horoscope");
    const attachment = { portfolio_id: "portfolio", storage_path: "owner/chart.webp" };

    await repository.findOwnedPortfolio("portfolio", "owner");
    await repository.findPortfolioForOwner("owner");
    await repository.findByPortfolio("portfolio");
    await repository.findById("horoscope");
    await repository.reserveUpload("portfolio");
    await repository.save(attachment, "owner/previous.webp");
    await repository.delete("horoscope");
    await repository.publish("portfolio", "2026-10-18T00:00:00.000Z");
    await repository.upload("owner/chart.webp", body, "image/webp");
    await repository.remove([]);
    await repository.remove(["owner/chart.webp"]);
    await repository.createSignedUrl("owner/chart.webp", 300, "horoscope.webp");

    expect(from).toHaveBeenCalledWith("portfolios");
    expect(from).toHaveBeenCalledWith("portfolio_horoscopes");
    expect(rpc).toHaveBeenCalledWith("reserve_horoscope_upload", { p_portfolio_id: "portfolio" });
    expect(rpc).toHaveBeenCalledWith("replace_horoscope", {
      p_portfolio_id: "portfolio",
      p_expected_path: "owner/previous.webp",
      p_attachment: attachment,
    });
    expect(rpc).toHaveBeenCalledWith("delete_owned_horoscope", { p_id: "horoscope" });
    expect(rpc).toHaveBeenCalledWith("publish_owned_horoscope", {
      p_portfolio_id: "portfolio",
      p_published_at: "2026-10-18T00:00:00.000Z",
    });
    expect(storageFrom).toHaveBeenCalledWith("horoscopes");
    expect(upload).toHaveBeenCalledWith("owner/chart.webp", body, {
      contentType: "image/webp",
      cacheControl: "0",
      upsert: false,
    });
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(["owner/chart.webp"]);
    expect(createSignedUrl).toHaveBeenCalledWith("owner/chart.webp", 300, { download: "horoscope.webp" });
  });
});
