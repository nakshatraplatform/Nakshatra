import { NextResponse } from "next/server";
import { familyInvitationAcceptSchema } from "@/features/family-viewers/server/family-viewer.contract";
import {
  clearFamilyInvitationCookie,
  familyInvitationCookieName,
  readFamilyInvitationCookie,
} from "@/features/family-viewers/server/family-viewer.cookie";
import { acceptFamilyViewerInvitation, FamilyViewerError } from "@/features/family-viewers/server/family-viewer.service";
import { hashFamilyViewerInvitationToken } from "@/features/family-viewers/server/family-viewer.token";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { readRequestCookie } from "@/features/account/server/reauth-cookie";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";
import { getRequestId, logServerError } from "@/lib/security/logging";

const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const body = familyInvitationAcceptSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!body.success) return NextResponse.json({ available: false }, { status: 400, headers: noStore });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") {
      const response = apiAuthFailureResponse(auth);
      response.headers.set("Cache-Control", noStore["Cache-Control"]);
      return response;
    }
    const limited = await enforceRateLimit(auth.supabase, request, "family_viewer_invitation_accept");
    if (limited) return limited;
    const token = readFamilyInvitationCookie(readRequestCookie(request, familyInvitationCookieName));
    if (!token) return NextResponse.json({ available: false }, { status: 403, headers: noStore });
    const result = await acceptFamilyViewerInvitation(
      auth.supabase,
      hashFamilyViewerInvitationToken(token),
      body.data.idempotencyKey
    );
    const response = result.available
      ? NextResponse.json(result, { headers: noStore })
      : NextResponse.json(result, { status: 403, headers: noStore });
    response.cookies.set(clearFamilyInvitationCookie());
    return response;
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    if (error instanceof FamilyViewerError) {
      const response = NextResponse.json({ available: false }, { status: error.status, headers: noStore });
      response.cookies.set(clearFamilyInvitationCookie());
      return response;
    }
    logServerError("family_viewer.invitation_accept_failed", requestId, error);
    return NextResponse.json({ available: false }, { status: 503, headers: { ...noStore, "X-Request-Id": requestId } });
  }
}
