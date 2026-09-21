import type { Metadata } from "next";
import PilotAccessClient from "../pilot-access/pilot-access-client";
import { createClient } from "@/lib/supabase/server";
import { loadPilotAccessState } from "@/features/pilot-access/server/pilot-access.service";

export const metadata: Metadata = {
  title: "Request an invitation",
  description: "Request an invitation to the VivIntro private pilot.",
  alternates: { canonical: "/waitlist" },
};

export default async function WaitlistPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <PilotAccessClient initialStep="identify" />;
  let initialState = null;
  let initialError: string | null = null;
  try {
    initialState = await loadPilotAccessState(supabase);
  } catch {
    initialError = "We could not check an existing invitation request. You can verify your email to continue.";
  }
  if (!initialState) return <PilotAccessClient initialStep="identify" initialError={initialError} />;
  return <PilotAccessClient initialState={initialState} initialStep={initialState.canCreatePortfolio || initialState.application ? "result" : "details"} />;
}
