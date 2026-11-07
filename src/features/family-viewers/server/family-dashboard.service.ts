import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FamilyViewerRepository } from "./family-viewer.repository";
import { FamilyViewerError } from "./family-viewer.service";
import { familyDashboardQuerySchema, familyDashboardSchema, type FamilyDashboardQuery } from "./family-dashboard.contract";

export async function resolveFamilyDashboard(supabase: SupabaseClient, input: FamilyDashboardQuery = {}) {
  const query = familyDashboardQuerySchema.parse(input);
  const { data, error } = await new FamilyViewerRepository(supabase).introductions(query);
  const parsed = familyDashboardSchema.safeParse(data);
  if (error || !parsed.success) {
    throw new FamilyViewerError("Family introductions are temporarily unavailable.", "FAMILY_DASHBOARD_UNAVAILABLE", 503);
  }
  return parsed.data;
}
