import { z } from "zod/v4";
import { isValidPhoneNumber } from "@/features/portfolio/phone-number";

const optionalText = (maximum: number) => z.preprocess(
  (value) => value == null || typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(maximum).optional()
);

const interestRequestBaseSchema = z.object({
  portfolioToken: z.string().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
  familyContext: optionalText(600),
  message: optionalText(600),
});

export const interestRequestSchema = interestRequestBaseSchema.extend({
  name: z.string().trim().min(2).max(180),
  profileFor: z.enum(["self", "son", "daughter", "sibling", "relative"]),
  phone: z.string().trim().max(40),
  email: z.string().trim().email().max(180),
  country: optionalText(100),
  state: optionalText(120),
  city: optionalText(120),
});

export type InterestRequestInput = z.infer<typeof interestRequestSchema>;

export const interestLocationSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  regionCode: z.string().trim().min(1).max(30),
  cityId: z.number().int().positive(),
});
const candidateSchema = z.object({
  name: z.string().trim().min(2).max(180).regex(/\p{L}/u),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(40).refine(isValidPhoneNumber, "Enter a valid candidate phone number."),
  relationship: z.string().trim().min(2).max(80),
  location: interestLocationSchema,
});

const newViewerInterestSubmissionSchema = interestRequestSchema.extend({
  useExistingProfile: z.literal(false),
  phone: z.string().trim().max(40).refine(isValidPhoneNumber, "Enter a valid phone number."),
  name: z.string().trim().min(2).max(180).regex(/\p{L}/u),
  familyContext: z.string().trim().min(40, "Add at least 40 characters of family context.").max(600),
  message: z.string().trim().min(80, "Write a message of at least 80 characters.").max(600),
  location: interestLocationSchema,
  candidate: candidateSchema.optional(),
}).superRefine((input, context) => {
  if (input.profileFor !== "self" && !input.candidate) context.addIssue({ code: "custom", path: ["candidate"], message: "Complete the candidate details." });
});
export type NewViewerInterestInput = z.infer<typeof newViewerInterestSubmissionSchema>;

const existingViewerInterestSubmissionSchema = interestRequestBaseSchema.extend({
  useExistingProfile: z.literal(true),
});

export const interestSubmissionSchema = z.preprocess(
  (value) => value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).useExistingProfile !== true
    ? { ...value, useExistingProfile: false, ...((value as Record<string, unknown>).profileFor === "self" ? { candidate: undefined } : {}) }
    : value,
  z.discriminatedUnion("useExistingProfile", [
    existingViewerInterestSubmissionSchema,
    newViewerInterestSubmissionSchema,
  ])
);

export type InterestSubmissionInput = z.infer<typeof interestSubmissionSchema>;

/** Form controls and API validation share the same paths and readable messages. */
export function interestFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(error.issues.map(issue => {
    const path = issue.path.join(".");
    const candidate = path.startsWith("candidate.");
    const field = candidate ? path.slice(10) : path;
    const messages: Record<string, string> = {
      name: candidate ? "Enter the candidate’s full name." : "Enter your full name.",
      phone: "Enter a valid phone number.", email: "Enter a valid email address.",
      profileFor: "Choose who you are contacting for.",
      relationship: "Choose your relationship to the candidate.",
      "location.countryCode": "Choose a country.", "location.regionCode": "Choose a state or province.", "location.cityId": "Choose a city.",
      familyContext: "Add 40–600 characters of family context.", message: "Write a message of 80–600 characters.",
      candidate: "Complete the candidate details.",
    };
    return [path, messages[field] || "Check this value."];
  }));
}

/** Returns a clear form-level message for the first invalid interest field. */
export function interestRequestValidationMessage(error: z.ZodError) {
  const invalidFields = new Set(error.issues.map((issue) => issue.path[0]));

  if (invalidFields.has("portfolioToken")) {
    return "This portfolio link is invalid. Open the original shared link and try again.";
  }
  if (invalidFields.has("name")) return "Enter your full name.";
  if (invalidFields.has("profileFor")) return "Choose who you are contacting for.";
  if (invalidFields.has("phone")) return "Enter a valid phone number.";
  if (invalidFields.has("email")) return "Enter a valid email address.";
  if (invalidFields.has("location")) return "Choose your country, state and city from the directory.";
  if (invalidFields.has("candidate")) return "Complete the candidate’s name, email, phone, location and relationship.";
  if (invalidFields.has("familyContext")) return "Add 40–600 characters of family context.";
  if (invalidFields.has("message")) return "Write a message of 80–600 characters.";
  return "One of the optional details is too long. Shorten it and try again.";
}
