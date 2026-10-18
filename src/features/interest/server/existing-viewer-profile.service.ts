import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { careerSchema, lifestyleSchema, contactSchema, personalSchema, type ContactData, type PersonalData } from "@/types/portfolio";
import { findSubdivision } from "@/features/location/subdivisions";

export type ExistingViewerProfile = {
  name: string;
  profileFor: "self" | "son" | "daughter" | "sibling" | "relative";
  phone: string;
  country?: string;
  state?: string;
  city?: string;
  countryCode?: "IN" | "US";
  subdivisionCode?: string;
  cityGeonameId?: number;
  postalCode?: string;
  profession?: string;
  coreValues?: string;
};

const supportedProfileFor = new Set<ExistingViewerProfile["profileFor"]>([
  "self",
  "son",
  "daughter",
  "sibling",
  "relative",
]);
const reusablePersonalSchema = personalSchema.pick({
  name: true,
  profile_for: true,
  country: true,
  region: true,
  city: true,
  country_code: true,
  region_code: true,
  city_geoname_id: true,
  postal_code: true,
}).partial();
const reusableContactSchema = contactSchema.pick({ phone: true, contacts: true }).partial();

/** Resolves reusable viewer identity from the authenticated user's own portfolio. */
export async function resolveExistingViewerProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ExistingViewerProfile | null> {
  const { data } = await supabase
    .from("portfolios")
    .select("draft_data,published_data")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;
  const sources = [data.draft_data, data.published_data];
  let personal: Partial<PersonalData> | null = null;
  let contact: Partial<ContactData> | null = null;
  let profession: string | undefined;
  let coreValues: string | undefined;

  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const record = source as Record<string, unknown>;
    const career = careerSchema.pick({ title: true }).safeParse(record.career);
    const lifestyle = lifestyleSchema.pick({ values_statement: true }).safeParse(record.lifestyle);
    if (!profession && career.success) profession = career.data.title;
    if (!coreValues && lifestyle.success) coreValues = lifestyle.data.values_statement;
    if (!personal) {
      const parsedPersonal = reusablePersonalSchema.safeParse(record.personal);
      if (parsedPersonal.success && parsedPersonal.data.name?.trim()) personal = parsedPersonal.data;
    }
    if (!contact) {
      const parsedContact = reusableContactSchema.safeParse(record.contact);
      if (parsedContact.success) contact = parsedContact.data;
    }
  }

  const name = personal?.name?.trim();
  if (!name) return null;
  const firstContact = contact?.contacts?.find((entry) => entry.phone) || contact?.contacts?.[0];
  const requestedProfileFor = personal?.profile_for as ExistingViewerProfile["profileFor"] | undefined;

  const countryCode = personal?.country_code === "IN" || personal?.country_code === "US" ? personal.country_code : undefined;
  const subdivisionCode = countryCode
    ? findSubdivision(countryCode, personal?.region_code ?? personal?.region)?.subdivisionCode
    : undefined;
  return {
    name,
    profileFor: requestedProfileFor && supportedProfileFor.has(requestedProfileFor) ? requestedProfileFor : "self",
    phone: contact?.phone?.trim() || firstContact?.phone?.trim() || "",
    country: personal?.country,
    state: personal?.region,
    city: personal?.city,
    countryCode,
    subdivisionCode,
    cityGeonameId: personal?.city_geoname_id,
    postalCode: personal?.postal_code,
    profession,
    coreValues,
  };
}
