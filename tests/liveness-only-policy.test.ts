import { describe, expect, it, vi } from "vitest";
import { createIdentityVerificationWorker, evaluateDiditDecision } from "../scripts/identity-verification-worker.mjs";

const claim = {
  subject_type: "candidate", verification_method: "candidate_liveness_only",
  provider_session_ref: "11111111-1111-4111-8111-111111111111",
  provider_workflow_id: "22222222-2222-4222-8222-222222222222",
  provider_workflow_version: 7, provider_vendor_data: "iv:subject:attempt",
};
const decision = {
  session_id: claim.provider_session_ref, status: "Approved",
  workflow_id: claim.provider_workflow_id, workflow_version: 7,
  vendor_data: claim.provider_vendor_data,
  liveness_checks: [{ status: "Approved", method: "PASSIVE" }],
};

describe("candidate liveness-only policy", () => {
  it("approves liveness without IP, identity, or face matching", () => {
    expect(evaluateDiditDecision(decision, claim)).toMatchObject({
      outcome: "verified", livenessVerified: true, ipVerified: false,
      idVerified: false, faceMatchVerified: false,
    });
  });
  it.each([
    { liveness_checks: [] }, { liveness_checks: [{ status: "Declined" }] },
    { liveness_checks: [{ status: "In Review" }] }, { workflow_version: 8 },
    { workflow_id: "wrong" }, { vendor_data: "wrong" },
    { id_verifications: [{ status: "Approved" }] }, { face_matches: [{ status: "Approved" }] },
    { ip_analyses: [{ status: "Approved" }] },
  ])("rejects incompatible approval: %j", (patch) => {
    expect(evaluateDiditDecision({ ...decision, ...patch }, claim).outcome).toBe("declined");
  });
  it("reconciles using the session's returned version, without a version environment variable", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const fetchImpl = vi.fn().mockResolvedValue(Response.json(decision));
    const worker = createIdentityVerificationWorker({ rpc }, {
      apiKey: "test-key", candidateWorkflowId: claim.provider_workflow_id, fetchImpl,
    });
    expect(await worker.process({ ...claim, task_type: "reconcile", attempt_id: "attempt", claim_token: "lease" }))
      .toEqual({ status: "completed" });
    expect(rpc).toHaveBeenCalledWith("complete_identity_verification_reconciliation", expect.objectContaining({
      p_outcome: "verified", p_passive_liveness_verified: true, p_ip_verified: false,
    }));
  });

  it.each([null, "wrong-workflow", "wrong-vendor", "wrong-session", "invalid-version"])("recovers uncertain creation with exact metadata (%s)", async (mismatch) => {
    const vendor = "iv:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444";
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const recovered = { ...decision, vendor_data: vendor };
    if (mismatch === "wrong-workflow") recovered.workflow_id = "wrong";
    if (mismatch === "wrong-vendor") recovered.vendor_data = "wrong";
    if (mismatch === "wrong-session") recovered.session_id = "wrong";
    if (mismatch === "invalid-version") recovered.workflow_version = 0;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({ results: [{ session_id: claim.provider_session_ref, vendor_data: vendor }], next: null }))
      .mockResolvedValueOnce(Response.json(recovered))
      .mockResolvedValueOnce(Response.json({ session_id: claim.provider_session_ref, face_retention_outcome: "deleted", biometric_template_uuid: null }));
    const worker = createIdentityVerificationWorker({ rpc }, { apiKey: "test-key", fetchImpl });
    const result = await worker.process({ ...claim, provider_session_ref: null, provider_workflow_version: null,
      provider_vendor_data: vendor, task_type: "provider_recovery", attempt_id: "attempt", claim_token: "lease", work_attempts: 1 });
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe("/v3/sessions/");
    expect(result.status).toBe(mismatch ? "deferred" : "completed");
    expect(fetchImpl).toHaveBeenCalledTimes(mismatch ? 2 : 3);
    if (mismatch) expect(rpc).not.toHaveBeenCalledWith("complete_identity_verification_provider_recovery", expect.anything());
  });
});
