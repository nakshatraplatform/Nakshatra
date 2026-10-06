import { describe, expect, it, vi } from "vitest";
import { createIdentityVerificationWorker, evaluateDiditDecision } from "../scripts/identity-verification-worker.mjs";

const claim = {
  subject_type: "candidate", verification_method: "candidate_liveness_ip",
  provider_session_ref: "11111111-1111-4111-8111-111111111111",
  provider_workflow_id: "22222222-2222-4222-8222-222222222222",
  provider_workflow_version: 1,
  provider_vendor_data: "iv:subject:attempt",
};
const decision = {
  session_id: claim.provider_session_ref, status: "Approved",
  workflow_id: claim.provider_workflow_id, workflow_version: 1,
  vendor_data: claim.provider_vendor_data,
  liveness_checks: [{ status: "Approved", method: "PASSIVE" }],
  ip_analyses: [{ status: "Approved" }],
};

describe("candidate liveness and IP policy", () => {
  it("approves a live capture and IP check without photo matching or identity data", () => {
    expect(evaluateDiditDecision(decision, claim)).toMatchObject({
      outcome: "verified", livenessVerified: true, ipVerified: true,
      idVerified: false, faceMatchVerified: false, nameMatches: false, birthDateMatches: false,
    });
  });

  it.each([
    { ip_analyses: undefined }, { ip_analyses: [] }, { ip_analyses: [{ status: "Declined" }] },
    { ip_analyses: [{ status: "Approved" }, { status: "In Review" }] },
    { liveness_checks: [] }, { liveness_checks: [{ status: "Declined" }] },
    { liveness_checks: [{ status: "In Review" }] },
    { workflow_version: 2 }, { workflow_id: "wrong" }, { vendor_data: "wrong" },
    { id_verifications: [{ status: "Approved" }] }, { face_matches: [{ status: "Approved" }] },
    { id_verifications: {} }, { face_matches: "malformed" },
  ])("rejects an overall approval with incomplete or incompatible checks: %j", (patch) => {
    expect(evaluateDiditDecision({ ...decision, ...patch }, claim).outcome).toBe("declined");
  });

  it("keeps review pending and handles expiry without manufacturing a pass", () => {
    expect(evaluateDiditDecision({ ...decision, status: "In Review" }, claim).outcome).toBe("pending");
    expect(evaluateDiditDecision({ ...decision, status: "Expired" }, claim).outcome).toBe("expired");
    expect(evaluateDiditDecision({ ...decision, status: "Declined" }, claim).outcome).toBe("declined");
  });

  it("does not apply candidate assurance to a representative", () => {
    expect(() => evaluateDiditDecision(decision, { ...claim, subject_type: "organization_representative" }, "x".repeat(32)))
      .toThrow("IDENTITY_VERIFICATION_METHOD_INVALID");
  });

  it("passes explicit IP approval to the database and rejects configuration drift before fetching", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const fetchImpl = vi.fn().mockImplementation(async () => Response.json(decision));
    const worker = createIdentityVerificationWorker({ rpc }, {
      apiKey: "test-key", candidateWorkflowId: claim.provider_workflow_id,
      fetchImpl,
    });
    const work = { ...claim, task_type: "reconcile", attempt_id: "attempt", claim_token: "lease" };
    expect(await worker.process(work)).toEqual({ status: "completed" });
    expect(rpc).toHaveBeenCalledWith("complete_identity_verification_reconciliation", {
      p_attempt_id: "attempt", p_claim_token: "lease", p_outcome: "verified",
      p_id_verified: false, p_passive_liveness_verified: true, p_ip_verified: true,
      p_face_match_verified: false, p_name_matches: false, p_birth_date_matches: false,
    });
    expect(await worker.process({ ...work, provider_workflow_id: "33333333-3333-4333-8333-333333333333" })).toEqual({ status: "deferred" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
