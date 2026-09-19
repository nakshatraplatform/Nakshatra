import { NextResponse } from "next/server";
import { BrokerIntroductionError, resolveBrokerdeskDashboard } from "@/features/broker-introductions/server/broker-introduction.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { getApiUser } from "@/lib/auth";

type Context = { params: Promise<{ workspaceRef: string }> };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, context: Context) {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_read");
  if (limited) return limited;
  try {
    const { workspaceRef } = await context.params;
    const result = await resolveBrokerdeskDashboard(auth.supabase, workspaceRef);
    return NextResponse.json(result, { status: result.available ? 200 : 404, headers });
  } catch (error) {
    const status = error instanceof BrokerIntroductionError ? error.status : 503;
    return NextResponse.json({ available: false }, { status, headers });
  }
}
