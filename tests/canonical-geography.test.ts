import { describe, expect, it } from "vitest";
import { savedCanonicalGeography } from "@/features/portfolio/canonical-geography";

describe("saved canonical geography publication", () => {
  const saved = { name: "Aditi Rao", country_code: "US", region_code: "MA", city_geoname_id: 4930956,
    country: "United States", region: "Massachusetts", city: "Boston" };
  it("does not publish browser-supplied labels for selected IDs", () => {
    expect(savedCanonicalGeography({ ...saved, country: "Incorrect", city: "Spoofed", region: "Wrong" }, saved)).toMatchObject({
      country: "United States", region: "Massachusetts", city: "Boston", current_location: "Boston, Massachusetts, United States",
    });
  });
  it("requires changed identifiers to be saved before publication", () => {
    expect(() => savedCanonicalGeography({ ...saved, city_geoname_id: 123 }, saved)).toThrow(/Save your location/);
    expect(() => savedCanonicalGeography(saved, undefined)).toThrow(/Save your location/);
  });
  it("preserves manual and legacy labels without guessing identifiers", () => {
    const manual = { name: "Aditi Rao", country: "USA", region: "MA", city: "Boston" };
    expect(savedCanonicalGeography(manual, undefined)).toBe(manual);
  });
});
