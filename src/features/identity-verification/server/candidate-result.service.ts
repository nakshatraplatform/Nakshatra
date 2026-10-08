import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createIdentityVerificationWorker } from "../../../../scripts/identity-verification-worker.mjs";
import { getCurrentCandidateVerification } from "./candidate-recovery.service";
import { IdentityVerificationSessionError } from "./session.service";

const resultClaimSchema = z.object({
  subject_type: z.literal("candidate"), verification_method: z.literal("candidate_liveness_only"),
  candidate_id: z.uuid(), attempt_id: z.uuid(), task_type: z.literal("reconcile"),
  claim_token: z.uuid(), provider_session_ref: z.uuid(), provider_workflow_id: z.uuid(),
  provider_workflow_version: z.number().int().positive(), provider_vendor_data: z.string().min(1),
  work_attempts: z.number().int().positive(),
}).passthrough();

/** One owner-authorized provider lookup; the existing worker owns all approval rules. */
export async function checkCandidateResult(supabase: SupabaseClient, candidateId: string, attemptId: string,
  owner: { id: string; sessionId: string }) {
  const current = await getCurrentCandidateVerification(supabase, candidateId);
  if (current.attemptId !== attemptId) throw new IdentityVerificationSessionError("This check changed. Refresh status.", "IDENTITY_VERIFICATION_STATE_CONFLICT", 409);
  if (!["active", "awaiting_result"].includes(current.state)) return current;
  let admin: SupabaseClient;
  let worker: ReturnType<typeof createIdentityVerificationWorker>;
  // Validate local configuration before acquiring a lease; construction performs no provider I/O.
  try {
    admin = createServiceRoleClient();
    worker = createIdentityVerificationWorker(admin, { candidateOnly: true });
  }
  catch { throw new IdentityVerificationSessionError("Result checking is temporarily unavailable. Your existing check is unchanged.", "IDENTITY_VERIFICATION_RECOVERY_UNAVAILABLE", 503); }
  const { data, error } = await admin.rpc("claim_candidate_liveness_result", {
    p_candidate_id: candidateId, p_attempt_id: attemptId, p_owner_user_id: owner.id, p_owner_session_id: owner.sessionId,
  });
  if (error) throw new IdentityVerificationSessionError("We could not check the result. Your existing check is unchanged.", "IDENTITY_VERIFICATION_RECOVERY_UNAVAILABLE", error.code === "42501" ? 403 : 503);
  if (data !== null) {
    const claim = resultClaimSchema.safeParse(data);
    if (!claim.success || claim.data.candidate_id !== candidateId || claim.data.attempt_id !== attemptId) {
      throw new IdentityVerificationSessionError("We could not check the result. Try again shortly.", "IDENTITY_VERIFICATION_RECOVERY_UNAVAILABLE", 503);
    }
    await worker.process(claim.data);
  }
  return getCurrentCandidateVerification(supabase, candidateId);
}
