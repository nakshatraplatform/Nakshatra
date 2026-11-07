import { NextResponse } from "next/server";
import {
  candidateFamilyViewerCreateResponseSchema,
  createFamilyViewerCommandSchema,
} from "@/features/family-viewers/server/family-viewer.contract";
import { sendFamilyViewerInvitationEmail } from "@/features/family-viewers/server/family-viewer-email";
import { createCandidateFamilyViewer, FamilyViewerError, resolveCandidateFamilyRoster } from "@/features/family-viewers/server/family-viewer.service";
import { deriveFamilyViewerInvitationToken, hashFamilyViewerInvitationToken } from "@/features/family-viewers/server/family-viewer.token";
import { hashInvitationEmail, invitationEmailHint, normalizeInvitationEmail } from "@/features/organization-access/server/brokerdesk-team-invitation.token";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";
import { createCanonicalAppUrl } from "@/lib/security/redirect";
import { getRequestId, logServerError } from "@/lib/security/logging";

const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const auth = await getApiUser();
    if (auth.status !== "authenticated") {
      const response = apiAuthFailureResponse(auth);
      response.headers.set("Cache-Control", noStore["Cache-Control"]);
      return response;
    }
    const limited = await enforceRateLimit(auth.supabase, request, "customer_family_viewer_read");
    if (limited) return limited;
    const result = await resolveCandidateFamilyRoster(auth.supabase);
    return result.available
      ? NextResponse.json(result, { headers: noStore })
      : NextResponse.json(result, { status: 404, headers: noStore });
  } catch (error) {
    if (error instanceof FamilyViewerError) {
      return NextResponse.json({ available: false }, { status: error.status, headers: noStore });
    }
    logServerError("customer.family_viewers.read_failed", requestId, error);
    return NextResponse.json({ available: false }, { status: 503, headers: { ...noStore, "X-Request-Id": requestId } });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const body = createFamilyViewerCommandSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!body.success) return NextResponse.json({ available: false }, { status: 400, headers: noStore });
    const auth = await getApiUser();
    if (auth.status !== "authenticated") {
      const response = apiAuthFailureResponse(auth);
      response.headers.set("Cache-Control", noStore["Cache-Control"]);
      return response;
    }
    const limited = await enforceRateLimit(auth.supabase, request, "customer_family_viewer_manage");
    if (limited) return limited;
    const email = normalizeInvitationEmail(body.data.email);
    const token = deriveFamilyViewerInvitationToken({
      actorUserId: auth.user.id,
      contextRef: `direct:${email}`,
      email,
      idempotencyKey: body.data.idempotencyKey,
    });
    const result = await createCandidateFamilyViewer(auth.supabase, {
      emailHash: hashInvitationEmail(email),
      emailHint: invitationEmailHint(email),
      displayName: body.data.displayName,
      relationshipKind: body.data.relationshipKind,
      relationshipLabel: body.data.relationshipLabel ?? null,
      preferredLocale: body.data.preferredLocale ?? null,
      tokenHash: hashFamilyViewerInvitationToken(token),
      idempotencyKey: body.data.idempotencyKey,
    });
    if (!result.available) return NextResponse.json(result, { status: 403, headers: noStore });
    const invitationUrl = `${createCanonicalAppUrl("/join/family", request.url)}#token=${token}`;
    const delivery = await sendFamilyViewerInvitationEmail({
      invitationRef: result.invitationRef,
      recipientEmail: email,
      invitationUrl,
      expiresAt: result.expiresAt,
    });
    return NextResponse.json(candidateFamilyViewerCreateResponseSchema.parse({
      ...result,
      invitationUrl,
      emailStatus: delivery.status,
    }), { headers: noStore });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    if (error instanceof FamilyViewerError) {
      return NextResponse.json({ available: false }, { status: error.status, headers: noStore });
    }
    logServerError("customer.family_viewers.create_failed", requestId, error);
    return NextResponse.json({ available: false }, { status: 503, headers: { ...noStore, "X-Request-Id": requestId } });
  }
}
