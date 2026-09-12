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
const decision = {
  requestRef: `par_${"a".repeat(32)}`,
  decision: "approve",
  reviewNote: null,
  idempotencyKey: "pilot-review:00000001",
};

function post(body: unknown, origin = "http://local") {
  return new Request("http://local/api/admin/pilot-access", {
    method: "POST",
    headers: { Origin: origin, "Sec-Fetch-Site": origin === "http://local" ? "same-origin" : "cross-site", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("pilot access administration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue(actor);
    enforceRateLimit.mockResolvedValue(null);
    listPilotAccessRequests.mockResolvedValue([]);
    reviewPilotAccessRequest.mockResolvedValue({
      requestRef: decision.requestRef,
      status: "approved",
      submittedAt: "2026-09-12T12:00:00Z",
      reviewedAt: "2026-09-12T13:00:00Z",
    });
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

  it("rejects cross-site and malformed decisions", async () => {
    expect((await POST(post(decision, "https://attacker.test"))).status).toBe(403);
    expect((await POST(post({ ...decision, decision: "grant-everyone" }))).status).toBe(400);
    expect(reviewPilotAccessRequest).not.toHaveBeenCalled();
  });

  it("rate limits and applies a validated decision", async () => {
    const response = await POST(post(decision));
    expect(response.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith(actor.supabase, expect.any(Request), "pilot_access_review");
    expect(reviewPilotAccessRequest).toHaveBeenCalledWith(actor.supabase, decision);
  });

  it("returns a conflict for a stale state transition", async () => {
    reviewPilotAccessRequest.mockRejectedValueOnce(new PilotAccessServiceError("invalid_request", "22023"));
    expect((await POST(post(decision))).status).toBe(409);
  });
});
