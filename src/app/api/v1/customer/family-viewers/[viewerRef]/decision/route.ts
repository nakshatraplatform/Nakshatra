import { NextResponse } from "next/server";
import {
  candidateFamilyViewerDecisionResponseSchema,
  decideFamilyViewerProposalCommandSchema,
} from "@/features/family-viewers/server/family-viewer.contract";
import { sendFamilyViewerInvitationEmail } from "@/features/family-viewers/server/family-viewer-email";
import { decideCandidateFamilyViewerProposal, FamilyViewerError } from "@/features/family-viewers/server/family-viewer.service";
import { deriveFamilyViewerInvitationToken, hashFamilyViewerInvitationToken } from "@/features/family-viewers/server/family-viewer.token";
import { hashInvitationEmail, normalizeInvitationEmail } from "@/features/organization-access/server/brokerdesk-team-invitation.token";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";
import { createCanonicalAppUrl } from "@/lib/security/redirect";
import { getRequestId, logServerError } from "@/lib/security/logging";

type Context = { params: Promise<{ viewerRef: string }> };
const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request, context: Context) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const body = decideFamilyViewerProposalCommandSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
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
    const email = body.data.decision === "approve" ? normalizeInvitationEmail(body.data.email) : null;
    const token = email ? deriveFamilyViewerInvitationToken({
      actorUserId: auth.user.id,
      contextRef: viewerRef,
      email,
      idempotencyKey: body.data.idempotencyKey,
    }) : null;
    const result = await decideCandidateFamilyViewerProposal(auth.supabase, {
      viewerRef,
      decision: body.data.decision,
      emailHash: email ? hashInvitationEmail(email) : null,
      tokenHash: token ? hashFamilyViewerInvitationToken(token) : null,
      idempotencyKey: body.data.idempotencyKey,
    });
    if (!result.available) return NextResponse.json(result, { status: 404, headers: noStore });
    if (!email || !token || !result.invitationRef || !result.expiresAt) {
      return NextResponse.json(result, { headers: noStore });
    }
    const invitationUrl = `${createCanonicalAppUrl("/join/family", request.url)}#token=${token}`;
    const delivery = await sendFamilyViewerInvitationEmail({
      invitationRef: result.invitationRef,
      recipientEmail: email,
      invitationUrl,
      expiresAt: result.expiresAt,
    });
    return NextResponse.json(candidateFamilyViewerDecisionResponseSchema.parse({
      ...result,
      invitationUrl,
      emailStatus: delivery.status,
    }), { headers: noStore });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    if (error instanceof FamilyViewerError) return NextResponse.json({ available: false }, { status: error.status, headers: noStore });
    logServerError("customer.family_viewers.decision_failed", requestId, error);
    return NextResponse.json({ available: false }, { status: 503, headers: { ...noStore, "X-Request-Id": requestId } });
  }
}
