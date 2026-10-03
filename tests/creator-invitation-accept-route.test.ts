import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const acceptCreatorInvitation = vi.hoisted(() => vi.fn());
const ensureOwnerPortfolio = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", async () => {
  const actual = await vi.importActual<typeof import("../src/features/security/server/rate-limit.service")>("../src/features/security/server/rate-limit.service");
  return { ...actual, consumeRateLimit };
});
vi.mock("@/features/pilot-access/server/creator-invitations.service", () => ({ acceptCreatorInvitation }));
vi.mock("@/features/auth/server/portfolio-bootstrap", () => ({ ensureOwnerPortfolio }));

import { POST } from "../src/app/api/pilot-invitations/accept/route";

function request(token = "A".repeat(43), origin = "http://local") {
  return new Request("http://local/api/pilot-invitations/accept", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

describe("creator invitation acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ status: "authenticated", user: { id: "candidate" }, supabase: {} });
    consumeRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
    acceptCreatorInvitation.mockResolvedValue({ status: "accepted" });
    ensureOwnerPortfolio.mockResolvedValue("portfolio-id");
  });

  it("requires a live signed-in session and same-origin request", async () => {
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("A".repeat(43), "https://evil.example"))).status).toBe(403);
    expect(acceptCreatorInvitation).not.toHaveBeenCalled();
  });

  it("accepts a valid invitation before creating the private draft", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(acceptCreatorInvitation).toHaveBeenCalledWith({}, "A".repeat(43));
    expect(ensureOwnerPortfolio).toHaveBeenCalledWith({}, "candidate");
    expect(acceptCreatorInvitation.mock.invocationCallOrder[0]).toBeLessThan(ensureOwnerPortfolio.mock.invocationCallOrder[0]);
  });

  it("does not create a draft when the verified email does not match or the invite expired", async () => {
    acceptCreatorInvitation.mockRejectedValueOnce({ code: "42501" });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(ensureOwnerPortfolio).not.toHaveBeenCalled();
  });
});
