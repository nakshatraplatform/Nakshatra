import type { AccessData, PersonalData, PortfolioData } from "@/types/portfolio";
import { findSubdivision } from "@/features/location/subdivisions";

/** Never infer a region abbreviation or include street/postal details. */
export function formatPortfolioLocation(personal: PersonalData): string | undefined {
  const legacy = personal.current_location?.trim();
  const parts = legacy?.split(",").map(part => part.trim());
  const structured = Boolean(personal.city?.trim());
  const city = structured ? personal.city?.trim() : parts?.length === 3 ? parts[0] : undefined;
  const region = structured ? personal.region_code?.trim() || personal.region?.trim() : parts?.length === 3 ? parts[1] : undefined;
  const country = structured ? personal.country?.trim() : parts?.length === 3 ? parts[2] : undefined;
  const countryCode = country === "United States" || country === "US" || country === "USA" ? "US"
    : country === "India" || country === "IN" ? "IN" : undefined;
  // Use the existing directory; unknown countries/regions retain their labels.
  const subdivision = findSubdivision(countryCode, region);
  const regionLabel = subdivision ? subdivision.subdivisionCode.slice(3) : region;
  return city ? [city, regionLabel, country].filter(Boolean).join(", ") : legacy || undefined;
}

export function portfolioHobbies(value?: string): string[] {
  return [...new Set((value || "").split(",").map(item => item.trim()).filter(Boolean))];
}

/** A defensive display check on already authorized data, not a grant resolver.
 * Server projections remain authoritative, including broker disclosure versions.
 */
export function isPortfolioAudienceLocked(data: PortfolioData, key: keyof AccessData, mode: "owner" | "approved" | "public"): boolean {
  if (mode === "owner") return false;
  const audience = data.access?.[key];
  return audience === "owner" || audience === "broker" || (audience === "approved" && mode !== "approved");
}
