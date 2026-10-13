import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InterestRequestInput, NewViewerInterestInput } from "./interest.contract";

/** Calls the database-owned interest command so clients cannot set workflow fields. */
export class InterestRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  submit(input: InterestRequestInput & { useExistingProfile?: boolean }) {
    if (input.useExistingProfile) return this.supabase.rpc("submit_existing_interest", {
      p_share_token: input.portfolioToken, p_family_context: input.familyContext ?? null, p_message: input.message ?? null,
    });
    if ("location" in input) {
      const details = input as NewViewerInterestInput;
      return this.supabase.rpc("submit_interest_details", { p_details: {
        portfolioToken: details.portfolioToken, name: details.name, profileFor: details.profileFor,
        phone: details.phone, email: details.email, familyContext: details.familyContext,
        message: details.message, location: details.location,
        ...(details.profileFor !== "self" ? { candidate: details.candidate } : {}),
      } });
    }
    // Historical read shapes must never select the retired weaker command.
    return Promise.resolve({ data: null, error: { code: "22023", message: "Structured interest details required" } });
  }

  /**
   * Lists owner-visible relationships through the database-owned projection.
   * Requester portfolio links are resolved from authenticated ownership, never metadata.
   */
  listForPortfolio(_portfolioId: string, limit = 50) {
    return this.supabase.rpc("list_dashboard_interests", { p_limit: limit });
  }
}
