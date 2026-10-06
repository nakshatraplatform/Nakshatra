import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { retrieveDiditLivenessSession } from "@/features/identity-verification/server/didit.provider";
const input = { sessionId: "11111111-1111-4111-8111-111111111111", workflowId: "22222222-2222-4222-8222-222222222222", workflowVersion: 2, vendorData: "iv:test:attempt" };
const decision = { session_id: input.sessionId, workflow_id: input.workflowId, workflow_version: 2, vendor_data: input.vendorData, status: "Not Started", session_url: "https://verify.didit.me/session" };
const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv("DIDIT_API_KEY", "test-only-api-key"); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); fetchMock.mockResolvedValue(Response.json(decision)); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("retrieves a correlated session without a create request", async () => {
  expect(await retrieveDiditLivenessSession(input)).toEqual({ awaitingResult: false, url: decision.session_url });
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0][0]).toContain(`/v3/session/${input.sessionId}/decision/`);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error" }); expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
});
it.each(["Approved", "Declined", "Expired", "Abandoned", "KYC Expired", "In Review"])("does not resume terminal status %s", async status => {
  fetchMock.mockResolvedValue(Response.json({ ...decision, status })); expect(await retrieveDiditLivenessSession(input)).toEqual({ awaitingResult: true });
});
it.each([{ session_id: input.workflowId }, { workflow_id: input.sessionId }, { workflow_version: 1 }, { vendor_data: "other" }, { session_url: "https://evil.test" }, { status: "Unknown" }])("rejects malformed or untrusted retrieval %j", async change => {
  fetchMock.mockResolvedValue(Response.json({ ...decision, ...change })); await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE");
});
it("rejects a hosted URL containing user information", async () => {
  // Build synthetic user information without committing a credential-shaped URI.
  const url = new URL(decision.session_url);
  url.username = "test-user";
  url.password = "test-password";
  fetchMock.mockResolvedValue(Response.json({ ...decision, session_url: url.href }));
  await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE");
});
it.each([404, 429, 500])("preserves safe errors for HTTP %s", async status => { fetchMock.mockResolvedValue(new Response(null, { status })); await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", status === 429 ? "IDENTITY_VERIFICATION_PROVIDER_RATE_LIMITED" : "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE"); });
it("bounds provider payload size", async () => { fetchMock.mockResolvedValue(new Response("x".repeat(262145))); await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE"); });
it("rejects invalid JSON without leaking it", async () => { fetchMock.mockResolvedValue(new Response("private response")); await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("message", "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE"); });
it("bounds stalled provider requests", async () => {
  vi.useFakeTimers(); fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
  const result = expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_TIMEOUT"); await vi.advanceTimersByTimeAsync(10001); await result; vi.useRealTimers();
});
