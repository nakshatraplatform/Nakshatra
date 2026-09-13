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

/** One canonical checklist drives progress UI, resume guidance, and server publication validation. */
export function calculatePortfolioCompletion(
  data: PortfolioDraftData,
  hasShareablePrimaryPhoto: boolean
): PortfolioCompletion {
  const name = resolvePortfolioNameParts(data.personal);
  const requirements: PortfolioRequirement[] = [
    { key: "first_name", label: "First name", editorSection: "foundation", group: "basics", complete: hasValue(name.first_name) },
    { key: "last_name", label: "Last name", editorSection: "foundation", group: "basics", complete: hasValue(name.last_name) },
    { key: "date_of_birth", label: "Date of birth", editorSection: "foundation", group: "basics", complete: hasValue(data.personal.dob) },
    { key: "current_location", label: "Current location", editorSection: "foundation", group: "basics", complete: hasValue(data.personal.current_location) },
    { key: "career_title", label: "Profession or role", editorSection: "work", group: "basics", complete: hasValue(data.career?.title) },
    {
      key: "introduction",
      label: "Short introduction",
      editorSection: "story",
      group: "basics",
      complete: hasValue(data.personal.short_bio) || hasValue(data.personal.profile_summary),
    },
    { key: "time_of_birth", label: "Time of birth", editorSection: "astrology", group: "details", complete: hasValue(data.astrology?.time_of_birth) },
    { key: "place_of_birth", label: "Place of birth", editorSection: "astrology", group: "details", complete: hasValue(data.personal.place_of_birth) },
    { key: "rashi", label: "Moon sign (Rashi)", editorSection: "astrology", group: "details", complete: hasValue(data.astrology?.rashi) },
    { key: "nakshatra", label: "Birth star (Nakshatra)", editorSection: "astrology", group: "details", complete: hasValue(data.astrology?.nakshatra) },
    { key: "pada", label: "Pada", editorSection: "astrology", group: "details", complete: hasValue(data.astrology?.pada) },
    { key: "gotra", label: "Gotra", editorSection: "astrology", group: "details", complete: hasValue(data.vitals?.gotra) },
    { key: "manglik_status", label: "Manglik status", editorSection: "astrology", group: "details", complete: hasValue(data.astrology?.manglik_status) },
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
