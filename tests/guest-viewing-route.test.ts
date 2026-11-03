import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), mail: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ anonymousSubjectHash: async () => "a".repeat(64) }));
vi.mock("@/features/notifications/server/resend.provider", () => ({ sendResendEmail: mocks.mail }));
import { POST } from "@/app/api/interest/viewing/route";
import { guestViewingCookieName, hashGuestViewingProof, newGuestViewingProof } from "@/features/access/server/guest-viewing-proof";
const id = "11111111-1111-4111-8111-111111111111";
const request = (body: unknown, origin = "https://app.test") => new Request("https://app.test/api/interest/viewing", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GUEST_INTEREST_OTP_SECRET", "synthetic-viewing-verification-key-32-characters");
  mocks.mail.mockResolvedValue({ status: "accepted" });
});
describe("portfolio-only guest verification", () => {
  it.each([true, false])("returns the same response without exposing approval existence (%s)", async eligible => {
    mocks.rpc.mockResolvedValue({ data: { challengeId: id, eligible }, error: null });
    const response = await POST(request({ action: "start", shareToken: "portfolio-token", email: "guest@example.test" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true, challengeId: id });
    expect(mocks.mail).toHaveBeenCalledTimes(eligible ? 1 : 0);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("sets only a portfolio-scoped HttpOnly proof after successful code verification", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "verified", shareToken: "portfolio-token" }, error: null });
    const response = await POST(request({ action: "complete", challengeId: id, email: "guest@example.test", code: "123456" }));
    expect(await response.json()).toEqual({ verified: true, path: "/p/portfolio-token" });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain(guestViewingCookieName("portfolio-token"));
    expect(cookie).toContain("Path=/p/portfolio-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Max-Age=1296000");
    expect(cookie).not.toContain("sb-");
    expect(mocks.rpc).toHaveBeenCalledWith("complete_guest_portfolio_access_verification", expect.objectContaining({ p_proof_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });
  it.each(["expired", "invalid_code"])("never remembers an invalid proof (%s)", async status => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null });
    const response = await POST(request({ action: "complete", challengeId: id, email: "guest@example.test", code: "123456" }));
    expect(response.status).toBe(status === "expired" ? 410 : 400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("blocks cross-origin requests and missing configuration", async () => {
    expect((await POST(request({ action: "start", shareToken: "portfolio-token", email: "guest@example.test" }, "https://other.test"))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    vi.stubEnv("GUEST_INTEREST_OTP_SECRET", "");
    expect((await POST(request({ action: "start", shareToken: "portfolio-token", email: "guest@example.test" }))).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("uses unguessable proofs and rejects malformed cookie values", () => {
    const a = newGuestViewingProof(); const b = newGuestViewingProof();
    expect(a.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.hash).toHaveLength(64);
    expect(a.value).not.toBe(b.value);
    expect(hashGuestViewingProof("modified proof")).toBeNull();
    expect(guestViewingCookieName("portfolio-token")).not.toBe(guestViewingCookieName("another-token"));
  });
});
