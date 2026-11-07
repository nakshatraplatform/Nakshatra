import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getApiUser: auth }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: rateLimit }));
vi.mock("@/lib/security/logging", () => ({ getRequestId: () => "request", logServerError: vi.fn() }));
import { GET } from "../src/app/api/v1/family/introductions/route";
import { resolveFamilyDashboard } from "@/features/family-viewers/server/family-dashboard.service";
import { familyDashboardQuerySchema } from "@/features/family-viewers/server/family-dashboard.contract";

const supabase = { rpc };
const reference = `bir_${"a".repeat(32)}`;
const request = (query = "") => new Request("https://vivintro.com/api/v1/family/introductions" + query);
const result = {
  available: true,
  introductions: [{ introductionRef: reference, candidateNames: ["Candidate"],
    status: "active", createdAt: "2026-11-01T12:00:00Z", responseDueAt: "2026-11-16T12:00:00Z" }],
  nextCursor: null,
};

describe("family introduction list boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: result, error: null });
    auth.mockResolvedValue({ status: "authenticated", user: { id: "viewer" }, supabase });
    rateLimit.mockResolvedValue(null);
  });

  it("validates bounded paired cursors without accepting authority from callers", () => {
    expect(familyDashboardQuerySchema.parse({})).toEqual({ limit: 25 });
    expect(familyDashboardQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(familyDashboardQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(familyDashboardQuerySchema.safeParse({ beforeRef: reference }).success).toBe(false);
    expect(familyDashboardQuerySchema.safeParse({ beforeCreatedAt: "2026-11-01T12:00:00Z" }).success).toBe(false);
    expect(familyDashboardQuerySchema.safeParse({ candidateId: "someone-else" }).success).toBe(false);
    expect(familyDashboardQuerySchema.safeParse({ beforeCreatedAt: "bad", beforeRef: reference }).success).toBe(false);
  });

  it("uses one RPC and returns only schema-validated metadata", async () => {
    await expect(resolveFamilyDashboard(supabase as never)).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("resolve_family_introductions", {
      p_limit: 25, p_before_created_at: undefined, p_before_ref: undefined,
    });
    const response = await GET(request(`?limit=50&beforeCreatedAt=2026-11-01T12%3A00%3A00Z&beforeRef=${reference}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(rpc).toHaveBeenLastCalledWith("resolve_family_introductions", {
      p_limit: 50, p_before_created_at: "2026-11-01T12:00:00Z", p_before_ref: reference,
    });
  });

  it("fails closed if the database returns private or malformed output", async () => {
    rpc.mockResolvedValueOnce({ data: { ...result, contact: { phone: "private" } }, error: null });
    await expect(resolveFamilyDashboard(supabase as never)).rejects.toMatchObject({ code: "FAMILY_DASHBOARD_UNAVAILABLE" });
    rpc.mockResolvedValueOnce({ data: result, error: { code: "XX001" } });
    expect((await GET(request())).status).toBe(503);
  });

  it("accepts candidate labels at the existing database name boundary", async () => {
    const data = { ...result, introductions: [{ ...result.introductions[0], candidateNames: ["A".repeat(180)] }] };
    rpc.mockResolvedValueOnce({ data, error: null });
    await expect(resolveFamilyDashboard(supabase as never)).resolves.toEqual(data);
  });

  it("returns a private neutral denial for an unrelated account", async () => {
    rpc.mockResolvedValue({ data: { available: false }, error: null });
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ available: false });
  });

  it("rejects unknown and repeated parameters before reading data", async () => {
    expect((await GET(request("?candidateId=other"))).status).toBe(400);
    expect((await GET(request("?limit=25&limit=50"))).status).toBe(400);
    expect((await GET(request("?beforeCreatedAt=2026-11-01T12%3A00%3A00Z"))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires a live session and preserves private headers on errors", async () => {
    auth.mockResolvedValueOnce({ status: "missing_session" });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(rpc).not.toHaveBeenCalled();
    auth.mockRejectedValueOnce(new Error("private database detail"));
    const failed = await GET(request());
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private database detail");
  });

  it("retains the family read throttle without querying after refusal", async () => {
    rateLimit.mockResolvedValueOnce(NextResponse.json({ error: "Wait" }, { status: 429 }));
    const response = await GET(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(rpc).not.toHaveBeenCalled();
  });
});
