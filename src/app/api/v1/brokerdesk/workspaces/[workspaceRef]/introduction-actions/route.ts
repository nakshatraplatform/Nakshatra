import { NextResponse } from "next/server";
import { workspaceRefSchema } from "@/features/security/public-reference";
import { introductionWorkspaceQuerySchema } from "@/features/broker-introductions/server/introduction-workspace.contract";
import { resolveIntroductionWorkspaceList } from "@/features/broker-introductions/server/introduction-workspace.service";
import { introductionPrivateHeaders, privateIntroductionResponse, introductionWorkspaceFailure } from "@/features/broker-introductions/server/introduction-workspace.http";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { getApiUser } from "@/lib/auth";

export async function GET(request: Request, context: { params: Promise<{ workspaceRef: string }> }) {
  try {
    const workspace = workspaceRefSchema.safeParse((await context.params).workspaceRef);
    const params = new URL(request.url).searchParams;
    const query = introductionWorkspaceQuerySchema.safeParse(Object.fromEntries(params));
    if (!workspace.success || !query.success || new Set(params.keys()).size !== [...params.keys()].length) {
      return NextResponse.json({ available: false }, { status: 400, headers: introductionPrivateHeaders });
    }
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return privateIntroductionResponse(apiAuthFailureResponse(auth));
    const limited = await enforceRateLimit(auth.supabase, request, "brokerdesk_introduction_read");
    if (limited) return privateIntroductionResponse(limited);
    const result = await resolveIntroductionWorkspaceList(auth.supabase, workspace.data, query.data);
    return NextResponse.json(result, { status: result.available ? 200 : 403, headers: introductionPrivateHeaders });
  } catch (error) { return introductionWorkspaceFailure(error, request); }
}
