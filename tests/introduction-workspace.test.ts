import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => vi.fn());
const throttle = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getApiUser: auth }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: throttle }));
vi.mock("@/lib/security/logging", () => ({ getRequestId: () => "request", logServerError: vi.fn() }));
import { POST as recordFamilyUpdate } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/introductions/[introductionRef]/family-updates/route";
import { GET as list } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/introduction-actions/route";
import { GET as read } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/introductions/[introductionRef]/route";
import { POST as share } from "../src/app/api/v1/brokerdesk/workspaces/[workspaceRef]/introductions/[introductionRef]/share-actions/route";
import { recordIntroductionShareAction, resolveIntroductionAction, resolveIntroductionWorkspaceList } from "@/features/broker-introductions/server/introduction-workspace.service";
import { introductionShareCommandSchema, introductionWorkspaceQuerySchema } from "@/features/broker-introductions/server/introduction-workspace.contract";
import { actionData, listData, workspace, introduction, date } from "./introduction-workspace.fixture";

const supabase = { rpc };
const path = { workspaceRef: workspace, introductionRef: introduction };
const context = () => ({ params: Promise.resolve(path) });
const listContext = () => ({ params: Promise.resolve({ workspaceRef: workspace }) });
const command = { side: "source", action: "initiate", expectedVersion: 1, idempotencyKey: "nak204:share:00001" };
const request = (query = "") => new Request("https://vivintro.com/api/v1/actions" + query);
const post = (body: unknown = command, origin = "https://vivintro.com") => new Request("https://vivintro.com/api/v1/actions", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
});
describe("Introduction action boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks(); auth.mockResolvedValue({ status: "authenticated", user: { id: "broker" }, supabase });
    throttle.mockResolvedValue(null); rpc.mockResolvedValue({ data: actionData, error: null });
  });
  it("strictly bounds cursor and command values without caller authority fields", () => {
    expect(introductionWorkspaceQuerySchema.parse({})).toEqual({ limit: 25 });
    for (const query of [{ limit: 51 }, { limit: 0 }, { beforeRef: introduction }, { beforeCreatedAt: date }, { actorId: "other" }])
      expect(introductionWorkspaceQuerySchema.safeParse(query).success).toBe(false);
    for (const body of [{ ...command, side: "other" }, { ...command, expectedVersion: 0 }, { ...command, organizationId: "other" }, { ...command, action: "respond" }])
      expect(introductionShareCommandSchema.safeParse(body).success).toBe(false);
  });
  it("reads a strict safe projection through one RPC", async () => {
    await expect(resolveIntroductionAction(supabase as never, path)).resolves.toEqual(actionData);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("resolve_brokerdesk_introduction_action_with_responses", { p_workspace_ref: workspace, p_introduction_ref: introduction });
    const response = await read(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
  it("validates list output and passes bounded cursor in a single query", async () => {
    rpc.mockResolvedValue({ data: listData, error: null });
    expect(await resolveIntroductionWorkspaceList(supabase as never, workspace)).toEqual(listData);
    const response = await list(request(`?limit=50&beforeCreatedAt=${encodeURIComponent(date)}&beforeRef=${introduction}`), listContext());
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith("resolve_brokerdesk_introduction_actions", { p_workspace_ref: workspace, p_limit: 50, p_before_created_at: date, p_before_ref: introduction });
  });
  it("writes only the validated side command through the canonical repository", async () => {
    rpc.mockResolvedValue({ data: { available: true, side: "source", shareState: "initiated", rowVersion: 2 }, error: null });
    expect((await share(post(), context())).status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("record_introduction_share_action", {
      p_workspace_ref: workspace, p_introduction_ref: introduction, p_side: "source", p_action: "initiate", p_expected_version: 1, p_idempotency_key: command.idempotencyKey,
    });
  });
  it("records an attested Interested decision with the workspace and side bound by the route", async () => {
    const body = { side: "recipient", status: "accepted", reportedBy: "authorized_parent", channel: "phone",
      comment: "  Spoke by phone  ", consentAttested: true, expectedVersion: 3, idempotencyKey: "nak205:response:00001" };
    rpc.mockResolvedValue({ data: { available: true, rowVersion: 4, completeAccessExpiresAt: date }, error: null });
    const response = await recordFamilyUpdate(post(body), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("record_introduction_family_update", {
      p_workspace_ref: workspace, p_introduction_ref: introduction, p_side: "recipient", p_reported_status: "accepted",
      p_reported_by: "authorized_parent", p_channel: "phone", p_comment: "Spoke by phone", p_consent_attested: true,
      p_expected_version: 3, p_idempotency_key: body.idempotencyKey,
    });
    expect((await recordFamilyUpdate(post({ ...body, confirmFamilyAccess: true }), context())).status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith("record_introduction_family_update_with_family_consent", expect.objectContaining({
      p_side: "recipient", p_consent_attested: true,
    }));
  });
  it("blocks unconfirmed or unattributed decisions and respects database authorization", async () => {
    const body = { side: "source", status: "accepted", reportedBy: "candidate", channel: "whatsapp",
      comment: "", consentAttested: true, expectedVersion: 3, idempotencyKey: "nak205:response:00002" };
    for (const invalid of [{ ...body, consentAttested: false }, { ...body, reportedBy: "family" }, { ...body, candidateId: "other" }]) {
      expect((await recordFamilyUpdate(post(invalid), context())).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: { available: false }, error: null });
    expect((await recordFamilyUpdate(post(body), context())).status).toBe(403);
  });
  it.each(["22023", "40001", "54000", "23505", "XX000"])("maps SQL failure %s without exposing database details", async code => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "private SQL" } });
    const response = await share(post(), context());
    expect(response.status).toBe(code === "22023" ? 400 : code === "XX000" ? 503 : 409);
    expect(await response.text()).not.toContain("private SQL");
  });
  it("accepts PostgreSQL-sized notes containing supplementary Unicode characters", async () => {
    const comment = "📞".repeat(1000);
    const latestUpdate = { status: "needs_time", reportedBy: "family", channel: "phone", comment, recordedAt: date };
    rpc.mockResolvedValue({ data: { ...actionData, sides: [{ ...actionData.sides[0], latestUpdate }, actionData.sides[1]] }, error: null });
    const result = await resolveIntroductionAction(supabase as never, path);
    expect(result.available && result.sides[0].latestUpdate?.comment).toBe(comment);
    rpc.mockResolvedValueOnce({ data: actionData, error: null });
    const legacyResponse = await read(request(), context());
    expect(rpc).toHaveBeenLastCalledWith("resolve_brokerdesk_introduction_action", { p_workspace_ref: workspace, p_introduction_ref: introduction });
    expect(await legacyResponse.json()).toEqual(actionData);
    const expandedResponse = await read(request("?view=responses"), context());
    expect((await expandedResponse.json()).sides[0].latestUpdate.comment).toBe(comment);
  });
  it("rejects extra private output, duplicate sides and oversized history", async () => {
    for (const data of [{ ...actionData, contact: "private" }, { ...actionData, sides: [actionData.sides[0], actionData.sides[0]] }, { ...actionData, timeline: Array(101).fill(actionData.timeline[0]) }]) {
      rpc.mockResolvedValueOnce({ data, error: null });
      await expect(resolveIntroductionAction(supabase as never, path)).rejects.toMatchObject({ status: 503 });
    }
  });
  it("accepts the existing 180-character candidate name limit", async () => {
    const data = { ...actionData, sides: actionData.sides.map(side => ({ ...side, name: "A".repeat(180) })) };
    rpc.mockResolvedValueOnce({ data, error: null });
    await expect(resolveIntroductionAction(supabase as never, path)).resolves.toEqual(data);
  });
  it("returns neutral private denial on all workspace operations", async () => {
    rpc.mockResolvedValue({ data: { available: false }, error: null });
    for (const response of [await read(request(), context()), await list(request(), listContext()), await share(post(), context())]) {
      expect(response.status).toBe(403); expect(await response.json()).toEqual({ available: false });
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });
  it("rejects wrong paths, unknown fields and repeated query parameters before RPC", async () => {
    expect((await read(request(), { params: Promise.resolve({ ...path, workspaceRef: "tampered" }) })).status).toBe(400);
    expect((await share(post({ ...command, candidateId: "other" }), context())).status).toBe(400);
    expect((await share(post(), { params: Promise.resolve({ ...path, introductionRef: "bad" }) })).status).toBe(400);
    expect((await list(request("?limit=25&limit=50"), listContext())).status).toBe(400);
    expect((await list(request("?userId=other"), listContext())).status).toBe(400);
    expect((await list(request(), { params: Promise.resolve({ workspaceRef: "bad" }) })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("protects mutations against cross-origin, malformed and oversized bodies", async () => {
    expect((await share(post(command, "https://evil.test"), context())).status).toBe(403);
    expect((await share(new Request("https://vivintro.com/api/v1/actions", { method: "POST", headers: { Origin: "https://vivintro.com", "Content-Type": "application/json" }, body: "{" }), context())).status).toBe(400);
    expect((await share(post({ ...command, extra: "a".repeat(20000) }), context())).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([read, share])("requires live identity and retains headers on auth and throttle failures", async handler => {
    auth.mockResolvedValueOnce({ status: "missing_session" });
    const unauthenticated = await handler(post(), context());
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers.get("Cache-Control")).toBe("private, no-store");
    throttle.mockResolvedValueOnce(NextResponse.json({}, { status: 429 }));
    const limited = await handler(post(), context());
    expect(limited.status).toBe(429); expect(limited.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("fails privately for unexpected errors and unavailable sessions", async () => {
    auth.mockRejectedValueOnce(new Error("secret"));
    const failed = await read(request(), context());
    expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("secret");
    auth.mockResolvedValueOnce({ status: "service_unavailable" });
    expect((await list(request(), listContext())).status).toBe(503);
    throttle.mockResolvedValueOnce(NextResponse.json({}, { status: 429 }));
    expect((await list(request(), listContext())).status).toBe(429);
  });
  it("service rejects malformed commands before storage access", async () => {
    await expect(recordIntroductionShareAction(supabase as never, path, { ...command, expectedVersion: -1 })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
