import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { brokerCustomerRelationshipRefSchema } from "@/features/security/public-reference";
import { acknowledgeBrokerPortfolioUpdate, BrokerIntroductionError } from "@/features/broker-introductions/server/broker-introduction.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, readJsonBody, RequestSecurityError, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";

type Context = { params: Promise<{ workspaceRef: string; noticeRef: string }> };
const inputSchema = z.object({ relationshipRef: brokerCustomerRelationshipRefSchema }).strict();
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const input = inputSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!input.success) return NextResponse.json({ available: false }, { status: 400, headers });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_update");
    if (limited) return limited;
    const { workspaceRef, noticeRef } = await context.params;
    return NextResponse.json(await acknowledgeBrokerPortfolioUpdate(
      auth.supabase, workspaceRef, input.data.relationshipRef, noticeRef
    ), { headers });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    const status = error instanceof BrokerIntroductionError ? error.status : 503;
    return NextResponse.json({ available: false }, { status, headers });
  }
}
