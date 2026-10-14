import { describe, expect, it } from "vitest";
import {
  locationDisplayValue,
  normalizePostalCode,
  structuredLocationSchema,
} from "../src/features/location/location.contract";
import {
  findSubdivision,
  subdivisionsForCountry,
} from "../src/features/location/subdivisions";

describe("structured location contract", () => {
  it("normalizes supported India and US subdivision names and abbreviations", () => {
    expect(findSubdivision("IN", "Karnataka")?.subdivisionCode).toBe("IN-KA");
    expect(findSubdivision("IN", "KA")?.subdivisionCode).toBe("IN-KA");
    expect(findSubdivision("US", "Massachusetts")?.subdivisionCode).toBe("US-MA");
    expect(findSubdivision("US", "MA")?.subdivisionCode).toBe("US-MA");
    expect(subdivisionsForCountry("IN")).toHaveLength(36);
    expect(subdivisionsForCountry("US")).toHaveLength(57);
  });

  it("rejects cross-country and unsupported codes without requiring postal codes", () => {
    expect(structuredLocationSchema.safeParse({
      country: "India",
      countryCode: "IN",
      state: "Massachusetts",
      subdivisionCode: "US-MA",
      city: "Boston",
    }).success).toBe(false);
    expect(structuredLocationSchema.safeParse({
      country: "India",
      countryCode: "IN",
      state: "Karnataka",
      subdivisionCode: "IN-KA",
      city: "Bengaluru",
      postalCode: "",
      locationSource: "manual",
    }).success).toBe(true);
  });

  it("preserves postal codes as text and derives only the compatible display value", () => {
    const parsed = structuredLocationSchema.parse({
      country: "United States",
      countryCode: "US",
      state: "Massachusetts",
      subdivisionCode: "US-MA",
      city: "Boston",
      postalCode: "02108",
      cityGeonameId: "4930956",
      locationSource: "geonames",
    });
    expect(parsed.postalCode).toBe("02108");
    expect(parsed.cityGeonameId).toBe(4930956);
    expect(locationDisplayValue(parsed)).toBe("Boston, Massachusetts, United States");
  });

  it("accepts Zippopotam as normalized US ZIP provenance", () => {
    expect(structuredLocationSchema.parse({
      country: "United States",
      countryCode: "US",
      state: "Massachusetts",
      subdivisionCode: "US-MA",
      city: "Boston",
      postalCode: "02108",
      locationSource: "zippopotam",
    }).locationSource).toBe("zippopotam");
  });

  it("normalizes ZIP+4 input to the five-digit matching boundary", () => {
    expect(normalizePostalCode("02108-1234")).toBe("02108");
    expect(structuredLocationSchema.parse({
      countryCode: "US",
      postalCode: "02108-1234",
    }).postalCode).toBe("02108");
  });

  it("uses one canonical US Virgin Islands name while retaining provider aliases", () => {
    expect(findSubdivision("US", "US-VI")?.name).toBe("United States Virgin Islands");
    expect(findSubdivision("US", "Virgin Islands, U.S.")?.subdivisionCode).toBe("US-VI");
  });
});
