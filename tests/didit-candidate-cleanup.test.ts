import { expect, it, vi } from "vitest";
import { createIdentityVerificationWorker } from "../scripts/identity-verification-worker.mjs";

const claim = { subject_type: "candidate", verification_method: "candidate_liveness_only", task_type: "provider_redaction",
  attempt_id: "44444444-4444-4444-8444-444444444444", claim_token: "fixture-lease",
  provider_session_ref: "11111111-1111-4111-8111-111111111111", provider_workflow_id: "22222222-2222-4222-8222-222222222222",
  provider_workflow_version: 2, provider_vendor_data: "iv:subject:attempt" };
const decision = { session_id: claim.provider_session_ref, workflow_id: claim.provider_workflow_id, workflow_version: 2,
  vendor_data: claim.provider_vendor_data, status: "Approved", session_url: null, liveness_checks: [{ status: "Approved" }] };
const receipt = { session_id: claim.provider_session_ref, face_retention_outcome: "deleted", biometric_template_uuid: null };
function fixture(fetchImpl = vi.fn()) {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  return { rpc, fetchImpl, worker: createIdentityVerificationWorker({ rpc }, { apiKey: "loopback-only-api-key", candidateWorkflowId: claim.provider_workflow_id, fetchImpl }) };
}

it.each(["candidate_liveness_only", "candidate_liveness_ip"])("does not convert an unknown child status into a biometric decline: %s", async method => {
  const { worker, rpc } = fixture(vi.fn().mockResolvedValue(Response.json({ ...decision,
    liveness_checks: [{ status: "UNRECOGNIZED_PROVIDER_STATUS" }], ...(method.endsWith("_ip") ? { ip_analyses: [{ status: "Approved" }] } : {}) })));
  expect(await worker.process({ ...claim, task_type: "reconcile", verification_method: method })).toEqual({ status: "deferred" });
  expect(rpc).not.toHaveBeenCalledWith("complete_identity_verification_reconciliation", expect.anything());
});
it.each(["   ", null, "Unknown"])("defers invalid child statuses without an outcome: %s", async status => {
  const { worker, rpc } = fixture(vi.fn().mockResolvedValue(Response.json({ ...decision, liveness_checks: [{ status }] })));
  expect(await worker.process({ ...claim, task_type: "reconcile" })).toEqual({ status: "deferred" });
  expect(rpc).not.toHaveBeenCalledWith("complete_identity_verification_reconciliation", expect.anything());
});
it("rejects unknown IP-check statuses on legacy candidate IP checks", async () => {
  const { worker, rpc } = fixture(vi.fn().mockResolvedValue(Response.json({ ...decision, ip_analyses: [{ status: "Unknown" }] })));
  expect(await worker.process({ ...claim, task_type: "reconcile", verification_method: "candidate_liveness_ip" })).toEqual({ status: "deferred" });
  expect(rpc).not.toHaveBeenCalledWith("complete_identity_verification_reconciliation", expect.anything());
});
it("validates correlation before deleting a known session", async () => {
  const { worker, fetchImpl, rpc } = fixture(vi.fn().mockResolvedValueOnce(Response.json(decision)).mockResolvedValueOnce(Response.json(receipt)));
  expect(await worker.process(claim)).toEqual({ status: "completed" });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(fetchImpl.mock.calls[0][0]).toContain("/decision/?include=events");
  expect(fetchImpl.mock.calls[1][1].method).toBe("DELETE");
  expect(rpc).toHaveBeenCalledWith("complete_identity_verification_provider_redaction", expect.anything());
});
it.each([{ vendor_data: "another-attempt" }, { workflow_version: 3 }, { workflow_id: claim.provider_session_ref },
  { session_id: claim.provider_workflow_id }, { workflow_version: undefined }])("never deletes an unrelated or unverifiable session: %j", async patch => {
  const { worker, fetchImpl, rpc } = fixture(vi.fn().mockResolvedValue(Response.json({ ...decision, ...patch })));
  expect(await worker.process(claim)).toEqual({ status: "deferred" });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl.mock.calls[0][1].method).not.toBe("DELETE");
  expect(rpc).not.toHaveBeenCalledWith("complete_identity_verification_provider_redaction", expect.anything());
});
it.each([429, 500])("preserves cleanup on retrieval outage HTTP %s", async status => {
  const { worker, fetchImpl } = fixture(vi.fn().mockResolvedValue(new Response(null, { status })));
  expect(await worker.process(claim)).toEqual({ status: "deferred" });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl.mock.calls[0][1].method).not.toBe("DELETE");
});
it("records known-session absence separately from biometric purge", async () => {
  const { worker, rpc, fetchImpl } = fixture(vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
  expect(await worker.process(claim)).toEqual({ status: "completed" });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("complete_identity_verification_provider_absence", expect.anything());
  expect(rpc).not.toHaveBeenCalledWith("complete_identity_verification_provider_redaction", expect.anything());
});
it.each([null, receipt])("requires a valid HTTP 200 deletion receipt, never confusing null JSON with absence", async body => {
  const { worker, rpc } = fixture(vi.fn().mockResolvedValueOnce(Response.json(decision)).mockResolvedValueOnce(Response.json(body, { status: body ? 201 : 200 })));
  expect(await worker.process(claim)).toEqual({ status: "deferred" });
  expect(rpc.mock.calls.every(([name]) => name === "defer_identity_verification_work")).toBe(true);
});
it("does not let cancellation bypass a preceding reconciliation correlation failure", async () => {
  const { worker, rpc, fetchImpl } = fixture(vi.fn().mockImplementation(async () => Response.json({ ...decision, vendor_data: "unrelated-session" })));
  expect(await worker.process({ ...claim, task_type: "reconcile" })).toEqual({ status: "deferred" });
  expect(await worker.process(claim)).toEqual({ status: "deferred" });
  expect(fetchImpl.mock.calls.every(([, options]) => options.method !== "DELETE")).toBe(true);
  expect(rpc.mock.calls.every(([name]) => name === "defer_identity_verification_work")).toBe(true);
});
