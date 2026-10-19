import "server-only";
import type { getAuthenticatedUser } from "@/lib/auth";
import { readAccountProfile, readPortfolioAccountProfile } from "../profile";

type Session = Awaited<ReturnType<typeof getAuthenticatedUser>>;

/** Read-only display projection; the verified owner's names never authorize access. */
export async function loadAccountHeaderProfile({ supabase, user }: Session) {
  const fallback = readAccountProfile(user);
  try {
    const { data, error } = await supabase.from("portfolios").select("draft_data")
      .eq("user_id", user.id).maybeSingle();
    if (error) return fallback;
    return readPortfolioAccountProfile(data?.draft_data) ?? fallback;
  } catch {
    // Identity loading must not take settings, theme or sign-out offline.
    return fallback;
  }
}
