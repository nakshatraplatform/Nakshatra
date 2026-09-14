import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const listPilotAccessRequests = vi.hoisted(() => vi.fn());
const reviewPilotAccessRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("@/features/pilot-access/server/pilot-access.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/pilot-access/server/pilot-access.service")>();
  return { ...actual, listPilotAccessRequests, reviewPilotAccessRequest };
});

import { GET, POST } from "../src/app/api/admin/pilot-access/route";
import { PilotAccessServiceError } from "../src/features/pilot-access/server/pilot-access.service";

const actor = { status: "authenticated", user: { id: "admin", sessionId: "session" }, supabase: {} };
describe("pilot access administration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue(actor);
    enforceRateLimit.mockResolvedValue(null);
    listPilotAccessRequests.mockResolvedValue([]);
  });

  it("lists only a validated status filter", async () => {
    expect((await GET(new Request("http://local/api/admin/pilot-access?status=all"))).status).toBe(200);
    expect(listPilotAccessRequests).toHaveBeenCalledWith(actor.supabase, "all");
    expect((await GET(new Request("http://local/api/admin/pilot-access?status=secret"))).status).toBe(400);
  });

  it("requires authentication and database administrator authorization", async () => {
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await GET(new Request("http://local/api/admin/pilot-access"))).status).toBe(401);
    listPilotAccessRequests.mockRejectedValueOnce(new PilotAccessServiceError("unavailable", "42501"));
    expect((await GET(new Request("http://local/api/admin/pilot-access"))).status).toBe(403);
  });

  it("keeps the waitlist API read-only", async () => {
    const response = await POST();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(reviewPilotAccessRequest).not.toHaveBeenCalled();
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });
});
