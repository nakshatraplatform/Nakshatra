import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_PUBLICATION_READINESS,
  publicationReadinessSchema,
  type PublicationProgressAction,
  type PublicationReadiness,
} from "./publication-readiness.contract";

export class PublicationProgressError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

/** Reads only the owner-safe journey projection; private payment references never cross this boundary. */
export async function getPublicationReadiness(
  supabase: SupabaseClient
): Promise<PublicationReadiness> {
  const { data, error } = await supabase.rpc("get_portfolio_publication_readiness");
  const parsed = publicationReadinessSchema.safeParse(data);
  return error || !parsed.success ? EMPTY_PUBLICATION_READINESS : parsed.data;
}

/** Applies one authenticated, database-authorized journey transition. */
export async function updatePublicationProgress(
  supabase: SupabaseClient,
  action: PublicationProgressAction
): Promise<PublicationReadiness> {
  const { data, error } = await supabase.rpc("update_portfolio_onboarding_progress", {
    p_action: action.action,
    p_value: action.value ?? null,
  });
  if (error) {
    throw new PublicationProgressError("We could not save your publication progress.", "PUBLICATION_PROGRESS_FAILED", 500);
  }
  const result = data as { status?: unknown; readiness?: unknown } | null;
  if (result?.status === "not_found") {
    throw new PublicationProgressError("Save your portfolio before continuing.", "PORTFOLIO_DRAFT_MISSING", 409);
  }
  if (result?.status === "verification_required") {
    throw new PublicationProgressError("Complete identity verification before confirming disclosure.", "IDENTITY_VERIFICATION_REQUIRED", 409);
  }
  if (result?.status === "payment_required") {
    throw new PublicationProgressError("An active paid plan is required before confirming disclosure.", "PAYMENT_REQUIRED", 409);
  }
  if (result?.status === "content_required") {
    throw new PublicationProgressError("Complete all required portfolio details before confirming disclosure.", "PORTFOLIO_NOT_READY", 409);
  }
  const parsed = publicationReadinessSchema.safeParse(result?.readiness);
  if (result?.status !== "ok" || !parsed.success) {
    throw new PublicationProgressError("We could not confirm your publication progress.", "PUBLICATION_PROGRESS_FAILED", 500);
  }
  return parsed.data;
}
