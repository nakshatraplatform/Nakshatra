import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const anonymousSubjectHash = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ rpc }) }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ anonymousSubjectHash }));
import { POST } from "../src/app/api/landing-feedback/route";

const valid = { audience: "viewer", experience: "The introduction was easy to understand.", improvement: "", creditName: "", contactEmail: "", contactPermission: false, website: "" };
function request(body: unknown, origin = "https://vivintro.test") {
  return new Request("https://vivintro.test/api/landing-feedback", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("public landing feedback route", () => {
  beforeEach(() => { vi.clearAllMocks(); anonymousSubjectHash.mockResolvedValue("a".repeat(64)); rpc.mockResolvedValue({ data: { status: "saved" }, error: null }); });
  it("rejects cross-origin and invalid input before database access", async () => {
    expect((await POST(request(valid, "https://other.test"))).status).toBe(403);
    expect((await POST(request({ ...valid, experience: "short" }))).status).toBe(400);
    expect((await POST(request({ ...valid, contactPermission: true }))).status).toBe(400);
    expect((await POST(request({ ...valid, contactEmail: "someone@example.test" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("stores only bounded private feedback through the service-only RPC", async () => {
    expect((await POST(request(valid))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("submit_landing_feedback", expect.objectContaining({ p_audience: "viewer", p_contact_permission: false, p_subject_hash: "a".repeat(64) }));
  });
  it("surfaces the database quota and fails closed on persistence errors", async () => {
    rpc.mockResolvedValueOnce({ data: { status: "rate_limited" }, error: null });
    expect((await POST(request(valid))).status).toBe(429);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    expect((await POST(request(valid))).status).toBe(503);
  });
});
