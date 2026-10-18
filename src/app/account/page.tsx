import type { Metadata } from "next";
import { getAccountDeletionStatus } from "@/features/account/server/account.service";
import { getAuthenticatedUser } from "@/lib/auth";
import AccountClient from "./account-client";
import { accountSignInMethods, readAccountProfile, readPortfolioAccountProfile } from "@/features/account/profile";
import { CustomerAppFrame } from "@/components/navigation/CustomerAppFrame";
import { DataLoadError } from "@/components/loading/DataLoadError";

export const metadata: Metadata = {
  title: "Settings",
};

/** Authenticates before streaming the owner's account controls and safe name projection. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reauth?: string }>;
}) {
  const session = await getAuthenticatedUser();
  const query = await searchParams;
  return <CustomerAppFrame currentPage="account" userEmail={session.user.email}
    className="account-privacy-shell" loadingTitle="Loading your account controls">
    <AccountControls session={session} reauthComplete={query.reauth === "complete"} />
  </CustomerAppFrame>;
}

async function AccountControls({ session: { supabase, user }, reauthComplete }: {
  session: Awaited<ReturnType<typeof getAuthenticatedUser>>;
  reauthComplete: boolean;
}) {
  let deletion;
  let portfolioProfile;
  try {
    deletion = await getAccountDeletionStatus(supabase);
    // Keep RLS and the owner filter; only validated self-created name parts reach the client.
    const { data: portfolio, error } = await supabase.from("portfolios").select("draft_data")
      .eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    portfolioProfile = readPortfolioAccountProfile(portfolio?.draft_data);
  } catch {
    // Unknown deletion/name-source state must never enable account mutation controls.
    return <main id="main-content" tabIndex={-1}><DataLoadError title="We could not load your account controls." /></main>;
  }

  return (
    <AccountClient
      userEmail={user.email ?? ""}
      initialProfile={portfolioProfile || readAccountProfile(user)}
      profileManagedByPortfolio={Boolean(portfolioProfile)}
      signInMethods={accountSignInMethods(user)}
      initialDeletion={deletion}
      reauthComplete={reauthComplete}
    />
  );
}
