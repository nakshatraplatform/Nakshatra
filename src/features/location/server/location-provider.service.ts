import "server-only";

import { z } from "zod/v4";
import { getGooglePlacesApiKey } from "@/lib/env";
import type { LocationSuggestion, StructuredLocation } from "../location.contract";
import { findSubdivision } from "../subdivisions";

const postalResponseSchema = z.array(z.object({
  Status: z.string().max(40).optional(),
  PostOffice: z.array(z.object({
    Name: z.string().max(160),
    District: z.string().max(160).optional().nullable(),
    Block: z.string().max(160).optional().nullable(),
    State: z.string().max(160),
    Country: z.string().max(100).optional(),
    Pincode: z.string().max(20),
  })).max(100).nullable().optional(),
})).max(10);

const zippopotamResponseSchema = z.object({
  "post code": z.string().trim().regex(/^\d{5}$/),
  country: z.string().max(100),
  "country abbreviation": z.literal("US"),
  places: z.array(z.object({
    "place name": z.string().trim().min(1).max(160),
    state: z.string().trim().min(1).max(160),
    "state abbreviation": z.string().trim().regex(/^[A-Z]{2}$/),
  })).min(1).max(100),
});

const googleAutocompleteSchema = z.object({
  suggestions: z.array(z.object({
    placePrediction: z.object({
      placeId: z.string().max(300),
      text: z.object({ text: z.string().max(500) }),
    }).optional(),
  })).max(20).optional(),
});

const googlePlaceSchema = z.object({
  addressComponents: z.array(z.object({
    longText: z.string().max(500),
    shortText: z.string().max(100).optional(),
    types: z.array(z.string().max(100)).max(10),
  })).max(50).optional(),
});

export class LocationProviderError extends Error {
  constructor(public readonly reason: "unavailable" | "invalid") {
    super(`Location provider ${reason}`);
  }
}

async function providerFetch(input: string, init?: RequestInit) {
  try {
    const response = await fetch(input, { ...init, signal: AbortSignal.timeout(3_000) });
    if (!response.ok) throw new LocationProviderError("unavailable");
    return response;
  } catch (error) {
    if (error instanceof LocationProviderError) throw error;
    throw new LocationProviderError("unavailable");
  }
}

async function readBoundedJson(response: Response, maximumBytes = 128 * 1024) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new LocationProviderError("unavailable");
  if (!response.body) throw new LocationProviderError("unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new LocationProviderError("unavailable");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(body)) as unknown; }
  catch { throw new LocationProviderError("unavailable"); }
}

function cleanLocality(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.toUpperCase() !== "NA" ? normalized : undefined;
}

async function searchIndiaPin(pin: string): Promise<LocationSuggestion[]> {
  const response = await providerFetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`);
  const parsed = postalResponseSchema.safeParse(await readBoundedJson(response));
  if (!parsed.success) throw new LocationProviderError("unavailable");

  return parsed.data.flatMap((entry) => entry.Status?.toLowerCase() === "success"
    ? (entry.PostOffice ?? []).map((office, index) => {
      const subdivision = findSubdivision("IN", office.State);
      // District is the stable city-level boundary used by matching. Block and
      // post-office names are useful display localities but vary too much to be
      // promoted into the universal country/subdivision/city hierarchy.
      const city = cleanLocality(office.District) ?? cleanLocality(office.Block) ?? office.Name.trim();
      return {
        id: `postalpincode:${office.Pincode}:${index}`,
        label: `${office.Name}, ${office.District ?? city}, ${office.State} ${office.Pincode}`,
        provider: "postalpincode" as const,
        country: "India",
        countryCode: "IN" as const,
        state: subdivision?.name ?? office.State.trim(),
        subdivisionCode: subdivision?.subdivisionCode,
        city,
        postalCode: office.Pincode.trim(),
        locationSource: "postalpincode" as const,
      };
    })
    : []);
}

async function searchUsZip(zip: string): Promise<LocationSuggestion[]> {
  const response = await providerFetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`);
  const parsed = zippopotamResponseSchema.safeParse(await readBoundedJson(response));
  if (!parsed.success || parsed.data["post code"] !== zip) throw new LocationProviderError("unavailable");

  return parsed.data.places.map((place, index) => {
    const subdivision = findSubdivision("US", place["state abbreviation"])
      ?? findSubdivision("US", place.state);
    return {
      id: `zippopotam:${parsed.data["post code"]}:${index}`,
      label: `${place["place name"]}, ${subdivision?.name ?? place.state} ${parsed.data["post code"]}`,
      provider: "zippopotam" as const,
      country: "United States",
      countryCode: "US" as const,
      state: subdivision?.name ?? place.state,
      subdivisionCode: subdivision?.subdivisionCode,
      city: place["place name"],
      postalCode: parsed.data["post code"],
      locationSource: "zippopotam" as const,
    };
  });
}

