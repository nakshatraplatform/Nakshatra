import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InterestRequestInput } from "./interest.contract";

/** Calls the database-owned interest command so clients cannot set workflow fields. */
export class InterestRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  submit(input: InterestRequestInput) {
    const location = [input.city, input.state, input.country]
      .filter((value): value is string => Boolean(value))
      .join(", ") || null;

    return this.supabase.rpc("submit_public_interest", {
      p_share_token: input.portfolioToken,
      p_name: input.name,
      p_profile_for: input.profileFor,
      p_phone: input.phone,
      p_email: input.email,
      p_location: location,
      p_family_context: input.familyContext ?? null,
      p_message: input.message ?? null,
      p_portfolio_url: null,
      p_country: input.country ?? null,
      p_state: input.state ?? null,
      p_city: input.city ?? null,
    });
  }

  /**
   * Lists owner-visible relationships through the database-owned projection.
   * Requester portfolio links are resolved from authenticated ownership, never metadata.
   */
  listForPortfolio(_portfolioId: string, limit = 50) {
    return this.supabase.rpc("list_dashboard_interests", { p_limit: limit });
  }
}
