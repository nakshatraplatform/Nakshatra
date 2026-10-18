import { describe, expect, it, vi } from "vitest";
import { processRetention } from "@/features/operations/server/retention.service";
import { processHoroscopeCleanup } from "@/features/horoscope/server/horoscope-cleanup.service";

describe("independent retention work", () => {
  it("runs every fixed class despite one failure and reports deferred backlog", async () => {
    const rpc = vi.fn(async (_name: string, args: { p_class: string; p_limit: number }): Promise<{ data: unknown; error: unknown }> => {
      if (args.p_class === "viewerSessionsDeleted") throw new Error("private failure");
      return { data: { affected: 500, remaining: args.p_class === "rateLimitsDeleted" ? 1 : 0 }, error: null };
    });
    expect(await processRetention({ rpc } as never)).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(7);
    expect(rpc).toHaveBeenCalledWith("run_retention_class", { p_class: "accessAuditEventsDeleted", p_limit: 500 });
    rpc.mockResolvedValue({ data: { affected: 0, remaining: 0 }, error: null });
    expect(await processRetention({ rpc } as never)).toBe(true);
    rpc.mockResolvedValue({ data: { affected: 0 }, error: null });
    expect(await processRetention({ rpc } as never)).toBe(false);
  });
});

describe("durable horoscope object cleanup", () => {
  const job = { storage_path: "owner/portfolio/old.webp", claim_token: "a1740000-1111-4111-8111-111111111111" };
  it("records a retry after Storage failure, keeping the durable obligation", async () => {
    const remove = vi.fn().mockResolvedValue({ error: { message: "private storage detail" } });
    const rpc = vi.fn(async (name) => ({ data: name === "claim_horoscope_cleanup" ? [job] : true, error: null }));
    const client = { rpc, storage: { from: () => ({ remove }) } };
    expect(await processHoroscopeCleanup(client as never)).toEqual({ deferred: 1 });
    expect(remove).toHaveBeenCalledWith([job.storage_path]);
    expect(rpc).toHaveBeenLastCalledWith("finish_horoscope_cleanup", { p_storage_path: job.storage_path,
      p_claim_token: job.claim_token, p_error_code: "STORAGE_CLEANUP_FAILED" });
    remove.mockResolvedValue({ error: null });
    expect(await processHoroscopeCleanup(client as never)).toEqual({ deferred: 0 });
    expect(rpc).toHaveBeenLastCalledWith("finish_horoscope_cleanup", { p_storage_path: job.storage_path,
      p_claim_token: job.claim_token, p_error_code: null });
  });
  it("rejects malformed claims and unfenced completion", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(processHoroscopeCleanup({ rpc } as never)).rejects.toThrow("HOROSCOPE_CLEANUP_CLAIM_FAILED");
    rpc.mockResolvedValueOnce({ data: [job], error: null }).mockResolvedValueOnce({ data: false, error: null });
    const client = { rpc, storage: { from: () => ({ remove: async () => ({ error: null }) }) } };
    await expect(processHoroscopeCleanup(client as never)).rejects.toThrow("HOROSCOPE_CLEANUP_COMPLETION_FAILED");
  });
});
