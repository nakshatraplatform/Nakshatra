import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, readJsonBody, RequestSecurityError, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { consumeRateLimit, rateLimitResponse } from "@/features/security/server/rate-limit.service";
import { creatorInvitationCommandSchema, hashCreatorInvitationToken, listCreatorInvitations, manageCreatorInvitation } from "@/features/pilot-access/server/creator-invitations.service";
import { sendResendEmail } from "@/features/notifications/server/resend.provider";
import { getRequestId, logServerError } from "@/lib/security/logging";

const noStore = { "Cache-Control": "private, no-store" };

function fail(error: unknown, requestId: string) {
  if (error && typeof error === "object" && "code" in error && error.code === "42501") {
    return NextResponse.json({ code: "ADMIN_FORBIDDEN", error: "Administrator access is required." }, { status: 403, headers: noStore });
  }
  logServerError("admin.creator_invitation.failed", requestId, error);
  return NextResponse.json({ code: "ADMIN_UNAVAILABLE", error: "Invitations are temporarily unavailable." }, { status: 503, headers: { ...noStore, "X-Request-Id": requestId } });
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  try {
    return NextResponse.json({ invitations: await listCreatorInvitations(auth.supabase) }, { headers: noStore });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const parsed = creatorInvitationCommandSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!parsed.success) return NextResponse.json({ code: "INVITE_INVALID", error: "Enter a valid email address." }, { status: 400, headers: noStore });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const quota = await consumeRateLimit(auth.supabase, request, "pilot_access_review");
    if (!quota.allowed) return rateLimitResponse(quota.retryAfter);
    const { email, action } = parsed.data;
    if (action === "grant" && !process.env.NEXT_PUBLIC_APP_URL && process.env.NODE_ENV === "production") {
      return NextResponse.json({ code: "APP_URL_MISSING", error: "The application URL must be configured before sending invitations." }, { status: 503, headers: noStore });
    }
    const token = action === "grant" ? randomBytes(32).toString("base64url") : null;
    const result = await manageCreatorInvitation(auth.supabase, email, action, token ? hashCreatorInvitationToken(token) : undefined);
    if (action === "revoke") return NextResponse.json({ ...result, delivery: "not_applicable" }, { headers: noStore });
    const invitationUrl = new URL(`/invite/${token}`, process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).toString();
    const delivery = await sendResendEmail({
      deliveryId: randomUUID(),
      to: email,
      subject: "Your VivIntro private pilot invitation",
      text: `You have been invited to create a VivIntro portfolio. Open ${invitationUrl} and continue with Google or sign up using this exact email address. This link expires in seven days and works only with your verified email. Your portfolio begins as a private draft. You choose when to publish after the required verification. If you did not expect this invitation, ignore this message.`,
    });
    return NextResponse.json({
      ...result,
      delivery: delivery.status === "accepted" ? "accepted" : "failed",
      ...(delivery.status === "failed" ? { invitationUrl, error: "The email was not accepted. Copy this private invitation link and share it securely, or resend the invitation." } : {}),
    }, { headers: noStore });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    return fail(error, requestId);
  }
}
