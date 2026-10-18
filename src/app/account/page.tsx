import type { Metadata } from "next";
import { getAccountDeletionStatus } from "@/features/account/server/account.service";
import { getAuthenticatedUser } from "@/lib/auth";
import AccountClient from "./account-client";
import { accountSignInMethods, readAccountProfile, readPortfolioAccountProfile } from "@/features/account/profile";

export const metadata: Metadata = {
  title: "Settings",
};

/** Loads only the signed-in user's deletion status before rendering account controls. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reauth?: string }>;
}) {
  const { supabase, user } = await getAuthenticatedUser();
  const deletion = await getAccountDeletionStatus(supabase);
  // RLS and the explicit owner filter both apply. No published/private details are sent to the client.
  const { data: portfolio } = await supabase.from("portfolios").select("draft_data")
    .eq("user_id", user.id).maybeSingle();
  const portfolioProfile = readPortfolioAccountProfile(portfolio?.draft_data);
  const query = await searchParams;

  return (
    <AccountClient
      userEmail={user.email ?? ""}
      initialProfile={portfolioProfile || readAccountProfile(user)}
      profileManagedByPortfolio={Boolean(portfolioProfile)}
      signInMethods={accountSignInMethods(user)}
      initialDeletion={deletion}
      reauthComplete={query.reauth === "complete"}
    />
  );
}
