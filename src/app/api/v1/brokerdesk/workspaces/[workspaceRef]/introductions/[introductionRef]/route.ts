import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { revokeBrokerIntroduction, BrokerIntroductionError } from "@/features/broker-introductions/server/broker-introduction.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";

type Context = { params: Promise<{ workspaceRef: string; introductionRef: string }> };
const bodySchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function DELETE(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const body = bodySchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!body.success) return NextResponse.json({ available: false }, { status: 400, headers });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_update");
    if (limited) return limited;
    const { workspaceRef, introductionRef } = await context.params;
    return NextResponse.json(await revokeBrokerIntroduction(auth.supabase, workspaceRef, introductionRef, body.data.expectedVersion), { headers });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    if (error instanceof BrokerIntroductionError) return NextResponse.json({ available: false }, { status: error.status, headers });
    return NextResponse.json({ available: false }, { status: 503, headers });
  }
}
