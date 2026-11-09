import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recordPublicPortfolioView,
  resolveApprovedHoroscope,
  resolveApprovedPhoto,
  resolvePublicPortfolioAvailability,
  resolvePortfolioView,
  resolvePublicPortfolio,
} from "../src/features/portfolio/server/public-portfolio.service";

const publicPayload = {
  data: {
    privacy_mode: "private",
    personal: { name: "Aditi", age: 29, gender: "female" },
    astrology: { rashi: "kanya" },
  },
  templateId: 3,
  themeColor: "#17151c",
  sunSign: "kanya",
  media: [{
    key: "safe-key",
    accessPath: "owner/portfolio/hero.webp",
    altText: "Aditi portrait",
    mediaType: "hero",
    sortOrder: 0,
    width: 800,
    height: 1200,
    presentation: "clear",
  }],
};

function client(outcomes: Record<string, { data: unknown; error?: unknown }>) {
  const rpc = vi.fn((name: string) => Promise.resolve(outcomes[name] ?? { data: null, error: null }));
  const createSignedUrls = vi.fn(async (paths: string[], ttl: number) => {
    void ttl;
    return { data: paths.map(path => ({ path, signedUrl: `https://signed.test/${path}`, error: null })) };
  });
  const createSignedUrl = vi.fn((path: string, ttl?: number, options?: unknown) => {
    void ttl; void options;
    return Promise.resolve({
    data: { signedUrl: `https://signed.test/${path}` },
    error: null,
  }); });
  return {
    supabase: {
      rpc,
      storage: { from: vi.fn(() => ({ createSignedUrl, createSignedUrls })) },
    } as unknown as SupabaseClient,
    rpc,
    createSignedUrl,
    createSignedUrls,
  };
}

