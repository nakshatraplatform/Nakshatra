export interface CountryReference {
  country_code: string;
  name: string;
}

export interface RegionReference {
  region_code: string;
  name: string;
}

export interface CityReference {
  geoname_id: number;
  name: string;
  region_code: string | null;
}

type LocationReference = CountryReference | RegionReference | CityReference;

export async function getLocationReferences<T extends LocationReference>(
  params: URLSearchParams,
  signal?: AbortSignal
): Promise<T[]> {
  try {
    const response = await fetch(
      `/api/reference/locations?${params.toString()}`,
      { signal }
    );
    if (!response.ok) return [];
    const payload = (await response.json().catch(() => null)) as
      | { options?: T[] }
      | null;
    return Array.isArray(payload?.options) ? payload.options : [];
  } catch {
    return [];
  }
}

import type { LocationSuggestion, StructuredLocation } from "@/features/location/location.contract";

export async function searchLocationSuggestions(input: {
  query: string;
  countryCode?: "IN" | "US";
  sessionToken: string;
  portfolioToken?: string;
}, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  try {
    const response = await fetch("/api/reference/location-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "search", ...input }),
      signal,
    });
    if (!response.ok) return [];
    const payload = (await response.json().catch(() => null)) as { options?: LocationSuggestion[] } | null;
    return Array.isArray(payload?.options) ? payload.options : [];
  } catch {
    return [];
  }
}

export async function resolveLocationSuggestion(input: {
  placeId: string;
  sessionToken: string;
  portfolioToken?: string;
}): Promise<StructuredLocation | null> {
  try {
    const response = await fetch("/api/reference/location-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", provider: "google_places", ...input }),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { location?: StructuredLocation } | null;
    return payload?.location ?? null;
  } catch {
    return null;
  }
}
