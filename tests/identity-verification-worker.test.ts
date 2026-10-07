import { afterEach, describe, expect, it, vi } from "vitest";
import { createIdentityVerificationWorker, evaluateDiditDecision } from "../scripts/identity-verification-worker.mjs";
import { hashIdentityBirthDate } from "../src/features/identity-verification/server/identity-match.mjs";

const claim = {
  attempt_id: "11111111-1111-4111-8111-111111111111",
  birth_date: "1990-01-01",
  candidate_id: "22222222-2222-4222-8222-222222222222",
  claim_token: "33333333-3333-4333-8333-333333333333",
  legal_name: "Test Person",
  provider_session_ref: "44444444-4444-4444-8444-444444444444",
  subject_type: "candidate",
  task_type: "reconcile",
  verification_method: "document_identity",
};

const approvedDecision = {
  session_id: claim.provider_session_ref,
  status: "Approved",
  id_verifications: [{ status: "Approved", first_name: "Test", last_name: "Person", date_of_birth: "1990-01-01" }],
  liveness_checks: [{ status: "Approved", method: "PASSIVE_3D" }],
  face_matches: [{ status: "Approved" }],
};

function workerClient(claims: Array<Record<string, unknown>> = [claim]) {
  const rpc = vi.fn((name: string): Promise<{ data: Array<Record<string, unknown>> | boolean | null; error: { code: string } | null }> => Promise.resolve(
    name === "claim_identity_verification_work" ? { data: claims, error: null } : { data: true, error: null }
  ));
  return { rpc, client: { rpc } };
}

