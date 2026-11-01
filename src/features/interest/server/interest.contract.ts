import { portfolioSharePathSchema } from "@/features/portfolio/share-path";
import { z } from "zod/v4";
import { isValidInterestPhoneNumber } from "@/features/portfolio/phone-number";
import { HAS_LETTER_PATTERN, NAME_PART_PATTERN } from "@/features/portfolio/field-validation";
import { isValidPostalCode, locationCountryCodeSchema, locationSourceSchema, normalizePostalCode } from "@/features/location/location.contract";
import { findSubdivision } from "@/features/location/subdivisions";

const optionalText = (maximum: number) => z.preprocess(
  (value) => value == null || typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(maximum).optional()
);

const optionalPositiveInteger = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : Number(value),
  z.number().int().positive().optional()
);

const requiredText = (maximum: number, message: string) => z.string().trim().min(1, message).max(maximum);

const requiredLocationFields = {
  country: requiredText(100, "Country is required."),
  state: requiredText(120, "State is required."),
  city: requiredText(120, "City is required.").refine(value => HAS_LETTER_PATTERN.test(value), "Enter a city name with at least one letter."),
  countryCode: locationCountryCodeSchema,
  subdivisionCode: z.string().trim().regex(/^(?:IN|US)-[A-Z0-9]{1,3}$/),
  cityGeonameId: optionalPositiveInteger,
  postalCode: requiredText(20, "ZIP or PIN code is required.").transform(normalizePostalCode),
  locationSource: locationSourceSchema,
};

const interestRequestBaseSchema = z.object({
  portfolioToken: portfolioSharePathSchema,
  familyContext: optionalText(600),
  message: optionalText(600),
});

function validateStructuredLocation(input: z.infer<typeof viewerStructuredLocationSchema>, context: z.RefinementCtx) {
  const expectedCountry = input.countryCode === "IN" ? "India" : "United States";
  const expectedSubdivision = findSubdivision(input.countryCode, input.subdivisionCode);
  if (input.country.toLowerCase() !== expectedCountry.toLowerCase()) {
    context.addIssue({ code: "custom", path: ["country"], message: "Country name and code must match." });
  }
  if (!input.subdivisionCode.startsWith(`${input.countryCode}-`)) {
    context.addIssue({ code: "custom", path: ["subdivisionCode"], message: "Subdivision and country must match." });
  }
  if (!expectedSubdivision || input.state.toLowerCase() !== expectedSubdivision.name.toLowerCase()) {
    context.addIssue({ code: "custom", path: ["state"], message: "State name and subdivision code must match." });
  }
  if (input.countryCode === "IN" && !isValidPostalCode(input.countryCode, input.postalCode)) {
    context.addIssue({ code: "custom", path: ["postalCode"], message: "Enter a valid six-digit Indian PIN code." });
  }
  if (input.countryCode === "US" && !isValidPostalCode(input.countryCode, input.postalCode)) {
    context.addIssue({ code: "custom", path: ["postalCode"], message: "Enter a valid US ZIP code." });
  }
}

export const interestRequestSchema = interestRequestBaseSchema.extend({
  name: z.string().trim().min(2).max(180).regex(NAME_PART_PATTERN),
  profileFor: z.enum(["self", "son", "daughter", "sibling", "relative"]),
  phone: z.string().trim().max(40),
  email: z.string().trim().email().max(180),
  ...requiredLocationFields,
}).superRefine(validateStructuredLocation);

/** Contacting-for is the sole relationship decision, not another form question. */
export function candidateRelationship(profileFor: string): string {
  return profileFor === "son" || profileFor === "daughter" ? "Parent" : profileFor === "sibling" ? "Sibling" : "Relative";
}

export type InterestRequestInput = z.infer<typeof interestRequestSchema>;

export const interestLocationSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  regionCode: z.string().trim().min(1).max(30),
  cityId: z.number().int().positive(),
});
export const viewerStructuredLocationSchema = z.object({
  country: requiredLocationFields.country,
  state: requiredLocationFields.state,
  city: requiredLocationFields.city,
  countryCode: requiredLocationFields.countryCode,
  subdivisionCode: requiredLocationFields.subdivisionCode,
  cityGeonameId: requiredLocationFields.cityGeonameId,
  postalCode: requiredLocationFields.postalCode,
  locationSource: requiredLocationFields.locationSource,
});
const candidateSchema = z.object({
  name: z.string().trim().min(2).max(180).regex(NAME_PART_PATTERN),
  email: optionalText(180).pipe(z.email().optional()),
  phone: optionalText(40).refine(value => value === undefined || isValidInterestPhoneNumber(value), "Add a country code and a valid candidate phone number. For India and the US, use 10 digits."),
  relationship: z.string().trim().min(2).max(80),
  // Accept previously submitted directory locations during schema-first rollout.
  location: z.union([viewerStructuredLocationSchema.superRefine(validateStructuredLocation), interestLocationSchema.extend({ subdivisionCode: z.never().optional() })]).optional(),
});

