import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

const interestDecisionResultSchema = z.enum([
  "approved",
  "set_aside",
  "rejected",
  "reopened",
  "already_approved",
  "already_rejected",
  "already_open",
  "invalid_transition",
  "not_found",
  "signin_required",
  "verification_required",
  "unauthorized",
  "review_changed",
  "no_contact",
]);

export type InterestDecisionResult = z.infer<typeof interestDecisionResultSchema>;

/** Reviewed approvals create expiring viewing access without a visitor Auth account. */
export async function decideInterestRequest(
  supabase: SupabaseClient,
  interestRequestId: string,
  decision: "approved" | "rejected" | "reopened" | "set_aside",
  revision?: string
): Promise<InterestDecisionResult> {
  const { data, error } = await supabase.rpc("decide_interest_relationship", {
    p_interest_request_id: interestRequestId, p_decision: decision, p_revision: revision ?? null,
  });
  const result = interestDecisionResultSchema.safeParse(data);
  if (error || !result.success) throw new Error("Interest decision could not be stored");
  return result.data;
}
