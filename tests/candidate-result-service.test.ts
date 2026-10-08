import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const current = vi.hoisted(() => vi.fn());
const admin = vi.hoisted(() => ({ rpc: vi.fn() }));
const processClaim = vi.hoisted(() => vi.fn());
const createAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: createAdmin }));
vi.mock("@/features/identity-verification/server/candidate-recovery.service", () => ({ getCurrentCandidateVerification: current }));
vi.mock("../scripts/identity-verification-worker.mjs", () => ({ createIdentityVerificationWorker: () => ({ process: processClaim }) }));
import { checkCandidateResult } from "@/features/identity-verification/server/candidate-result.service";
const candidateId = "11111111-1111-4111-8111-111111111111", attemptId = "22222222-2222-4222-8222-222222222222";
const owner = { id: "owner", sessionId: "live-session" }, supabase = {} as SupabaseClient;
const claim = { subject_type: "candidate", verification_method: "candidate_liveness_only", candidate_id: candidateId, attempt_id: attemptId,
  task_type: "reconcile", claim_token: candidateId, provider_session_ref: candidateId, provider_workflow_id: candidateId,
  provider_workflow_version: 1, provider_vendor_data: "iv:subject:attempt", work_attempts: 1 };
describe("owner-requested authoritative result check", () => {
  beforeEach(() => { current.mockReset().mockResolvedValue({ state: "active", attemptId }); admin.rpc.mockReset().mockResolvedValue({ data: claim, error: null }); createAdmin.mockReset().mockReturnValue(admin); processClaim.mockReset().mockResolvedValue({ status: "completed" }); });
  it("checks ownership before creating a privileged client and never creates a session", async () => {
    current.mockRejectedValue(new Error("unauthorized"));
    await expect(checkCandidateResult(supabase, candidateId, attemptId, owner)).rejects.toThrow("unauthorized");
    expect(createAdmin).not.toHaveBeenCalled(); expect(processClaim).not.toHaveBeenCalled();
  });
  it("rejects stale attempt IDs without privileged access", async () => {
    await expect(checkCandidateResult(supabase, candidateId, candidateId, owner)).rejects.toMatchObject({ status: 409 });
    expect(createAdmin).not.toHaveBeenCalled();
  });
  it("passes the verified owner/session to the guarded lease and reuses the canonical worker", async () => {
    current.mockResolvedValueOnce({ state: "active", attemptId }).mockResolvedValueOnce({ state: "verified", attemptId });
    expect(await checkCandidateResult(supabase, candidateId, attemptId, owner)).toMatchObject({ state: "verified" });
    expect(admin.rpc).toHaveBeenCalledWith("claim_candidate_liveness_result", { p_candidate_id: candidateId, p_attempt_id: attemptId, p_owner_user_id: owner.id, p_owner_session_id: owner.sessionId });
    expect(processClaim).toHaveBeenCalledWith(claim);
    expect(current).toHaveBeenCalledTimes(2);
  });
  it("respects another worker's lease/backoff without another provider request", async () => {
    admin.rpc.mockResolvedValue({ data: null, error: null });
    await checkCandidateResult(supabase, candidateId, attemptId, owner);
    expect(processClaim).not.toHaveBeenCalled();
  });
  it.each(["verified", "cleanup_pending", "expired", "cancelled"])("does not request provider work for %s", async state => {
    current.mockResolvedValue({ state, attemptId });
    await checkCandidateResult(supabase, candidateId, attemptId, owner);
    expect(createAdmin).not.toHaveBeenCalled();
  });
  it.each([{}, { ...claim, subject_type: "organization_representative" }, { ...claim, attempt_id: candidateId }])("rejects malformed or unrelated claims", async data => {
    admin.rpc.mockResolvedValue({ data, error: null });
    await expect(checkCandidateResult(supabase, candidateId, attemptId, owner)).rejects.toMatchObject({ status: 503 });
    expect(processClaim).not.toHaveBeenCalled();
  });
  it("maps a database authorization failure safely", async () => {
    admin.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private" } });
    await expect(checkCandidateResult(supabase, candidateId, attemptId, owner)).rejects.toMatchObject({ status: 403 });
    expect(processClaim).not.toHaveBeenCalled();
  });
});
