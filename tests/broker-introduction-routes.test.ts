import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const createIntroduction = vi.hoisted(() => vi.fn());
const listIntroductions = vi.hoisted(() => vi.fn());
const markShared = vi.hoisted(() => vi.fn());
const revoke = vi.hoisted(() => vi.fn());
const listNotices = vi.hoisted(() => vi.fn());
const flagNotice = vi.hoisted(() => vi.fn());
const claim = vi.hoisted(() => vi.fn());
const resolve = vi.hoisted(() => vi.fn());
const respond = vi.hoisted(() => vi.fn());
const dashboard = vi.hoisted(() => vi.fn());
const reviewed = vi.hoisted(() => vi.fn());
const acknowledged = vi.hoisted(() => vi.fn());
const readCookie = vi.hoisted(() => vi.fn((value?: string, ref?: string): string | null => {
  void value; void ref;
  return "s".repeat(43);
}));

vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("@/features/account/server/reauth-cookie", () => ({ readRequestCookie: vi.fn(() => "signed-cookie") }));
vi.mock("@/features/broker-introductions/server/broker-introduction.cookie", () => ({
  brokerIntroductionCookieName: vi.fn((ref: string) => `vivintro_broker_introduction_${ref}`),
  readBrokerIntroductionCookie: readCookie,
  createBrokerIntroductionCookie: vi.fn((ref: string) => ({ name: `vivintro_broker_introduction_${ref}`, value: "signed", httpOnly: true, path: "/", sameSite: "lax", maxAge: 60 })),
}));
vi.mock("@/features/broker-introductions/server/broker-introduction.service", () => {
  class BrokerIntroductionError extends Error {
    constructor(message = "unavailable", readonly code = "BROKER_INTRODUCTION_UNAVAILABLE", readonly status = 403) { super(message); }
  }
  return {
    BrokerIntroductionError,
    createBrokerIntroduction: createIntroduction,
    listBrokerIntroductions: listIntroductions,
    markBrokerIntroductionShared: markShared,
    revokeBrokerIntroduction: revoke,
    listBrokerPortfolioNotices: listNotices,
    flagBrokerPortfolioUpdate: flagNotice,
    claimBrokerIntroductionPass: claim,
    resolveBrokerIntroduction: resolve,
    respondToBrokerIntroduction: respond,
    resolveBrokerdeskDashboard: dashboard,
    markBrokerIntroductionResponseReviewed: reviewed,
    acknowledgeBrokerPortfolioUpdate: acknowledged,
  };
});

import { GET as list, POST as create } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/introductions/route";
import { POST as share } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/introductions/[introductionRef]/shared/route";
import { DELETE as remove } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/introductions/[introductionRef]/route";
import { GET as notices } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/portfolio-updates/route";
import { POST as clarification } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/portfolio-updates/[noticeRef]/clarification/route";
import { POST as exchange } from "../src/app/api/v1/introductions/[introductionRef]/exchange/route";
import { GET as publicRead } from "../src/app/api/v1/introductions/[introductionRef]/route";
import { POST as response } from "../src/app/api/v1/introductions/[introductionRef]/response/route";
import { GET as workspaceDashboard } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/dashboard/route";
import { POST as reviewResponse } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/introductions/[introductionRef]/reviewed/route";
import { POST as acknowledgeNotice } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/portfolio-updates/[noticeRef]/acknowledge/route";

