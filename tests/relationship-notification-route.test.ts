import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  process: vi.fn(),
  createClient: vi.fn(() => ({ kind: "service-role" })),
  logError: vi.fn(),
}));

vi.mock("@/features/notifications/server/relationship-notification.service", () => ({
  processRelationshipNotifications: mocks.process,
}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: mocks.createClient }));
vi.mock("@/lib/security/logging", () => ({
  getRequestId: () => "request-1",
  logServerError: mocks.logError,
}));

import { POST } from "../src/app/api/internal/relationship-notifications/route";

describe("relationship notification worker route", () => {
  const secret = "a-secure-worker-secret-with-32-characters";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTIFICATION_WORKER_SECRET = secret;
  });

  it("conceals the endpoint when the worker credential is missing or invalid", async () => {
    const missing = await POST(new Request("https://app.test/api/internal/relationship-notifications", { method: "POST" }));
    expect(missing.status).toBe(404);
    const invalid = await POST(new Request("https://app.test/api/internal/relationship-notifications", {
      method: "POST",
      headers: { authorization: "Bearer incorrect" },
    }));
    expect(invalid.status).toBe(404);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("processes due relationship notifications for an authorized scheduler", async () => {
    mocks.process.mockResolvedValue({ claimed: 2, sent: 2, failed: 0 });
    const response = await POST(new Request("https://app.test/api/internal/relationship-notifications", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ claimed: 2, sent: 2, failed: 0 });
    expect(mocks.process).toHaveBeenCalledWith({ kind: "service-role" });
  });

  it("returns a safe retryable failure without exposing server details", async () => {
    mocks.process.mockRejectedValue(new Error("provider credential leaked"));
    const response = await POST(new Request("https://app.test/api/internal/relationship-notifications", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get("x-request-id")).toBe("request-1");
    await expect(response.json()).resolves.toEqual({
      code: "NOTIFICATION_WORKER_FAILED",
      error: "Notification processing failed.",
    });
    expect(mocks.logError).toHaveBeenCalledWith(
      "relationship_notifications.process_failed",
      "request-1",
      expect.any(Error),
    );
  });
});
