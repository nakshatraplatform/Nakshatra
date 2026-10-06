import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const retrieve = vi.hoisted(() => vi.fn());
vi.mock("@/features/identity-verification/server/didit.provider", () => ({
  retrieveDiditLivenessSession: retrieve,
  DiditProviderError: class extends Error { code = "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE"; },
}));
import { cancelCandidateVerification, getCurrentCandidateVerification, resumeCandidateVerification } from "@/features/identity-verification/server/candidate-recovery.service";

const candidateId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const active = { state: "active", attemptId, deadline: "2026-10-06T08:00:00Z", cleanupPending: false,
  canStart: false, canResume: true, canCancel: true, providerSessionRef: "33333333-3333-4333-8333-333333333333",
  workflowId: "44444444-4444-4444-8444-444444444444", workflowVersion: 1, vendorData: "private-correlation" };
function client(results: Array<{ data?: unknown; error?: unknown }>) {
  const rpc = vi.fn().mockImplementation(async () => results.shift() ?? { data: null, error: null });
  return { supabase: { rpc } as unknown as SupabaseClient, rpc };
}
describe("owner liveness recovery", () => {
  beforeEach(() => { vi.clearAllMocks(); retrieve.mockResolvedValue({ url: "https://verify.didit.me/session", awaitingResult: false }); });
  it("strips provider correlations from the status response", async () => {
    const { supabase } = client([{ data: active }]);
    const result = await getCurrentCandidateVerification(supabase, candidateId);
    expect(result.state).toBe("active"); expect(result).not.toHaveProperty("vendorData"); expect(result).not.toHaveProperty("providerSessionRef");
  });
  it("resumes the stored session and never registers a creation", async () => {
    const { supabase, rpc } = client([{ data: active }, { data: active }]);
    expect(await resumeCandidateVerification(supabase, candidateId, attemptId)).toEqual({ url: "https://verify.didit.me/session" });
    expect(retrieve).toHaveBeenCalledWith({ sessionId: active.providerSessionRef, workflowId: active.workflowId, workflowVersion: 1, vendorData: active.vendorData });
    expect(rpc.mock.calls.every(([name]) => name === "get_current_candidate_liveness_verification")).toBe(true);
  });
  it("rejects stale-tab resume before contacting Didit", async () => {
    const { supabase } = client([{ data: active }]);
    await expect(resumeCandidateVerification(supabase, candidateId, candidateId)).rejects.toMatchObject({ status: 409 });
    expect(retrieve).not.toHaveBeenCalled();
  });
  it("fences cancellation while retrieval is in flight", async () => {
    const { supabase } = client([{ data: active }, { data: { ...active, state: "cancelled", canResume: false } }]);
    await expect(resumeCandidateVerification(supabase, candidateId, attemptId)).rejects.toMatchObject({ status: 409 });
  });
  it("requests reconciliation rather than reopening a completed session", async () => {
    retrieve.mockResolvedValue({ awaitingResult: true });
    const { supabase, rpc } = client([{ data: active }, { data: active }, {}]);
    expect(await resumeCandidateVerification(supabase, candidateId, attemptId)).toEqual({ awaitingResult: true });
    expect(rpc).toHaveBeenLastCalledWith("request_candidate_liveness_reconciliation", { p_candidate_id: candidateId, p_attempt_id: attemptId });
  });
  it("preserves the attempt on a provider outage", async () => {
    retrieve.mockRejectedValue(new Error("private provider response"));
    const { supabase, rpc } = client([{ data: active }]);
    await expect(resumeCandidateVerification(supabase, candidateId, attemptId)).rejects.toMatchObject({ status: 503 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("returns only safe cancellation state", async () => {
    const { supabase, rpc } = client([{ data: { ...active, state: "cleanup_pending", canResume: false, cleanupPending: true } }]);
    expect((await cancelCandidateVerification(supabase, candidateId, attemptId)).cleanupPending).toBe(true);
    expect(rpc).toHaveBeenCalledWith("cancel_candidate_liveness_verification", { p_candidate_id: candidateId, p_attempt_id: attemptId });
  });
  it.each(["42501", "IV002", "XX000"])("maps database failure %s without leaking details", async code => {
    const { supabase } = client([{ error: { code, message: "private details" } }]);
    await expect(getCurrentCandidateVerification(supabase, candidateId)).rejects.not.toMatchObject({ message: "private details" });
  });
});