const newViewerInterestSubmissionSchema = interestRequestSchema.safeExtend({
  useExistingProfile: z.literal(false),
  phone: z.string().trim().max(40).refine(isValidInterestPhoneNumber, "Add a country code and a valid phone number. For India and the US, use 10 digits."),
  name: z.string().trim().min(2).max(180).regex(NAME_PART_PATTERN),
  familyContext: z.string().trim().min(40, "Add at least 40 characters of family context.").max(600),
  message: optionalText(600).refine(value => value === undefined || value.length >= 80, "Write at least 80 characters, or leave the message blank."),
  location: viewerStructuredLocationSchema,
  candidate: candidateSchema.optional(),
}).superRefine((input, context) => {
  if (input.profileFor !== "self" && !input.candidate) context.addIssue({ code: "custom", path: ["candidate"], message: "Complete the candidate details." });
  for (const field of ["country", "state", "city", "countryCode", "subdivisionCode", "postalCode", "locationSource"] as const) {
    if (input[field] !== input.location[field]) context.addIssue({ code: "custom", path: ["location", field], message: "Your location details must match." });
  }
});
export type NewViewerInterestInput = z.infer<typeof newViewerInterestSubmissionSchema>;

const existingViewerInterestSubmissionSchema = interestRequestBaseSchema.extend({
  useExistingProfile: z.literal(true),
  familyContext: z.string().trim().min(40, "Add at least 40 characters of family context.").max(600),
  message: optionalText(600).refine(value => value === undefined || value.length >= 80, "Write at least 80 characters, or leave the message blank."),
  ...requiredLocationFields,
}).superRefine(validateStructuredLocation);

export const interestSubmissionSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value) || (value as Record<string, unknown>).useExistingProfile === true) return value;
    const input = value as Record<string, unknown>;
    const candidate = input.candidate;
    return { ...input, useExistingProfile: false, candidate: input.profileFor === "self" ? undefined
      : candidate && typeof candidate === "object" && !Array.isArray(candidate)
        ? { ...candidate, relationship: candidateRelationship(String(input.profileFor)) } : candidate };
  },
  z.discriminatedUnion("useExistingProfile", [
    existingViewerInterestSubmissionSchema,
    newViewerInterestSubmissionSchema,
  ])
);

export type InterestSubmissionInput = z.infer<typeof interestSubmissionSchema>;

function nameIssueMessage(issues: z.ZodError["issues"], candidate: boolean) {
  if (issues.some(issue => issue.code === "too_small")) return candidate ? "Please provide the candidate’s full name." : "Please provide your full name.";
  if (issues.some(issue => issue.code === "too_big")) return "Keep the full name within 180 characters.";
  return "Use letters, spaces, apostrophes or hyphens for this name.";
}

/** Form controls and API validation share the same paths and readable messages. */
export function interestFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(error.issues.map(issue => {
    const path = issue.path.join(".");
    const candidate = path.startsWith("candidate.");
    const field = candidate ? path.slice(10) : path;
    const messages: Record<string, string> = {
      name: nameIssueMessage(error.issues.filter(item => item.path.join(".") === path), candidate),
      phone: "Add a country code and a valid phone number. For India and the US, use 10 digits.", email: "Enter a valid email address.",
      profileFor: "Choose who you are contacting for.",
      relationship: "Choose your relationship to the candidate.",
      country: "Choose a complete country, state, city, and ZIP or PIN code.",
      state: "Choose a valid state for your country.", city: "Enter a city name with at least one letter.",
      countryCode: "Choose a country.", subdivisionCode: "Choose a state for your country.",
      postalCode: "Enter a valid ZIP or PIN code.",
      "location.countryCode": "Choose a country.", "location.regionCode": "Choose a state or province.", "location.cityId": "Choose a city.",
      familyContext: "Add 40–600 characters of family context.", message: "Write 80–600 characters, or leave the message blank.",
      candidate: "Complete the candidate details.",
    };
    return [path, field === "location" && candidate ? "Choose a complete candidate location, or remove it." : messages[field] || "Check this value."];
  }));
}

/** Returns a clear form-level message for the first invalid interest field. */
export function interestRequestValidationMessage(error: z.ZodError) {
  const invalidFields = new Set(error.issues.map((issue) => issue.path[0]));

  if (invalidFields.has("portfolioToken")) {
    return "This portfolio link is invalid. Open the original shared link and try again.";
  }
  if (invalidFields.has("name")) return nameIssueMessage(error.issues.filter(issue => issue.path.join(".") === "name"), false);
  if (invalidFields.has("profileFor")) return "Choose who you are contacting for.";
  if (invalidFields.has("phone")) return "Add a country code and a valid phone number. For India and the US, use 10 digits.";
  if (invalidFields.has("email")) return "Enter a valid email address.";
  if (invalidFields.has("location")) return "Choose your country, state and city from the directory.";
  if (invalidFields.has("candidate")) return "Enter the candidate’s name and check any optional details you supplied.";
  if (invalidFields.has("familyContext")) return "Add 40–600 characters of family context.";
  if (invalidFields.has("message")) return "Write 80–600 characters, or leave the message blank.";
  return "One of the optional details is too long. Shorten it and try again.";
}
