import { describe, expect, it, vi } from "vitest";
import { processDeletedProviderCleanup } from "../scripts/deleted-provider-cleanup.mjs";

const job = { id: "cleanup", claim_token: "lease", provider_session_ref: "ae740000-1111-4111-8111-111111111111", provider_vendor_data: "correlation", provider_workflow_id: "ad740000-1111-4111-8111-111111111111", provider_workflow_version: 1 };
function fixture(responses: Response[], cleanupJob: Record<string, unknown> = job) {
  const rpc = vi.fn(async (name: string) => ({ data: name === "claim_deleted_provider_cleanup" ? [cleanupJob] : true, error: null }));
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return responses.shift()!;
  });
  return { rpc, transport, client: { rpc } };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const decision = { session_id: job.provider_session_ref, workflow_id: job.provider_workflow_id, workflow_version: 1, vendor_data: job.provider_vendor_data, status: "Approved", liveness_checks: [{ status: "Approved" }] };

describe("deleted-account provider cleanup", () => {
  it("keeps independent work when the provider is unavailable", async () => {
    const f = fixture([json({}, 503)]);
    expect(await processDeletedProviderCleanup(f.client, { apiKey: "test", fetchImpl: f.transport })).toEqual({ completed: 0, deferred: 1 });
    expect(f.rpc).toHaveBeenLastCalledWith("finish_deleted_provider_cleanup", expect.objectContaining({ p_id: job.id, p_claim_token: job.claim_token, p_error_code: expect.any(String) }));
  });
  it("never deletes a foreign session", async () => {
    const f = fixture([json({ ...decision, vendor_data: "someone-else" })]);
    expect((await processDeletedProviderCleanup(f.client, { apiKey: "test", fetchImpl: f.transport })).deferred).toBe(1);
    expect(f.transport).toHaveBeenCalledTimes(1);
  });
  it("requires explicit purge proof rather than treating 404 as success", async () => {
    const f = fixture([json(decision), json({}, 404)]);
    expect((await processDeletedProviderCleanup(f.client, { apiKey: "test", fetchImpl: f.transport })).deferred).toBe(1);
  });
  it("removes correlation only after a matching no-retention purge response", async () => {
    const f = fixture([json(decision), json({ session_id: job.provider_session_ref, face_retention_outcome: "deleted", biometric_template_uuid: null })]);
    expect(await processDeletedProviderCleanup(f.client, { apiKey: "test", fetchImpl: f.transport })).toEqual({ completed: 1, deferred: 0 });
    expect(f.transport).toHaveBeenLastCalledWith(expect.stringContaining("/delete/"), expect.objectContaining({ method: "DELETE", body: JSON.stringify({ retain_face_embeddings: false }) }));
    expect(f.rpc).toHaveBeenLastCalledWith("finish_deleted_provider_cleanup", { p_id: job.id, p_claim_token: job.claim_token, p_error_code: null });
  });
  it("discovers one correlation-matched session before deleting it", async () => {
    const discoveredJob = { ...job, provider_session_ref: null };
    const f = fixture([
      json([{ session_id: job.provider_session_ref, vendor_data: job.provider_vendor_data }]),
      json(decision),
      json({
        session_id: job.provider_session_ref,
        face_retention_outcome: "none",
        biometric_template_uuid: null,
      }),
    ], discoveredJob);

    await expect(processDeletedProviderCleanup(f.client, {
      apiKey: "test",
      fetchImpl: f.transport,
    })).resolves.toEqual({ completed: 1, deferred: 0 });
    const discoveryUrl = f.transport.mock.calls[0]?.[0];
    expect(discoveryUrl).toBeInstanceOf(URL);
    if (!(discoveryUrl instanceof URL)) throw new Error("Expected discovery request URL");
    expect(discoveryUrl.pathname).toBe("/v3/sessions/");
    expect([...discoveryUrl.searchParams.entries()]).toEqual([
      ["vendor_data", job.provider_vendor_data],
    ]);
    expect(f.transport).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ searchParams: expect.any(URLSearchParams) }),
      expect.objectContaining({ headers: expect.any(Object), signal: expect.any(AbortSignal) })
    );
  });
  it.each([
    ["no sessions", []],
    ["a foreign correlation", [{ session_id: job.provider_session_ref, vendor_data: "someone-else" }]],
    ["multiple sessions", [
      { session_id: job.provider_session_ref, vendor_data: job.provider_vendor_data },
      { session_id: "be850000-2222-4222-8222-222222222222", vendor_data: job.provider_vendor_data },
    ]],
    ["a paginated result", {
      results: [{ session_id: job.provider_session_ref, vendor_data: job.provider_vendor_data }],
      next: "https://verification.didit.me/v3/sessions/?page=2",
    }],
  ])("defers cleanup when discovery returns %s", async (_case, discoveryResult) => {
    const f = fixture([json(discoveryResult)], { ...job, provider_session_ref: null });

    await expect(processDeletedProviderCleanup(f.client, {
      apiKey: "test",
      fetchImpl: f.transport,
    })).resolves.toEqual({ completed: 0, deferred: 1 });
    expect(f.transport).toHaveBeenCalledTimes(1);
    expect(f.rpc).toHaveBeenLastCalledWith("finish_deleted_provider_cleanup", {
      p_id: job.id,
      p_claim_token: job.claim_token,
      p_error_code: "DIDIT_CLEANUP_DISCOVERY_UNCONFIRMED",
    });
  });
  it("fails if completion cannot be persisted", async () => {
    const f = fixture([]); f.rpc.mockResolvedValueOnce({ data: [job], error: null }).mockResolvedValueOnce({ data: false, error: null });
    await expect(processDeletedProviderCleanup(f.client, { apiKey: "" })).rejects.toThrow("DELETED_PROVIDER_COMPLETION_FAILED");
  });
});
