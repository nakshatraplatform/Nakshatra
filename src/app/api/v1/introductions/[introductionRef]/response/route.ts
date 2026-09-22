import { NextResponse } from "next/server";
import { brokerIntroductionResponseSchema } from "@/features/broker-introductions/server/broker-introduction.contract";
import { respondToBrokerIntroduction } from "@/features/broker-introductions/server/broker-introduction.service";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { getApiUser } from "@/lib/auth";

type Context = { params: Promise<{ introductionRef: string }> };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const body = brokerIntroductionResponseSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    const { introductionRef } = await context.params;
    if (!body.success || !brokerIntroductionRouteRefSchema.safeParse(introductionRef).success) {
      return NextResponse.json({ available: false }, { status: 400, headers });
    }
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const limited = await enforceRateLimit(auth.supabase, request, "broker_introduction_respond");
    if (limited) return limited;
    return NextResponse.json(await respondToBrokerIntroduction(
      auth.supabase,
      introductionRef,
      body.data.response,
      body.data.comment,
      body.data.confirmCompleteAccess
    ), { headers });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    return NextResponse.json({ available: false }, { status: 403, headers });
  }
}
