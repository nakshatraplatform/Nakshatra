import { NextResponse } from "next/server";
import { createBrokerIntroductionSchema } from "@/features/broker-introductions/server/broker-introduction.contract";
import { createBrokerIntroduction, listBrokerIntroductions, BrokerIntroductionError } from "@/features/broker-introductions/server/broker-introduction.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";
import { createCanonicalAppUrl } from "@/lib/security/redirect";

type Context = { params: Promise<{ workspaceRef: string }> };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, context: Context) {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_read");
  if (limited) return limited;
  const { workspaceRef } = await context.params;
  const relationshipRef = new URL(request.url).searchParams.get("relationshipRef") || "";
  try {
    return NextResponse.json(await listBrokerIntroductions(auth.supabase, workspaceRef, relationshipRef), { headers });
  } catch {
    return NextResponse.json({ available: false }, { status: 404, headers });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const parsed = createBrokerIntroductionSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!parsed.success) return NextResponse.json({ code: "BROKER_INTRODUCTION_INVALID", error: "Check the recipient details and try again." }, { status: 400, headers });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_create");
    if (limited) return limited;
    const { workspaceRef } = await context.params;
    const result = await createBrokerIntroduction(auth.supabase, {
      workspaceRef,
      relationshipRef: parsed.data.relationshipRef,
      recipientRelationshipRef: parsed.data.recipientRelationshipRef,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    const introductionUrl = createCanonicalAppUrl(`/introductions/${result.introductionRef}`, request.url);
    return NextResponse.json({ ...result, introductionUrl }, { status: 201, headers });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    if (error instanceof BrokerIntroductionError) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status, headers });
    return NextResponse.json({ code: "BROKER_INTRODUCTION_UNAVAILABLE", error: "The introduction could not be created." }, { status: 503, headers });
  }
}
