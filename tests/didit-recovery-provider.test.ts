import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { retrieveDiditLivenessSession } from "@/features/identity-verification/server/didit.provider";
const input = { sessionId: "11111111-1111-4111-8111-111111111111", workflowId: "22222222-2222-4222-8222-222222222222", workflowVersion: 2, vendorData: "iv:test:attempt" };
const decision = { session_id: input.sessionId, workflow_id: input.workflowId, workflow_version: 2, vendor_data: input.vendorData, status: "Not Started", session_url: "https://verify.didit.me/session" };
const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv("DIDIT_API_KEY", "test-only-api-key"); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); fetchMock.mockResolvedValue(Response.json(decision)); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("retrieves a correlated session without a create request", async () => {
  expect(await retrieveDiditLivenessSession(input)).toEqual({ awaitingResult: false, url: decision.session_url });
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0][0]).toBe(`https://verification.didit.me/v3/session/${input.sessionId}/decision/?include=events`);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error" }); expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
});
it("accepts the documented terminal response with no hosted URL", async () => {
  fetchMock.mockResolvedValue(Response.json({ ...decision, status: "Approved", session_url: null, features: [{ feature: "LIVENESS", node_id: "node" }] }));
  expect(await retrieveDiditLivenessSession(input)).toEqual({ awaitingResult: true });
});
it("reopens a resubmission without creating a competing session", async () => {
  fetchMock.mockResolvedValue(Response.json({ ...decision, status: "Resubmitted" }));
  expect(await retrieveDiditLivenessSession(input)).toEqual({ awaitingResult: false, url: decision.session_url });
});
it.each(["Approved", "Declined", "Expired", "Abandoned", "KYC Expired", "In Review"])("does not resume terminal status %s", async status => {
  fetchMock.mockResolvedValue(Response.json({ ...decision, status })); expect(await retrieveDiditLivenessSession(input)).toEqual({ awaitingResult: true });
});
it.each([{ session_id: input.workflowId }, { workflow_id: input.sessionId }, { workflow_version: 1 }, { vendor_data: "other" }])("rejects mismatched correlation %j", async change => {
  fetchMock.mockResolvedValue(Response.json({ ...decision, ...change })); await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_CORRELATION_INVALID");
});
it.each([{ workflow_version: undefined }, { session_url: "https://evil.test" }, { status: "Unknown" }, { status: "Awaiting User" }, { session_kind: "business" }])("rejects invalid candidate contract %j", async change => {
  fetchMock.mockResolvedValue(Response.json({ ...decision, ...change })); await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID");
});
it("rejects a hosted URL containing user information", async () => {
  // Build synthetic user information without committing a credential-shaped URI.
  const url = new URL(decision.session_url);
  url.username = "test-user";
  url.password = "test-password";
  fetchMock.mockResolvedValue(Response.json({ ...decision, session_url: url.href }));
  await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID");
});
it.each([[404, "SESSION_MISSING"], [429, "RATE_LIMITED"], [500, "REJECTED"], [401, "CREDENTIALS"]])("preserves safe errors for HTTP %s", async (status, code) => { fetchMock.mockResolvedValue(new Response(null, { status: Number(status) })); await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", `IDENTITY_VERIFICATION_PROVIDER_${code}`); });
it("bounds provider payload size", async () => { fetchMock.mockResolvedValue(new Response("x".repeat(262145))); await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID"); });
it("rejects invalid JSON without leaking it", async () => { fetchMock.mockResolvedValue(new Response("private response")); await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("message", "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID"); });
it("classifies insufficient credits without returning the provider message", async () => {
  fetchMock.mockResolvedValue(Response.json({ detail: "You don't have enough credits to perform this request. Please top up at https://business.didit.me" }, { status: 400 }));
  await expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_CREDITS");
});
it("bounds stalled provider requests", async () => {
  vi.useFakeTimers(); fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
  const result = expect(retrieveDiditLivenessSession(input)).rejects.toHaveProperty("code", "IDENTITY_VERIFICATION_PROVIDER_TIMEOUT"); await vi.advanceTimersByTimeAsync(10001); await result; vi.useRealTimers();
});
