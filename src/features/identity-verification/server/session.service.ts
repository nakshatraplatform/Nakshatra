import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import {
  createDiditLivenessSession,
  getCandidateVerificationConfig,
  createDiditVerificationSession,
  DiditProviderError,
} from "./didit.provider";
import { hashIdentityBirthDate } from "./identity-match.mjs";
import { IdentityVerificationSessionRepository } from "./session.repository";
import { getIdentityVerificationMatchKey } from "@/lib/env";

const preparedCandidateSessionSchema = z.object({
  attempt_id: z.uuid(),
  provider_subject_ref: z.uuid(),
}).strict();

const preparedRepresentativeSessionSchema = z.object({
  attempt_id: z.uuid(),
  provider_subject_ref: z.uuid(),
  legal_name: z.string().min(1),
}).strict();

const linkStatusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("invitation"), status: z.literal("ready") }).strict(),
  z.object({
    kind: z.literal("management"),
    status: z.enum(["pending", "created", "invited", "in_progress", "verified", "declined", "failed", "expired", "redacted", "revoked"]),
    canRetry: z.boolean(),
    canWithdraw: z.boolean(),
  }).strict(),
]);

export type IdentityVerificationLinkStatus = z.infer<typeof linkStatusSchema>;

export class IdentityVerificationSessionError extends Error {
  constructor(message: string, readonly code: string, readonly status: number, readonly managementToken?: string) {
    super(message);
  }
}

function preparedCandidateSession(data: unknown) {
  const parsed = preparedCandidateSessionSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!parsed.success) {
    throw new IdentityVerificationSessionError("We could not prepare identity verification. Please try again.", "IDENTITY_VERIFICATION_START_FAILED", 503);
  }
  return parsed.data;
}

function unavailableFromDatabase(error: { code?: string } | null, fallback: string, managementToken?: string, stage = "database"): never {
  console.warn("identity_verification_failure", { stage, sqlstate: /^[A-Z0-9]{5}$/.test(error?.code ?? "") ? error?.code : "UNKNOWN" });
  if (error?.code === "42501") {
    throw new IdentityVerificationSessionError("This verification action is not available.", "IDENTITY_VERIFICATION_FORBIDDEN", 403, managementToken);
  }
  if (error?.code === "IV001") {
    throw new IdentityVerificationSessionError("This verification link is unavailable or has expired.", "IDENTITY_VERIFICATION_LINK_INVALID", 400, managementToken);
  }
  if (error?.code === "IV003") {
    throw new IdentityVerificationSessionError("Verification is temporarily unavailable. Please try again later.", "IDENTITY_VERIFICATION_CONFIGURATION_INVALID", 503, managementToken);
  }
  if (error?.code === "IV002") {
    throw new IdentityVerificationSessionError("This verification cannot continue in its current state. Use its management link or start a new check from your dashboard.", "IDENTITY_VERIFICATION_STATE_CONFLICT", 409, managementToken);
  }
  throw new IdentityVerificationSessionError("We could not complete identity verification. Please try again.", fallback, 503, managementToken);
}

async function attachCandidateSession(input: {
  repository: IdentityVerificationSessionRepository;
  prepared: z.infer<typeof preparedCandidateSessionSchema>;
  managementTokenHash: string;
  callbackUrl: string;
  managementToken: string;
}) {
  let didit;
  try {
    const { workflowId } = getCandidateVerificationConfig();
    const registration = await input.repository.registerCandidateProviderCreate(
      input.prepared.attempt_id,
      workflowId,
      null,
      input.managementTokenHash
    );
    if (registration.error) {
      unavailableFromDatabase(
        registration.error,
        "IDENTITY_VERIFICATION_START_FAILED",
        input.managementToken,
        "register_provider_create"
      );
    }
    didit = await createDiditLivenessSession({
      attemptId: input.prepared.attempt_id,
      providerSubjectRef: input.prepared.provider_subject_ref,
      callbackUrl: input.callbackUrl,
    });
  } catch (error) {
    if (error instanceof IdentityVerificationSessionError) throw error;
    const code = error instanceof DiditProviderError ? error.code : "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE";
    throw new IdentityVerificationSessionError("Identity verification is temporarily unavailable. Please try again.", code, 503, input.managementToken);
  }
  const { error } = await input.repository.attachCandidateSession({
    attemptId: input.prepared.attempt_id,
    providerSessionRef: didit.sessionId,
    workflowId: didit.workflowId,
    workflowVersion: didit.workflowVersion,
    managementTokenHash: input.managementTokenHash,
  });
  if (error) unavailableFromDatabase(error, "IDENTITY_VERIFICATION_START_FAILED", input.managementToken, "attach_provider_session");
  return { url: didit.url };
}

async function attachRepresentativeProviderSession(input: {
  repository: IdentityVerificationSessionRepository;
  prepared: z.infer<typeof preparedRepresentativeSessionSchema> & { birth_date: string };
  managementTokenHash: string;
  callbackUrl: string;
  managementToken: string;
}) {
  let didit;
  try {
    didit = await createDiditVerificationSession({
      attemptId: input.prepared.attempt_id,
      providerSubjectRef: input.prepared.provider_subject_ref,
      legalName: input.prepared.legal_name,
      birthDate: input.prepared.birth_date,
      callbackUrl: input.callbackUrl,
    });
  } catch (error) {
    const code = error instanceof DiditProviderError ? error.code : "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE";
    throw new IdentityVerificationSessionError("Identity verification is temporarily unavailable. Please try again.", code, 503, input.managementToken);
  }
  const { error } = await input.repository.attachProviderSession(
    input.prepared.attempt_id,
    didit.sessionId,
    input.managementTokenHash
  );
  if (error) unavailableFromDatabase(error, "IDENTITY_VERIFICATION_START_FAILED", input.managementToken);
  return { url: didit.url };
}

