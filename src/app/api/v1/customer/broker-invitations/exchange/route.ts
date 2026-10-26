import { NextResponse } from "next/server";
import { z } from "zod/v4";
import {
  createCustomerInvitationExchangeCookie,
  customerInvitationCookieName,
  readCustomerInvitationExchangeCookie,
} from "@/features/broker-relationships/server/customer-invitation.cookie";
import { isCustomerInvitationToken } from "@/features/broker-relationships/server/customer-invitation.token";
import { hashCustomerInvitationToken } from "@/features/broker-relationships/server/customer-invitation.token";
import { resolveCustomerInvitationConsentVersion } from "@/features/broker-relationships/server/customer-invitation.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { AUTH_BODY_LIMIT, RequestSecurityError, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { createClient } from "@/lib/supabase/server";
import { readRequestCookie } from "@/features/account/server/reauth-cookie";
import { getRequestId, logServerError } from "@/lib/security/logging";

const schema = z.object({
  token: z.string().refine(isCustomerInvitationToken).optional(),
}).strict();
const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

/** Moves the fragment credential into a short-lived HttpOnly cookie without consuming it. */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const supabase = await createClient();
    const limited = await enforceRateLimit(supabase, request, "brokerdesk_customer_invitation_exchange");
    if (limited) return limited;
    const parsed = schema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    const token = parsed.success
      ? parsed.data.token ?? readCustomerInvitationExchangeCookie(
        readRequestCookie(request, customerInvitationCookieName)
      )
      : null;
    if (!token) {
      return NextResponse.json(
        { ready: true, consentVersion: "broker-representation-v3" },
        { headers: noStore }
      );
    }
    const consentVersion = await resolveCustomerInvitationConsentVersion(
      supabase,
      hashCustomerInvitationToken(token)
    );
    const response = NextResponse.json({ ready: true, consentVersion }, { headers: noStore });
    if (parsed.success && parsed.data.token) {
      response.cookies.set(createCustomerInvitationExchangeCookie(parsed.data.token));
    }
    return response;
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    logServerError("customer.broker_invitation_exchange_failed", requestId, error);
    return NextResponse.json({ ready: false }, { status: 503, headers: { ...noStore, "X-Request-Id": requestId } });
  }
}

