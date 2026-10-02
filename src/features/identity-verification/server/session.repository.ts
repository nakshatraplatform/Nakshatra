import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Keeps all public verification RPC calls at a small server-only persistence boundary. */
export class IdentityVerificationSessionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  begin(candidateId: string | null, invitationTokenHash: string | null, managementTokenHash: string) {
    return this.supabase.rpc("begin_candidate_photo_verification", {
      p_candidate_id: candidateId,
      p_invitation_token_hash: invitationTokenHash,
      p_management_token_hash: managementTokenHash,
    });
  }

  downloadPhotoReference(path: string, authorizedReader: SupabaseClient = this.supabase) {
    return authorizedReader.storage.from("photos").download(path);
  }

  registerPhotoProviderCreate(
    attemptId: string,
    workflowId: string,
    workflowVersion: number,
    managementTokenHash: string
  ) {
    return this.supabase.rpc("register_candidate_photo_provider_create", {
      p_attempt_id: attemptId,
      p_management_token_hash: managementTokenHash,
      p_workflow_id: workflowId,
      p_workflow_version: workflowVersion,
    });
  }

  attachCandidatePhotoSession(input: {
    attemptId: string;
    providerSessionRef: string;
    referenceSha256: string;
    workflowId: string;
    workflowVersion: number;
    managementTokenHash: string;
  }) {
    return this.supabase.rpc("attach_candidate_photo_provider_session", {
      p_attempt_id: input.attemptId,
      p_management_token_hash: input.managementTokenHash,
      p_provider_session_ref: input.providerSessionRef,
      p_reference_sha256: input.referenceSha256,
      p_workflow_id: input.workflowId,
      p_workflow_version: input.workflowVersion,
    });
  }

  beginBrokerdeskRepresentative(
    workspaceRef: string,
    birthDateHash: string,
    managementTokenHash: string,
    proofHash: string
  ) {
    return this.supabase.rpc("begin_brokerdesk_representative_verification", {
      p_birth_date_hash: birthDateHash,
      p_management_token_hash: managementTokenHash,
      p_proof_hash: proofHash,
      p_workspace_ref: workspaceRef,
    });
  }

  attachProviderSession(attemptId: string, providerSessionRef: string, managementTokenHash: string) {
    return this.supabase.rpc("attach_identity_verification_provider_session", {
      p_attempt_id: attemptId,
      p_provider_session_ref: providerSessionRef,
      p_management_token_hash: managementTokenHash,
    });
  }

  getLinkStatus(tokenHash: string) {
    return this.supabase.rpc("get_identity_verification_link_status", { p_token_hash: tokenHash });
  }

  withdrawConsent(tokenHash: string) {
    return this.supabase.rpc("withdraw_identity_verification_consent", { p_token_hash: tokenHash });
  }

  retry(tokenHash: string, replacementManagementTokenHash: string) {
    return this.supabase.rpc("retry_candidate_photo_verification", {
      p_token_hash: tokenHash,
      p_management_token_hash: replacementManagementTokenHash,
    });
  }
}