/** Atomically authorizes, records consent, and starts one hosted Didit verification. */
export async function startIdentityVerification(input: {
  supabase: SupabaseClient;
  candidateId: string | null;
  invitationTokenHash: string | null;
  managementToken: string;
  managementTokenHash: string;
  callbackUrl: string;
}) {
  const repository = new IdentityVerificationSessionRepository(input.supabase);
  const { data, error } = await repository.begin(input.candidateId, input.invitationTokenHash, input.managementTokenHash);
  if (error) unavailableFromDatabase(error, "IDENTITY_VERIFICATION_START_FAILED", undefined, "begin_candidate_liveness");
  return attachCandidateSession({
    repository,
    prepared: preparedCandidateSession(data),
    managementTokenHash: input.managementTokenHash,
    callbackUrl: input.callbackUrl,
    managementToken: input.managementToken,
  });
}

function preparedRepresentativeSession(data: unknown, birthDate: string) {
  const parsed = preparedRepresentativeSessionSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!parsed.success) {
    throw new IdentityVerificationSessionError("We could not prepare identity verification. Please try again.", "IDENTITY_VERIFICATION_START_FAILED", 503);
  }
  return { ...parsed.data, birth_date: birthDate };
}

/** Starts the same Didit lifecycle for the authenticated business representative. */
export async function startBrokerdeskRepresentativeVerification(input: {
  supabase: SupabaseClient;
  workspaceRef: string;
  birthDate: string;
  proofHash: string;
  managementToken: string;
  managementTokenHash: string;
  callbackUrl: string;
}) {
  let birthDateHash: string;
  try {
    birthDateHash = hashIdentityBirthDate(
      input.birthDate,
      getIdentityVerificationMatchKey()
    );
  } catch {
    throw new IdentityVerificationSessionError(
      "Identity verification is temporarily unavailable. Please try again.",
      "IDENTITY_VERIFICATION_MATCHING_UNAVAILABLE",
      503
    );
  }

  const repository = new IdentityVerificationSessionRepository(input.supabase);
  const { data, error } = await repository.beginBrokerdeskRepresentative(
    input.workspaceRef,
    birthDateHash,
    input.managementTokenHash,
    input.proofHash
  );
  if (error) unavailableFromDatabase(error, "BROKERDESK_REPRESENTATIVE_VERIFICATION_START_FAILED");
  return attachRepresentativeProviderSession({
    repository,
    prepared: preparedRepresentativeSession(data, input.birthDate),
    managementTokenHash: input.managementTokenHash,
    callbackUrl: input.callbackUrl,
    managementToken: input.managementToken,
  });
}

/** Reads only generic invitation/management state; no candidate or provider data crosses this boundary. */
export async function getIdentityVerificationLinkStatus(supabase: SupabaseClient, tokenHash: string) {
  const { data, error } = await new IdentityVerificationSessionRepository(supabase).getLinkStatus(tokenHash);
  if (error?.code === "22023") {
    throw new IdentityVerificationSessionError("This verification link is unavailable or has expired.", "IDENTITY_VERIFICATION_LINK_INVALID", 400);
  }
  if (error) unavailableFromDatabase(error, "IDENTITY_VERIFICATION_STATUS_FAILED");
  const parsed = linkStatusSchema.safeParse(data);
  if (!parsed.success) {
    throw new IdentityVerificationSessionError("We could not load this verification link. Please try again.", "IDENTITY_VERIFICATION_STATUS_FAILED", 503);
  }
  return parsed.data;
}

/** Revokes VivIntro's verification projection immediately after one valid withdrawal request. */
export async function withdrawIdentityVerificationConsent(supabase: SupabaseClient, tokenHash: string) {
  const { error } = await new IdentityVerificationSessionRepository(supabase).withdrawConsent(tokenHash);
  if (error) unavailableFromDatabase(error.code === "22023" ? { code: "IV001" } : error, "IDENTITY_VERIFICATION_WITHDRAW_FAILED");
}

/** Creates a fresh attempt from an unwithdrawn consent record and starts the hosted flow again. */
export async function retryIdentityVerification(input: {
  supabase: SupabaseClient;
  tokenHash: string;
  managementToken: string;
  managementTokenHash: string;
  callbackUrl: string;
}) {
  const repository = new IdentityVerificationSessionRepository(input.supabase);
  const { data, error } = await repository.retry(input.tokenHash, input.managementTokenHash);
  if (error) unavailableFromDatabase(error, "IDENTITY_VERIFICATION_RETRY_FAILED", undefined, "retry_candidate_liveness");
  return attachCandidateSession({
    repository,
    prepared: preparedCandidateSession(data),
    managementTokenHash: input.managementTokenHash,
    callbackUrl: input.callbackUrl,
    managementToken: input.managementToken,
  });
}
