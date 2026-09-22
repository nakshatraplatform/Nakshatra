import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const manageConsent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("@/features/broker-relationships/server/customer-invitation.service", async (original) => {
  const actual = await original<typeof import("@/features/broker-relationships/server/customer-invitation.service")>();
  return { ...actual, manageCustomerBrokerConsent: manageConsent };
});

import { POST } from "../src/app/api/v1/customer/brokers/[relationshipRef]/consent/route";

const origin = "https://vivintro.test";
const relationshipRef = `bcr_${"a".repeat(32)}`;
const context = { params: Promise.resolve({ relationshipRef }) };
const request = (body: object, suppliedOrigin = origin) => new Request(
  `${origin}/api/v1/customer/brokers/${relationshipRef}/consent`,
  { method: "POST", headers: { Origin: suppliedOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body) }
);

describe("customer broker consent route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ status: "authenticated", supabase: {} });
    enforceRateLimit.mockResolvedValue(null);
    manageConsent.mockResolvedValue({
      available: true, relationshipRef, relationshipStatus: "paused",
      endsAt: "2027-09-10T00:00:00Z",
    });
  });

  it("accepts a same-origin, authenticated, idempotent command", async () => {
    const response = await POST(request({
      action: "pause", idempotencyKey: "broker-consent:1111111111111111",
    }), context);
    expect(response.status).toBe(200);
    expect(manageConsent).toHaveBeenCalledWith({}, {
      relationshipRef, action: "pause", idempotencyKey: "broker-consent:1111111111111111",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("fails closed for cross-site, invalid, unauthenticated, and unknown relationships", async () => {
    expect((await POST(request({ action: "pause", idempotencyKey: "broker-consent:1111111111111111" }, "https://attacker.test"), context)).status).toBe(403);
    expect((await POST(request({ action: "delete" }), context)).status).toBe(400);
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await POST(request({ action: "pause", idempotencyKey: "broker-consent:1111111111111111" }), context)).status).toBe(401);
    manageConsent.mockResolvedValueOnce({ available: false });
    expect((await POST(request({ action: "pause", idempotencyKey: "broker-consent:1111111111111111" }), context)).status).toBe(404);
  });
});
