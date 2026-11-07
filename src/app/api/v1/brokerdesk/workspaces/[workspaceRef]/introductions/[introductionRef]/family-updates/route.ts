import { NextResponse } from "next/server";
import { introductionFamilyUpdateCommandSchema, introductionWorkspacePathSchema } from "@/features/broker-introductions/server/introduction-workspace.contract";
import { recordIntroductionFamilyUpdate } from "@/features/broker-introductions/server/introduction-workspace.service";
import { introductionPrivateHeaders, privateIntroductionResponse, introductionWorkspaceFailure } from "@/features/broker-introductions/server/introduction-workspace.http";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, readJsonBody, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";

type Context = { params: Promise<{ workspaceRef: string; introductionRef: string }> };
export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const path = introductionWorkspacePathSchema.safeParse(await context.params);
    const command = introductionFamilyUpdateCommandSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!path.success || !command.success) return NextResponse.json({ available: false }, { status: 400, headers: introductionPrivateHeaders });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return privateIntroductionResponse(apiAuthFailureResponse(auth));
    const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_update");
    if (limited) return privateIntroductionResponse(limited);
    const result = await recordIntroductionFamilyUpdate(auth.supabase, path.data, command.data);
    return NextResponse.json(result, { status: result.available ? 200 : 403, headers: introductionPrivateHeaders });
  } catch (error) { return introductionWorkspaceFailure(error, request); }
}
