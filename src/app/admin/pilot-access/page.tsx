import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadPilotAccessState } from "@/features/pilot-access/server/pilot-access.service";
import PilotAccessAdminClient from "./pilot-access-admin-client";

export const metadata: Metadata = { title: "Pilot access administration" };

export default async function PilotAccessAdminPage() {
  const { supabase } = await getAuthenticatedUser();
  const state = await loadPilotAccessState(supabase);
  if (!state.isPilotAdministrator) notFound();
  return <PilotAccessAdminClient />;
}
