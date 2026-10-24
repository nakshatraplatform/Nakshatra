import "server-only";
import { flush } from "@sentry/core";
import { reportOperationFailure } from "@/lib/observability/operations.mjs";
import { after, NextResponse } from "next/server";
import { z } from "zod/v4";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { RequestSecurityError, AUTH_BODY_LIMIT, readJsonBody, requireSameOrigin, requestSecurityErrorResponse } from "@/lib/api/request-security";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { IdentityVerificationSessionError } from "./session.service";
import { cancelCandidateVerification, getCurrentCandidateVerification, resumeCandidateVerification } from "./candidate-recovery.service";
import { verificationResponse } from "./verification-diagnostics";
import { checkCandidateResult, dispatchOwnerLivenessConfirmation } from "./candidate-result.service";
import { logServerError } from "@/lib/security/logging";

const actionSchema = z.object({ candidateId: z.uuid(), attemptId: z.uuid() }).strict();
const noStore = { "Cache-Control": "private, no-store" };

/** Shared HTTP boundary only; lifecycle decisions belong to the guarded database RPCs. */
export async function candidateRecoveryRoute(request: Request, action: "current" | "resume" | "cancel" | "check-result") {
  return verificationResponse(action, reference => handleCandidateRecovery(request, action, reference));
}

async function handleCandidateRecovery(request: Request, action: "current" | "resume" | "cancel" | "check-result", reference: string) {
  try {
    if (action !== "current") requireSameOrigin(request);
    const input = action === "current"
      ? z.object({ candidateId: z.uuid() }).strict().parse(Object.fromEntries(new URL(request.url).searchParams))
      : actionSchema.parse(await readJsonBody(request, AUTH_BODY_LIMIT));
    const auth = await getApiUser();
    if (auth.status !== "authenticated") {
      const response = apiAuthFailureResponse(auth); response.headers.set("Cache-Control", noStore["Cache-Control"]); return response;
    }
    const limited = await enforceRateLimit(auth.supabase, request, "candidate_liveness_interaction");
    if (limited) { limited.headers.set("Cache-Control", noStore["Cache-Control"]); return limited; }
    const data = action === "current" ? await getCurrentCandidateVerification(auth.supabase, input.candidateId)
      : action === "check-result" ? await checkCandidateResult(auth.supabase, input.candidateId, (input as z.infer<typeof actionSchema>).attemptId, auth.user)
      : action === "cancel" ? await cancelCandidateVerification(auth.supabase, input.candidateId, (input as z.infer<typeof actionSchema>).attemptId)
      : await resumeCandidateVerification(auth.supabase, input.candidateId, (input as z.infer<typeof actionSchema>).attemptId);
    if (action === "check-result" && "state" in data && data.state === "verified"
      && "emailStatus" in data && data.emailStatus === "queued"
      && typeof data.attemptId === "string" && data.attemptId === (input as z.infer<typeof actionSchema>).attemptId) {
      const attemptId = data.attemptId;
      const requestId = reference;
      const report = () => logServerError("identity_verification.email_dispatch_failed", requestId, new Error("LIVENESS_EMAIL_DISPATCH_FAILED"));
      try {
        after(async () => {
          try {
            const result = await dispatchOwnerLivenessConfirmation(input.candidateId, attemptId, auth.user);
            if (result.failed > 0) report();
          } catch { report(); }
          finally { await flush(2000).catch(() => false); }
        });
      } catch { report(); } // A scheduling problem cannot undo a committed proof.
    }
    return NextResponse.json(data, { headers: noStore });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: "INVALID_REQUEST", error: "Refresh your check and try again." }, { status: 400, headers: noStore });
    if (error instanceof IdentityVerificationSessionError) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status, headers: noStore });
    if (!(error instanceof RequestSecurityError)) reportOperationFailure(`verification.${action}`, error, { code: "IDENTITY_VERIFICATION_REQUEST_FAILED", reference });
    const response = requestSecurityErrorResponse(error); response.headers.set("Cache-Control", noStore["Cache-Control"]); return response;
  }
}
