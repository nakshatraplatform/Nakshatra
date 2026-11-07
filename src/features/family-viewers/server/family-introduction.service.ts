import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { FamilyViewerRepository } from "./family-viewer.repository";
import { familyIntroductionSchema, type FamilyIntroductionAsset } from "./family-introduction.contract";

export async function resolveFamilyIntroduction(supabase: SupabaseClient, introductionRef: string) {
  const ref = brokerIntroductionRouteRefSchema.parse(introductionRef);
  const { data, error } = await new FamilyViewerRepository(supabase).introduction(ref);
  const parsed = familyIntroductionSchema.safeParse(data);
  if (error || !parsed.success) return { available: false } as const;
  return parsed.data;
}

const photoTypes = ["image/webp", "image/jpeg", "image/png", "image/avif"];

const assetLocatorSchema = z.object({
  path: z.string().min(1).max(1024),
  extension: z.enum(["pdf", "doc", "docx", "webp"]).nullable(),
}).strict();

export async function readFamilyIntroductionAsset(
  user: { id: string; sessionId: string }, introductionRef: string, asset: FamilyIntroductionAsset,
) {
  const admin = createServiceRoleClient();
  const resolved = await admin.rpc("resolve_family_introduction_asset", {
    p_introduction_ref: introductionRef, p_asset: asset, p_actor: user.id, p_session_id: user.sessionId,
  });
  const locator = assetLocatorSchema.safeParse(resolved.data);
  const horoscope = asset === "horoscope";
  if (resolved.error || !locator.success || horoscope !== Boolean(locator.data.extension)) return null;

  // Only a path from the live, authorized pinned projection reaches storage.
  const bucket = horoscope ? "horoscopes" : "photos";
  const { data, error } = await admin.storage.from(bucket).download(locator.data.path);
  if (error || !data || (!horoscope && !photoTypes.includes(data.type))) return null;
  return {
    body: data,
    contentType: horoscope ? "application/octet-stream" : data.type,
    fileName: horoscope ? `horoscope.${locator.data.extension}` : null,
  };
}