describe("identity-verification worker", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defers missing candidate workflow metadata instead of recording a biometric decline", async () => {
    const workflowId = "66666666-6666-4666-8666-666666666666";
    const candidate = { ...claim, verification_method: "candidate_liveness_only", provider_workflow_id: workflowId, provider_workflow_version: 1, provider_vendor_data: "iv:fixture:attempt" };
    const { client, rpc } = workerClient([candidate]);
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ session_id: candidate.provider_session_ref, workflow_id: workflowId, vendor_data: candidate.provider_vendor_data, status: "Approved", liveness_checks: [{ status: "Approved" }] }));
    await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl, candidateWorkflowId: workflowId }).run(1)).resolves.toMatchObject({ deferred: 1, completed: 0 });
    expect(rpc.mock.calls.some(([name]) => name === "complete_identity_verification_reconciliation")).toBe(false);
    expect(fetchImpl.mock.calls[0][0]).toContain("?include=events");
  });

  it("processes candidate liveness without a representative matching key", async () => {
    vi.stubEnv("IDENTITY_VERIFICATION_MATCH_HMAC_KEY", "");
    const workflowId = "66666666-6666-4666-8666-666666666666";
    const candidate = { ...claim, verification_method: "candidate_liveness_only", provider_workflow_id: workflowId, provider_workflow_version: 1, provider_vendor_data: "iv:fixture:attempt" };
    const { client, rpc } = workerClient([]);
    rpc.mockImplementation(async name => ({ data: name === "claim_candidate_identity_verification_work" ? [candidate] : true, error: null }));
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ session_id: candidate.provider_session_ref, workflow_id: workflowId, workflow_version: 1, vendor_data: candidate.provider_vendor_data, status: "Approved", liveness_checks: [{ status: "Approved" }] }));
    await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl, candidateWorkflowId: workflowId, candidateOnly: true }).run(1)).resolves.toMatchObject({ completed: 1, deferred: 0 });
    expect(rpc).toHaveBeenCalledWith("claim_candidate_identity_verification_work", { p_limit: 1 });
    expect(rpc.mock.calls.some(([name]) => name === "claim_identity_verification_work")).toBe(false);
  });

  it("fails closed without provider requests if the candidate queue returns a representative", async () => {
    const { client, rpc } = workerClient([]);
    rpc.mockImplementation(async name => ({ data: name === "claim_candidate_identity_verification_work" ? [{ ...claim, subject_type: "organization_representative" }] : true, error: null }));
    const fetchImpl = vi.fn();
    await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl, candidateOnly: true }).run(1)).rejects.toThrow("IDENTITY_VERIFICATION_WORK_SCOPE_INVALID");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("continues the batch when provider failure races with a retired candidate lease", async () => {
    const workflowId = "66666666-6666-4666-8666-666666666666";
    vi.stubEnv("DIDIT_WORKFLOW_ID", workflowId);
    const candidate = { ...claim, verification_method: "candidate_liveness_only", provider_workflow_id: workflowId, provider_workflow_version: 1, provider_vendor_data: "iv:fixture:attempt" };
    const second = { ...candidate, attempt_id: "77777777-7777-4777-8777-777777777777" };
    const { client, rpc } = workerClient([candidate, second]);
    rpc.mockImplementation(async name => ({ data: name === "claim_identity_verification_work" ? [candidate, second] : name === "defer_identity_verification_work" ? false : true, error: null }));
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("provider timeout")).mockResolvedValueOnce(Response.json({ session_id: candidate.provider_session_ref, workflow_id: workflowId, workflow_version: 1, vendor_data: candidate.provider_vendor_data, status: "Approved", liveness_checks: [{ status: "Approved" }] }));
    await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl }).run(2)).resolves.toMatchObject({ completed: 2, deferred: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not hide database errors when deferring a candidate failure", async () => {
    const workflowId = "66666666-6666-4666-8666-666666666666";
    vi.stubEnv("DIDIT_WORKFLOW_ID", workflowId);
    const candidate = { ...claim, verification_method: "candidate_liveness_only", provider_workflow_id: workflowId, provider_workflow_version: 1, provider_vendor_data: "iv:fixture:attempt" };
    const { client, rpc } = workerClient([candidate]);
    rpc.mockImplementation(async name => name === "defer_identity_verification_work" ? { data: null, error: { code: "08006" } } : { data: name === "claim_identity_verification_work" ? [candidate] : true, error: null });
    await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl: vi.fn().mockRejectedValue(new Error("provider timeout")) }).run(1)).rejects.toThrow("IDENTITY_VERIFICATION_DEFERRAL_FAILED");
  });

  it("does not raise cleanup alerts for a candidate lease retired during reconciliation", async () => {
    const workflowId = "66666666-6666-4666-8666-666666666666";
    vi.stubEnv("DIDIT_WORKFLOW_ID", workflowId);
    const candidate = { ...claim, verification_method: "candidate_liveness_only", provider_workflow_id: workflowId, provider_workflow_version: 1, provider_vendor_data: "iv:fixture:attempt" };
    const { client, rpc } = workerClient([candidate]);
    rpc.mockImplementation(async name => ({ data: name === "claim_identity_verification_work" ? [candidate] : name === "complete_identity_verification_reconciliation" ? false : true, error: null }));
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ session_id: candidate.provider_session_ref, workflow_id: workflowId, workflow_version: 1, vendor_data: candidate.provider_vendor_data, status: "Approved", liveness_checks: [{ status: "Approved" }] }));
    await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl }).run(1)).resolves.toMatchObject({ completed: 1, deferred: 0 });
    expect(rpc.mock.calls.some(([name]) => name === "defer_identity_verification_work")).toBe(false);
  });

  it("reconciles a photo claim using the shared workflow environment settings", async () => {
    const workflowId = "66666666-6666-4666-8666-666666666666";
    vi.stubEnv("DIDIT_WORKFLOW_ID", workflowId);

    const photoClaim = {
      ...claim, verification_method: "portfolio_photo_liveness",
      provider_workflow_id: workflowId, provider_workflow_version: 7,
    };
    const { client, rpc } = workerClient([photoClaim]);
    const fetchImpl = vi.fn().mockImplementation(async () => Response.json({
      session_id: claim.provider_session_ref, status: "Approved",
      workflow_id: workflowId, workflow_version: 7,
      liveness_checks: [{ status: "Approved", method: "PASSIVE_3D" }],
      face_matches: [{ status: "Approved" }],
    }));
    await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl }).run(1))
      .resolves.toMatchObject({ completed: 1, deferred: 0 });
    expect(rpc).toHaveBeenCalledWith("complete_identity_verification_reconciliation", expect.objectContaining({
      p_outcome: "verified", p_id_verified: false,
    }));
    vi.stubEnv("DIDIT_WORKFLOW_ID", "88888888-8888-4888-8888-888888888888");
    const mismatched = workerClient([photoClaim]);
    await expect(createIdentityVerificationWorker(mismatched.client, { apiKey: "test-api-key", fetchImpl }).run(1))
      .resolves.toMatchObject({ completed: 0, deferred: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("accepts the candidate photo workflow only with the pinned workflow and no document checks", () => {
    const photoClaim = {
      ...claim,
      verification_method: "portfolio_photo_liveness",
      provider_workflow_id: "55555555-5555-4555-8555-555555555555",
      provider_workflow_version: 4,
    };
    const photoDecision = {
      session_id: claim.provider_session_ref,
      status: "Approved",
      workflow_id: photoClaim.provider_workflow_id,
      workflow_version: 4,
      id_verifications: [],
      liveness_checks: [{ status: "Approved", method: "PASSIVE_3D" }],
      face_matches: [{ status: "Approved" }],
    };
    expect(evaluateDiditDecision(photoDecision, photoClaim)).toEqual({
      outcome: "verified",
      idVerified: false,
      passiveLivenessVerified: true,
      faceMatchVerified: true,
      nameMatches: false,
      birthDateMatches: false,
    });
    expect(evaluateDiditDecision({ ...photoDecision, workflow_version: 5 }, photoClaim).outcome).toBe("declined");
    expect(evaluateDiditDecision({ ...photoDecision, id_verifications: [{ status: "Approved" }] }, photoClaim).outcome).toBe("declined");
  });

  it("accepts a provider approval only when every required check and expected detail matches", () => {
    expect(evaluateDiditDecision(approvedDecision, claim)).toEqual({
      outcome: "verified",
      idVerified: true,
      passiveLivenessVerified: true,
      faceMatchVerified: true,
      nameMatches: true,
      birthDateMatches: true,
    });
    expect(evaluateDiditDecision({ ...approvedDecision, liveness_checks: [{ status: "Approved", method: "ACTIVE" }] }, claim).outcome).toBe("declined");
    expect(evaluateDiditDecision({ ...approvedDecision, id_verifications: [...approvedDecision.id_verifications, approvedDecision.id_verifications[0]] }, claim).outcome).toBe("declined");
    expect(evaluateDiditDecision({ ...approvedDecision, status: "In Review" }, claim).outcome).toBe("pending");
    expect(evaluateDiditDecision({ ...approvedDecision, status: "Abandoned" }, claim).outcome).toBe("expired");
  });

  it("matches a representative birth date through its keyed digest without a retained raw date", () => {
    const key = "representative-test-match-key-with-at-least-32-characters";
    const representativeClaim = {
      ...claim,
      birth_date: null,
      birth_date_hash: hashIdentityBirthDate("1990-01-01", key),
      candidate_id: null,
      subject_type: "organization_representative",
    };
    expect(evaluateDiditDecision(approvedDecision, representativeClaim, key).birthDateMatches).toBe(true);
    expect(evaluateDiditDecision(
      { ...approvedDecision, id_verifications: [{ ...approvedDecision.id_verifications[0], date_of_birth: "1990-01-02" }] },
      representativeClaim,
      key
    ).birthDateMatches).toBe(false);
    expect(JSON.stringify(representativeClaim)).not.toContain("1990-01-01");
    expect(() => evaluateDiditDecision(approvedDecision, representativeClaim, "too-short"))
      .toThrow("IDENTITY_MATCH_KEY_UNAVAILABLE");
  });

  it("reconciles decisions through the lease-bound RPC without retaining provider payloads", async () => {
    const { client, rpc } = workerClient();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(approvedDecision), { status: 200 }));
    const result = await createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl }).run(10);

    expect(result).toMatchObject({ claimed: 1, completed: 1, pending: 0, deferred: 0 });
    expect(rpc).toHaveBeenCalledWith("complete_identity_verification_reconciliation", expect.objectContaining({
      p_attempt_id: claim.attempt_id,
      p_outcome: "verified",
      p_passive_liveness_verified: true,
    }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("id_verifications");
  });

  it("defers transient decision failures and confirms biometric deletion before redaction", async () => {
    const { client, rpc } = workerClient();
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("network"));
    const worker = createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl });
    await expect(worker.run(1)).resolves.toMatchObject({ completed: 0, pending: 0, deferred: 1 });
    expect(rpc).toHaveBeenCalledWith("defer_identity_verification_work", expect.objectContaining({
      p_error_code: "DIDIT_DECISION_FETCH_FAILED",
    }));

    const redaction = { ...claim, task_type: "provider_redaction" };
    const redactionClient = workerClient([redaction]);
    const deleteFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      session_id: claim.provider_session_ref,
      face_retention_outcome: "deleted",
      biometric_template_uuid: null,
    }), { status: 200 }));
    await expect(createIdentityVerificationWorker(redactionClient.client, { apiKey: "test-api-key", fetchImpl: deleteFetch }).run(1))
      .resolves.toMatchObject({ completed: 1, pending: 0, deferred: 0 });
    expect(redactionClient.rpc).toHaveBeenCalledWith("complete_identity_verification_provider_redaction", expect.any(Object));
    expect(JSON.parse(deleteFetch.mock.calls[0][1].body)).toEqual({ retain_face_embeddings: false });

    const retained = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      session_id: claim.provider_session_ref,
      face_retention_outcome: "retained_with_user",
      biometric_template_uuid: "77777777-7777-4777-8777-777777777777",
    }), { status: 200 }));
    const failed = workerClient([redaction]);
    await expect(createIdentityVerificationWorker(failed.client, { apiKey: "test-api-key", fetchImpl: retained }).run(1))
      .resolves.toMatchObject({ completed: 0, deferred: 1 });
    expect(failed.rpc).not.toHaveBeenCalledWith("complete_identity_verification_provider_redaction", expect.anything());
    expect(failed.rpc).toHaveBeenCalledWith("defer_identity_verification_work", expect.objectContaining({
      p_error_code: "DIDIT_SESSION_PURGE_FAILED",
    }));

    const unknown = workerClient([redaction]);
    await expect(createIdentityVerificationWorker(unknown.client, {
      apiKey: "test-api-key",
      fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    }).run(1)).resolves.toMatchObject({ completed: 1, deferred: 0 });
    expect(unknown.rpc).not.toHaveBeenCalledWith("complete_identity_verification_provider_redaction", expect.anything());
    expect(unknown.rpc).toHaveBeenCalledWith("complete_identity_verification_provider_absence", expect.objectContaining({ p_attempt_id: redaction.attempt_id }));

    const oldPhotoRedaction = {
      ...redaction,
      verification_method: "portfolio_photo_liveness",
      provider_workflow_id: "66666666-6666-4666-8666-666666666666",
      provider_workflow_version: 3,
      provider_vendor_data: "iv:legacy-photo:attempt",
    };
    const rotated = workerClient([oldPhotoRedaction]);
    const rotatedDelete = vi.fn().mockResolvedValueOnce(Response.json({
      session_id: claim.provider_session_ref, workflow_id: oldPhotoRedaction.provider_workflow_id,
      workflow_version: 3, vendor_data: oldPhotoRedaction.provider_vendor_data, status: "Expired",
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      session_id: claim.provider_session_ref,
      face_retention_outcome: "deleted",
      biometric_template_uuid: null,
    }), { status: 200 }));
    await expect(createIdentityVerificationWorker(rotated.client, {
      apiKey: "test-api-key",
      fetchImpl: rotatedDelete,
      candidateWorkflowId: "88888888-8888-4888-8888-888888888888",

    }).run(1)).resolves.toMatchObject({ completed: 1, deferred: 0 });
    expect(rotatedDelete).toHaveBeenCalledTimes(2);
  });

  it("recovers and deletes an unattached photo session by exact vendor correlation", async () => {
    const recoveryClaim = {
      ...claim,
      task_type: "provider_recovery",
      provider_session_ref: null,
      verification_method: "portfolio_photo_liveness",
      provider_vendor_data: `iv:55555555-5555-4555-8555-555555555555:${claim.attempt_id}`,
      provider_workflow_id: "66666666-6666-4666-8666-666666666666",
      provider_workflow_version: 3,
      work_attempts: 1,
    };
    const { client, rpc } = workerClient([recoveryClaim]);
    const orphanSessionId = "77777777-7777-4777-8777-777777777777";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{
        session_id: orphanSessionId,
        vendor_data: recoveryClaim.provider_vendor_data,
        workflow_id: recoveryClaim.provider_workflow_id,
        workflow_version: 3,
      }] }), { status: 200 }))
      .mockResolvedValueOnce(Response.json({
        session_id: orphanSessionId,
        status: "Not Started",
        vendor_data: recoveryClaim.provider_vendor_data,
        workflow_id: recoveryClaim.provider_workflow_id,
        workflow_version: 3,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: orphanSessionId,
        face_retention_outcome: "deleted",
        biometric_template_uuid: null,
      }), { status: 200 }));

    await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl }).run(1))
      .resolves.toMatchObject({ completed: 1, deferred: 0 });
    expect(String(fetchImpl.mock.calls[0][0])).toContain(encodeURIComponent(recoveryClaim.provider_vendor_data));
    expect(rpc).toHaveBeenCalledWith("complete_identity_verification_provider_recovery", expect.objectContaining({
      p_attempt_id: claim.attempt_id,
    }));
  });

  it("defers empty or structurally unknown recovery lookups without closing the attempt", async () => {
    const recoveryClaim = {
      ...claim,
      task_type: "provider_recovery",
      provider_session_ref: null,
      verification_method: "portfolio_photo_liveness",
      provider_vendor_data: `iv:55555555-5555-4555-8555-555555555555:${claim.attempt_id}`,
      provider_workflow_id: "66666666-6666-4666-8666-666666666666",
      provider_workflow_version: 3,
      work_attempts: 1,
    };
    for (const body of [{ results: [] }, { unexpected: [] }]) {
      const { client, rpc } = workerClient([recoveryClaim]);
      const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
      await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl }).run(1))
        .resolves.toMatchObject({ completed: 0, deferred: 1 });
      expect(rpc).toHaveBeenCalledWith("defer_identity_verification_work", expect.objectContaining({
        p_attempt_id: claim.attempt_id,
        p_task_type: "provider_recovery",
      }));
      expect(rpc).not.toHaveBeenCalledWith("complete_identity_verification_provider_recovery", expect.anything());
    }
  });

  it("bounds an unavailable Didit request and defers it through the database policy", async () => {
    vi.useFakeTimers();
    try {
      const { client, rpc } = workerClient();
      const fetchMock = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }));
      const run = createIdentityVerificationWorker(client, {
        apiKey: "test-api-key",
        fetchImpl: fetchMock as typeof fetch,
        requestTimeoutMs: 100,
      }).run(1);

      await vi.advanceTimersByTimeAsync(100);
      await expect(run).resolves.toMatchObject({ completed: 0, pending: 0, deferred: 1 });
      expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
      expect(rpc).toHaveBeenCalledWith("defer_identity_verification_work", expect.not.objectContaining({
        p_delay_seconds: expect.anything(),
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an in-review decision distinct from a failed deferred operation", async () => {
    const { client, rpc } = workerClient();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...approvedDecision,
      status: "In Review",
    }), { status: 200 }));

    await expect(createIdentityVerificationWorker(client, { apiKey: "test-api-key", fetchImpl }).run(1))
      .resolves.toMatchObject({ claimed: 1, completed: 0, pending: 1, deferred: 0 });
    expect(rpc).toHaveBeenCalledWith("complete_identity_verification_reconciliation", expect.objectContaining({
      p_outcome: "pending",
    }));
    expect(rpc).not.toHaveBeenCalledWith("defer_identity_verification_work", expect.anything());
  });
});
