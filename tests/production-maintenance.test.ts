import { createHmac } from "node:crypto";
vi.mock("@/features/operations/server/retention.service", () => ({ processRetention: mocks.retention }));
vi.mock("@/features/horoscope/server/horoscope-cleanup.service", () => ({ processHoroscopeCleanup: mocks.horoscopeCleanup }));

vi.mock("@/features/media/server/photo-cleanup.service", () => ({ processPhotoCleanup: mocks.photoCleanup }));

import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), retention: vi.fn(), horoscopeCleanup: vi.fn(), photoCleanup: vi.fn(), factory: vi.fn(), identity: vi.fn(), cleanup: vi.fn(), email: vi.fn(), relationship: vi.fn(), deletion: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("../scripts/identity-verification-worker.mjs", () => ({ createIdentityVerificationWorker: mocks.factory }));
vi.mock("../scripts/deleted-provider-cleanup.mjs", () => ({ processDeletedProviderCleanup: mocks.cleanup }));
vi.mock("../scripts/candidate-liveness-email-worker.mjs", () => ({ processCandidateLivenessEmails: mocks.email }));
vi.mock("../scripts/account-deletion-worker.mjs", () => ({ createAccountDeletionWorker: () => ({ run: mocks.deletion }) }));
vi.mock("@/features/notifications/server/relationship-notification.service", () => ({ processRelationshipNotifications: mocks.relationship }));
vi.mock("@/lib/observability/operations.mjs", async original => ({ ...await original<typeof import("@/lib/observability/operations.mjs")>(), reportOperationFailure: mocks.report }));
import { productionHealth, runProductionMaintenance, workerAuthorized } from "@/features/operations/server/production-maintenance";
import { GET } from "@/app/api/internal/production-health/route";
import { POST } from "@/app/api/internal/production-maintenance/route";
const secret = "x".repeat(32);
const request = () => new Request("https://app.test/internal", { headers: { authorization: `Bearer ${secret}` } });
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "synthetic-key"); vi.stubEnv("RESEND_FROM_EMAIL", "notifications@example.test");
  vi.stubEnv("EMAIL_RECIPIENT_HMAC_KEY", "synthetic-independent-32-plus-character-key");
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_c3ludGhldGljLWtleS1mb3ItdGVzdHM=");
  vi.clearAllMocks(); vi.stubEnv("PRODUCTION_WORKER_ENABLED", "true"); vi.stubEnv("PRODUCTION_WORKER_SECRET", secret);
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "begin_production_maintenance" ? "lease" : name === "enqueue_due_full_view_expiry_reminders" ? 0 : true, error: null }));
  mocks.retention.mockReset().mockResolvedValue(true); mocks.horoscopeCleanup.mockReset().mockResolvedValue({ deferred: 0 }); mocks.photoCleanup.mockReset().mockResolvedValue({ deferred: 0 });
  mocks.factory.mockReset().mockReturnValue({ run: mocks.identity });
  mocks.identity.mockResolvedValue({ deferred: 0 }); mocks.cleanup.mockResolvedValue({ deferred: 0 });
  mocks.email.mockResolvedValue({ failed: 0 }); mocks.relationship.mockResolvedValue({ failed: 0 }); mocks.deletion.mockResolvedValue({ deferred: 0 });
});
describe("production maintenance", () => {
  it("waits for the proof commit before claiming confirmation emails without delaying unrelated queues", async () => {
    let finish!: (value: { deferred: number }) => void;
    mocks.identity.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const running = runProductionMaintenance();
    await vi.waitFor(() => expect(mocks.identity).toHaveBeenCalledOnce());
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.retention).toHaveBeenCalledOnce();
    expect(mocks.horoscopeCleanup).toHaveBeenCalledOnce();
    expect(mocks.photoCleanup).toHaveBeenCalledOnce();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.relationship).toHaveBeenCalledOnce();
    finish({ deferred: 0 });
    await running;
    expect(mocks.factory).toHaveBeenCalledOnce();
    expect(mocks.identity).toHaveBeenCalledOnce();
    expect(mocks.email).toHaveBeenCalledOnce();
  });
  it.each(["retention", "horoscopeCleanup", "photoCleanup"] as const)("isolates %s failure without duplicating verification or starving email", async task => {
    mocks[task].mockRejectedValueOnce(new Error("private cleanup detail"));
    const result = await runProductionMaintenance();
    expect(result.failed).toBe(true);
    expect(result.tasks?.[task]).toBe("deferred");
    expect(result.tasks?.identity).toBe("completed");
    expect(result.tasks?.livenessEmail).toBe("completed");
    expect(mocks.factory).toHaveBeenCalledOnce();
    expect(mocks.identity).toHaveBeenCalledOnce();
    for (const work of [mocks.retention, mocks.photoCleanup, mocks.horoscopeCleanup, mocks.cleanup, mocks.email, mocks.relationship, mocks.deletion]) {
      expect(work).toHaveBeenCalledOnce();
    }
    expect(JSON.stringify(result)).not.toContain("private cleanup detail");
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_production_maintenance", { p_claim_token: "lease", p_succeeded: false });
  });
  it("enqueues once before relationship claims without delaying verification or cleanup", async () => {
    let finish!: (value: { data: number; error: null }) => void;
    mocks.rpc.mockImplementation(async (name: string) => name === "enqueue_due_full_view_expiry_reminders"
      ? new Promise(resolve => { finish = resolve; }) : { data: name === "begin_production_maintenance" ? "lease" : true, error: null });
    const running = runProductionMaintenance();
    await vi.waitFor(() => expect(mocks.identity).toHaveBeenCalledOnce());
    expect(mocks.relationship).not.toHaveBeenCalled();
    expect(mocks.retention).toHaveBeenCalledOnce();
    expect(mocks.horoscopeCleanup).toHaveBeenCalledOnce();
    expect(mocks.photoCleanup).toHaveBeenCalledOnce();
    finish({ data: 2, error: null });
    expect((await running).tasks?.expiryReminders).toBe("completed");
    expect(mocks.relationship).toHaveBeenCalledOnce();
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "enqueue_due_full_view_expiry_reminders")).toHaveLength(1);
  });
  it.each([null, 51, -1, "2"])("isolates invalid enqueue result %s and still drains existing mail", async result => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "begin_production_maintenance" ? "lease" : name === "enqueue_due_full_view_expiry_reminders" ? result : true, error: null }));
    const batch = await runProductionMaintenance();
    expect(batch.failed).toBe(true);
    expect(batch.tasks?.expiryReminders).toBe("deferred");
    expect(batch.tasks?.relationshipEmail).toBe("completed");
    expect(mocks.relationship).toHaveBeenCalledOnce();
    expect(mocks.email).toHaveBeenCalledOnce();
    expect(mocks.retention).toHaveBeenCalledOnce();
  });
  it("keeps enqueue RPC errors visible while old mail continues", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "enqueue_due_full_view_expiry_reminders"
      ? { data: null, error: { message: "private database detail" } } : { data: name === "begin_production_maintenance" ? "lease" : true, error: null });
    const batch = await runProductionMaintenance();
    expect(batch.failed).toBe(true); expect(mocks.relationship).toHaveBeenCalledOnce();
    expect(JSON.stringify(batch)).not.toContain("private database detail");
  });
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
    expect(mocks.retention).not.toHaveBeenCalled();
    expect(mocks.horoscopeCleanup).not.toHaveBeenCalled();
  });
  it("continues independent email and cleanup queues after identity provider failure", async () => {
    mocks.identity.mockRejectedValue(new Error("secret provider detail"));
    const result = await runProductionMaintenance();
    expect(result.failed).toBe(true); expect(result.tasks?.identity).toBe("deferred");
    for (const task of [mocks.retention, mocks.photoCleanup, mocks.horoscopeCleanup, mocks.cleanup, mocks.email, mocks.relationship, mocks.deletion]) expect(task).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_production_maintenance", { p_claim_token: "lease", p_succeeded: false });
    expect(JSON.stringify(result)).not.toContain("secret provider detail");
  });
  it("keeps independent queues running when provider factory configuration is missing", async () => {
    mocks.factory.mockImplementationOnce(() => { throw new Error("private configuration"); });
    const result = await runProductionMaintenance();
    expect(result.tasks?.identity).toBe("deferred");
    expect(result.failed).toBe(true);
    for (const task of [mocks.retention, mocks.photoCleanup, mocks.horoscopeCleanup, mocks.cleanup, mocks.email, mocks.relationship, mocks.deletion]) expect(task).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain("private configuration");
  });
  it("reports aggregate deferrals as an unhealthy HTTP result", async () => {
    mocks.relationship.mockResolvedValue({ failed: 1 });
    expect((await POST(request())).status).toBe(503);
  });
  it("rejects unfenced persistence and concealed database health failures", async () => {
    mocks.rpc.mockImplementationOnce(async () => ({ data: "lease", error: null })).mockImplementation(async (name: string) => ({ data: name === "enqueue_due_full_view_expiry_reminders" ? 0 : false, error: null }));
    await expect(runProductionMaintenance()).rejects.toThrow("MAINTENANCE_COMPLETION_FAILED");
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "database detail" } });
    expect((await GET(request())).status).toBe(503);
    await expect(productionHealth()).rejects.toThrow("HEALTH_UNAVAILABLE");
  });
  it("reports missing expiry production even when other maintenance looks healthy", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: { healthy: name !== "portfolio_expiry_reminder_health" }, error: null }));
    expect((await GET(request())).status).toBe(503);
    mocks.rpc.mockImplementation(async (name: string) => name === "portfolio_expiry_reminder_health"
      ? { data: null, error: { message: "private database detail" } } : { data: { healthy: true }, error: null });
    await expect(productionHealth()).rejects.toThrow("HEALTH_UNAVAILABLE");
  });
  it("returns unhealthy status when a run is missing even if queues are empty", async () => {
    mocks.rpc.mockResolvedValue({ data: { healthy: false, heldRelationshipNotifications: 0 }, error: null });
    expect((await GET(request())).status).toBe(503);
    mocks.rpc.mockResolvedValue({ data: { healthy: true }, error: null });
    expect((await GET(request())).status).toBe(200);
  });
});
it("aggregates signed delivery health and conceals missing configuration", async () => {
  mocks.rpc.mockResolvedValue({ data: { healthy: true }, error: null });
  expect((await GET(request())).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("email_delivery_health", { p_daily_limit: 100, p_monthly_limit: 3000 });
  vi.stubEnv("EMAIL_RECIPIENT_HMAC_KEY", "");
  expect((await GET(request())).status).toBe(503);
});
it.each(["0", "-1", "NaN", "1000000000"])("refuses malformed mail quota configuration %s", async value => {
  vi.stubEnv("RESEND_DAILY_EMAIL_LIMIT", value);
  await expect(productionHealth()).rejects.toThrow("HEALTH_UNAVAILABLE");
  vi.unstubAllEnvs();
});
it("uses configured application budgets and exposes email health failures", async () => {
  vi.stubEnv("RESEND_DAILY_EMAIL_LIMIT", "500"); vi.stubEnv("RESEND_MONTHLY_EMAIL_LIMIT", "10000");
  mocks.rpc.mockImplementation(async (name: string) => ({ data: { healthy: name !== "email_delivery_health" }, error: null }));
  expect((await GET(request())).status).toBe(503);
  expect(mocks.rpc).toHaveBeenCalledWith("email_delivery_health", { p_daily_limit: 500, p_monthly_limit: 10000 });
  vi.unstubAllEnvs();
});
it("isolates email retention failure while still running proof and mail tasks", async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "begin_production_maintenance" ? "lease" : name === "enqueue_due_full_view_expiry_reminders" ? 0 : name !== "run_email_delivery_retention", error: null }));
  const batch = await runProductionMaintenance();
  expect(batch.tasks?.emailRetention).toBe("deferred"); expect(batch.failed).toBe(true);
  expect(mocks.email).toHaveBeenCalledOnce(); expect(mocks.relationship).toHaveBeenCalledOnce();
});

// Failure reporting must survive Promise.allSettled and boolean worker summaries.
it("reports deferred and rejected maintenance tasks with a safe operation and dispatch reference", async () => {
  const reference = "11111111-1111-4111-8111-111111111111";
  mocks.identity.mockResolvedValueOnce({ deferred: 1 });
  mocks.cleanup.mockRejectedValueOnce(new Error("private provider payload"));
  const result = await runProductionMaintenance(reference);
  expect(result.tasks?.identity).toBe("deferred");
  expect(mocks.report).toHaveBeenCalledWith("maintenance.identity", undefined, { code: "TASK_DEFERRED", reference });
  expect(mocks.report).toHaveBeenCalledWith("maintenance.providerCleanup", expect.any(Error), { code: "TASK_FAILED", reference });
  expect(mocks.report).toHaveBeenCalledTimes(2);
  expect(result.tasks?.livenessEmail).toBe("completed");
});
