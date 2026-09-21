import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import { DashboardRepository } from "./dashboard.repository";

const renewalResultSchema = z.object({
  status: z.enum(["renewed", "not_published", "unauthorized", "creator_entitlement_required"]),
  expiresAt: z.string().nullable().optional(),
});

export class PortfolioRenewalError extends Error {
  constructor(
    message: string,
    readonly code = "PORTFOLIO_RENEWAL_FAILED",
    readonly status = 500
  ) {
    super(message);
  }
}

/**
 * Reactivates the authenticated owner's public link until they unpublish it.
 */
export async function renewPortfolioLink({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const expiresAt = null;

  const repository = new DashboardRepository(supabase);
  const { data, error } = await repository.renewPortfolioTransaction(expiresAt);
  const result = renewalResultSchema.safeParse(data);
  if (error || !result.success) {
    throw new PortfolioRenewalError("We could not renew your portfolio link. Please try again.", "PORTFOLIO_RENEWAL_TRANSACTION_FAILED");
  }
  if (result.data.status === "creator_entitlement_required") {
    throw new PortfolioRenewalError(
      "Portfolio creation is currently available only to invited beta participants.",
      "PILOT_INVITATION_REQUIRED",
      403
    );
  }
  if (result.data.status !== "renewed") {
    throw new PortfolioRenewalError("Generate your portfolio before renewing its link.", "PORTFOLIO_NOT_PUBLISHED", 400);
  }
  return { expiresAt: result.data.expiresAt ?? null };
}
