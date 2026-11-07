import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export class FamilyViewerRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  introductions(query: { limit: number; beforeCreatedAt?: string; beforeRef?: string }) {
    return this.supabase.rpc("resolve_family_introductions", {
      p_limit: query.limit,
      p_before_created_at: query.beforeCreatedAt ?? undefined,
      p_before_ref: query.beforeRef ?? undefined,
    });
  }

  introduction(introductionRef: string) {
    return this.supabase.rpc("resolve_family_introduction", { p_introduction_ref: introductionRef });
  }

  resolveBrokerdeskSetup(workspaceRef: string, relationshipRef: string) {
    return this.supabase.rpc("resolve_brokerdesk_family_setup", {
      p_workspace_ref: workspaceRef,
      p_relationship_ref: relationshipRef,
    });
  }

  propose(input: {
    workspaceRef: string;
    relationshipRef: string;
    emailHash: string;
    emailHint: string;
    displayName: string;
    relationshipKind: string;
    relationshipLabel: string | null;
    preferredLocale: string | null;
    idempotencyKey: string;
  }) {
    return this.supabase.rpc("propose_candidate_family_viewer", {
      p_workspace_ref: input.workspaceRef,
      p_relationship_ref: input.relationshipRef,
      p_email_hash: input.emailHash,
      p_email_hint: input.emailHint,
      p_display_name: input.displayName,
      p_relationship_kind: input.relationshipKind,
      p_relationship_label: input.relationshipLabel,
      p_preferred_locale: input.preferredLocale,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  resolveCandidateRoster() {
    return this.supabase.rpc("resolve_candidate_family_roster");
  }

  create(input: {
    emailHash: string;
    emailHint: string;
    displayName: string;
    relationshipKind: string;
    relationshipLabel: string | null;
    preferredLocale: string | null;
    tokenHash: string;
    idempotencyKey: string;
  }) {
    return this.supabase.rpc("create_candidate_family_viewer", {
      p_email_hash: input.emailHash,
      p_email_hint: input.emailHint,
      p_display_name: input.displayName,
      p_relationship_kind: input.relationshipKind,
      p_relationship_label: input.relationshipLabel,
      p_preferred_locale: input.preferredLocale,
      p_token_hash: input.tokenHash,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  decide(input: {
    viewerRef: string;
    decision: "approve" | "reject";
    emailHash: string | null;
    tokenHash: string | null;
    idempotencyKey: string;
  }) {
    return this.supabase.rpc("decide_family_viewer_proposal", {
      p_viewer_ref: input.viewerRef,
      p_decision: input.decision,
      p_email_hash: input.emailHash,
      p_token_hash: input.tokenHash,
      p_idempotency_key: input.idempotencyKey,
    });
  }

  setPrimary(viewerRef: string, expectedVersion: number, idempotencyKey: string) {
    return this.supabase.rpc("set_primary_family_viewer", {
      p_viewer_ref: viewerRef,
      p_expected_row_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
    });
  }

  revoke(viewerRef: string, expectedVersion: number, idempotencyKey: string) {
    return this.supabase.rpc("revoke_family_viewer", {
      p_viewer_ref: viewerRef,
      p_expected_row_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
    });
  }

  accept(tokenHash: string, idempotencyKey: string) {
    return this.supabase.rpc("accept_family_viewer_invitation", {
      p_token_hash: tokenHash,
      p_idempotency_key: idempotencyKey,
    });
  }
}
