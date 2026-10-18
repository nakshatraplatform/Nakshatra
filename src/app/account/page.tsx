import type { Metadata } from "next";
import { getAccountDeletionStatus } from "@/features/account/server/account.service";
import { getAuthenticatedUser } from "@/lib/auth";
import AccountClient from "./account-client";
import { accountSignInMethods, readAccountProfile } from "@/features/account/profile";
import { CustomerAppFrame } from "@/components/navigation/CustomerAppFrame";
import { DataLoadError } from "@/components/loading/DataLoadError";

export const metadata: Metadata = {
  title: "Settings",
};

/** Loads only the signed-in user's deletion status before rendering account controls. */
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
  try {
    deletion = await getAccountDeletionStatus(supabase);
  } catch {
    // Unknown deletion state must never enable account mutation controls.
    return <main id="main-content"><DataLoadError title="We could not load your account controls." /></main>;
  }

  return (
    <AccountClient
      userEmail={user.email ?? ""}
      initialProfile={readAccountProfile(user)}
      signInMethods={accountSignInMethods(user)}
      initialDeletion={deletion}
      reauthComplete={reauthComplete}
    />
  );
}
