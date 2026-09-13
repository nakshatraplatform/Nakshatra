import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const updatePublicationProgress = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("@/features/portfolio/server/publication-readiness.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/portfolio/server/publication-readiness.service")>();
  return { ...actual, updatePublicationProgress };
});

import { PUT } from "@/app/api/portfolio/onboarding/route";
import { PublicationProgressError } from "@/features/portfolio/server/publication-readiness.service";

function request(body: unknown, origin = "http://local") {
  return new Request("http://local/api/portfolio/onboarding", {
    method: "PUT",
    headers: {
      Origin: origin,
      "Sec-Fetch-Site": origin === "http://local" ? "same-origin" : "cross-site",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("publication onboarding route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ status: "authenticated", user: { id: "owner" }, supabase: {} });
    enforceRateLimit.mockResolvedValue(null);
    updatePublicationProgress.mockResolvedValue({ portfolioExists: true });
  });

  it("rejects cross-site and malformed transitions before mutation", async () => {
    expect((await PUT(request({ action: "previewed" }, "https://attacker.test"))).status).toBe(403);
    expect((await PUT(request({ action: "pay_me", value: "paid" }))).status).toBe(400);
    expect(updatePublicationProgress).not.toHaveBeenCalled();
  });

  it("requires authentication, rate limits, and persists a validated transition", async () => {
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await PUT(request({ action: "previewed" }))).status).toBe(401);

    getApiUser.mockResolvedValue({ status: "authenticated", user: { id: "owner" }, supabase: {} });
    const response = await PUT(request({ action: "editor_section", value: "family" }));
    expect(response.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith({}, expect.any(Request), "dashboard_save");
    expect(updatePublicationProgress).toHaveBeenCalledWith({}, { action: "editor_section", value: "family" });
  });

  it("returns a stable domain error for an invalid state transition", async () => {
    updatePublicationProgress.mockRejectedValue(new PublicationProgressError(
      "An active paid plan is required before confirming disclosure.",
      "PAYMENT_REQUIRED",
      409
    ));
    const response = await PUT(request({
      action: "confirm_disclosure",
      value: "publication-disclosure-v1",
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "PAYMENT_REQUIRED" });
  });
});
