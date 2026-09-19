import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { brokerIntroductionTokenSchema } from "@/features/broker-introductions/server/broker-introduction.contract";
import { createBrokerIntroductionCookie } from "@/features/broker-introductions/server/broker-introduction.cookie";
import { claimBrokerIntroductionPass } from "@/features/broker-introductions/server/broker-introduction.service";
import { deriveBrokerIntroductionSessionToken, hashBrokerIntroductionToken } from "@/features/broker-introductions/server/broker-introduction.token";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ introductionRef: string }> };
const bodySchema = z.object({ pass: brokerIntroductionTokenSchema }).strict();
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const body = bodySchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    const { introductionRef } = await context.params;
    if (!body.success || !brokerIntroductionRouteRefSchema.safeParse(introductionRef).success) {
      return NextResponse.json({ ready: true }, { headers });
    }
    const supabase = await createClient();
    const limited = await enforceRateLimit(supabase, request, "broker_introduction_claim");
    if (limited) return limited;
    const sessionToken = deriveBrokerIntroductionSessionToken(introductionRef, body.data.pass);
    const result = await claimBrokerIntroductionPass(
      supabase,
      introductionRef,
      hashBrokerIntroductionToken(body.data.pass),
      hashBrokerIntroductionToken(sessionToken)
    ).catch(() => null);
    const response = NextResponse.json({ ready: true }, { headers });
    if (result?.available) response.cookies.set(createBrokerIntroductionCookie(introductionRef, sessionToken, result.expiresAt));
    return response;
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    return NextResponse.json({ ready: true }, { headers });
  }
}
