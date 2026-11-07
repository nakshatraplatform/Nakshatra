
import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => vi.fn());
const throttle = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn());
const assetRpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getApiUser: auth }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: throttle }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ rpc: assetRpc, storage: { from } }) }));
import { GET } from "../src/app/api/v1/family/introductions/[introductionRef]/route";

const introductionRef = `bir_${"a".repeat(32)}`;
const detail = {
  available: true, introductionRef, disclosureLevel: "complete", data: { personal: { name: "Test customer" } },
  templateId: 1, sunSign: null, expiresAt: "2026-12-01T12:00:00Z", versionNumber: 2,
  media: [{ key: "photo-0", accessPath: `/api/v1/family/introductions/${introductionRef}?asset=photo-0`, mediaType: "hero", sortOrder: 0, presentation: "clear" }],
  horoscope: { accessPath: `/api/v1/family/introductions/${introductionRef}?asset=horoscope`, fileExtension: "webp", languageLabel: null, pageCount: null },
};
function get(query = "", ref = introductionRef) {
  return GET(new Request(`https://vivintro.com/api/v1/family/introductions/${ref}${query}`),
    { params: Promise.resolve({ introductionRef: ref }) });
}
describe("family introduction reads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.mockResolvedValue({ status: "authenticated", supabase: { rpc }, user: { id: "actor", sessionId: "session" } });
    rpc.mockResolvedValue({ data: detail, error: null });
    throttle.mockResolvedValue(null);
    from.mockReturnValue({ download });
    assetRpc.mockImplementation(async (_rpc, { p_asset }) => ({
      data: p_asset === "photo-0" ? { path: "private/hero.webp", extension: null }
        : p_asset === "horoscope" ? { path: "private/horoscope.webp", extension: "webp" } : null,
      error: null,
    }));
  });

  it("returns only authenticated application URLs for authorized pinned assets", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const json = await response.json();
    expect(json.media[0].accessPath).toContain("?asset=photo-0");
    expect(json.horoscope.accessPath).toContain("?asset=horoscope");
    expect(JSON.stringify(json)).not.toContain("private/");
    expect(from).not.toHaveBeenCalled();
  });

  it("rechecks access for each asset and only downloads pinned objects", async () => {
    download.mockResolvedValue({ data: new Blob(["image"], { type: "image/webp" }), error: null });
    const photo = await get("?asset=photo-0");
    expect(photo.headers.get("Content-Type")).toBe("image/webp");
    expect(photo.headers.get("Cache-Control")).toBe("private, no-store");
    expect(photo.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(download).toHaveBeenCalledWith("private/hero.webp");
    const horoscope = await get("?asset=horoscope");
    expect(horoscope.headers.get("Content-Disposition")).toBe('attachment; filename="horoscope.webp"');
    expect(from).toHaveBeenLastCalledWith("horoscopes");
    expect(assetRpc).toHaveBeenCalledWith("resolve_family_introduction_asset", {
      p_introduction_ref: introductionRef, p_asset: "photo-0", p_actor: "actor", p_session_id: "session",
    });
    assetRpc.mockResolvedValue({ data: null, error: null });
    expect((await get("?asset=photo-0")).status).toBe(404);
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("requires a live session and applies the broker Introduction read limit before asset resolution", async () => {
    auth.mockResolvedValueOnce({ status: "missing_session" });
    expect((await get("?asset=photo-0")).status).toBe(401);
    throttle.mockResolvedValueOnce(new Response(null, { status: 429 }));
    expect((await get("?asset=photo-0")).status).toBe(429);
    expect(assetRpc).not.toHaveBeenCalled();
  });

  it("rejects bad refs, query overrides, missing assets and unsafe content", async () => {
    expect((await get("", "other")).status).toBe(404);
    expect((await get("?asset=photo-0&side=recipient")).status).toBe(404);
    expect((await get("?asset=private/path")).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
    expect((await get("?asset=photo-7")).status).toBe(404);
    download.mockResolvedValue({ data: new Blob(["html"], { type: "text/html" }), error: null });
    expect((await get("?asset=photo-0")).status).toBe(404);
    rpc.mockResolvedValue({ data: { ...detail, responseComment: "private note" }, error: null });
    expect((await get()).status).toBe(404);
  });
});
