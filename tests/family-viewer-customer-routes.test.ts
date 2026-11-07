import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const resolveRoster = vi.hoisted(() => vi.fn());
const createViewer = vi.hoisted(() => vi.fn());
const decideViewer = vi.hoisted(() => vi.fn());
const setPrimary = vi.hoisted(() => vi.fn());
const revokeViewer = vi.hoisted(() => vi.fn());
const acceptInvitation = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("@/features/family-viewers/server/family-viewer-email", () => ({
  sendFamilyViewerInvitationEmail: sendEmail,
}));
vi.mock("@/features/family-viewers/server/family-viewer.service", () => {
  class FamilyViewerError extends Error {
    constructor(message: string, readonly code: string, readonly status: number) { super(message); }
  }
  return {
    FamilyViewerError,
    resolveCandidateFamilyRoster: resolveRoster,
    createCandidateFamilyViewer: createViewer,
    decideCandidateFamilyViewerProposal: decideViewer,
    setCandidatePrimaryFamilyViewer: setPrimary,
    revokeCandidateFamilyViewer: revokeViewer,
    acceptFamilyViewerInvitation: acceptInvitation,
  };
});
vi.mock("@/lib/security/logging", () => ({ getRequestId: () => "request-id", logServerError: vi.fn() }));

import { GET as readRoster, POST as create } from "../src/app/api/v1/customer/family-viewers/route";
import { POST as decide } from "../src/app/api/v1/customer/family-viewers/[viewerRef]/decision/route";
import { POST as makePrimary } from "../src/app/api/v1/customer/family-viewers/[viewerRef]/primary/route";
import { DELETE as revoke } from "../src/app/api/v1/customer/family-viewers/[viewerRef]/route";
import { POST as exchange } from "../src/app/api/v1/family-invitations/exchange/route";
import { POST as accept } from "../src/app/api/v1/family-invitations/accept/route";
import { createFamilyInvitationCookie } from "@/features/family-viewers/server/family-viewer.cookie";

const origin = "http://local";
const viewerRef = `fvw_${"a".repeat(32)}`;
const invitationRef = `fvi_${"b".repeat(32)}`;
const actor = {
  status: "authenticated" as const,
  user: { id: "11111111-1111-4111-8111-111111111111", sessionId: "session" },
  supabase: {},
};
const context = { params: Promise.resolve({ viewerRef }) };

