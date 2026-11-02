import { afterEach, describe, expect, it, vi } from "vitest";
import { manageAccessGrantRequest } from "../src/features/access/client/access-dashboard.api";

const grantId = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("access dashboard API", () => {
  it("returns a normalized successful grant action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "revoked",
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(manageAccessGrantRequest(grantId, "revoke")).resolves.toEqual({
      ok: true,
      status: "revoked",
      expiresAt: undefined,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/access-grants/${grantId}`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "revoke" }) })
    );
  });

  it("preserves safe API errors for the dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "ACCESS_INVALID_TRANSITION",
      error: "This access can no longer be changed.",
    }), { status: 409 })));

    await expect(manageAccessGrantRequest(grantId, "revoke")).resolves.toEqual({
      ok: false,
      code: "ACCESS_INVALID_TRANSITION",
      error: "This access can no longer be changed.",
      status: 409,
    });
  });

  it("returns an actionable message when the network is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(manageAccessGrantRequest(grantId, "revoke")).resolves.toMatchObject({
      ok: false,
      code: "NETWORK_UNAVAILABLE",
      status: 0,
    });
  });

  it("uses neutral defaults when a failed response is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 503 })));
    await expect(manageAccessGrantRequest("grant/encoded", "revoke")).resolves.toEqual({
      ok: false,
      code: "ACCESS_REQUEST_FAILED",
      error: "This access change could not be saved.",
      status: 503,
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/access-grants/grant%2Fencoded",
      expect.objectContaining({ body: JSON.stringify({ action: "revoke" }) })
    );
  });
});
