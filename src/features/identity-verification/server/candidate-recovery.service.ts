import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import { candidateRecoverySchema } from "../candidate-recovery.types";
import { IdentityVerificationSessionRepository } from "./session.repository";
import { IdentityVerificationSessionError } from "./session.service";
import { DiditProviderError, retrieveDiditLivenessSession } from "./didit.provider";

function databaseFailure(error: { code?: string } | null): never {
  throw new IdentityVerificationSessionError(
    error?.code === "IV002" ? "This check changed. Refresh its status before continuing." : "We could not load your check. Try again shortly.",
    error?.code === "IV002" ? "IDENTITY_VERIFICATION_STATE_CONFLICT" : "IDENTITY_VERIFICATION_RECOVERY_UNAVAILABLE",
    error?.code === "42501" ? 403 : error?.code === "IV002" ? 409 : 503,
  );
}

export async function getCurrentCandidateVerification(supabase: SupabaseClient, candidateId: string) {
  const { data, error } = await new IdentityVerificationSessionRepository(supabase).current(candidateId);
  if (error) databaseFailure(error);
  const parsed = candidateRecoverySchema.safeParse(data);
  if (!parsed.success) databaseFailure(null);
  return parsed.data;
}

export async function cancelCandidateVerification(supabase: SupabaseClient, candidateId: string, attemptId: string) {
  const { data, error } = await new IdentityVerificationSessionRepository(supabase).cancel(candidateId, attemptId);
  if (error) databaseFailure(error);
  const parsed = candidateRecoverySchema.safeParse(data);
  if (!parsed.success) databaseFailure(null);
  return parsed.data;
}

export async function resumeCandidateVerification(supabase: SupabaseClient, candidateId: string, attemptId: string) {
  const repository = new IdentityVerificationSessionRepository(supabase);
  const { data, error } = await repository.current(candidateId);
  if (error) databaseFailure(error);
  const snapshot = candidateRecoverySchema.safeParse(data);
  const correlation = z.object({ providerSessionRef: z.uuid(), workflowId: z.uuid(), workflowVersion: z.number().int().positive(), vendorData: z.string().min(1) }).safeParse(data);
  if (!snapshot.success || snapshot.data.attemptId !== attemptId || !snapshot.data.canResume || !correlation.success) databaseFailure({ code: "IV002" });
  let hosted;
  try {
    hosted = await retrieveDiditLivenessSession({ sessionId: correlation.data.providerSessionRef, workflowId: correlation.data.workflowId,
      workflowVersion: correlation.data.workflowVersion, vendorData: correlation.data.vendorData });
  } catch (error) {
    throw new IdentityVerificationSessionError("We could not reopen this check. Your existing check is unchanged; try Resume again shortly.",
      error instanceof DiditProviderError ? error.code : "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE", 503);
  }
  const current = await getCurrentCandidateVerification(supabase, candidateId);
  if (current.attemptId !== attemptId || !current.canResume) databaseFailure({ code: "IV002" });
  if (hosted.awaitingResult) {
    const result = await repository.requestReconciliation(candidateId, attemptId);
    if (result.error) databaseFailure(result.error);
    return { awaitingResult: true as const };
  }
  return { url: hosted.url };
}
