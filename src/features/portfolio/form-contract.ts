import { z } from "zod/v4";
import { HEIGHT_OPTIONS } from "@/features/portfolio/blueprint-options";
import { resolvePortfolioNameParts } from "@/features/portfolio/name";
import { isValidPhoneNumber } from "@/features/portfolio/phone-number";
import {
  portfolioDataSchema,
  portfolioDraftSchema,
  type PortfolioDraftData,
} from "@/types/portfolio";

/** Pilot authoring rules. Stored historical snapshots retain the broader read schema. */
export const NAME_PART_PATTERN = /^(?=.*[A-Za-z])[A-Za-z '-]+$/;
export const NAME_PART_MAX_LENGTH = 50;
export const FORM_LIST_LIMITS = { languages: 10, hobbies: 6, values_statement: 5 } as const;

export function formListValues(value?: string) {
  const unique = new Map<string, string>();
  for (const item of (value || "").split(/[,;\n]/).map((part) => part.trim()).filter(Boolean)) {
    const key = item.toLowerCase();
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string) {
  ctx.addIssue({ code: "custom", path, message });
}

export function validAdultBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1920-01-01") return false;
  const birth = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== value) return false;
  return value <= latestAdultBirthDate();
}

/** Subtract calendar years without rolling February 29 into March 1. */
export function latestAdultBirthDate() {
  const today = new Date();
  const year = today.getUTCFullYear() - 18;
  const month = today.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(today.getUTCDate(), lastDay))).toISOString().slice(0, 10);
}

function validateEditorFields(data: PortfolioDraftData, ctx: z.RefinementCtx, publishing: boolean) {
  if (publishing && data.privacy_mode === "private") {
    addIssue(ctx, ["privacy_mode"], "Update this draft to the current sharing setup, then confirm publication consent.");
  }
  const nameParts = resolvePortfolioNameParts(data.personal);
  for (const [field, label] of [
    ["first_name", "First name"],
    ["middle_name", "Middle name"],
    ["last_name", "Last name"],
  ] as const) {
    const value = nameParts[field];
    if (!value && publishing && field !== "middle_name") {
      addIssue(ctx, ["personal", field], `${label} is required.`);
    } else if (value && (value.length > NAME_PART_MAX_LENGTH || !NAME_PART_PATTERN.test(value))) {
      addIssue(ctx, ["personal", field], `${label} must be at most 50 letters, spaces, apostrophes or hyphens.`);
    }
  }

  const dob = data.personal.dob?.trim();
  if (dob && !validAdultBirthDate(dob)) {
    addIssue(ctx, ["personal", "dob"], "Enter a valid date from 1920 onward; you must be at least 18.");
  } else if (publishing && !dob) {
    addIssue(ctx, ["personal", "dob"], "Date of birth is required.");
  }

  const birthTime = data.astrology?.time_of_birth;
  if (birthTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(birthTime)) {
    addIssue(ctx, ["astrology", "time_of_birth"], "Enter a valid time from 00:00 to 23:59, or leave it blank.");
  }
  const validatePhone = (phone: string | undefined, path: (string | number)[]) => {
    if (phone?.trim() && !isValidPhoneNumber(phone)) {
      addIssue(ctx, path, "Enter a valid phone number with 7–20 digits, or leave it blank.");
    }
  };
  validatePhone(data.contact?.phone, ["contact", "phone"]);
  data.contact?.contacts?.forEach((contact, index) => {
    validatePhone(contact.phone, ["contact", "contacts", index, "phone"]);
  });
  const validateEmailLength = (email: string | undefined, path: (string | number)[]) => {
    if (email && email.length > 254) addIssue(ctx, path, "Use an email address of at most 254 characters.");
  };
  validateEmailLength(data.contact?.email, ["contact", "email"]);
  data.contact?.contacts?.forEach((contact, index) => validateEmailLength(contact.email, ["contact", "contacts", index, "email"]));

  if (publishing) {
    for (const [path, value, label] of [
      [["personal", "gender"], data.personal.gender, "Gender"],
      [["vitals", "height"], data.vitals?.height, "Height"],
      [["personal", "marital_status"], data.personal.marital_status, "Marital Status"],
      [["personal", "country"], data.personal.country, "Current country"],
      [["personal", "city"], data.personal.city, "Current city"],
      [["career", "title"], data.career?.title, "Current profession title"],
      [["personal", "short_bio"], data.personal.short_bio, "Short description"],
    ] as const) {
      if (!value?.trim()) addIssue(ctx, [...path], `${label} is required.`);
    }
    const expectedLocation = [data.personal.city, data.personal.region, data.personal.country]
      .map((part) => part?.trim()).filter(Boolean).join(", ");
    if (expectedLocation && data.personal.current_location?.trim() !== expectedLocation) {
      addIssue(ctx, ["personal", "current_location"], "Current location must match the city, region, and country selected above.");
    }
  }
  if (data.vitals?.height && !HEIGHT_OPTIONS.some((option) => option.value === data.vitals?.height)) {
    addIssue(ctx, ["vitals", "height"], "Choose a height from the list.");
  }

  for (const [field, maximum] of Object.entries(FORM_LIST_LIMITS) as Array<[keyof typeof FORM_LIST_LIMITS, number]>) {
    if (formListValues(data.lifestyle?.[field]).length > maximum) {
      addIssue(ctx, ["lifestyle", field], `Choose no more than ${maximum} ${field === "hobbies" ? "interests" : field === "values_statement" ? "values" : "languages"}.`);
    }
  }
}

export const portfolioEditorDraftSchema = portfolioDraftSchema.superRefine(
  (data, ctx) => validateEditorFields(data, ctx, false)
);

export const portfolioEditorPublishSchema = portfolioDataSchema.superRefine(
  (data, ctx) => validateEditorFields(data, ctx, true)
);

/** Stable dotted paths let the editor highlight the exact answer to correct. */
export function portfolioFieldErrors(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "portfolio";
    (fields[key] ||= []).push(issue.message);
  }
  return fields;
}