describe("public portfolio service", () => {
  it("keeps approved text but serves only public photos to an accountless guest", async () => {
    const publicClient = client({ resolve_public_portfolio: { data: publicPayload } });
    const signing = client({ resolve_guest_approved_portfolio: { data: {
      ...publicPayload, data: { ...publicPayload.data, personal: { ...publicPayload.data.personal, dob: "1996-01-01" } },
      accessExpiresAt: new Date(Date.now() + 90_000).toISOString(),
      horoscope: { fileExtension: "webp" },
      media: [{ ...publicPayload.media[0], accessPath: "owner/portfolio/private.webp" }],
    } } });
    const view = await resolvePortfolioView(publicClient.supabase, "portfolio-token", false, {
      guestProofHash: "a".repeat(64), createGuestClient: () => signing.supabase,
    });
    expect(view?.accessMode).toBe("approved");
    expect(view?.data.personal.dob).toBe("1996-01-01");
    expect(signing.rpc).toHaveBeenCalledWith("resolve_guest_approved_portfolio", { p_share_token: "portfolio-token", p_proof_hash: "a".repeat(64) });
    expect(view?.filesRequireApprovedAccount).toBe(true);
    expect(view?.horoscope).toBeUndefined();
    expect(view?.photos[0]?.src).toBe("https://signed.test/owner/portfolio/hero.webp");
    expect(signing.createSignedUrls).not.toHaveBeenCalled();
  });
  it("keeps the public projection when a remembered guest grant is unavailable", async () => {
    const publicClient = client({ resolve_public_portfolio: { data: publicPayload } });
    const signing = client({ resolve_guest_approved_portfolio: { data: null } });
    const view = await resolvePortfolioView(publicClient.supabase, "portfolio-token", false, {
      guestProofHash: "a".repeat(64), createGuestClient: () => signing.supabase,
    });
    expect(view?.accessMode).toBe("public");
    expect(view?.data.personal.dob).toBeUndefined();
    expect(signing.createSignedUrls).not.toHaveBeenCalled();
  });
  it("uses application file URLs for the signed-in approved account", async () => {
    const fixture = client({
      resolve_public_portfolio: { data: publicPayload },
      resolve_approved_portfolio: { data: { ...publicPayload, accessExpiresAt: new Date(Date.now() + 90_000).toISOString() } },
    });
    const view = await resolvePortfolioView(fixture.supabase, "allowed-token", true);
    expect(view?.photos[0]?.src).toBe("/p/allowed-token/files/photo-safe-key");
    expect(view?.filesRequireApprovedAccount).toBe(false);
    expect(fixture.rpc).toHaveBeenCalledWith("resolve_approved_portfolio", { p_share_token: "allowed-token" });
    expect(fixture.createSignedUrls).not.toHaveBeenCalled();
  });

  it("does not resolve a file descriptor when approval has expired", async () => {
    const accessExpiresAt = new Date(Date.now() - 1000).toISOString();
    const fixture = client({
      resolve_approved_portfolio: { data: { ...publicPayload, accessExpiresAt } },
      resolve_approved_horoscope: { data: {
        accessPath: "owner/portfolio/private.webp", mimeType: "image/webp", fileExtension: "webp", accessExpiresAt,
      } },
    });
    await expect(resolveApprovedPhoto(fixture.supabase, "expired", "safe-key")).resolves.toBeNull();
    await expect(resolveApprovedHoroscope(fixture.supabase, "expired")).resolves.toBeNull();
  });

  it.each(["owner/../foreign/file.webp", "owner/%2e%2e/foreign/file.webp", "owner/portfolio/%2Ffile.webp", "owner/portfolio/./file.webp", "owner\\..\\foreign/file.webp", "owner/portfolio/file.webp?query", "owner//file.webp"])("rejects noncanonical historical descriptors: %s", async path => {
    const requester = client({ resolve_public_portfolio: { data: publicPayload }, resolve_approved_portfolio: { data: {
      ...publicPayload, accessExpiresAt: new Date(Date.now()+600_000).toISOString(),
      media: [{ ...publicPayload.media[0], accessPath: path }],
    } }, resolve_approved_horoscope: { data: {
      accessPath: path, mimeType: "image/webp", fileExtension: "webp", profileName: "Aditi", accessExpiresAt: new Date(Date.now()+600_000).toISOString(),
    } } });
    expect((await resolvePortfolioView(requester.supabase, "token", true))?.photos).toEqual([]);
    await expect(resolveApprovedPhoto(requester.supabase, "token", "safe-key")).resolves.toBeNull();
    await expect(resolveApprovedHoroscope(requester.supabase, "token")).resolves.toBeNull();
    expect(requester.createSignedUrls).not.toHaveBeenCalled();
  });
  it("maps the entire approved photo array without the public three-photo restriction", async () => {
    const media = Array.from({ length: 8 }, (_, index) => ({ ...publicPayload.media[0], key: `approved-${index}`, accessPath: `owner/portfolio/approved-${index}.webp`, mediaType: index ? "gallery" : "hero", sortOrder: index }));
    const fixture = client({ resolve_public_portfolio: { data: publicPayload }, resolve_approved_portfolio: { data: { ...publicPayload, media, accessExpiresAt: new Date(Date.now()+600_000).toISOString() } } });
    const view = await resolvePortfolioView(fixture.supabase, "valid-token", true);
    expect(view?.photos).toHaveLength(8);
    expect(view?.photos.map(photo=>photo.id)).toEqual(media.map(item=>item.key));
    expect(view?.photos.map(photo => photo.src)).toEqual(media.map(item => `/p/valid-token/files/photo-${item.key}`));
    expect(fixture.createSignedUrls).not.toHaveBeenCalled();
    const foreign = client({ resolve_public_portfolio: { data: publicPayload }, resolve_approved_portfolio: { data: null } });
    expect((await resolvePortfolioView(foreign.supabase,"valid-token",true))?.photos).toHaveLength(1);
    expect(foreign.createSignedUrls).toHaveBeenCalledExactlyOnceWith([publicPayload.media[0].accessPath], 3600);
  });
  it("returns only valid token-resolver payloads", async () => {
    const valid = client({
      resolve_public_portfolio: { data: publicPayload },
      resolve_public_portfolio_identity_verified: { data: true },
    });
    await expect(resolvePublicPortfolio(valid.supabase, "valid-token")).resolves.toMatchObject({
      data: { personal: { name: "Aditi" } },
      identityVerified: true,
    });
    expect(valid.rpc).toHaveBeenCalledWith("resolve_public_portfolio", { p_share_token: "valid-token" });
    expect(valid.rpc).toHaveBeenCalledWith("resolve_public_portfolio_identity_verified", { p_share_token: "valid-token" });

    const malformed = client({ resolve_public_portfolio: { data: { portfolioId: "private-id" } } });
    await expect(resolvePublicPortfolio(malformed.supabase, "valid-token")).resolves.toBeNull();
  });

  it("distinguishes only exact expired tokens from all other unavailable links", async () => {
    const expired = client({
      resolve_public_portfolio: { data: null },
      resolve_public_portfolio_status: { data: "expired" },
    });
    await expect(resolvePublicPortfolioAvailability(expired.supabase, "expired-token"))
      .resolves.toBe("expired");
    expect(expired.rpc).toHaveBeenCalledWith("resolve_public_portfolio_status", {
      p_share_token: "expired-token",
    });

    const unavailable = client({
      resolve_public_portfolio: { data: null },
      resolve_public_portfolio_status: { data: "unexpected", error: null },
    });
    await expect(resolvePublicPortfolioAvailability(unavailable.supabase, "unknown-token"))
      .resolves.toBe("unavailable");
  });

  it("signs only descriptors returned by the public resolver", async () => {
    const fixture = client({ resolve_public_portfolio: { data: publicPayload } });
    const view = await resolvePortfolioView(fixture.supabase, "valid-token", false);
    expect(view).toMatchObject({
      accessMode: "public",
      photos: [{
        id: "safe-key",
        src: "https://signed.test/owner/portfolio/hero.webp",
        orientation: "portrait",
      }],
    });
    expect(fixture.rpc).not.toHaveBeenCalledWith("resolve_approved_portfolio", expect.anything());
  });

  it("uses an approved projection only when the database returns one", async () => {
    const approved = {
      ...publicPayload,
      accessExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      data: { ...publicPayload.data, personal: { ...publicPayload.data.personal, name: "Approved Aditi" } },
    };
    const fixture = client({
      resolve_public_portfolio: { data: publicPayload },
      resolve_public_portfolio_identity_verified: { data: true },
      resolve_approved_portfolio: { data: approved },
    });
    const view = await resolvePortfolioView(fixture.supabase, "valid-token", true);
    expect(view?.accessMode).toBe("approved");
    expect(view?.data.personal.name).toBe("Approved Aditi");
    expect(view?.identityVerified).toBe(true);
  });

  it("records views by token and resolves a document without signing it", async () => {
    const fixture = client({
      record_public_portfolio_view: { data: true },
      resolve_approved_horoscope: { data: {
        accessPath: "owner/portfolio/private.webp",
        mimeType: "image/webp",
        fileExtension: "webp",
        profileName: "Aditi",
        accessExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      } },
    });
    await recordPublicPortfolioView(fixture.supabase, "valid-token");
    expect(fixture.rpc).toHaveBeenCalledWith("record_public_portfolio_view", { p_share_token: "valid-token" });

    const horoscope = await resolveApprovedHoroscope(fixture.supabase, "valid-token");
    expect(horoscope?.accessPath).toBe("owner/portfolio/private.webp");
    expect(fixture.createSignedUrl).not.toHaveBeenCalled();
  });
});
