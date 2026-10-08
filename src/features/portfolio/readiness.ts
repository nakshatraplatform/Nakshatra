import type { PortfolioDraftData } from "@/types/portfolio";
import { resolvePortfolioNameParts } from "@/features/portfolio/name";
import { HEIGHT_OPTIONS } from "@/features/portfolio/blueprint-options";
import { NAME_PART_MAX_LENGTH, NAME_PART_PATTERN, portfolioEditorPublishSchema, validAdultBirthDate } from "@/features/portfolio/form-contract";

export type PortfolioRequirementGroup = "basics" | "details";

export interface PortfolioRequirement {
  key: string;
  label: string;
  editorSection: string;
  group: PortfolioRequirementGroup;
  complete: boolean;
}

export interface PortfolioCompletion {
  percentage: number;
  completedCount: number;
  totalCount: number;
  basicsComplete: boolean;
  detailsComplete: boolean;
  readyToPublish: boolean;
  missing: PortfolioRequirement[];
  invalidAnswers: { key: string; label: string; editorSection: string }[];
  nextEditorSection: string;
}

function hasValue(value: unknown) {
  return typeof value === "string"
    ? value.trim().length > 0
    : value !== undefined && value !== null && value !== false;
}

function validNamePart(value: string) {
  return value.length > 0 && value.length <= NAME_PART_MAX_LENGTH && NAME_PART_PATTERN.test(value);
}

/** One canonical checklist drives progress UI, resume guidance, and server publication validation. */
export function calculatePortfolioCompletion(
  data: PortfolioDraftData,
  hasShareablePrimaryPhoto: boolean
): PortfolioCompletion {
  const name = resolvePortfolioNameParts(data.personal);
  const requirements: PortfolioRequirement[] = [
    { key: "first_name", label: "First name", editorSection: "foundation", group: "basics", complete: validNamePart(name.first_name) },
    { key: "last_name", label: "Last name", editorSection: "foundation", group: "basics", complete: validNamePart(name.last_name) },
    { key: "date_of_birth", label: "Date of birth (18 or older)", editorSection: "foundation", group: "basics", complete: typeof data.personal.dob === "string" && validAdultBirthDate(data.personal.dob) },
    { key: "gender", label: "Gender", editorSection: "foundation", group: "basics", complete: hasValue(data.personal.gender) },
    { key: "marital_status", label: "Marital Status", editorSection: "foundation", group: "basics", complete: hasValue(data.personal.marital_status) },
    { key: "height", label: "Height", editorSection: "foundation", group: "basics", complete: HEIGHT_OPTIONS.some((item) => item.value !== "" && item.value === data.vitals?.height) },
    { key: "current_country", label: "Current country", editorSection: "foundation", group: "basics", complete: hasValue(data.personal.country) },
    { key: "current_city", label: "Current city", editorSection: "foundation", group: "basics", complete: hasValue(data.personal.city) },
    { key: "career_title", label: "Current profession title", editorSection: "foundation", group: "basics", complete: hasValue(data.career?.title) },
    {
      key: "introduction",
      label: "Short description",
      editorSection: "foundation",
      group: "basics",
      complete: hasValue(data.personal.short_bio),
    },
    { key: "primary_photo", label: "Shareable primary photo", editorSection: "foundation", group: "details", complete: hasShareablePrimaryPhoto },
  ];
  const missing = requirements.filter((requirement) => !requirement.complete);
  const validation = portfolioEditorPublishSchema.safeParse(data);
  const requiredPaths = new Set([
    "personal.name", "personal.first_name", "personal.last_name", "personal.dob", "personal.gender",
    "personal.country", "personal.city", "personal.marital_status", "personal.short_bio", "vitals.height", "career.title",
  ]);
  const invalidAnswers = validation.success ? [] : validation.error.issues
    .map((issue) => ({ key: issue.path.join("."), label: issue.message, editorSection: editorSectionForPath(issue.path.join(".")) }))
    .filter((issue) => !requiredPaths.has(issue.key));
  const basicsComplete = requirements
    .filter((requirement) => requirement.group === "basics")
    .every((requirement) => requirement.complete);
  const detailsComplete = requirements
    .filter((requirement) => requirement.group === "details")
    .every((requirement) => requirement.complete);
  const completedCount = requirements.length - missing.length;

  return {
    percentage: Math.round((completedCount / requirements.length) * 100),
    completedCount,
    totalCount: requirements.length,
    basicsComplete,
    detailsComplete,
    readyToPublish: basicsComplete && detailsComplete && invalidAnswers.length === 0,
    missing,
    invalidAnswers,
    nextEditorSection: missing[0]?.editorSection || invalidAnswers[0]?.editorSection || "privacy",
  };
}

function editorSectionForPath(path: string) {
  if (path.startsWith("personal.profile_summary") || path.startsWith("personal.long_term_goals") || path.startsWith("personal.shared_life_plans") || path.startsWith("lifestyle.")) return "story";
  if (path.startsWith("family.")) return "family";
  if (path.startsWith("astrology.")) return "astrology";
  if (path.startsWith("preferences.")) return "preferences";
  if (path.startsWith("career.") || path.startsWith("education.")) return "work";
  if (path.startsWith("contact.")) return "privacy";
  if (path === "privacy_mode") return "privacy";
  return "foundation";
}