function request(path: string, method = "POST", body: object = {}) {
  return new Request(`${origin}${path}`, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

describe("Family Viewer customer and activation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue(actor);
    createClient.mockResolvedValue({});
    enforceRateLimit.mockResolvedValue(null);
    sendEmail.mockResolvedValue({ status: "sent" });
    resolveRoster.mockResolvedValue({ available: true, activeCount: 0, viewers: [] });
    createViewer.mockResolvedValue({
      available: true, viewerRef, invitationRef, status: "pending_verification",
      expiresAt: "2026-10-30T12:00:00.000Z", rowVersion: 1,
    });
    decideViewer.mockResolvedValue({
      available: true, viewerRef, invitationRef, status: "pending_verification",
      expiresAt: "2026-10-30T12:00:00.000Z", rowVersion: 2,
    });
    setPrimary.mockResolvedValue({ available: true, viewerRef, status: "active", role: "primary", rowVersion: 3 });
    revokeViewer.mockResolvedValue({ available: true, viewerRef, status: "revoked", rowVersion: 4 });
    acceptInvitation.mockResolvedValue({ available: true, viewerRef, status: "active", rowVersion: 3 });
  });

  it("reads the candidate-owned roster", async () => {
    const response = await readRoster(request("/api/v1/customer/family-viewers", "GET"));
    expect(response.status).toBe(200);
    expect(resolveRoster).toHaveBeenCalledWith(actor.supabase);
  });

  it("creates a private invitation after hashing identity and capability data", async () => {
    const response = await create(request("/api/v1/customer/family-viewers", "POST", {
      email: "Parent@Example.com", displayName: "Parent", relationshipKind: "parent",
      relationshipLabel: null, preferredLocale: null,
      idempotencyKey: "family-create:11111111-1111-4111-8111-111111111111",
    }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.invitationUrl).toMatch(/^http:\/\/local\/join\/family#token=[A-Za-z0-9_-]{43}$/);
    expect(createViewer).toHaveBeenCalledWith(actor.supabase, expect.objectContaining({
      emailHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      emailHint: "pa***@example.com",
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: "parent@example.com",
      invitationUrl: result.invitationUrl,
    }));
  });

  it("requires the candidate to re-enter the exact proposal email", async () => {
    const response = await decide(request(`/api/v1/customer/family-viewers/${viewerRef}/decision`, "POST", {
      decision: "approve", email: "parent@example.com",
      idempotencyKey: "family-decision:11111111-1111-4111-8111-111111111111",
    }), context);
    expect(response.status).toBe(200);
    expect(decideViewer).toHaveBeenCalledWith(actor.supabase, expect.objectContaining({
      viewerRef,
      decision: "approve",
      emailHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it("applies optimistic versions to primary and revoke commands", async () => {
    const version = { expectedVersion: 2, idempotencyKey: "family-version:1111111111111111" };
    expect((await makePrimary(request(`/api/v1/customer/family-viewers/${viewerRef}/primary`, "POST", version), context)).status).toBe(200);
    expect(setPrimary).toHaveBeenCalledWith(actor.supabase, expect.objectContaining({ expectedVersion: 2 }));
    expect((await revoke(request(`/api/v1/customer/family-viewers/${viewerRef}`, "DELETE", version), context)).status).toBe(200);
    expect(revokeViewer).toHaveBeenCalledWith(actor.supabase, expect.objectContaining({ expectedVersion: 2 }));
  });

  it("exchanges the fragment for a scoped cookie, resumes from it, and consumes it only on guarded acceptance", async () => {
    const token = "a".repeat(43);
    const exchanged = await exchange(request("/api/v1/family-invitations/exchange", "POST", { token }));
    expect(exchanged.status).toBe(200);
    await expect(exchanged.json()).resolves.toEqual({ ready: true });
    expect(exchanged.headers.get("set-cookie")).toContain("vivintro_family_invitation=");
    const cookie = createFamilyInvitationCookie(token);
    const resumed = await exchange(new Request(`${origin}/api/v1/family-invitations/exchange`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: `${cookie.name}=${cookie.value}`,
      },
      body: JSON.stringify({}),
    }));
    await expect(resumed.json()).resolves.toEqual({ ready: true });
    const accepted = await accept(new Request(`${origin}/api/v1/family-invitations/accept`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", Cookie: `${cookie.name}=${cookie.value}` },
      body: JSON.stringify({ idempotencyKey: "family-accept:1111111111111111" }),
    }));
    expect(accepted.status).toBe(200);
    expect(acceptInvitation).toHaveBeenCalledWith(
      actor.supabase,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      "family-accept:1111111111111111"
    );
    expect(accepted.headers.get("set-cookie")).toContain("vivintro_family_invitation=;");
  });

  it("does not advance a direct or malformed invitation visit", async () => {
    const direct = await exchange(request("/api/v1/family-invitations/exchange", "POST", {}));
    expect(direct.status).toBe(200);
    await expect(direct.json()).resolves.toEqual({ ready: false });

    const malformed = await exchange(request("/api/v1/family-invitations/exchange", "POST", { token: "short" }));
    expect(malformed.status).toBe(200);
    await expect(malformed.json()).resolves.toEqual({ ready: false });
    expect(malformed.headers.get("set-cookie")).toBeNull();
  });

  it("fails closed for unauthorized, cross-origin, invalid and unavailable requests", async () => {
    const crossOrigin = request("/api/v1/customer/family-viewers", "POST", {});
    crossOrigin.headers.set("Origin", "https://attacker.example");
    expect((await create(crossOrigin)).status).toBe(403);
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await readRoster(request("/api/v1/customer/family-viewers", "GET"))).status).toBe(401);
    expect((await decide(request(`/api/v1/customer/family-viewers/${viewerRef}/decision`, "POST", {
      decision: "approve", idempotencyKey: "family-decision:1111111111111111",
    }), context)).status).toBe(400);
    createViewer.mockResolvedValueOnce({ available: false });
    expect((await create(request("/api/v1/customer/family-viewers", "POST", {
      email: "parent@example.com", displayName: "Parent", relationshipKind: "parent",
      idempotencyKey: "family-create:1111111111111111",
    }))).status).toBe(403);
  });
});
