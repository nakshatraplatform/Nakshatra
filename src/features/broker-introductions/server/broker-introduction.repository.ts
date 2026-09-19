import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export class BrokerIntroductionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  prepare(workspaceRef: string, relationshipRef: string) {
    return this.supabase.rpc("prepare_broker_introduction", {
      p_workspace_ref: workspaceRef,
      p_relationship_ref: relationshipRef,
    });
  }

  create(input: Record<string, unknown>) {
    return this.supabase.rpc("create_broker_introduction", input);
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

  resolve(introductionRef: string, sessionHash: string | null) {
    return this.supabase.rpc("resolve_broker_introduction", {
      p_introduction_ref: introductionRef,
      p_session_token_hash: sessionHash,
    });
  }

  respond(introductionRef: string, sessionHash: string, response: string, comment: string) {
    return this.supabase.rpc("respond_to_broker_introduction", {
      p_introduction_ref: introductionRef,
      p_session_token_hash: sessionHash,
      p_response: response,
      p_comment: comment,
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
