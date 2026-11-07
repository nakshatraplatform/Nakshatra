import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntroductionFamilyUpdateCommand, IntroductionShareCommand } from "./introduction-workspace.contract";

export class BrokerIntroductionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  actionWorkspace(workspaceRef: string, introductionRef: string, includeResponses: boolean) {
    const rpc = includeResponses ? "resolve_brokerdesk_introduction_action_with_responses" : "resolve_brokerdesk_introduction_action";
    return this.supabase.rpc(rpc, {
      p_workspace_ref: workspaceRef, p_introduction_ref: introductionRef,
    });
  }

  recordFamilyUpdate(workspaceRef: string, introductionRef: string, command: IntroductionFamilyUpdateCommand) {
    const rpc = command.confirmFamilyAccess ? "record_introduction_family_update_with_family_consent" : "record_introduction_family_update";
    return this.supabase.rpc(rpc, {
      p_workspace_ref: workspaceRef, p_introduction_ref: introductionRef,
      p_side: command.side, p_reported_status: command.status, p_reported_by: command.reportedBy,
      p_channel: command.channel, p_comment: command.comment, p_consent_attested: command.consentAttested,
      p_expected_version: command.expectedVersion, p_idempotency_key: command.idempotencyKey,
    });
  }

  recordShareAction(workspaceRef: string, introductionRef: string, command: IntroductionShareCommand) {
    return this.supabase.rpc("record_introduction_share_action", {
      p_workspace_ref: workspaceRef, p_introduction_ref: introductionRef,
      p_side: command.side, p_action: command.action, p_expected_version: command.expectedVersion,
      p_idempotency_key: command.idempotencyKey,
    });
  }

  actionList(workspaceRef: string, query: { limit: number; beforeCreatedAt?: string; beforeRef?: string }) {
    return this.supabase.rpc("resolve_brokerdesk_introduction_actions", {
      p_workspace_ref: workspaceRef, p_limit: query.limit,
      p_before_created_at: query.beforeCreatedAt, p_before_ref: query.beforeRef,
    });
  }

  recipients(workspaceRef: string, relationshipRef: string) {
    return this.supabase.rpc("resolve_broker_introduction_recipients", {
      p_workspace_ref: workspaceRef,
      p_source_relationship_ref: relationshipRef,
    });
  }

  createIdentityBound(workspaceRef: string, relationshipRef: string, recipientRelationshipRef: string, idempotencyKey: string) {
    return this.supabase.rpc("create_identity_bound_broker_introduction", {
      p_workspace_ref: workspaceRef,
      p_source_relationship_ref: relationshipRef,
      p_recipient_relationship_ref: recipientRelationshipRef,
      p_idempotency_key: idempotencyKey,
    });
  }

  list(workspaceRef: string, relationshipRef: string) {
    return this.supabase.rpc("resolve_broker_introductions", {
      p_workspace_ref: workspaceRef,
      p_relationship_ref: relationshipRef,
    });
  }

  markShared(workspaceRef: string, introductionRef: string, expectedVersion: number) {
    return this.supabase.rpc("mark_broker_introduction_shared", {
      p_workspace_ref: workspaceRef,
      p_introduction_ref: introductionRef,
      p_expected_version: expectedVersion,
    });
  }

  revoke(workspaceRef: string, introductionRef: string, expectedVersion: number) {
    return this.supabase.rpc("revoke_broker_introduction", {
      p_workspace_ref: workspaceRef,
      p_introduction_ref: introductionRef,
      p_expected_version: expectedVersion,
    });
  }

  claim(introductionRef: string, claimHash: string, sessionHash: string) {
    return this.supabase.rpc("claim_broker_introduction_pass", {
      p_introduction_ref: introductionRef,
      p_claim_token_hash: claimHash,
      p_session_token_hash: sessionHash,
    });
  }

  resolve(introductionRef: string) {
    return this.supabase.rpc("resolve_broker_introduction", {
      p_introduction_ref: introductionRef,
      p_session_token_hash: null,
    });
  }

  respond(introductionRef: string, response: string, comment: string, confirmCompleteAccess: boolean, confirmFamilyAccess?: true) {
    const rpc = confirmFamilyAccess ? "respond_to_broker_introduction_with_family_consent" : "respond_to_broker_introduction";
    return this.supabase.rpc(rpc, {
      p_introduction_ref: introductionRef,
      ...(confirmFamilyAccess ? {} : { p_session_token_hash: "" }),
      p_response: response,
      p_comment: comment,
      p_confirm_complete_access: confirmCompleteAccess,
    });
  }

  notices(workspaceRef: string, relationshipRef: string) {
    return this.supabase.rpc("resolve_broker_portfolio_update_notices", {
      p_workspace_ref: workspaceRef,
      p_relationship_ref: relationshipRef,
    });
  }

  flagNotice(workspaceRef: string, relationshipRef: string, noticeRef: string) {
    return this.supabase.rpc("flag_broker_portfolio_update", {
      p_workspace_ref: workspaceRef,
      p_relationship_ref: relationshipRef,
      p_notice_ref: noticeRef,
    });
  }

  ownerResponses() {
    return this.supabase.rpc("resolve_my_broker_introduction_responses");
  }

  received() {
    return this.supabase.rpc("resolve_received_broker_introductions");
  }

  dashboard(workspaceRef: string) {
    return this.supabase.rpc("resolve_brokerdesk_dashboard", { p_workspace_ref: workspaceRef });
  }

  markResponseReviewed(workspaceRef: string, introductionRef: string) {
    return this.supabase.rpc("mark_broker_introduction_response_reviewed", {
      p_workspace_ref: workspaceRef,
      p_introduction_ref: introductionRef,
    });
  }

  acknowledgeNotice(workspaceRef: string, relationshipRef: string, noticeRef: string) {
    return this.supabase.rpc("acknowledge_broker_portfolio_update", {
      p_workspace_ref: workspaceRef,
      p_relationship_ref: relationshipRef,
      p_notice_ref: noticeRef,
    });
  }
}
