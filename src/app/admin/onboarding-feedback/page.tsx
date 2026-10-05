import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadPilotAccessState } from "@/features/pilot-access/server/pilot-access.service";
import OnboardingFeedbackAdminClient from "./onboarding-feedback-admin-client";

export const metadata: Metadata = { title: "Creator feedback · VivIntro", robots: { index: false, follow: false } };

export default async function OnboardingFeedbackAdminPage() {
  const { supabase } = await getAuthenticatedUser();
  const state = await loadPilotAccessState(supabase);
  if (!state.isPilotAdministrator) notFound();
  return <OnboardingFeedbackAdminClient />;
}
