import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getApiUser: mocks.auth }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: mocks.limit }));
import { GET } from "@/app/api/relationships/route";
const request = (query = "stage=awaiting") => new Request(`https://app.test/api/relationships?${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ status: "authenticated", user: { id: "owner" }, supabase: { rpc: mocks.rpc } });
  mocks.limit.mockResolvedValue(null); mocks.rpc.mockResolvedValue({ data: { records: [], total: 60 }, error: null });
});
describe("owner relationship queues", () => {
  it("passes bounded paging and literal search to the owner-scoped RPC", async () => {
    const response = await GET(request("stage=access&offset=56&search=old%25&filter=direct"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ records: [], total: 60 });
    expect(mocks.rpc).toHaveBeenCalledWith("list_relationship_queue", { p_stage: "access", p_offset: 56, p_search: "old%", p_filter: "direct" });
  });
  it.each(["", "stage=other", "stage=access&offset=-1", "stage=access&offset=100001", "stage=access&filter=bogus", `stage=access&search=${"x".repeat(101)}`, "stage=access&userId=other"])("rejects malformed queries: %s", async query => {
    expect((await GET(request(query))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires a live authenticated session before any queue read", async () => {
    mocks.auth.mockResolvedValue({ status: "missing_session" });
    expect((await GET(request())).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves throttling without reading the queue", async () => {
    mocks.limit.mockResolvedValue(Response.json({ code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "30" } }));
    const response = await GET(request()); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("30");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: null }, { data: { records: [], total: -1 }, error: null }, { data: null, error: { message: "private database detail" } }])("surfaces unavailable data without inventing an empty queue", async result => {
    mocks.rpc.mockResolvedValue(result);
    const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private database detail");
  });
});
