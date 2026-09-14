import type { PortfolioDraftData } from "@/types/portfolio";
import { resolvePortfolioNameParts } from "@/features/portfolio/name";

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
  nextEditorSection: string;
}

function hasValue(value: unknown) {
  return typeof value === "string"
    ? value.trim().length > 0
    : value !== undefined && value !== null && value !== false;
}

function isAdultBirthDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const birthDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) return false;
  if (birthDate.toISOString().slice(0, 10) !== value) return false;
  const latest = new Date();
  latest.setUTCHours(0, 0, 0, 0);
  latest.setUTCFullYear(latest.getUTCFullYear() - 18);
  return birthDate <= latest;
}

/** One canonical checklist drives progress UI, resume guidance, and server publication validation. */
export function calculatePortfolioCompletion(
  data: PortfolioDraftData,
  hasShareablePrimaryPhoto: boolean
): PortfolioCompletion {
  const name = resolvePortfolioNameParts(data.personal);
  const requirements: PortfolioRequirement[] = [
    { key: "first_name", label: "First name", editorSection: "foundation", group: "basics", complete: hasValue(name.first_name) },
    { key: "last_name", label: "Last name", editorSection: "foundation", group: "basics", complete: hasValue(name.last_name) },
    { key: "date_of_birth", label: "Date of birth (18 or older)", editorSection: "foundation", group: "basics", complete: isAdultBirthDate(data.personal.dob) },
    { key: "current_location", label: "Current location", editorSection: "foundation", group: "basics", complete: hasValue(data.personal.current_location) },
    { key: "career_title", label: "Profession or role", editorSection: "foundation", group: "basics", complete: hasValue(data.career?.title) },
    {
      key: "introduction",
      label: "Short introduction",
      editorSection: "foundation",
      group: "basics",
      complete: hasValue(data.personal.short_bio) || hasValue(data.personal.profile_summary),
    },
    { key: "primary_photo", label: "Shareable primary photo", editorSection: "foundation", group: "details", complete: hasShareablePrimaryPhoto },
  ];
  const missing = requirements.filter((requirement) => !requirement.complete);
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
    readyToPublish: basicsComplete && detailsComplete,
    missing,
    nextEditorSection: missing[0]?.editorSection || "privacy",
  };
}
