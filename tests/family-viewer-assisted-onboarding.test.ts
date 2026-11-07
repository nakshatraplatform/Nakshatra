import { beforeEach, describe, expect, it, vi } from "vitest";
import { proposeFamilyViewerCommandSchema } from "@/features/family-viewers/server/family-viewer.contract";

const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const resolveSetup = vi.hoisted(() => vi.fn());
const proposeViewer = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("@/features/family-viewers/server/family-viewer.service", () => {
  class FamilyViewerError extends Error {
    constructor(message: string, readonly code: string, readonly status: number) {
      super(message);
    }
  }
  return {
    FamilyViewerError,
    resolveBrokerdeskFamilySetup: resolveSetup,
    proposeFamilyViewer: proposeViewer,
  };
});
vi.mock("@/lib/security/logging", () => ({
  getRequestId: () => "request-id",
  logServerError: vi.fn(),
}));

import { GET as readSetup } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/customers/[relationshipRef]/family-viewers/route";
import { POST as propose } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/customers/[relationshipRef]/family-proposals/route";

const origin = "http://local";
const workspaceRef = `wrk_${"a".repeat(32)}`;
const relationshipRef = `bcr_${"b".repeat(32)}`;
const context = { params: Promise.resolve({ workspaceRef, relationshipRef }) };
const actor = {
  status: "authenticated" as const,
  user: { id: "11111111-1111-4111-8111-111111111111", sessionId: "session" },
  supabase: {},
};

function proposalRequest(extra: object = {}) {
  return new Request(
    `${origin}/api/v1/brokerdesk/workspaces/${workspaceRef}/customers/${relationshipRef}/family-proposals`,
    {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "parent@example.com",
        displayName: "Parent",
        relationshipKind: "parent",
        relationshipLabel: null,
        preferredLocale: null,
        idempotencyKey: "family-proposal:11111111-1111-4111-8111-111111111111",
        ...extra,
      }),
    }
  );
}

describe("NAK-202 assisted family onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue(actor);
    enforceRateLimit.mockResolvedValue(null);
    resolveSetup.mockResolvedValue({
      available: true,
      activeViewerCount: 1,
      maximumActiveViewers: 3,
      canPropose: true,
      ownProposals: [],
    });
    proposeViewer.mockResolvedValue({ accepted: true });
  });

  it("keeps proposal input closed and relationship labels consistent", () => {
    const base = {
      email: "parent@example.com",
      displayName: "Parent",
      relationshipKind: "parent",
      relationshipLabel: null,
      preferredLocale: null,
      idempotencyKey: "family-proposal:1111111111111111",
    };
    expect(proposeFamilyViewerCommandSchema.safeParse(base).success).toBe(true);
    expect(proposeFamilyViewerCommandSchema.safeParse({ ...base, candidateId: "internal" }).success).toBe(false);
    expect(proposeFamilyViewerCommandSchema.safeParse({ ...base, relationshipLabel: "Father" }).success).toBe(false);
    expect(proposeFamilyViewerCommandSchema.safeParse({ ...base, relationshipKind: "other" }).success).toBe(false);
  });

  it("reads only the server-authorized BrokerDesk projection", async () => {
    const response = await readSetup(
      new Request(`${origin}/api/v1/brokerdesk/workspaces/${workspaceRef}/customers/${relationshipRef}/family-viewers`),
      context
    );
    expect(response.status).toBe(200);
    expect(resolveSetup).toHaveBeenCalledWith(actor.supabase, workspaceRef, relationshipRef);
    expect(enforceRateLimit).toHaveBeenCalledWith(
      actor.supabase,
      expect.any(Request),
      "brokerdesk_family_viewer_read"
    );
  });

  it("normalizes and hashes broker-provided email before the guarded command", async () => {
    const response = await propose(proposalRequest({ email: "Parent@Example.com" }), context);
    expect(response.status).toBe(202);
    expect(proposeViewer).toHaveBeenCalledWith(actor.supabase, expect.objectContaining({
      workspaceRef,
      relationshipRef,
      emailHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      emailHint: "pa***@example.com",
      displayName: "Parent",
    }));
    expect(proposeViewer.mock.calls[0][1]).not.toHaveProperty("email");
  });

  it("fails closed for expanded input, cross-origin writes, missing auth, and throttling", async () => {
    expect((await propose(proposalRequest({ organizationId: "internal" }), context)).status).toBe(400);
    const crossOrigin = proposalRequest();
    crossOrigin.headers.set("Origin", "https://attacker.example");
    expect((await propose(crossOrigin, context)).status).toBe(403);
    getApiUser.mockResolvedValueOnce({ status: "missing_session" });
    expect((await propose(proposalRequest(), context)).status).toBe(401);
    enforceRateLimit.mockResolvedValueOnce(new Response(null, { status: 429 }));
    expect((await readSetup(new Request(`${origin}/family-viewers`), context)).status).toBe(429);
  });

  it("keeps unavailable relationships and unexpected dependencies neutral", async () => {
    resolveSetup.mockResolvedValueOnce({ available: false });
    const missing = await readSetup(new Request(`${origin}/family-viewers`), context);
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ available: false });
    resolveSetup.mockRejectedValueOnce(new Error("database unavailable"));
    const unavailable = await readSetup(new Request(`${origin}/family-viewers`), context);
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ available: false });
  });
});
