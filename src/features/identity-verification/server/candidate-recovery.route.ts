import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, readJsonBody, requireSameOrigin, requestSecurityErrorResponse } from "@/lib/api/request-security";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { IdentityVerificationSessionError } from "./session.service";
import { cancelCandidateVerification, getCurrentCandidateVerification, resumeCandidateVerification } from "./candidate-recovery.service";
import { verificationResponse } from "./verification-diagnostics";

const actionSchema = z.object({ candidateId: z.uuid(), attemptId: z.uuid() }).strict();
const noStore = { "Cache-Control": "private, no-store" };

/** Shared HTTP boundary only; lifecycle decisions belong to the guarded database RPCs. */
export async function candidateRecoveryRoute(request: Request, action: "current" | "resume" | "cancel") {
  return verificationResponse(action, () => handleCandidateRecovery(request, action));
}

async function handleCandidateRecovery(request: Request, action: "current" | "resume" | "cancel") {
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
      : action === "cancel" ? await cancelCandidateVerification(auth.supabase, input.candidateId, (input as z.infer<typeof actionSchema>).attemptId)
      : await resumeCandidateVerification(auth.supabase, input.candidateId, (input as z.infer<typeof actionSchema>).attemptId);
    return NextResponse.json(data, { headers: noStore });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ code: "INVALID_REQUEST", error: "Refresh your check and try again." }, { status: 400, headers: noStore });
    if (error instanceof IdentityVerificationSessionError) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status, headers: noStore });
    const response = requestSecurityErrorResponse(error); response.headers.set("Cache-Control", noStore["Cache-Control"]); return response;
  }
}
