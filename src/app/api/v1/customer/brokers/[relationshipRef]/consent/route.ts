import { NextResponse } from "next/server";
import {
  customerBrokerConsentCommandSchema,
} from "@/features/broker-relationships/server/customer-invitation.contract";
import {
  CustomerInvitationError,
  manageCustomerBrokerConsent,
} from "@/features/broker-relationships/server/customer-invitation.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import {
  readJsonBody,
  requestSecurityErrorResponse,
  requireSameOrigin,
} from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";
import { getRequestId, logServerError } from "@/lib/security/logging";

const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

/** Changes only the signed-in customer's own broker mandate and issued access. */
export async function POST(
  request: Request,
  context: { params: Promise<{ relationshipRef: string }> }
) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
  } catch (error) {
    return requestSecurityErrorResponse(error);
  }

  try {
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const limited = await enforceRateLimit(auth.supabase, request, "customer_broker_relationship_manage");
    if (limited) return limited;

    let payload: unknown;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      return requestSecurityErrorResponse(error);
    }
    const body = customerBrokerConsentCommandSchema.safeParse(payload);
    if (!body.success) {
      return NextResponse.json(
        { available: false, error: "Choose a valid broker access action." },
        { status: 400, headers: noStore }
      );
    }

    const { relationshipRef } = await context.params;
    const result = await manageCustomerBrokerConsent(auth.supabase, {
      relationshipRef,
      ...body.data,
    });
    if (!result.available) {
      return NextResponse.json({ available: false }, { status: 404, headers: noStore });
    }
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    if (error instanceof CustomerInvitationError) {
      return NextResponse.json(
        { available: false, error: error.message },
        { status: error.status, headers: noStore }
      );
    }
    logServerError("customer.broker_consent_change_failed", requestId, error);
    return NextResponse.json(
      { available: false, error: "The broker access change could not be saved." },
      { status: 503, headers: { ...noStore, "X-Request-Id": requestId } }
    );
  }
}
