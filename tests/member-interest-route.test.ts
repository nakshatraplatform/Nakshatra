import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getApiUser: mocks.auth }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: mocks.rate }));
import { GET, POST } from "@/app/api/interest/member/route";
const payload = { portfolioToken: "member-portfolio", revision: "a".repeat(32), scope: "full_portfolio" };
const request = (body: unknown, origin = "https://app.test") => new Request("https://app.test/api/interest/member", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ status: "authenticated", user: { id: "member-1" }, supabase: { rpc: mocks.rpc } });
  mocks.rate.mockResolvedValue(null);
});
describe("explicit member interest sharing", () => {
  it("requires an existing sign-in and does not create one", async () => {
    mocks.auth.mockResolvedValue({ status: "missing_session" });
    expect((await POST(request(payload))).status).toBe(401);
    expect((await GET(new Request("https://app.test/api/interest/member?token=member-portfolio"))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns only validated current published context with private no-store caching", async () => {
    const context = { available: true, name: "Published Member", revision: "a".repeat(32), photoCount: 2, privatePhotoCount: 1,
      hasHoroscope: true, alreadySent: false, requestStatus: null, sharingActive: false };
    mocks.rpc.mockResolvedValue({ data: { ...context, draft_data: "must not serialize" }, error: null });
    const response = await GET(new Request("https://app.test/api/interest/member?token=member-portfolio"));
    expect(await response.json()).toEqual(context);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("member_interest_context", { p_share_token: "member-portfolio" });
  });
  it("sends one scoped, revision-fenced command without accepting identity or recipient overrides", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "submitted", mutual: true }, error: null });
    const response = await POST(request({ ...payload, message: "Happy to connect." }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ submitted: true, mutual: true });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("send_member_interest_and_share", {
      p_share_token: "member-portfolio", p_revision: "a".repeat(32), p_message: "Happy to connect.",
    });
    mocks.rpc.mockClear();
    expect((await POST(request({ ...payload, requesterId: "another-user" }))).status).toBe(400);
    expect((await POST(request({ portfolioToken: payload.portfolioToken, revision: payload.revision }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([["existing_request", 409], ["review_changed", 409], ["unavailable", 409], ["rate_limited", 429]] as const)("keeps %s from being reported as a new send", async (status, expected) => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null });
    const response = await POST(request(payload));
    expect(response.status).toBe(expected);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects cross-origin, invalid tokens, oversized messages and unknown database outcomes safely", async () => {
    expect((await POST(request(payload, "https://other.test"))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect((await POST(request({ ...payload, message: "x".repeat(601) }))).status).toBe(400);
    expect((await GET(new Request("https://app.test/api/interest/member?token=bad%2Ftoken"))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: { status: "unknown", private_data: "sensitive" }, error: null });
    const response = await POST(request(payload));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
  });
});
