import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { relationshipQueueSchema, relationshipStageSchema } from "@/features/access/relationship-queue.contract";

const querySchema = z.object({
  stage: relationshipStageSchema,
  // shortcut: follows retained-history's 100,000 offset bound; use keyset paging if owner queues approach it.
  offset: z.string().regex(/^(0|[1-9][0-9]{0,5})$/).transform(Number).pipe(z.number().max(100000)).default(0),
  search: z.string().trim().max(100).default(""),
  filter: z.enum(["all", "direct", "broker", "verified", "pending", "active", "ended"]).default("all"),
}).strict();
const headers = { "Cache-Control": "private, no-store" };

/** Complete owner queues; authentication and ownership are checked again by the RPC. */
export async function GET(request: Request) {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "Choose a valid relationship page." }, { status: 400, headers });
  const limited = await enforceRateLimit(auth.supabase, request, "interest_decision");
  if (limited) return limited;
  try {
    const { stage, offset, search, filter } = query.data;
    const { data, error } = await auth.supabase.rpc("list_relationship_queue", { p_stage: stage, p_offset: offset, p_search: search, p_filter: filter });
    const parsed = relationshipQueueSchema.safeParse(data);
    if (error || !parsed.success) throw new Error("Relationship queue unavailable");
    return NextResponse.json(parsed.data, { headers });
  } catch {
    return NextResponse.json({ error: "We could not load this queue. Please retry." }, { status: 503, headers });
  }
}
