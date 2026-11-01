import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  grantActionResultSchema,
  portfolioAccessSummarySchema,
  type GrantAction,
  type PortfolioAccessSummary,
} from "./access.contract";
import { AccessRepository } from "./access.repository";

export class AccessLifecycleError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** Returns the authenticated owner's active grants and immutable access history. */
export async function getPortfolioAccessSummary(
  supabase: SupabaseClient
): Promise<PortfolioAccessSummary> {
  const repository = new AccessRepository(supabase);
  const { data, error } = await repository.listPortfolioAccess();
  const parsed = portfolioAccessSummarySchema.safeParse(data);
  if (error || !parsed.success) throw new AccessLifecycleError("Sharing status could not be loaded. Existing access has not changed.", "ACCESS_SUMMARY_UNAVAILABLE", 503);
  return parsed.data;
}

/** Revokes an existing Complete Portfolio grant through an atomic command. */
export async function managePortfolioGrant(
  supabase: SupabaseClient,
  grantId: string,
  action: GrantAction
) {
  const repository = new AccessRepository(supabase);
  const { data, error } = await repository.manageGrant(grantId, action);
  const parsed = grantActionResultSchema.safeParse(data);
  if (error || !parsed.success) {
    throw new AccessLifecycleError(
      "This access change could not be saved.",
      "ACCESS_TRANSACTION_FAILED",
      500
    );
  }
  if (parsed.data.status === "not_found") {
    throw new AccessLifecycleError("Access grant not found.", "ACCESS_NOT_FOUND", 404);
  }
  if (parsed.data.status === "unauthorized") {
    throw new AccessLifecycleError("You cannot manage this access grant.", "ACCESS_FORBIDDEN", 403);
  }
  if (parsed.data.status === "invalid_transition") {
    throw new AccessLifecycleError(
      "This access can no longer be changed.",
      "ACCESS_INVALID_TRANSITION",
      409
    );
  }
  if (parsed.data.status === "renewal_disabled") {
    throw new AccessLifecycleError("Existing private access cannot be extended.", "ACCESS_RENEWAL_DISABLED", 409);
  }
  return parsed.data;
}
