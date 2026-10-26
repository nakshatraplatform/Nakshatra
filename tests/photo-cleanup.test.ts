import { describe, expect, it, vi } from "vitest";
import { processPhotoCleanup } from "@/features/media/server/photo-cleanup.service";

const job = { storage_path: "owner/portfolio/retired.webp", claim_token: "73000000-0000-4000-8000-000000000001" };
function client() {
  const rpc = vi.fn().mockResolvedValueOnce({ data: [job], error: null }).mockResolvedValue({ data: true, error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ remove }));
  return { rpc, remove, from, supabase: { rpc, storage: { from } } };
}
describe("retired photo cleanup", () => {
  it("deletes only leased photos and acknowledges their exact claim", async () => {
    const c = client();
    expect(await processPhotoCleanup(c.supabase as never)).toEqual({ deferred: 0 });
    expect(c.from).toHaveBeenCalledWith("photos");
    expect(c.remove).toHaveBeenCalledWith([job.storage_path]);
    expect(c.rpc).toHaveBeenLastCalledWith("finish_photo_cleanup", { p_storage_path: job.storage_path, p_claim_token: job.claim_token, p_error_code: null });
  });
  it.each(["error", "throw"])("defers failed storage cleanup (%s) without losing the obligation", async failure => {
    const c = client();
    if (failure === "throw") c.remove.mockRejectedValueOnce(new Error("private path"));
    else c.remove.mockResolvedValueOnce({ error: new Error("private path") } as never);
    expect(await processPhotoCleanup(c.supabase as never)).toEqual({ deferred: 1 });
    expect(c.rpc).toHaveBeenLastCalledWith("finish_photo_cleanup", { p_storage_path: job.storage_path, p_claim_token: job.claim_token, p_error_code: "STORAGE_CLEANUP_FAILED" });
  });
  it.each([null, [{ ...job, claim_token: "invalid" }], Array(6).fill(job)])("rejects malformed or excessive claims", async data => {
    const c = client(); c.rpc.mockReset().mockResolvedValue({ data, error: null });
    await expect(processPhotoCleanup(c.supabase as never)).rejects.toThrow("PHOTO_CLEANUP_CLAIM_FAILED");
    expect(c.remove).not.toHaveBeenCalled();
  });
  it("does not claim success when the lease cannot be acknowledged", async () => {
    const c = client(); c.rpc.mockResolvedValueOnce({ data: [job], error: null }).mockResolvedValueOnce({ data: false, error: null });
    await expect(processPhotoCleanup(c.supabase as never)).rejects.toThrow("PHOTO_CLEANUP_COMPLETION_FAILED");
  });
});
