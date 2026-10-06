import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSandboxRecoveryJournal, recoverLivenessSandbox, verifyLivenessSandbox } from "../scripts/verify-didit-liveness-sandbox.mjs";

const workflowId = "55555555-5555-4555-8555-555555555555";
const sessionId = "44444444-4444-4444-8444-444444444444";
function journal() {
  let entry: { vendorData: string; workflowId: string; createdAt: string } | null = null;
  return {
    record: vi.fn(async (value) => { entry = value; }),
    read: vi.fn(async () => entry),
    complete: vi.fn(async () => { entry = null; }),
  };
}

describe("document-free Didit Sandbox contract", () => {
  it("uses a sandbox-only scenario, validates workflow metadata and purges the session", async () => {
    const recovery = journal();
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

    await expect(verifyLivenessSandbox({
      apiKey: "sandbox-key", workflowId, journal: recovery, fetchImpl,
    })).resolves.toEqual({ workflowVersion: 2 });
    const request = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(request).toEqual(expect.objectContaining({
      workflow_id: workflowId,
      sandbox_scenario: "approve",
    }));
    expect(request).not.toHaveProperty("expected_details");
    expect(request).not.toHaveProperty("portrait_image");
    expect(fetchImpl.mock.calls[1][0]).toBe(`https://verification.didit.me/v3/session/${sessionId}/delete/`);
    expect(fetchImpl.mock.calls[1][1].method).toBe("DELETE");
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ retain_face_embeddings: false });
    expect(recovery.record).toHaveBeenCalledTimes(1);
    expect(recovery.complete).toHaveBeenCalledTimes(1);
  });

  it("still deletes when the provider returns an unexpected workflow", async () => {
    const recovery = journal();
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
    await expect(verifyLivenessSandbox({
      apiKey: "sandbox-key", workflowId, journal: recovery, fetchImpl,
    })).rejects.toThrow("DIDIT_SANDBOX_RESPONSE_INVALID");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(recovery.complete).toHaveBeenCalledTimes(1);
  });

  it("rejects a provider deletion that retains a biometric template", async () => {
    const recovery = journal();
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
    await expect(verifyLivenessSandbox({
      apiKey: "sandbox-key", workflowId, journal: recovery, fetchImpl,
    })).rejects.toThrow("DIDIT_SANDBOX_PURGE_FAILED");
    expect(recovery.complete).not.toHaveBeenCalled();
  });

  it("retains a pre-create lookup handle and retries a failed purge", async () => {
    const recovery = journal();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: sessionId, workflow_id: workflowId, workflow_version: 2,
        url: "https://verify.didit.me/session/private-token",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementationOnce(async (url) => {
        expect(new URL(url).searchParams.get("vendor_data")).toBe((await recovery.read())?.vendorData);
        return new Response(JSON.stringify({ next: null, results: [{
          session_id: sessionId, vendor_data: (await recovery.read())?.vendorData,
        }] }), { status: 200 });
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: sessionId, face_retention_outcome: "deleted", biometric_template_uuid: null,
      }), { status: 200 }));
    await expect(verifyLivenessSandbox({
      apiKey: "sandbox-key", workflowId,
      journal: recovery, fetchImpl,
    })).rejects.toThrow("DIDIT_SANDBOX_PURGE_FAILED");
    expect(recovery.record).toHaveBeenCalledBefore(fetchImpl);
    expect(recovery.complete).not.toHaveBeenCalled();
    await expect(recoverLivenessSandbox({ apiKey: "sandbox-key", journal: recovery, fetchImpl }))
      .resolves.toEqual({ deleted: 1 });
    expect(recovery.complete).toHaveBeenCalledTimes(1);
  });

  it("keeps the lookup handle when create response is unreadable and zero sessions are found", async () => {
    const recovery = journal();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("not-json", { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ next: null, results: [] }), { status: 200 }));
    await expect(verifyLivenessSandbox({
      apiKey: "sandbox-key", workflowId,
      journal: recovery, fetchImpl,
    })).rejects.toThrow("DIDIT_SANDBOX_RESPONSE_INVALID");
    await expect(recoverLivenessSandbox({ apiKey: "sandbox-key", journal: recovery, fetchImpl }))
      .rejects.toThrow("DIDIT_SANDBOX_RECOVERY_UNCONFIRMED");
    expect(recovery.complete).not.toHaveBeenCalled();
  });

  it("requires a durable journal before any provider request", async () => {
    const fetchImpl = vi.fn();
    await expect(verifyLivenessSandbox({
      apiKey: "sandbox-key", workflowId,
      journal: null, fetchImpl,
    })).rejects.toThrow("DIDIT_SANDBOX_JOURNAL_REQUIRED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("writes the recovery correlation outside the repository with owner-only permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nak60-recovery-"));
    const file = join(directory, "session.json");
    try {
      const recovery = createSandboxRecoveryJournal(file);
      const entry = { vendorData: "nak60-sandbox:test", workflowId, createdAt: "2026-09-30T00:00:00Z" };
      if (((await stat(directory)).mode & 0o077) !== 0) {
        // Some hosts, including Windows, do not expose owner-only POSIX bits
        // for temporary directories. The journal must fail closed there.
        await expect(recovery.record(entry)).rejects.toThrow("DIDIT_SANDBOX_JOURNAL_INVALID");
        await expect(readFile(file)).rejects.toThrow();
        return;
      }
      await recovery.record(entry);
      expect((await stat(file)).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({ workflowId });
      await expect(recovery.record({ vendorData: "overwrite" })).rejects.toThrow();
      await recovery.complete();
      await expect(readFile(file)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses a recovery journal inside the repository", () => {
    expect(() => createSandboxRecoveryJournal(join(process.cwd(), "didit-recovery.json")))
      .toThrow("DIDIT_SANDBOX_JOURNAL_INVALID");
  });
});
