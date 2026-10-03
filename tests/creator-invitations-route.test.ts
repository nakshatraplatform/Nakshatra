import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const listCreatorInvitations = vi.hoisted(() => vi.fn());
const manageCreatorInvitation = vi.hoisted(() => vi.fn());
const sendResendEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", async () => {
  const actual = await vi.importActual<typeof import("../src/features/security/server/rate-limit.service")>("../src/features/security/server/rate-limit.service");
  return { ...actual, consumeRateLimit };
});
vi.mock("@/features/pilot-access/server/creator-invitations.service", async () => {
  const actual = await vi.importActual<typeof import("../src/features/pilot-access/server/creator-invitations.service")>("../src/features/pilot-access/server/creator-invitations.service");
  return { ...actual, listCreatorInvitations, manageCreatorInvitation };
});
vi.mock("@/features/notifications/server/resend.provider", () => ({ sendResendEmail }));

import { GET, POST } from "../src/app/api/admin/creator-invitations/route";

function request(body: unknown, origin = "http://local") {
  return new Request("http://local/api/admin/creator-invitations", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin creator invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue({ status: "authenticated", supabase: {}, user: { id: "admin" } });
    consumeRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
    listCreatorInvitations.mockResolvedValue([]);
    manageCreatorInvitation.mockResolvedValue({ status: "invited" });
    sendResendEmail.mockResolvedValue({ status: "accepted", providerMessageId: "mail-id" });
  });

  it("lists invitations through the administrator-checked database function", async () => {
    expect((await GET(new Request("http://local/api/admin/creator-invitations"))).status).toBe(200);
    expect(listCreatorInvitations).toHaveBeenCalledWith({});
  });

  it("protects invitation listing when the session or admin check fails", async () => {
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await GET(new Request("http://local/api/admin/creator-invitations"))).status).toBe(401);
    listCreatorInvitations.mockRejectedValueOnce({ code: "42501" });
    expect((await GET(new Request("http://local/api/admin/creator-invitations"))).status).toBe(403);
    listCreatorInvitations.mockRejectedValueOnce(new Error("database offline"));
    expect((await GET(new Request("http://local/api/admin/creator-invitations"))).status).toBe(503);
  });

  it("rejects unauthenticated and cross-origin invitation requests", async () => {
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await POST(request({ email: "person@gmail.com", action: "grant" }))).status).toBe(401);
    expect((await POST(request({ email: "person@gmail.com", action: "grant" }, "https://evil.example"))).status).toBe(403);
    expect(manageCreatorInvitation).not.toHaveBeenCalled();
    expect(sendResendEmail).not.toHaveBeenCalled();
  });

  it("grants an exact email and sends a signup link without PII in the URL", async () => {
    const response = await POST(request({ email: "PERSON@gmail.com", action: "grant" }));
    expect(response.status).toBe(200);
    expect(manageCreatorInvitation).toHaveBeenCalledWith({}, "person@gmail.com", "grant", expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(sendResendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "person@gmail.com",
      text: expect.stringContaining("/invite/"),
    }));
    const message = sendResendEmail.mock.calls[0][0].text as string;
    expect(message).not.toMatch(/[?&]email=/);
  });

  it("does not send an invitation when the database denies administrator privilege", async () => {
    manageCreatorInvitation.mockRejectedValueOnce({ code: "42501" });
    const response = await POST(request({ email: "person@gmail.com", action: "grant" }));
    expect(response.status).toBe(403);
    expect(sendResendEmail).not.toHaveBeenCalled();
  });

  it("revokes access without sending another email", async () => {
    manageCreatorInvitation.mockResolvedValueOnce({ status: "revoked" });
    const response = await POST(request({ email: "person@gmail.com", action: "revoke" }));
    expect(response.status).toBe(200);
    expect(sendResendEmail).not.toHaveBeenCalled();
  });

  it("rejects malformed commands and rate-limited administrators", async () => {
    expect((await POST(request({ email: "bad", action: "grant" }))).status).toBe(400);
    expect(manageCreatorInvitation).not.toHaveBeenCalled();
    consumeRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 45 });
    expect((await POST(request({ email: "person@gmail.com", action: "grant" }))).status).toBe(429);
    expect(manageCreatorInvitation).not.toHaveBeenCalled();
  });

  it("returns a private recovery link if email delivery fails", async () => {
    sendResendEmail.mockResolvedValueOnce({ status: "failed" });
    const response = await POST(request({ email: "person@gmail.com", action: "grant" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.delivery).toBe("failed");
    expect(body.invitationUrl).toMatch(/^http:\/\/local\/invite\/[A-Za-z0-9_-]{43}$/);
    expect(body.invitationUrl).not.toContain("person@gmail.com");
  });

  it("reports temporary administrator database failures without sending", async () => {
    manageCreatorInvitation.mockRejectedValueOnce(new Error("database offline"));
    expect((await POST(request({ email: "person@gmail.com", action: "grant" }))).status).toBe(503);
    expect(sendResendEmail).not.toHaveBeenCalled();
  });
});
