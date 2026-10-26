import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { relationshipPageSchema, relationshipQuerySchema, type RelationshipQuery } from "../relationship-dashboard.contract";

/** One bounded owner/session-scoped snapshot, never a service-role read. */
export async function loadRelationshipPage(supabase: SupabaseClient, query: Partial<RelationshipQuery> = {}) {
  const input = relationshipQuerySchema.parse(query);
  const { data, error } = await supabase.rpc("get_owner_relationship_page", {
    p_queue: input.queue, p_offset: input.offset, p_query: input.query, p_filter: input.filter,
  });
  const parsed = relationshipPageSchema.safeParse(data);
  if (error || !parsed.success) throw new Error("We could not load requests and sharing access. Try again.");
  return parsed.data;
}
