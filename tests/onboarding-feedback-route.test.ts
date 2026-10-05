import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const getOwnOnboardingFeedback = vi.hoisted(() => vi.fn());
const submitOnboardingFeedback = vi.hoisted(() => vi.fn());
const listOnboardingFeedback = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("@/features/feedback/server/onboarding-feedback.service", async () => {
  const actual = await vi.importActual<typeof import("../src/features/feedback/server/onboarding-feedback.service")>("../src/features/feedback/server/onboarding-feedback.service");
  return { ...actual, getOwnOnboardingFeedback, submitOnboardingFeedback, listOnboardingFeedback };
});

import { GET as ownerGet, POST as ownerPost } from "../src/app/api/portfolio/onboarding-feedback/route";
import { GET as adminGet } from "../src/app/api/admin/onboarding-feedback/route";

const submitRequest = (body: unknown, origin = "http://local") => new Request("http://local/api/portfolio/onboarding-feedback", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
});

describe("private creator onboarding feedback routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ status: "authenticated", supabase: {}, user: { id: "owner" } });
    enforceRateLimit.mockResolvedValue(null);
    getOwnOnboardingFeedback.mockResolvedValue(null);
    submitOnboardingFeedback.mockResolvedValue(undefined);
    listOnboardingFeedback.mockResolvedValue([]);
  });

  it("returns only the signed-in owner's feedback", async () => {
    expect((await ownerGet()).status).toBe(200);
    expect(getOwnOnboardingFeedback).toHaveBeenCalledWith({});
  });

  it("rejects cross-origin and invalid input without persistence", async () => {
    expect((await ownerPost(submitRequest({ easeRating: 5, hardestStep: "none" }, "https://other.test"))).status).toBe(403);
    expect((await ownerPost(submitRequest({ easeRating: 6, hardestStep: "none" }))).status).toBe(400);
    expect((await ownerPost(submitRequest({ easeRating: 4, hardestStep: "none", comment: "x".repeat(1001) }))).status).toBe(400);
    expect(submitOnboardingFeedback).not.toHaveBeenCalled();
  });

  it("submits only bounded answers after authentication and a quota check", async () => {
    const response = await ownerPost(submitRequest({ easeRating: 4, hardestStep: "details", comment: "Hard to choose." }));
    expect(response.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith({}, expect.any(Request), "dashboard_save");
    expect(submitOnboardingFeedback).toHaveBeenCalledWith({}, { easeRating: 4, hardestStep: "details", comment: "Hard to choose." });
  });

  it("surfaces a database-completeness refusal without saving", async () => {
    submitOnboardingFeedback.mockRejectedValueOnce({ code: "42501" });
    const response = await ownerPost(submitRequest({ easeRating: 2, hardestStep: "photos" }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "PORTFOLIO_INCOMPLETE" });
  });

  it("requires the database administrator check for feedback review", async () => {
    listOnboardingFeedback.mockRejectedValueOnce({ code: "42501" });
    expect((await adminGet()).status).toBe(403);
    expect((await adminGet()).status).toBe(200);
  });
});
