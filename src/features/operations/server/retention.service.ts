import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

const classes = ["rateLimitsDeleted", "viewerSessionsDeleted", "portfolioViewsDeleted", "portfolioEventsDeleted",
  "accessAuditEventsDeleted", "interestRequestsAnonymized", "deletionReceiptsDeleted"] as const;
const outcome = z.object({ affected: z.number().int().min(0).max(500), remaining: z.number().int().min(0) });

/** Separate transactions keep one failing retention class from undoing another's cleanup. */
export async function processRetention(client: SupabaseClient) {
  const results = await Promise.allSettled(classes.map(async (name) => {
    const result = await client.rpc("run_retention_class", { p_class: name, p_limit: 500 });
    const parsed = outcome.safeParse(result.data);
    return !result.error && parsed.success && parsed.data.remaining === 0;
  }));
  return results.every(result => result.status === "fulfilled" && result.value);
}
