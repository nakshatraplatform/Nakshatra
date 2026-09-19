import { NextResponse } from "next/server";
import { readRequestCookie } from "@/features/account/server/reauth-cookie";
import { brokerIntroductionResponseSchema } from "@/features/broker-introductions/server/broker-introduction.contract";
import { brokerIntroductionCookieName, readBrokerIntroductionCookie } from "@/features/broker-introductions/server/broker-introduction.cookie";
import { respondToBrokerIntroduction } from "@/features/broker-introductions/server/broker-introduction.service";
import { hashBrokerIntroductionToken } from "@/features/broker-introductions/server/broker-introduction.token";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { createClient } from "@/lib/supabase/server";

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
    const sessionToken = readBrokerIntroductionCookie(readRequestCookie(request, brokerIntroductionCookieName(introductionRef)), introductionRef);
    if (!sessionToken) return NextResponse.json({ available: false }, { status: 403, headers });
    const supabase = await createClient();
    const limited = await enforceRateLimit(supabase, request, "broker_introduction_respond");
    if (limited) return limited;
    return NextResponse.json(await respondToBrokerIntroduction(
      supabase,
      introductionRef,
      hashBrokerIntroductionToken(sessionToken),
      body.data.response,
      body.data.comment
    ), { headers });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    return NextResponse.json({ available: false }, { status: 403, headers });
  }
}
