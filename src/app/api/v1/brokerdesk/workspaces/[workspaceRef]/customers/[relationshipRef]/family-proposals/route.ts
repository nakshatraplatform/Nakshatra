import { NextResponse } from "next/server";
import { proposeFamilyViewerCommandSchema } from "@/features/family-viewers/server/family-viewer.contract";
import { FamilyViewerError, proposeFamilyViewer } from "@/features/family-viewers/server/family-viewer.service";
import {
  hashInvitationEmail,
  invitationEmailHint,
  normalizeInvitationEmail,
} from "@/features/organization-access/server/brokerdesk-team-invitation.token";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import {
  AUTH_BODY_LIMIT,
  RequestSecurityError,
  readJsonBody,
  requestSecurityErrorResponse,
  requireSameOrigin,
} from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";
import { getRequestId, logServerError } from "@/lib/security/logging";

type Context = { params: Promise<{ workspaceRef: string; relationshipRef: string }> };
const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request, context: Context) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const body = proposeFamilyViewerCommandSchema.safeParse(
      await readJsonBody(request, AUTH_BODY_LIMIT)
    );
    if (!body.success) {
      return NextResponse.json(
        {
          code: "BROKERDESK_FAMILY_PROPOSAL_INVALID",
          error: "Check the family contact and try again.",
        },
        { status: 400, headers: noStore }
      );
    }

    const auth = await getApiUser();
    if (auth.status !== "authenticated") {
      const response = apiAuthFailureResponse(auth);
      response.headers.set("Cache-Control", noStore["Cache-Control"]);
      return response;
    }
    const limited = await enforceRateLimit(
      auth.supabase,
      request,
      "brokerdesk_family_viewer_propose"
    );
    if (limited) {
      limited.headers.set("Cache-Control", noStore["Cache-Control"]);
      return limited;
    }

    const { workspaceRef, relationshipRef } = await context.params;
    const email = normalizeInvitationEmail(body.data.email);
    const result = await proposeFamilyViewer(auth.supabase, {
      workspaceRef,
      relationshipRef,
      emailHash: hashInvitationEmail(email),
      emailHint: invitationEmailHint(email),
      displayName: body.data.displayName,
      relationshipKind: body.data.relationshipKind,
      relationshipLabel: body.data.relationshipLabel ?? null,
      preferredLocale: body.data.preferredLocale ?? null,
      idempotencyKey: body.data.idempotencyKey,
    });
    return NextResponse.json(result, { status: 202, headers: noStore });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return requestSecurityErrorResponse(error);
    }
    if (error instanceof FamilyViewerError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status, headers: noStore }
      );
    }
    logServerError("brokerdesk.family_viewers.proposal_failed", requestId, error);
    return NextResponse.json(
      {
        code: "BROKERDESK_FAMILY_PROPOSAL_UNAVAILABLE",
        error: "The family contact proposal could not be saved.",
      },
      { status: 503, headers: { ...noStore, "X-Request-Id": requestId } }
    );
  }
}
