import { NextResponse } from "next/server";
import { listBrokerPortfolioNotices } from "@/features/broker-introductions/server/broker-introduction.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { getApiUser } from "@/lib/auth";

type Context = { params: Promise<{ workspaceRef: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_read");
  if (limited) return limited;
  const { workspaceRef } = await context.params;
  const relationshipRef = new URL(request.url).searchParams.get("relationshipRef") || "";
  try {
    return NextResponse.json(await listBrokerPortfolioNotices(auth.supabase, workspaceRef, relationshipRef), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ available: false }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
}
