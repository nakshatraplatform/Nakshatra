import { describe, expect, it } from "vitest";
import { interestRequestSchema } from "../src/features/interest/server/interest.contract";
import { locationSearchRequestSchema } from "../src/features/location/location.contract";

describe("readable share-link consumers", () => {
  it.each(["a-b", "li-xu", "aditi-sharma", "aditi-sharma-2", "kym15WPWD9KXqVSUoLvG0"])("accepts %s in an interest request", portfolioToken => {
    expect(interestRequestSchema.safeParse({ portfolioToken, name: "Rohan Mehta", profileFor: "self", phone: "+14155552671", email: "viewer@example.test", country: "United States", state: "Massachusetts", city: "Boston", countryCode: "US", subdivisionCode: "US-MA", postalCode: "02108", locationSource: "manual" }).success).toBe(true);
  });
  it.each(["a-b", "li-xu", "aditi-sharma-2"])("accepts %s for viewer location lookup", portfolioToken => {
    expect(locationSearchRequestSchema.safeParse({ action: "search", query: "Boston", sessionToken: "22222222-2222-4222-8222-222222222222", portfolioToken }).success).toBe(true);
  });
  it.each(["ab", "../aditi", "aditi/sharma", "a b", "a".repeat(161)])("rejects invalid path %s", portfolioToken => {
    expect(interestRequestSchema.safeParse({ portfolioToken, name: "Rohan Mehta", profileFor: "self", phone: "+14155552671", email: "viewer@example.test", country: "United States", state: "Massachusetts", city: "Boston", countryCode: "US", subdivisionCode: "US-MA", postalCode: "02108", locationSource: "manual" }).success).toBe(false);
  });
});
