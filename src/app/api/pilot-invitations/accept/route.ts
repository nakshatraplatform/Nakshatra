import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, readJsonBody, RequestSecurityError, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { consumeRateLimit, rateLimitResponse } from "@/features/security/server/rate-limit.service";
import { acceptCreatorInvitation } from "@/features/pilot-access/server/creator-invitations.service";
import { ensureOwnerPortfolio } from "@/features/auth/server/portfolio-bootstrap";
import { getRequestId, logServerError } from "@/lib/security/logging";

const noStore = { "Cache-Control": "private, no-store" };
const bodySchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const parsed = bodySchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!parsed.success) return NextResponse.json({ code: "INVITE_INVALID", error: "This invitation link is invalid." }, { status: 400, headers: noStore });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const quota = await consumeRateLimit(auth.supabase, request, "pilot_access_submit");
    if (!quota.allowed) return rateLimitResponse(quota.retryAfter);
    await acceptCreatorInvitation(auth.supabase, parsed.data.token);
    await ensureOwnerPortfolio(auth.supabase, auth.user.id);
    return NextResponse.json({ status: "accepted", redirect: "/dashboard" }, { headers: noStore });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    if (error && typeof error === "object" && "code" in error && (error.code === "42501" || error.code === "22023")) {
      return NextResponse.json({ code: "INVITE_UNAVAILABLE", error: "This link has expired, was replaced, or belongs to a different verified email." }, { status: 403, headers: noStore });
    }
    logServerError("pilot.creator_invitation.accept_failed", requestId, error);
    return NextResponse.json({ code: "INVITE_SERVICE_UNAVAILABLE", error: "We could not activate access right now. Please try again." }, { status: 503, headers: { ...noStore, "X-Request-Id": requestId } });
  }
}
