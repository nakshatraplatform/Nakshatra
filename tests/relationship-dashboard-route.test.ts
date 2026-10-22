import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getApiUser: mocks.auth }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: mocks.limit }));
vi.mock("@/features/access/server/relationship-dashboard.service", () => ({ loadRelationshipPage: mocks.load }));
import { GET } from "@/app/api/dashboard/relationships/route";
describe("owner relationship API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ status: "authenticated", supabase: {} }); mocks.limit.mockResolvedValue(null); });
  it("does not load private data for a missing session", async () => {
    mocks.auth.mockResolvedValue({ status: "missing_session" });
    expect((await GET(new Request("http://local/api/dashboard/relationships"))).status).toBe(401);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("honours throttling without reading relationships", async () => {
    mocks.limit.mockResolvedValue(new Response(null, { status: 429 }));
    expect((await GET(new Request("http://local/api/dashboard/relationships"))).status).toBe(429);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("rejects oversized search and out-of-range pages", async () => {
    for (const query of ["offset=-1", "offset=100001", "queue=other", `query=${"a".repeat(81)}`]) expect((await GET(new Request(`http://local/api/dashboard/relationships?${query}`))).status).toBe(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("returns private no-store results and actionable safe errors", async () => {
    mocks.load.mockResolvedValue({ records: [], total: 0 });
    const response = await GET(new Request("http://local/api/dashboard/relationships?queue=access&offset=8"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.load).toHaveBeenCalledWith({}, { queue: "access", offset: 8, query: "", filter: "all" });
    mocks.load.mockRejectedValue(new Error("database private details"));
    const failed = await GET(new Request("http://local/api/dashboard/relationships"));
    expect(failed.status).toBe(503);
    expect(JSON.stringify(await failed.json())).not.toContain("database private");
  });
});
