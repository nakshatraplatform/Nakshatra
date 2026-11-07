import { NextResponse } from "next/server";
import { familyViewerVersionCommandSchema } from "@/features/family-viewers/server/family-viewer.contract";
import { FamilyViewerError, revokeCandidateFamilyViewer } from "@/features/family-viewers/server/family-viewer.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";
import { getRequestId, logServerError } from "@/lib/security/logging";

type Context = { params: Promise<{ viewerRef: string }> };
const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function DELETE(request: Request, context: Context) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const body = familyViewerVersionCommandSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!body.success) return NextResponse.json({ available: false }, { status: 400, headers: noStore });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") {
      const response = apiAuthFailureResponse(auth);
      response.headers.set("Cache-Control", noStore["Cache-Control"]);
      return response;
    }
    const limited = await enforceRateLimit(auth.supabase, request, "customer_family_viewer_manage");
    if (limited) return limited;
    const { viewerRef } = await context.params;
    const result = await revokeCandidateFamilyViewer(auth.supabase, {
      viewerRef, expectedVersion: body.data.expectedVersion, idempotencyKey: body.data.idempotencyKey,
    });
    return result.available
      ? NextResponse.json(result, { headers: noStore })
      : NextResponse.json(result, { status: 409, headers: noStore });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    if (error instanceof FamilyViewerError) return NextResponse.json({ available: false }, { status: error.status, headers: noStore });
    logServerError("customer.family_viewers.revoke_failed", requestId, error);
    return NextResponse.json({ available: false }, { status: 503, headers: { ...noStore, "X-Request-Id": requestId } });
  }
}
