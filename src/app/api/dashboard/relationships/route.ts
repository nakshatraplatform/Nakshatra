import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { relationshipQuerySchema } from "@/features/access/relationship-dashboard.contract";
import { loadRelationshipPage } from "@/features/access/server/relationship-dashboard.service";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const limited = await enforceRateLimit(auth.supabase, request, "interest_decision");
  if (limited) return limited;
  const parsed = relationshipQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid queue, search or page." }, { status: 400, headers });
  try {
    return NextResponse.json(await loadRelationshipPage(auth.supabase, parsed.data), { headers });
  } catch {
    return NextResponse.json({ error: "We could not load requests and sharing access. Try again." }, { status: 503, headers });
  }
}
