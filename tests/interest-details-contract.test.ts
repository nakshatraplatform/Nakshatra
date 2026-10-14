import { describe, expect, it } from "vitest";
import { interestSubmissionSchema } from "../src/features/interest/server/interest.contract";

const location = { country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston", postalCode: "02108", locationSource: "manual" };
const valid = { portfolioToken: "portfolio-token", name: "Mira Rao", profileFor: "self", phone: "+1 617 555 0123", email: "mira@example.com", familyContext: "Our family values honesty, kindness and mutual respect.", message: "I enjoyed reading your introduction and would like to learn more about your family, interests and plans for the future.", ...location, location };
describe("new visitor interest contract", () => {
  it("requires decision-making context and canonical locations", () => {
    expect(interestSubmissionSchema.safeParse(valid).success).toBe(true);
    for (const field of ["familyContext", "message", "location"]) expect(interestSubmissionSchema.safeParse({ ...valid, [field]: undefined }).success).toBe(false);
    expect(interestSubmissionSchema.safeParse({ ...valid, message: " ".repeat(80) }).success).toBe(false);
    expect(interestSubmissionSchema.safeParse({ ...valid, familyContext: "short" }).success).toBe(false);
    for (const whitespace of ["\t", "\n", "\u00a0", "\uFEFF"]) {
      expect(interestSubmissionSchema.safeParse({ ...valid, message: whitespace.repeat(80) }).success).toBe(false);
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
    expect(interestSubmissionSchema.safeParse({ portfolioToken: valid.portfolioToken, useExistingProfile: true, ...location }).success).toBe(true);
  });
});