async function searchGoogle(
  query: string,
  countryCode: "IN" | "US" | undefined,
  sessionToken: string
): Promise<LocationSuggestion[]> {
  const key = getGooglePlacesApiKey();
  if (!key) return [];
  const response = await providerFetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
    },
    body: JSON.stringify({
      input: query,
      includedPrimaryTypes: ["(regions)"],
      includedRegionCodes: countryCode ? [countryCode.toLowerCase()] : ["in", "us"],
      languageCode: "en",
      sessionToken,
    }),
  });
  const parsed = googleAutocompleteSchema.safeParse(await readBoundedJson(response));
  if (!parsed.success) throw new LocationProviderError("unavailable");
  return (parsed.data.suggestions ?? []).flatMap((suggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return [];
    return [{
      id: prediction.placeId,
      label: prediction.text.text,
      provider: "google_places" as const,
      requiresResolution: true,
    }];
  });
}

export async function searchLocationSuggestions(input: {
  query: string;
  countryCode?: "IN" | "US";
  sessionToken: string;
}) {
  const query = input.query.trim();
  if ((!input.countryCode || input.countryCode === "IN") && /^\d{6}$/.test(query)) {
    try {
      const postal = await searchIndiaPin(query);
      if (postal.length > 0) return postal;
    } catch (error) {
      if (!(error instanceof LocationProviderError)) throw error;
      // Continue to Google when configured; otherwise the route returns manual fallback.
    }
  }
  const usZip = input.countryCode === "US" ? /^(\d{5})(?:-\d{4})?$/.exec(query)?.[1] : undefined;
  if (usZip) {
    try {
      const postal = await searchUsZip(usZip);
      if (postal.length > 0) return postal;
    } catch (error) {
      if (!(error instanceof LocationProviderError)) throw error;
      // Continue to Google when configured; otherwise the route returns manual fallback.
    }
  }
  return searchGoogle(query, input.countryCode, input.sessionToken);
}

function addressComponent(
  components: z.infer<typeof googlePlaceSchema>["addressComponents"],
  ...types: string[]
) {
  for (const type of types) {
    const component = components?.find((candidate) => candidate.types.includes(type));
    if (component) return component;
  }
  return undefined;
}

export async function resolveGooglePlace(placeId: string, sessionToken: string): Promise<StructuredLocation> {
  const key = getGooglePlacesApiKey();
  if (!key) throw new LocationProviderError("unavailable");
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("sessionToken", sessionToken);
  url.searchParams.set("languageCode", "en");
  const response = await providerFetch(url.toString(), {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "addressComponents",
    },
  });
  const parsed = googlePlaceSchema.safeParse(await readBoundedJson(response));
  if (!parsed.success) throw new LocationProviderError("unavailable");
  const components = parsed.data.addressComponents;
  const countryComponent = addressComponent(components, "country");
  const countryCode = countryComponent?.shortText?.toUpperCase();
  if (countryCode !== "IN" && countryCode !== "US") throw new LocationProviderError("invalid");
  const stateComponent = addressComponent(components, "administrative_area_level_1");
  const subdivision = stateComponent
    ? findSubdivision(countryCode, stateComponent.shortText ?? stateComponent.longText)
    : undefined;
  const cityComponent = countryCode === "IN"
    ? addressComponent(components, "administrative_area_level_2", "locality", "postal_town", "sublocality")
    : addressComponent(components, "locality", "postal_town", "administrative_area_level_2", "sublocality");
  if (!cityComponent?.longText) throw new LocationProviderError("invalid");
  return {
    country: countryCode === "IN" ? "India" : "United States",
    countryCode,
    state: subdivision?.name ?? stateComponent?.longText,
    subdivisionCode: subdivision?.subdivisionCode,
    city: cityComponent.longText,
    postalCode: addressComponent(components, "postal_code")?.longText,
    locationSource: "google_places",
  };
}
