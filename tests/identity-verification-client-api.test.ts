import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createIdentityVerificationInvitationRequest,
  getIdentityVerificationLinkRequest,
  retryIdentityVerificationRequest,
  startInvitationIdentityVerificationRequest,
  startSelfIdentityVerificationRequest,
  withdrawIdentityVerificationConsentRequest,
  navigateToDiditVerification,
} from "@/features/identity-verification/client/identity-verification.api";

describe("identity verification client API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses JSON bodies instead of URLs for bearer-token API calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ link: { kind: "invitation", status: "ready" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getIdentityVerificationLinkRequest("token")).resolves.toEqual({ ok: true, data: { link: { kind: "invitation", status: "ready" } } });
    expect(fetchMock).toHaveBeenCalledWith("/api/identity-verification/status", expect.objectContaining({ method: "POST", body: JSON.stringify({ token: "token" }) }));
  });

  it("starts both authorized flows, creates invitations, retries, and withdraws with narrowly scoped routes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://verify.didit.test/session", managementUrl: "https://nakshatra.test/verify/manage" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://verify.didit.test/self", managementUrl: "https://nakshatra.test/verify/self" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ invitationUrl: "https://nakshatra.test/verify/invite", expiresAt: "2026-09-01T00:00:00.000Z" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://verify.didit.test/retry", managementUrl: "https://nakshatra.test/verify/retry" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ withdrawn: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(startInvitationIdentityVerificationRequest("token")).resolves.toMatchObject({ ok: true });
    await expect(startSelfIdentityVerificationRequest("candidate-id")).resolves.toMatchObject({ ok: true });
    await expect(createIdentityVerificationInvitationRequest("candidate-id")).resolves.toMatchObject({ ok: true });
    await expect(retryIdentityVerificationRequest("token")).resolves.toMatchObject({ ok: true });
    await expect(withdrawIdentityVerificationConsentRequest("token")).resolves.toEqual({ ok: true, data: { withdrawn: true } });
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/identity-verification/start", "POST"],
      ["/api/identity-verification/start", "POST"],
      ["/api/identity-verification/invitations", "POST"],
      ["/api/identity-verification/retry", "POST"],
      ["/api/identity-verification/status", "DELETE"],
    ]);
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ authorization: "self", candidateId: "candidate-id", consent: true, consentVersion: "2026-10-05-liveness-only" }));
    expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ candidateId: "candidate-id" }));
  });

  it("maps server and network errors to stable frontend failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "IDENTITY_VERIFICATION_LINK_INVALID", error: "Unavailable", managementUrl: "https://nakshatra.test/verify/private" }), { status: 400 })));
    await expect(getIdentityVerificationLinkRequest("token")).resolves.toEqual({ ok: false, code: "IDENTITY_VERIFICATION_LINK_INVALID", message: "Unavailable", status: 400, managementUrl: "https://nakshatra.test/verify/private" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(getIdentityVerificationLinkRequest("token")).resolves.toMatchObject({ ok: false, code: "NETWORK_UNAVAILABLE", status: 0 });
  });

  it("shows a validated request reference without trusting arbitrary header text", async () => {
    const reference = "11111111-1111-4111-8111-111111111111";
    for (const value of [reference, "unexpected private upstream text"]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Try recovery" }, { status: 503, headers: { "X-Request-Id": value } })));
      const result = await startSelfIdentityVerificationRequest("candidate");
      expect(result).toMatchObject({ ok: false, message: value === reference ? `Try recovery Reference: ${reference}.` : "Try recovery" });
    }
  });
  it("navigates only to a credential-free trusted HTTPS hosted URL", () => {
    const assign = vi.fn(); vi.stubGlobal("window", { location: { assign } });
    navigateToDiditVerification("https://verify.didit.me/session/fixture");
    expect(assign).toHaveBeenCalledTimes(1);
    const credentialUrl = new URL("https://verify.didit.me/session/fixture"); credentialUrl.username = "synthetic";
    for (const value of ["https://evil.test", "http://verify.didit.me/session", "invalid", credentialUrl.href]) navigateToDiditVerification(value);
    expect(assign).toHaveBeenCalledTimes(1);
    assign.mockImplementation(() => { throw new Error("navigation blocked"); });
    expect(() => navigateToDiditVerification("https://verify.didit.me/session/fixture")).not.toThrow();
  });
});
