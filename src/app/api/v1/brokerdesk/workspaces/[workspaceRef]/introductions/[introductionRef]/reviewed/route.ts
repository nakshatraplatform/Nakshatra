import { NextResponse } from "next/server";
import { BrokerIntroductionError, markBrokerIntroductionResponseReviewed } from "@/features/broker-introductions/server/broker-introduction.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { RequestSecurityError, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";

type Context = { params: Promise<{ workspaceRef: string; introductionRef: string }> };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_update");
    if (limited) return limited;
    const { workspaceRef, introductionRef } = await context.params;
    return NextResponse.json(
      await markBrokerIntroductionResponseReviewed(auth.supabase, workspaceRef, introductionRef),
      { headers }
    );
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    const status = error instanceof BrokerIntroductionError ? error.status : 503;
    return NextResponse.json({ available: false }, { status, headers });
  }
}
