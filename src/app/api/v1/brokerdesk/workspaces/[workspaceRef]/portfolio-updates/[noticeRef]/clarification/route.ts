import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { flagBrokerPortfolioUpdate, BrokerIntroductionError } from "@/features/broker-introductions/server/broker-introduction.service";
import { brokerCustomerRelationshipRefSchema } from "@/features/security/public-reference";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";

type Context = { params: Promise<{ workspaceRef: string; noticeRef: string }> };
const bodySchema = z.object({ relationshipRef: brokerCustomerRelationshipRefSchema }).strict();
export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const body = bodySchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!body.success) return NextResponse.json({ available: false }, { status: 400 });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_update");
    if (limited) return limited;
    const { workspaceRef, noticeRef } = await context.params;
    return NextResponse.json(await flagBrokerPortfolioUpdate(auth.supabase, workspaceRef, body.data.relationshipRef, noticeRef));
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    if (error instanceof BrokerIntroductionError) return NextResponse.json({ available: false }, { status: error.status });
    return NextResponse.json({ available: false }, { status: 503 });
  }
}
