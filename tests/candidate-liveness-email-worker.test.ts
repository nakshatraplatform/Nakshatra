import { describe, expect, it, vi } from "vitest";
import { processCandidateLivenessEmails } from "../scripts/candidate-liveness-email-worker.mjs";
const delivery = { delivery_id: "11111111-1111-4111-8111-111111111111", claim_token: "22222222-2222-4222-8222-222222222222", recipient_email: "owner@example.test" };
const providerMessageId = "33333333-3333-4333-8333-333333333333";
function database() { return { rpc: vi.fn().mockResolvedValueOnce({ data: [delivery], error: null }).mockResolvedValue({ data: true, error: null }) }; }
describe("durable liveness confirmation dispatch", () => {
  it("scopes an owner-triggered claim to the current candidate, attempt, owner and live session", async () => {
    const supabase = database();
    const owner = { candidateId: delivery.delivery_id, attemptId: delivery.claim_token, userId: providerMessageId, sessionId: providerMessageId };
    const send = vi.fn().mockResolvedValue({ status: "accepted", providerMessageId });
    await processCandidateLivenessEmails(supabase, { send, owner });
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "claim_owner_candidate_liveness_email", {
      p_candidate_id: owner.candidateId, p_attempt_id: owner.attemptId,
      p_owner_user_id: owner.userId, p_owner_session_id: owner.sessionId,
    });
    expect(send).toHaveBeenCalledOnce();
  });
  it("sends only the leased recipient with a stable delivery ID and completes accepted (not delivered)", async () => {
    const supabase = database();
    const send = vi.fn().mockResolvedValue({ status: "accepted", providerMessageId });
    expect(await processCandidateLivenessEmails(supabase, { send })).toEqual({ accepted: 1, failed: 0 });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: delivery.delivery_id, to: delivery.recipient_email }));
    expect(send.mock.calls[0][0].text).not.toMatch(/verify\/|session_id|Approved/);
    expect(supabase.rpc).toHaveBeenLastCalledWith("complete_candidate_liveness_email", {
      p_delivery_id: delivery.delivery_id, p_claim_token: delivery.claim_token, p_provider_message_id: providerMessageId, p_error_code: null, p_retryable: false,
    });
  });
  it.each(["EMAIL_TIMEOUT", "EMAIL_NOT_CONFIGURED"])("persists %s without changing the verification proof", async code => {
    const supabase = database();
    const send = vi.fn().mockResolvedValue({ status: "failed", code, retryable: code === "EMAIL_TIMEOUT" });
    expect(await processCandidateLivenessEmails(supabase, { send })).toEqual({ accepted: 0, failed: 1 });
    expect(supabase.rpc).toHaveBeenLastCalledWith("complete_candidate_liveness_email", expect.objectContaining({ p_error_code: code, p_retryable: code === "EMAIL_TIMEOUT" }));
    expect(supabase.rpc.mock.calls.map(call => call[0])).toEqual(["claim_candidate_liveness_emails", "complete_candidate_liveness_email"]);
  });
  it("rejects a malformed claim before sending", async () => {
    const send = vi.fn();
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: [{ ...delivery, recipient_email: "bad" }], error: null }) };
    await expect(processCandidateLivenessEmails(supabase, { send })).rejects.toThrow("LIVENESS_EMAIL_CLAIM_FAILED");
    expect(send).not.toHaveBeenCalled();
  });
  it("retains retry state for an uncertain transport failure", async () => {
    const supabase = database();
    await processCandidateLivenessEmails(supabase, { send: vi.fn().mockRejectedValue(new Error("synthetic sensitive response")) });
    expect(supabase.rpc).toHaveBeenLastCalledWith("complete_candidate_liveness_email", expect.objectContaining({ p_error_code: "EMAIL_PROVIDER_UNAVAILABLE", p_retryable: true }));
  });
  it("surfaces a stale lease, never silently acknowledges delivery", async () => {
    const supabase = database();
    supabase.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(processCandidateLivenessEmails(supabase, { send: vi.fn().mockResolvedValue({ status: "accepted", providerMessageId }) })).rejects.toThrow("LIVENESS_EMAIL_COMPLETION_FAILED");
  });
});
it("the isolated worker default cannot bypass recipient suppression", async () => {
  vi.stubEnv("RESEND_API_KEY", "synthetic-key"); vi.stubEnv("RESEND_FROM_EMAIL", "notifications@example.test");
  vi.stubEnv("EMAIL_RECIPIENT_HMAC_KEY", "synthetic-independent-key-32-characters");
  const supabase = { rpc: vi.fn().mockResolvedValueOnce({ data: [delivery], error: null })
    .mockResolvedValueOnce({ data: { status: "suppressed" }, error: null }).mockResolvedValueOnce({ data: true, error: null }) };
  const transport = vi.fn(); vi.stubGlobal("fetch", transport);
  expect(await processCandidateLivenessEmails(supabase)).toEqual({ accepted: 0, failed: 1 });
  expect(transport).not.toHaveBeenCalled();
  expect(supabase.rpc).toHaveBeenLastCalledWith("complete_candidate_liveness_email", expect.objectContaining({ p_error_code: "EMAIL_RECIPIENT_SUPPRESSED", p_retryable: false }));
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
