import { z } from "zod/v4";

export const SUPPORTED_LOCATION_COUNTRIES = ["IN", "US"] as const;
export const locationCountryCodeSchema = z.enum(SUPPORTED_LOCATION_COUNTRIES);

export const locationSourceSchema = z.enum([
  "google_places",
  "postalpincode",
  "zippopotam",
  "geonames",
  "manual",
  "existing_profile",
]);

const optionalText = (maximum: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(maximum).optional()
);

/** Stores US ZIP+4 input at the five-digit boundary used by hierarchical matching. */
export function normalizePostalCode(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return normalized;
  const zipPlusFour = /^(\d{5})-\d{4}$/.exec(normalized);
  return zipPlusFour?.[1] ?? normalized;
}

export function isValidPostalCode(countryCode: string | undefined, value: string | undefined) {
  const normalized = value?.trim() ?? "";
  if (countryCode === "IN") return /^[1-9][0-9]{5}$/.test(normalized);
  if (countryCode === "US") return /^\d{5}$/.test(normalized);
  return false;
}

const optionalPositiveInteger = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return value;
  },
  z.number().int().positive().optional()
);

export const structuredLocationSchema = z.object({
  country: optionalText(100),
  countryCode: locationCountryCodeSchema.optional(),
  state: optionalText(120),
  subdivisionCode: z.string().trim().regex(/^(?:IN|US)-[A-Z0-9]{1,3}$/).optional(),
  city: optionalText(120),
  cityGeonameId: optionalPositiveInteger,
  postalCode: z.preprocess(
    (value) => typeof value === "string" ? normalizePostalCode(value) : value,
    z.string().trim().max(20).optional()
  ),
  locationSource: locationSourceSchema.optional(),
}).superRefine((location, context) => {
  if (location.subdivisionCode && !location.countryCode) {
    context.addIssue({
      code: "custom",
      path: ["countryCode"],
      message: "A country is required for the selected subdivision.",
    });
  }
  if (
    location.subdivisionCode &&
    location.countryCode &&
    !location.subdivisionCode.startsWith(`${location.countryCode}-`)
  ) {
    context.addIssue({
      code: "custom",
      path: ["subdivisionCode"],
      message: "The subdivision does not belong to the selected country.",
    });
  }
});

export type StructuredLocation = z.infer<typeof structuredLocationSchema>;

export type LocationSuggestion = StructuredLocation & {
  id: string;
  label: string;
  provider: "google_places" | "postalpincode" | "zippopotam";
  requiresResolution?: boolean;
};

export const locationSearchRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    query: z.string().trim().min(2).max(100),
    countryCode: locationCountryCodeSchema.optional(),
    sessionToken: z.uuid(),
    portfolioToken: z.string().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/).optional(),
  }),
  z.object({
    action: z.literal("resolve"),
    provider: z.literal("google_places"),
    placeId: z.string().trim().min(5).max(300).regex(/^[A-Za-z0-9_-]+$/),
    sessionToken: z.uuid(),
    portfolioToken: z.string().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/).optional(),
  }),
]);

export function locationDisplayValue(location: StructuredLocation) {
  return [location.city, location.state, location.country]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}
