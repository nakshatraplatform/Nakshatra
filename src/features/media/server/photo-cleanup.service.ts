import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

const jobsSchema = z.array(z.object({ storage_path: z.string().min(1), claim_token: z.uuid() })).max(5);

/** Only the database may authorize retired paths; failed deletions retain their lease-fenced job. */
export async function processPhotoCleanup(client: SupabaseClient) {
  const { data, error } = await client.rpc("claim_photo_cleanup", { p_limit: 5 });
  const parsed = jobsSchema.safeParse(data);
  if (error || !parsed.success) throw new Error("PHOTO_CLEANUP_CLAIM_FAILED");
  let deferred = 0;
  for (const job of parsed.data) {
    let code: string | null = null;
    try {
      const result = await client.storage.from("photos").remove([job.storage_path]);
      if (result.error) code = "STORAGE_CLEANUP_FAILED";
    } catch { code = "STORAGE_CLEANUP_FAILED"; }
    const result = await client.rpc("finish_photo_cleanup", {
      p_storage_path: job.storage_path, p_claim_token: job.claim_token, p_error_code: code,
    });
    if (result.error || result.data !== true) throw new Error("PHOTO_CLEANUP_COMPLETION_FAILED");
    if (code) deferred++;
  }
  return { deferred };
}
