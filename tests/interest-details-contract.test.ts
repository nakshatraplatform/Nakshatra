import { describe, expect, it } from "vitest";
import { interestFieldErrors, interestRequestValidationMessage, interestSubmissionSchema } from "../src/features/interest/server/interest.contract";

const location = { country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston", postalCode: "02108", locationSource: "manual" };
const valid = { portfolioToken: "portfolio-token", name: "Mira Rao", profileFor: "self", phone: "+1 617 555 0123", email: "mira@example.com", familyContext: "Our family values honesty, kindness and mutual respect.", message: "I enjoyed reading your introduction and would like to learn more about your family, interests and plans for the future.", ...location, location };
describe("new visitor interest contract", () => {
  it("accepts name-only candidate details and derives the relationship once", () => {
    for (const [profileFor, relationship] of [["son", "Parent"], ["daughter", "Parent"], ["sibling", "Sibling"], ["relative", "Relative"]]) {
      const result = interestSubmissionSchema.safeParse({ ...valid, profileFor, message: "", candidate: { name: "Arun Rao" } });
      expect(result.success).toBe(true);
      if (result.success && !result.data.useExistingProfile) expect(result.data.candidate).toEqual({ name: "Arun Rao", relationship });
    }
  });
  it("allows omitted message and candidate location but rejects malformed supplied values", () => {
    expect(interestSubmissionSchema.safeParse({ ...valid, message: undefined }).success).toBe(true);
    for (const candidate of [{ name: "Arun Rao", email: "broken" }, { name: "Arun Rao", phone: "broken" }, { name: "Arun Rao", location: { countryCode: "US" } }]) {
      expect(interestSubmissionSchema.safeParse({ ...valid, profileFor: "son", candidate }).success).toBe(false);
    }
    expect(interestSubmissionSchema.safeParse({ ...valid, profileFor: "son", candidate: { name: "Arun Rao", location } }).success).toBe(true);
  });
  it("requires decision-making context and canonical locations", () => {
    expect(interestSubmissionSchema.safeParse(valid).success).toBe(true);
    for (const field of ["familyContext", "location"]) expect(interestSubmissionSchema.safeParse({ ...valid, [field]: undefined }).success).toBe(false);
    expect(interestSubmissionSchema.safeParse({ ...valid, message: " ".repeat(80) }).success).toBe(true);
    expect(interestSubmissionSchema.safeParse({ ...valid, familyContext: "short" }).success).toBe(false);
    for (const whitespace of ["\t", "\n", "\u00a0", "\uFEFF"]) {
      expect(interestSubmissionSchema.safeParse({ ...valid, message: whitespace.repeat(80) }).success).toBe(true);
      expect(interestSubmissionSchema.safeParse({ ...valid, familyContext: whitespace.repeat(40) }).success).toBe(false);
    }
  });
  it("requires candidate details only for someone else", () => {
    expect(interestSubmissionSchema.safeParse({ ...valid, profileFor: "son" }).success).toBe(false);
    expect(interestSubmissionSchema.safeParse({ ...valid, profileFor: "son", candidate: { name: "Arun Rao", email: "arun@example.com", phone: "+91 98765 43210", relationship: "Parent", location: { countryCode: "US", regionCode: "MA", cityId: 4930956 } } }).success).toBe(true);
    expect(interestSubmissionSchema.safeParse({ ...valid, profileFor: "son", candidate: { email: "invalid" } }).success).toBe(false);
    const self = interestSubmissionSchema.safeParse({ ...valid, candidate: { email: "invalid" } });
    expect(self.success).toBe(true);
    if (self.success) expect("candidate" in self.data && self.data.candidate).toBeUndefined();
  });
  it("preserves existing authenticated profile submissions", () => {
    expect(interestSubmissionSchema.safeParse({ portfolioToken: valid.portfolioToken, useExistingProfile: true, familyContext: valid.familyContext, ...location }).success).toBe(true);
    expect(interestSubmissionSchema.safeParse({ portfolioToken: valid.portfolioToken, useExistingProfile: true, ...location }).success).toBe(false);
  });

  it("rejects country, subdivision, state, and postal mismatches for both viewer paths", () => {
    const cases = [
      [{ country: "India" }, "country"],
      [{ subdivisionCode: "IN-KA" }, "subdivisionCode"],
      [{ state: "New York" }, "state"],
      [{ postalCode: "1234" }, "postalCode"],
    ] as const;
    for (const [changes, expectedField] of cases) {
      for (const useExistingProfile of [false, true]) {
        const input = useExistingProfile
          ? { portfolioToken: valid.portfolioToken, useExistingProfile: true, familyContext: valid.familyContext, ...location, ...changes }
          : { ...valid, ...changes, location: { ...location, ...changes } };
        const result = interestSubmissionSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === expectedField)).toBe(true);
      }
    }
    const indian = { country: "India", countryCode: "IN", state: "Karnataka", subdivisionCode: "IN-KA", city: "Bangalore", postalCode: "560001", locationSource: "manual" };
    expect(interestSubmissionSchema.safeParse({ portfolioToken: valid.portfolioToken, useExistingProfile: true, familyContext: valid.familyContext, ...indian }).success).toBe(true);
    expect(interestSubmissionSchema.safeParse({ portfolioToken: valid.portfolioToken, useExistingProfile: true, ...indian, postalCode: "000001" }).success).toBe(false);
  });

  it("rejects a nested location that disagrees with its validated flat fields", () => {
    for (const field of ["country", "state", "city", "countryCode", "subdivisionCode", "postalCode", "locationSource"] as const) {
      const result = interestSubmissionSchema.safeParse({ ...valid, location: { ...location, [field]: "different" } });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.some(issue => issue.path.join(".") === `location.${field}`)).toBe(true);
    }
  });

  it("maps invalid candidate and viewer fields to helpful form errors", () => {
    const result = interestSubmissionSchema.safeParse({
      ...valid, profileFor: "son", candidate: { name: "A", email: "invalid", phone: "invalid", relationship: "", location: { countryCode: "US", regionCode: "", cityId: -1 } },
      familyContext: "short", message: "short",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = interestFieldErrors(result.error);
    expect(errors["candidate.name"]).toBe("Please provide the candidate’s full name.");
    expect(errors["candidate.phone"]).toBe("Enter a valid phone number.");
    expect(errors["candidate.location.cityId"]).toBe("Choose a city.");
    expect(interestRequestValidationMessage(result.error)).toContain("candidate");
  });
});
