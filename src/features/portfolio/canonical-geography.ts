import type { PortfolioData, PortfolioDraftData } from "@/types/portfolio";

/** Use the database-normalized saved labels for selected reference IDs.
 * Manual locations remain owner-entered; changing identifiers requires saving first.
 */
export function savedCanonicalGeography(
  personal: PortfolioData["personal"],
  saved: PortfolioDraftData["personal"] | undefined,
): PortfolioData["personal"] {
  if (!personal.country_code && !personal.region_code && !personal.city_geoname_id) return personal;
  if (!saved || ["country_code", "region_code", "city_geoname_id"].some(
    (key) => personal[key as keyof typeof personal] !== saved[key as keyof typeof saved],
  )) throw new Error("Save your location before reviewing and publishing it.");
  const next = {
    ...personal,
    ...(personal.country_code ? { country: saved.country } : {}),
    ...(personal.region_code ? { region: saved.region } : {}),
    ...(personal.city_geoname_id ? { city: saved.city } : {}),
  };
  return { ...next, current_location: [next.city, next.region, next.country].filter(Boolean).join(", ") };
}
