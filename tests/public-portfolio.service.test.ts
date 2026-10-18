import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recordPublicPortfolioView,
  resolveApprovedHoroscope,
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
  const createSignedUrl = vi.fn((path: string, ttl?: number, options?: unknown) => {
    void ttl; void options;
    return Promise.resolve({
    data: { signedUrl: `https://signed.test/${path}` },
    error: null,
  }); });
  return {
    supabase: {
      rpc,
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    } as unknown as SupabaseClient,
    rpc,
    createSignedUrl,
  };
}

describe("public portfolio service", () => {
  it("uses a separate trusted signer only after session-scoped authorization and caps private TTL", async () => {
    const requester = client({ resolve_public_portfolio: { data: publicPayload }, resolve_approved_portfolio: { data: { ...publicPayload, accessExpiresAt: new Date(Date.now() + 90_000).toISOString() } } });
    const trusted = client({});
    await resolvePortfolioView(requester.supabase, "allowed-token", true, { createSigningClient: () => trusted.supabase });
    expect(requester.rpc).toHaveBeenCalledWith("resolve_approved_portfolio", { p_share_token: "allowed-token" });
    expect(requester.createSignedUrl).not.toHaveBeenCalled();
    expect(trusted.rpc).not.toHaveBeenCalled();
    const ttl = trusted.createSignedUrl.mock.calls[0][1];
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(90);
    const factory = vi.fn(() => trusted.supabase);
    const denied = client({ resolve_approved_portfolio: { data: null } });
    await resolvePortfolioView(denied.supabase, "denied", true, { createSigningClient: factory });
    expect(factory).not.toHaveBeenCalled();
  });
  it("never invokes the privileged horoscope signer for expired authorization", async () => {
    const requester = client({ resolve_approved_horoscope: { data: {
      accessPath: "owner/portfolio/private.webp", mimeType: "image/webp", fileExtension: "webp",
      profileName: "Aditi", accessExpiresAt: new Date(Date.now() - 1000).toISOString(),
    } } });
    const factory = vi.fn();
    expect(await resolveApprovedHoroscope(requester.supabase, "expired", { createSigningClient: factory })).toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });
  it.each(["owner/../foreign/file.webp", "owner/%2e%2e/foreign/file.webp", "owner/portfolio/%2Ffile.webp", "owner/portfolio/./file.webp", "owner\\..\\foreign/file.webp", "owner/portfolio/file.webp?query", "owner//file.webp"])("never signs noncanonical historical descriptors: %s", async path => {
    const requester = client({ resolve_public_portfolio: { data: publicPayload }, resolve_approved_portfolio: { data: {
      ...publicPayload, accessExpiresAt: new Date(Date.now()+600_000).toISOString(),
      media: [{ ...publicPayload.media[0], accessPath: path }],
    } }, resolve_approved_horoscope: { data: {
      accessPath: path, mimeType: "image/webp", fileExtension: "webp", profileName: "Aditi", accessExpiresAt: new Date(Date.now()+600_000).toISOString(),
    } } });
    const trusted = client({});
    expect((await resolvePortfolioView(requester.supabase, "token", true, { createSigningClient: () => trusted.supabase }))?.photos).toEqual([]);
    expect(await resolveApprovedHoroscope(requester.supabase, "token", { createSigningClient: () => trusted.supabase })).toBeNull();
    expect(trusted.createSignedUrl).not.toHaveBeenCalled();
  });
  it("maps the entire approved photo array without the public three-photo restriction", async () => {
    const media = Array.from({ length: 8 }, (_, index) => ({ ...publicPayload.media[0], key: `approved-${index}`, accessPath: `owner/portfolio/approved-${index}.webp`, mediaType: index ? "gallery" : "hero", sortOrder: index }));
    const fixture = client({ resolve_public_portfolio: { data: publicPayload }, resolve_approved_portfolio: { data: { ...publicPayload, media, accessExpiresAt: new Date(Date.now()+600_000).toISOString() } } });
    const view = await resolvePortfolioView(fixture.supabase, "valid-token", true, { createSigningClient: () => fixture.supabase });
    expect(view?.photos).toHaveLength(8);
    expect(view?.photos.map(photo=>photo.id)).toEqual(media.map(item=>item.key));
    expect(fixture.createSignedUrl).toHaveBeenCalledTimes(8);
    const foreign = client({ resolve_public_portfolio: { data: publicPayload }, resolve_approved_portfolio: { data: null } });
    expect((await resolvePortfolioView(foreign.supabase,"valid-token",true))?.photos).toHaveLength(1);
    expect(foreign.createSignedUrl).not.toHaveBeenCalledWith("owner/portfolio/approved-7.webp",expect.anything());
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
    const view = await resolvePortfolioView(fixture.supabase, "valid-token", true, { createSigningClient: () => fixture.supabase });
    expect(view?.accessMode).toBe("approved");
    expect(view?.data.personal.name).toBe("Approved Aditi");
    expect(view?.identityVerified).toBe(true);
  });

  it("records views by token and signs approved horoscopes briefly", async () => {
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

    const horoscope = await resolveApprovedHoroscope(fixture.supabase, "valid-token", { createSigningClient: () => fixture.supabase });
    expect(horoscope?.signedUrl).toContain("private.webp");
    expect(fixture.createSignedUrl).toHaveBeenCalledWith(
      "owner/portfolio/private.webp",
      expect.any(Number),
      undefined
    );
  });
});
