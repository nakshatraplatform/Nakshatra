import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

const jobsSchema = z.array(z.object({ storage_path: z.string().min(1), claim_token: z.uuid() })).max(5);

/** Consumes only database-authorized, leased object paths, never browser-supplied paths. */
export async function processHoroscopeCleanup(client: SupabaseClient) {
  const { data, error } = await client.rpc("claim_horoscope_cleanup", { p_limit: 5 });
  const parsed = jobsSchema.safeParse(data);
  if (error || !parsed.success) throw new Error("HOROSCOPE_CLEANUP_CLAIM_FAILED");
  let deferred = 0;
  for (const job of parsed.data) {
    let code: string | null = null;
    try {
      const result = await client.storage.from("horoscopes").remove([job.storage_path]);
      if (result.error) code = "STORAGE_CLEANUP_FAILED";
    } catch { code = "STORAGE_CLEANUP_FAILED"; }
    const result = await client.rpc("finish_horoscope_cleanup", {
      p_storage_path: job.storage_path, p_claim_token: job.claim_token, p_error_code: code,
    });
    if (result.error || result.data !== true) throw new Error("HOROSCOPE_CLEANUP_COMPLETION_FAILED");
    if (code) deferred++;
  }
  return { deferred };
}
