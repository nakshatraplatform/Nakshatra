import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { createIdentityVerificationToken, hashIdentityVerificationToken, isIdentityVerificationToken } from "@/features/identity-verification/server/identity-verification.tokens";
import { IdentityVerificationSessionError, retryIdentityVerification } from "@/features/identity-verification/server/session.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { AUTH_BODY_LIMIT, readJsonBody, RequestSecurityError, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { createCanonicalAppUrl } from "@/lib/security/redirect";
import { getRequestId, logServerError } from "@/lib/security/logging";
import { createClient } from "@/lib/supabase/server";

const retrySchema = z.object({ token: z.string().refine(isIdentityVerificationToken, "Invalid verification token") }).strict();
const noStore = { "Cache-Control": "private, no-store" };

/** Starts a fresh hosted session only from a valid, unwithdrawn management link. */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    requireSameOrigin(request);
    const parsed = retrySchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "IDENTITY_VERIFICATION_LINK_INVALID", error: "This verification link is unavailable or has expired." },
        { status: 400, headers: noStore }
      );
    }
    const supabase = await createClient();
    const rateLimited = await enforceRateLimit(supabase, request, "identity_verification_retry");
    if (rateLimited) {
      rateLimited.headers.set("Cache-Control", noStore["Cache-Control"]);
      return rateLimited;
    }
    const managementToken = createIdentityVerificationToken();
    const result = await retryIdentityVerification({
      supabase,
      tokenHash: await hashIdentityVerificationToken(parsed.data.token),
      managementToken,
      managementTokenHash: await hashIdentityVerificationToken(managementToken),
      callbackUrl: createCanonicalAppUrl("/verification/result", request.url),
    });
    return NextResponse.json({
      url: result.url,
      managementUrl: createCanonicalAppUrl(`/verify/${managementToken}`, request.url),
    }, { headers: noStore });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      const response = requestSecurityErrorResponse(error);
      response.headers.set("Cache-Control", noStore["Cache-Control"]);
      return response;
    }
    if (error instanceof IdentityVerificationSessionError) {
      const diagnosticCode = /^[a-z_]{3,80}$/.test(error.diagnosticCode)
        ? error.diagnosticCode
        : "unclassified";
      if (error.status >= 500) {
        logServerError(`identity_verification.retry.${diagnosticCode}`, requestId, error);
      }
      return NextResponse.json(
        {
          code: error.code,
          error: error.message,
          ...(error.managementToken
            ? { managementUrl: createCanonicalAppUrl(`/verify/${error.managementToken}`, request.url) }
            : {}),
        },
        { status: error.status, headers: { ...noStore, "X-Request-Id": requestId } }
      );
    }
    logServerError("identity_verification.retry.unclassified", requestId, error);
    return NextResponse.json(
      { code: "IDENTITY_VERIFICATION_RETRY_FAILED", error: "We could not restart identity verification. Please try again." },
      { status: 503, headers: { ...noStore, "X-Request-Id": requestId } }
    );
  }
}