const origin = "http://localhost:3000";
const workspaceRef = `wrk_${"a".repeat(32)}`;
const relationshipRef = `bcr_${"b".repeat(32)}`;
const recipientRelationshipRef = `bcr_${"e".repeat(32)}`;
const introductionRef = `bir_${"c".repeat(32)}`;
const noticeRef = `bpn_${"d".repeat(32)}`;
const actor = { status: "authenticated" as const, user: { id: "11111111-1111-4111-8111-111111111111" }, supabase: { kind: "actor" } };
const context = { params: Promise.resolve({ workspaceRef, introductionRef, noticeRef }) };
function mutation(path: string, body: object, method = "POST") {
  return new Request(`${origin}${path}`, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("broker introduction routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue(actor);
    createClient.mockResolvedValue({ kind: "public" });
    enforceRateLimit.mockResolvedValue(null);
    createIntroduction.mockResolvedValue({ status: "created", introductionRef, sourceName: "Arun", recipientLabel: "Priya", recipientEmailHint: null, expiresAt: "2026-10-01T00:00:00Z", versionNumber: 1, rowVersion: 1 });
    listIntroductions.mockResolvedValue({ available: true, introductions: [] });
    markShared.mockResolvedValue({ available: true, status: "shared", rowVersion: 2 });
    revoke.mockResolvedValue({ available: true, status: "revoked", rowVersion: 3 });
    listNotices.mockResolvedValue({ available: true, notices: [] });
    flagNotice.mockResolvedValue({ available: true, status: "clarification" });
    claim.mockResolvedValue({ available: true, expiresAt: "2026-10-01T00:00:00Z" });
    resolve.mockResolvedValue({ available: false });
    respond.mockResolvedValue({ available: true, status: "responded", response: "accepted", disclosureLevel: "broker_standard", completeAccessExpiresAt: null });
    dashboard.mockResolvedValue({ available: true, workspaceRef, workspaceName: "Agency", metrics: { activeCustomers: 1, openIntroductions: 1, responsesAwaitingReview: 1, portfolioUpdates: 0 }, actions: [] });
    reviewed.mockResolvedValue({ available: true, status: "reviewed" });
    acknowledged.mockResolvedValue({ available: true, status: "acknowledged" });
  });

  it("creates an opaque identity-bound URL and lists one broker relationship", async () => {
    const request = mutation(`/api/v1/brokerdesk/workspaces/${workspaceRef}/introductions`, {
      relationshipRef, recipientRelationshipRef,
      idempotencyKey: "broker-introduction:1111111111111111",
    });
    const created = await create(request, context);
    expect(created.status).toBe(201);
    expect((await created.json()).introductionUrl).toMatch(new RegExp(`/introductions/${introductionRef}$`));
    expect(createIntroduction).toHaveBeenCalledWith(actor.supabase, expect.objectContaining({
      workspaceRef, relationshipRef, recipientRelationshipRef,
    }));
    const listed = await list(new Request(`${origin}/api?relationshipRef=${relationshipRef}`), context);
    expect(listed.status).toBe(200);
    expect(listIntroductions).toHaveBeenCalledWith(actor.supabase, workspaceRef, relationshipRef);
  });

  it("executes share, revoke, notice, and clarification commands", async () => {
    expect((await share(mutation("/shared", { expectedVersion: 1 }), context)).status).toBe(200);
    expect(markShared).toHaveBeenCalledWith(actor.supabase, workspaceRef, introductionRef, 1);
    expect((await remove(mutation("/introduction", { expectedVersion: 2 }, "DELETE"), context)).status).toBe(200);
    expect(revoke).toHaveBeenCalledWith(actor.supabase, workspaceRef, introductionRef, 2);
    expect((await notices(new Request(`${origin}/updates?relationshipRef=${relationshipRef}`), context)).status).toBe(200);
    expect((await clarification(mutation("/clarification", { relationshipRef }), context)).status).toBe(200);
    expect(flagNotice).toHaveBeenCalledWith(actor.supabase, workspaceRef, relationshipRef, noticeRef);
  });

  it("loads the workspace queue and completes response and update follow-ups", async () => {
    const loaded = await workspaceDashboard(new Request(`${origin}/dashboard`), context);
    expect(loaded.status).toBe(200);
    expect(dashboard).toHaveBeenCalledWith(actor.supabase, workspaceRef);
    expect((await reviewResponse(mutation("/reviewed", {}), context)).status).toBe(200);
    expect(reviewed).toHaveBeenCalledWith(actor.supabase, workspaceRef, introductionRef);
    expect((await acknowledgeNotice(mutation("/acknowledge", { relationshipRef }), context)).status).toBe(200);
    expect(acknowledged).toHaveBeenCalledWith(actor.supabase, workspaceRef, relationshipRef, noticeRef);
  });

  it("retires bearer-pass exchange and authorizes reads and responses through the live user session", async () => {
    const pass = "p".repeat(43);
    const exchanged = await exchange(mutation("/exchange", { pass }), context);
    expect(exchanged.status).toBe(410);
    expect(exchanged.headers.get("set-cookie")).toBeNull();
    expect(claim).not.toHaveBeenCalled();
    const viewed = await publicRead(new Request(`${origin}/introduction`, { headers: { Cookie: "x=y" } }), context);
    expect(viewed.status).toBe(404);
    expect(resolve).toHaveBeenCalledWith(actor.supabase, introductionRef);
    const answered = await response(mutation("/response", { response: "accepted", comment: "Proceed", confirmCompleteAccess: true }), context);
    expect(answered.status).toBe(200);
    expect(respond).toHaveBeenCalledWith(actor.supabase, introductionRef, "accepted", "Proceed", true);
  });

  it("rejects malformed and cross-origin mutations without touching services", async () => {
    expect((await create(mutation("/create", { relationshipRef, recipientRelationshipRef: "bad" }), context)).status).toBe(400);
    expect((await share(mutation("/shared", { expectedVersion: 0 }), context)).status).toBe(400);
    expect((await response(mutation("/response", { response: "maybe" }), context)).status).toBe(400);
    expect((await response(mutation("/response", { response: "accepted", confirmCompleteAccess: false }), context)).status).toBe(400);
    const hostile = new Request(`${origin}/exchange`, { method: "POST", headers: { Origin: "https://attacker.example", "Content-Type": "application/json" }, body: JSON.stringify({ pass: "p".repeat(43) }) });
    expect((await exchange(hostile, context)).status).toBe(410);
  });

  it("fails closed for missing authentication, throttling, bad references, and dependencies", async () => {
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await list(new Request(`${origin}/api?relationshipRef=${relationshipRef}`), context)).status).toBe(401);
    enforceRateLimit.mockResolvedValueOnce(new Response(null, { status: 429 }));
    expect((await publicRead(new Request(`${origin}/introduction`), context)).status).toBe(429);
    const bad = { params: Promise.resolve({ introductionRef: "bad", workspaceRef, noticeRef }) };
    expect((await publicRead(new Request(`${origin}/bad`), bad)).status).toBe(404);
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await response(mutation("/response", { response: "declined", comment: "" }), context)).status).toBe(401);
    listNotices.mockRejectedValueOnce(new Error("database details"));
    expect((await notices(new Request(`${origin}/updates?relationshipRef=${relationshipRef}`), context)).status).toBe(404);
  });
});
