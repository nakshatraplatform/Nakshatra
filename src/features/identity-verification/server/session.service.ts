import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import {
  createDiditPhotoMatchSession,
  createDiditVerificationSession,
  DiditProviderError,
} from "./didit.provider";
import { hashIdentityBirthDate } from "./identity-match.mjs";
import { PhotoReferenceError, preparePhotoReference } from "./photo-reference";
import { IdentityVerificationSessionRepository } from "./session.repository";
import { getIdentityVerificationMatchKey } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const preparedCandidateSessionSchema = z.object({
  attempt_id: z.uuid(),
  provider_subject_ref: z.uuid(),
  portfolio_id: z.uuid(),
  reference_media_id: z.uuid(),
  reference_storage_path: z.string().min(3).max(1024),
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

function unavailableFromDatabase(error: { code?: string } | null, fallback: string, managementToken?: string): never {
  if (error?.code === "42501") {
    throw new IdentityVerificationSessionError("This verification action is not available.", "IDENTITY_VERIFICATION_FORBIDDEN", 403, managementToken);
  }
  if (error?.code === "22023") {
    throw new IdentityVerificationSessionError("This verification link is unavailable or has expired.", "IDENTITY_VERIFICATION_LINK_INVALID", 400, managementToken);
  }
  throw new IdentityVerificationSessionError("We could not complete identity verification. Please try again.", fallback, 503, managementToken);
}

async function attachCandidatePhotoSession(input: {
  repository: IdentityVerificationSessionRepository;
  prepared: z.infer<typeof preparedCandidateSessionSchema>;
  managementTokenHash: string;
  callbackUrl: string;
  managementToken: string;
  referenceSupabase?: SupabaseClient;
}) {
  const { data: source, error: downloadError } = await input.repository.downloadPhotoReference(
    input.prepared.reference_storage_path,
    input.referenceSupabase ?? createServiceRoleClient()
  );
  if (downloadError || !source) {
    throw new IdentityVerificationSessionError(
      "Add a current primary portfolio photo before starting verification.",
      "IDENTITY_VERIFICATION_REFERENCE_UNAVAILABLE",
      409,
      input.managementToken
    );
  }

  let reference;
  try {
    reference = await preparePhotoReference(Buffer.from(await source.arrayBuffer()));
  } catch (error) {
    const code = error instanceof PhotoReferenceError
      ? error.message
      : "IDENTITY_VERIFICATION_REFERENCE_UNAVAILABLE";
    throw new IdentityVerificationSessionError(
      "We could not prepare your primary photo for verification. Upload it again and retry.",
      code,
      409,
      input.managementToken
    );
  }

  let didit;
  try {
    const workflowId = process.env.DIDIT_WORKFLOW_ID?.trim() || "";
    const workflowVersion = Number(process.env.DIDIT_WORKFLOW_VERSION);
    const registration = await input.repository.registerPhotoProviderCreate(
      input.prepared.attempt_id,
      workflowId,
      workflowVersion,
      input.managementTokenHash
    );
    if (registration.error) {
      unavailableFromDatabase(
        registration.error,
        "IDENTITY_VERIFICATION_START_FAILED",
        input.managementToken
      );
    }
    didit = await createDiditPhotoMatchSession({
      attemptId: input.prepared.attempt_id,
      providerSubjectRef: input.prepared.provider_subject_ref,
      callbackUrl: input.callbackUrl,
      portraitImageBase64: reference.portraitImageBase64,
    });
  } catch (error) {
    if (error instanceof IdentityVerificationSessionError) throw error;
    const code = error instanceof DiditProviderError ? error.code : "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE";
    throw new IdentityVerificationSessionError("Identity verification is temporarily unavailable. Please try again.", code, 503, input.managementToken);
  }
  const { error } = await input.repository.attachCandidatePhotoSession({
    attemptId: input.prepared.attempt_id,
    providerSessionRef: didit.sessionId,
    referenceSha256: reference.sourceSha256,
    workflowId: didit.workflowId,
    workflowVersion: didit.workflowVersion,
    managementTokenHash: input.managementTokenHash,
  });
  if (error) unavailableFromDatabase(error, "IDENTITY_VERIFICATION_START_FAILED", input.managementToken);
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
  referenceSupabase?: SupabaseClient;
  candidateId: string | null;
  invitationTokenHash: string | null;
  managementToken: string;
  managementTokenHash: string;
  callbackUrl: string;
}) {
  const repository = new IdentityVerificationSessionRepository(input.supabase);
  const { data, error } = await repository.begin(input.candidateId, input.invitationTokenHash, input.managementTokenHash);
  if (error) unavailableFromDatabase(error, "IDENTITY_VERIFICATION_START_FAILED");
  return attachCandidatePhotoSession({
    repository,
    prepared: preparedCandidateSession(data),
    managementTokenHash: input.managementTokenHash,
    callbackUrl: input.callbackUrl,
    managementToken: input.managementToken,
    referenceSupabase: input.referenceSupabase,
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
  if (error) unavailableFromDatabase(error, "IDENTITY_VERIFICATION_WITHDRAW_FAILED");
}

/** Creates a fresh attempt from an unwithdrawn consent record and starts the hosted flow again. */
export async function retryIdentityVerification(input: {
  supabase: SupabaseClient;
  referenceSupabase?: SupabaseClient;
  tokenHash: string;
  managementToken: string;
  managementTokenHash: string;
  callbackUrl: string;
}) {
  const repository = new IdentityVerificationSessionRepository(input.supabase);
  const { data, error } = await repository.retry(input.tokenHash, input.managementTokenHash);
  if (error) unavailableFromDatabase(error, "IDENTITY_VERIFICATION_RETRY_FAILED");
  return attachCandidatePhotoSession({
    repository,
    prepared: preparedCandidateSession(data),
    managementTokenHash: input.managementTokenHash,
    callbackUrl: input.callbackUrl,
    managementToken: input.managementToken,
    referenceSupabase: input.referenceSupabase,
  });
}
