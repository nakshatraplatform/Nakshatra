import { describe, expect, it, vi } from "vitest";
import { verifyPhotoMatchSandbox } from "../scripts/verify-didit-photo-match-sandbox.mjs";

const workflowId = "55555555-5555-4555-8555-555555555555";
const sessionId = "44444444-4444-4444-8444-444444444444";

describe("document-free Didit Sandbox contract", () => {
  it("uses a sandbox-only scenario, validates workflow metadata and purges the session", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: sessionId,
        workflow_id: workflowId,
        workflow_version: 2,
        url: "https://verify.didit.me/session/private-token",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: sessionId,
        face_retention_outcome: "deleted",
        biometric_template_uuid: null,
      }), { status: 200 }));

    await expect(verifyPhotoMatchSandbox({
      apiKey: "sandbox-key", workflowId, workflowVersion: 2, portrait: Buffer.from("test reference"), fetchImpl,
    })).resolves.toEqual({ workflowVersion: 2 });
    const request = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(request).toEqual(expect.objectContaining({
      workflow_id: workflowId,
      sandbox_scenario: "approve",
      portrait_image: Buffer.from("test reference").toString("base64"),
    }));
    expect(request).not.toHaveProperty("expected_details");
    expect(fetchImpl.mock.calls[1][0]).toBe(`https://verification.didit.me/v3/session/${sessionId}/delete/`);
    expect(fetchImpl.mock.calls[1][1].method).toBe("DELETE");
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ retain_face_embeddings: false });
  });

  it("still deletes when the provider returns an unexpected workflow", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: sessionId,
        workflow_id: "66666666-6666-4666-8666-666666666666",
        workflow_version: 1,
        url: "https://verify.didit.me/session/private-token",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: sessionId,
        face_retention_outcome: "deleted",
        biometric_template_uuid: null,
      }), { status: 200 }));
    await expect(verifyPhotoMatchSandbox({
      apiKey: "sandbox-key", workflowId, workflowVersion: 1, portrait: Buffer.from("test reference"), fetchImpl,
    })).rejects.toThrow("DIDIT_SANDBOX_RESPONSE_INVALID");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects a provider deletion that retains a biometric template", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: sessionId,
        workflow_id: workflowId,
        workflow_version: 2,
        url: "https://verify.didit.me/session/private-token",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: sessionId,
        face_retention_outcome: "retained_with_user",
        biometric_template_uuid: "77777777-7777-4777-8777-777777777777",
      }), { status: 200 }));
    await expect(verifyPhotoMatchSandbox({
      apiKey: "sandbox-key", workflowId, workflowVersion: 2, portrait: Buffer.from("test reference"), fetchImpl,
    })).rejects.toThrow("DIDIT_SANDBOX_PURGE_FAILED");
  });

  it("never creates a session without a bounded reference", async () => {
    const fetchImpl = vi.fn();
    await expect(verifyPhotoMatchSandbox({
      apiKey: "sandbox-key", workflowId, workflowVersion: 2, portrait: Buffer.alloc(2 * 1024 * 1024 + 1), fetchImpl,
    })).rejects.toThrow("DIDIT_SANDBOX_REFERENCE_INVALID");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
