import { candidateVerificationConsentVersion } from "@/features/identity-verification/identity-verification.types";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { z } from "zod/v4";
import { createIdentityVerificationToken, hashIdentityVerificationToken, isIdentityVerificationToken } from "@/features/identity-verification/server/identity-verification.tokens";
import { IdentityVerificationSessionError, retryIdentityVerification } from "@/features/identity-verification/server/session.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { AUTH_BODY_LIMIT, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { createCanonicalAppUrl } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/server";

const retrySchema = z.object({ token: z.string().refine(isIdentityVerificationToken, "Invalid verification token"), consent: z.literal(true), consentVersion: z.literal(candidateVerificationConsentVersion) }).strict();
const noStore = { "Cache-Control": "private, no-store" };

/** Starts a fresh hosted session only from a valid, unwithdrawn management link. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = retrySchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "IDENTITY_VERIFICATION_CONSENT_REQUIRED", error: "Use a valid management link and accept the liveness-only notice before retrying." },
        { status: 400, headers: noStore }
      );
    }
    const auth = await getApiUser();
    const supabase = auth.status === "authenticated" ? auth.supabase : await createClient();
    const rateLimited = await enforceRateLimit(supabase, request,
      auth.status === "authenticated" ? "candidate_liveness_interaction" : "identity_verification_retry");
    if (rateLimited) {
      rateLimited.headers.set("X-RateLimit-Scope", auth.status === "authenticated" ? "interaction" : "creation");
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
    if (error instanceof Error && "code" in error && "status" in error) {
      const known = error as IdentityVerificationSessionError;
      return NextResponse.json({ code: known.code, error: known.message, ...(known.managementToken ? { managementUrl: createCanonicalAppUrl(`/verify/${known.managementToken}`, request.url) } : {}) }, { status: known.status, headers: { ...noStore, ...(known.retryAfter ? { "Retry-After": String(known.retryAfter) } : {}) } });
    }
    if (error instanceof Error) {
      const response = requestSecurityErrorResponse(error);
      response.headers.set("Cache-Control", noStore["Cache-Control"]);
      return response;
    }
    return NextResponse.json(
      { code: "IDENTITY_VERIFICATION_RETRY_FAILED", error: "We could not restart identity verification. Please try again." },
      { status: 503, headers: noStore }
    );
  }
}
