import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { revokeBrokerIntroduction, BrokerIntroductionError } from "@/features/broker-introductions/server/broker-introduction.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";
import { introductionWorkspacePathSchema } from "@/features/broker-introductions/server/introduction-workspace.contract";
import { resolveIntroductionAction } from "@/features/broker-introductions/server/introduction-workspace.service";
import { privateIntroductionResponse, introductionWorkspaceFailure } from "@/features/broker-introductions/server/introduction-workspace.http";

type Context = { params: Promise<{ workspaceRef: string; introductionRef: string }> };
const bodySchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, context: Context) {
  try {
    const path = introductionWorkspacePathSchema.safeParse(await context.params);
    if (!path.success) return NextResponse.json({ available: false }, { status: 400, headers });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return privateIntroductionResponse(apiAuthFailureResponse(auth));
    const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_read");
    if (limited) return privateIntroductionResponse(limited);
    // Retain the original strict response for browser bundles loaded before NAK-205.
    const includeResponses = new URL(request.url).searchParams.get("view") === "responses";
    const result = await resolveIntroductionAction(auth.supabase, path.data, includeResponses);
    return NextResponse.json(result, { status: result.available ? 200 : 403, headers });
  } catch (error) { return introductionWorkspaceFailure(error, request); }
}

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
