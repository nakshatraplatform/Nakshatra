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
import { CustomerInvitationError } from "@/features/broker-relationships/server/customer-invitation.service";

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

  it("returns safe responses for malformed input and service failures", async () => {
    const malformed = new Request(
      `${origin}/api/v1/customer/brokers/${relationshipRef}/consent`,
      { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{" }
    );
    expect((await POST(malformed, context)).status).toBe(400);

    manageConsent.mockRejectedValueOnce(new CustomerInvitationError(
      "Check the action and try again.", "CUSTOMER_BROKER_ACTION_INVALID", 400
    ));
    const invalidAction = await POST(request({
      action: "pause", idempotencyKey: "broker-consent:1111111111111111",
    }), context);
    expect(invalidAction.status).toBe(400);
    await expect(invalidAction.json()).resolves.toEqual({
      available: false, error: "Check the action and try again.",
    });

    manageConsent.mockRejectedValueOnce(new Error("database details must remain private"));
    const unavailable = await POST(request({
      action: "pause", idempotencyKey: "broker-consent:1111111111111111",
    }), context);
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({
      available: false, error: "The broker access change could not be saved.",
    });
    expect(unavailable.headers.get("x-request-id")).toBeTruthy();
  });
});
