import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), identity: vi.fn(), cleanup: vi.fn(), email: vi.fn(), relationship: vi.fn(), deletion: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("../scripts/identity-verification-worker.mjs", () => ({ createIdentityVerificationWorker: () => ({ run: mocks.identity }) }));
vi.mock("../scripts/deleted-provider-cleanup.mjs", () => ({ processDeletedProviderCleanup: mocks.cleanup }));
vi.mock("../scripts/candidate-liveness-email-worker.mjs", () => ({ processCandidateLivenessEmails: mocks.email }));
vi.mock("../scripts/account-deletion-worker.mjs", () => ({ createAccountDeletionWorker: () => ({ run: mocks.deletion }) }));
vi.mock("@/features/notifications/server/relationship-notification.service", () => ({ processRelationshipNotifications: mocks.relationship }));
import { productionHealth, runProductionMaintenance, workerAuthorized } from "@/features/operations/server/production-maintenance";
import { GET } from "@/app/api/internal/production-health/route";
import { POST } from "@/app/api/internal/production-maintenance/route";
const secret = "x".repeat(32);
const request = () => new Request("https://app.test/internal", { headers: { authorization: `Bearer ${secret}` } });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("PRODUCTION_WORKER_ENABLED", "true"); vi.stubEnv("PRODUCTION_WORKER_SECRET", secret);
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "begin_production_maintenance" ? "lease" : true, error: null }));
  mocks.identity.mockResolvedValue({ deferred: 0 }); mocks.cleanup.mockResolvedValue({ deferred: 0 });
  mocks.email.mockResolvedValue({ failed: 0 }); mocks.relationship.mockResolvedValue({ failed: 0 }); mocks.deletion.mockResolvedValue({ deferred: 0 });
});
describe("production maintenance", () => {
  it("conceals both endpoints until enabled and authenticated, including unicode credentials", async () => {
    expect(workerAuthorized(request())).toBe(true);
    expect(workerAuthorized(new Request("https://app.test", { headers: { authorization: `Bearer ${"é".repeat(32)}` } }))).toBe(false);
    vi.stubEnv("PRODUCTION_WORKER_ENABLED", "false");
    expect((await GET(request())).status).toBe(404); expect((await POST(request())).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("accepts only fresh action-scoped scheduler MACs and passes nonce for durable replay fencing", async () => {
    const nonce = "af740000-1111-4111-8111-111111111111";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = { "x-worker-dispatch": nonce, "x-worker-timestamp": timestamp,
      "x-worker-signature": createHmac("sha256", secret).update(`vivintro-maintenance\n${nonce}\n${timestamp}`).digest("hex") };
    const signed = new Request("https://app.test/api/internal/production-maintenance", { method: "POST", headers });
    expect(workerAuthorized(signed)).toBe(true);
    expect((await POST(signed)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("begin_production_maintenance", { p_dispatch_id: nonce });
    expect(workerAuthorized(new Request("https://app.test/api/internal/production-health", { headers }))).toBe(false);
    expect(workerAuthorized(new Request(signed, { headers: { ...headers, "x-worker-dispatch": "ae740000-1111-4111-8111-111111111111" } }))).toBe(false);
    for (const age of [61, -11]) {
      const expired = String(Math.floor(Date.now() / 1000) - age);
      const signature = createHmac("sha256", secret).update(`vivintro-maintenance\n${nonce}\n${expired}`).digest("hex");
      expect(workerAuthorized(new Request(signed, { headers: { ...headers, "x-worker-timestamp": expired, "x-worker-signature": signature } }))).toBe(false);
    }
    expect(workerAuthorized(new Request(signed, { headers: { ...headers, "x-worker-signature": "invalid" } }))).toBe(false);
  });
  it("never runs jobs when another batch owns the lease or database scheduling is disabled", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await runProductionMaintenance()).toEqual({ skipped: true, failed: false });
    expect(mocks.identity).not.toHaveBeenCalled();
  });
  it("continues independent email and cleanup queues after identity provider failure", async () => {
    mocks.identity.mockRejectedValue(new Error("secret provider detail"));
    const result = await runProductionMaintenance();
    expect(result.failed).toBe(true); expect(result.tasks?.identity).toBe("deferred");
    for (const task of [mocks.cleanup, mocks.email, mocks.relationship, mocks.deletion]) expect(task).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_production_maintenance", { p_claim_token: "lease", p_succeeded: false });
    expect(JSON.stringify(result)).not.toContain("secret provider detail");
  });
  it("reports aggregate deferrals as an unhealthy HTTP result", async () => {
    mocks.relationship.mockResolvedValue({ failed: 1 });
    expect((await POST(request())).status).toBe(503);
  });
  it("rejects unfenced persistence and concealed database health failures", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "lease", error: null }).mockResolvedValueOnce({ data: false, error: null });
    await expect(runProductionMaintenance()).rejects.toThrow("MAINTENANCE_COMPLETION_FAILED");
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "database detail" } });
    expect((await GET(request())).status).toBe(503);
    await expect(productionHealth()).rejects.toThrow("HEALTH_UNAVAILABLE");
  });
  it("returns unhealthy status when a run is missing even if queues are empty", async () => {
    mocks.rpc.mockResolvedValue({ data: { healthy: false, heldRelationshipNotifications: 0 }, error: null });
    expect((await GET(request())).status).toBe(503);
    mocks.rpc.mockResolvedValue({ data: { healthy: true }, error: null });
    expect((await GET(request())).status).toBe(200);
  });
});
