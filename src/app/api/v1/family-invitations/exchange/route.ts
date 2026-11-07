import { NextResponse } from "next/server";
import {
  createFamilyInvitationCookie,
  familyInvitationCookieName,
  readFamilyInvitationCookie,
} from "@/features/family-viewers/server/family-viewer.cookie";
import {
  familyInvitationExchangeRequestSchema,
  familyInvitationExchangeResponseSchema,
} from "@/features/family-viewers/server/family-viewer.contract";
import { readRequestCookie } from "@/features/account/server/reauth-cookie";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { createClient } from "@/lib/supabase/server";
import { getRequestId, logServerError } from "@/lib/security/logging";

const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

/** Moves a fragment credential into a short-lived, family-invitation-scoped HttpOnly cookie. */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const supabase = await createClient();
    const limited = await enforceRateLimit(supabase, request, "family_viewer_invitation_exchange");
    if (limited) return limited;
    const parsed = familyInvitationExchangeRequestSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    const token = parsed.success
      ? parsed.data.token ?? readFamilyInvitationCookie(
        readRequestCookie(request, familyInvitationCookieName)
      )
      : null;
    // Keep the exchange response non-oracular. The guarded accept command is
    // the only place that determines whether a capability is usable.
    const response = NextResponse.json(
      familyInvitationExchangeResponseSchema.parse({ ready: Boolean(token) }),
      { headers: noStore }
    );
    if (parsed.success && parsed.data.token) response.cookies.set(createFamilyInvitationCookie(parsed.data.token));
    return response;
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    logServerError("family_viewer.invitation_exchange_failed", requestId, error);
    return NextResponse.json({ ready: false }, { status: 503, headers: { ...noStore, "X-Request-Id": requestId } });
  }
}
