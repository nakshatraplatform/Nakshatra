import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  brokerCustomerRelationshipRefSchema,
  familyViewerRefSchema,
  workspaceRefSchema,
} from "@/features/security/public-reference";
import {
  brokerdeskFamilySetupSchema,
  candidateFamilyRosterSchema,
  createdFamilyViewerInvitationSchema,
  familyViewerTransitionSchema,
  proposedFamilyViewerResultSchema,
} from "./family-viewer.contract";
import { FamilyViewerRepository } from "./family-viewer.repository";

export class FamilyViewerError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

export async function resolveBrokerdeskFamilySetup(
  supabase: SupabaseClient,
  workspaceRef: string,
  relationshipRef: string
) {
  if (!workspaceRefSchema.safeParse(workspaceRef).success
    || !brokerCustomerRelationshipRefSchema.safeParse(relationshipRef).success) {
    return { available: false } as const;
  }

  const { data, error } = await new FamilyViewerRepository(supabase)
    .resolveBrokerdeskSetup(workspaceRef, relationshipRef);
  const parsed = brokerdeskFamilySetupSchema.safeParse(data);
  if (error || !parsed.success) {
    throw new FamilyViewerError(
      "Family setup is temporarily unavailable.",
      "BROKERDESK_FAMILY_SETUP_UNAVAILABLE",
      503
    );
  }
  return parsed.data;
}

export async function proposeFamilyViewer(
  supabase: SupabaseClient,
  input: {
    workspaceRef: string;
    relationshipRef: string;
    emailHash: string;
    emailHint: string;
    displayName: string;
    relationshipKind: string;
    relationshipLabel: string | null;
    preferredLocale: string | null;
    idempotencyKey: string;
  }
) {
  if (!workspaceRefSchema.safeParse(input.workspaceRef).success
    || !brokerCustomerRelationshipRefSchema.safeParse(input.relationshipRef).success) {
    throw new FamilyViewerError(
      "Customer relationship unavailable.",
      "BROKERDESK_FAMILY_PROPOSAL_UNAVAILABLE",
      404
    );
  }

  const { data, error } = await new FamilyViewerRepository(supabase).propose(input);
  const parsed = proposedFamilyViewerResultSchema.safeParse(data);
  if (error?.code === "22023") {
    throw new FamilyViewerError(
      "Check the family contact and try again.",
      "BROKERDESK_FAMILY_PROPOSAL_INVALID",
      400
    );
  }
  if (error || !parsed.success) {
    throw new FamilyViewerError(
      "The family contact proposal could not be saved.",
      "BROKERDESK_FAMILY_PROPOSAL_UNAVAILABLE",
      503
    );
  }
  return parsed.data;
}

export async function resolveCandidateFamilyRoster(supabase: SupabaseClient) {
  const { data, error } = await new FamilyViewerRepository(supabase).resolveCandidateRoster();
  const parsed = candidateFamilyRosterSchema.safeParse(data);
  if (error || !parsed.success) {
    throw new FamilyViewerError(
      "Family representatives are temporarily unavailable.",
      "CUSTOMER_FAMILY_VIEWERS_UNAVAILABLE",
      503
    );
  }
  return parsed.data;
}

function commandError(error: { code?: string } | null, parsed: { success: boolean }, invalidCode: string) {
  if (error?.code === "22023") {
    throw new FamilyViewerError("Check the request and try again.", invalidCode, 400);
  }
  if (error || !parsed.success) {
    throw new FamilyViewerError(
      "The family representative change could not be saved.",
      "CUSTOMER_FAMILY_VIEWER_UNAVAILABLE",
      503
    );
  }
}

export async function createCandidateFamilyViewer(supabase: SupabaseClient, input: {
  emailHash: string;
  emailHint: string;
  displayName: string;
  relationshipKind: string;
  relationshipLabel: string | null;
  preferredLocale: string | null;
  tokenHash: string;
  idempotencyKey: string;
}) {
  const { data, error } = await new FamilyViewerRepository(supabase).create(input);
  const parsed = createdFamilyViewerInvitationSchema.safeParse(data);
  commandError(error, parsed, "CUSTOMER_FAMILY_VIEWER_INVALID");
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}

export async function decideCandidateFamilyViewerProposal(supabase: SupabaseClient, input: {
  viewerRef: string;
  decision: "approve" | "reject";
  emailHash: string | null;
  tokenHash: string | null;
  idempotencyKey: string;
}) {
  if (!familyViewerRefSchema.safeParse(input.viewerRef).success) return { available: false } as const;
  const { data, error } = await new FamilyViewerRepository(supabase).decide(input);
  const parsed = familyViewerTransitionSchema.safeParse(data);
  commandError(error, parsed, "CUSTOMER_FAMILY_VIEWER_DECISION_INVALID");
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}

export async function setCandidatePrimaryFamilyViewer(supabase: SupabaseClient, input: {
  viewerRef: string;
  expectedVersion: number;
  idempotencyKey: string;
}) {
  if (!familyViewerRefSchema.safeParse(input.viewerRef).success) return { available: false } as const;
  const { data, error } = await new FamilyViewerRepository(supabase)
    .setPrimary(input.viewerRef, input.expectedVersion, input.idempotencyKey);
  const parsed = familyViewerTransitionSchema.safeParse(data);
  commandError(error, parsed, "CUSTOMER_FAMILY_VIEWER_PRIMARY_INVALID");
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}

export async function revokeCandidateFamilyViewer(supabase: SupabaseClient, input: {
  viewerRef: string;
  expectedVersion: number;
  idempotencyKey: string;
}) {
  if (!familyViewerRefSchema.safeParse(input.viewerRef).success) return { available: false } as const;
  const { data, error } = await new FamilyViewerRepository(supabase)
    .revoke(input.viewerRef, input.expectedVersion, input.idempotencyKey);
  const parsed = familyViewerTransitionSchema.safeParse(data);
  commandError(error, parsed, "CUSTOMER_FAMILY_VIEWER_REVOKE_INVALID");
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}

export async function acceptFamilyViewerInvitation(
  supabase: SupabaseClient,
  tokenHash: string,
  idempotencyKey: string
) {
  const { data, error } = await new FamilyViewerRepository(supabase).accept(tokenHash, idempotencyKey);
  const parsed = familyViewerTransitionSchema.safeParse(data);
  commandError(error, parsed, "FAMILY_VIEWER_INVITATION_INVALID");
  if (!parsed.success) throw new Error("unreachable");
  return parsed.data;
}
