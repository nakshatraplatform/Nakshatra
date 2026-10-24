import { close, init } from "@sentry/nextjs";
import type { Envelope, ErrorEvent } from "@sentry/core";
import { sentryOptions } from "@/lib/observability/sentry.runtime.mjs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ after: vi.fn(), check: vi.fn(), send: vi.fn(), auth: vi.fn() }));
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/lib/auth", () => ({ getApiUser: mocks.auth }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/features/identity-verification/server/candidate-result.service", () => ({
  checkCandidateResult: mocks.check, dispatchOwnerLivenessConfirmation: mocks.send,
}));
import { POST } from "@/app/api/identity-verification/check-result/route";
const id = "11111111-1111-4111-8111-111111111111";
const owner = { id, sessionId: id };
const request = () => new Request("http://local/api/identity-verification/check-result", {
  method: "POST", headers: { Origin: "http://local", "Content-Type": "application/json" },
  body: JSON.stringify({ candidateId: id, attemptId: id }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ status: "authenticated", supabase: {}, user: owner });
  mocks.check.mockResolvedValue({ state: "verified", attemptId: id, emailStatus: "queued" });
  mocks.send.mockResolvedValue({ accepted: 1, failed: 0 });
});
it("returns the committed result before attempting its scoped confirmation email", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ state: "verified", emailStatus: "queued" });
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.after).toHaveBeenCalledOnce();
  await mocks.after.mock.calls[0][0]();
  expect(mocks.send).toHaveBeenCalledWith(id, id, owner);
});
it.each(["accepted", "processing", "failed", "skipped", null])("does not reset an existing %s delivery", async emailStatus => {
  mocks.check.mockResolvedValue({ state: "verified", attemptId: id, emailStatus });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.after).not.toHaveBeenCalled();
});
it("does not dispatch for an unconfirmed or unrelated attempt", async () => {
  for (const state of ["active", "awaiting_result", "declined", "expired"]) {
    mocks.check.mockResolvedValue({ state, attemptId: id, emailStatus: "queued" });
    expect((await POST(request())).status).toBe(200);
  }
  mocks.check.mockResolvedValue({ state: "verified", attemptId: "other", emailStatus: "queued" });
  await POST(request());
  expect(mocks.after).not.toHaveBeenCalled();
});
it("does not let dispatch or scheduling failure change a saved verification", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.send.mockRejectedValue(new Error("synthetic provider detail"));
  expect((await POST(request())).status).toBe(200);
  await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
  mocks.after.mockImplementation(() => { throw new Error("schedule unavailable"); });
  expect((await POST(request())).status).toBe(200);
});
it("rejects unsigned-in callers without email or provider work", async () => {
  mocks.auth.mockResolvedValue({ status: "missing_session" });
  expect((await POST(request())).status).toBe(401);
  expect(mocks.check).not.toHaveBeenCalled();
  expect(mocks.after).not.toHaveBeenCalled();
});

afterEach(async () => { await close(2000); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("flushes a failed after-response email with the same reference returned to the user", async () => {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.us.sentry.io/456");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const sent: Envelope[] = [];
  let flushed = false;
  init({ ...sentryOptions(), transport: () => ({ send: async (envelope: Envelope) => { sent.push(envelope); return { statusCode: 200 }; }, flush: async () => { flushed = true; return true; } }) });
  mocks.send.mockRejectedValueOnce(new Error("PRIVATE_PROVIDER_SENTINEL"));
  const response = await POST(request());
  expect(response.status).toBe(200);
  await mocks.after.mock.calls[0][0]();
  const errors: ErrorEvent[] = [];
  for (const [, items] of sent) for (const [header, event] of items) if (header.type === "event") errors.push(event as ErrorEvent);
  expect(errors).toHaveLength(1);
  expect(errors[0].tags).toMatchObject({ "vivintro.operation": "identity_verification.email_dispatch_failed", "vivintro.code": "LIVENESS_EMAIL_DISPATCH_FAILED", "vivintro.reference": response.headers.get("X-Request-Id") });
  expect(flushed).toBe(true);
  expect(JSON.stringify(sent)).not.toContain("PRIVATE_PROVIDER_SENTINEL");
});
