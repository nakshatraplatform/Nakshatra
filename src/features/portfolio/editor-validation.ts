import { portfolioEditorPublishSchema } from "@/features/portfolio/form-contract";
import { calculatePortfolioCompletion, editorSectionForPath } from "@/features/portfolio/readiness";
import type { PortfolioDraftData } from "@/types/portfolio";
import { authoringChoiceErrors } from "./authoring-choices";

export type EditorFieldIssue = { path: string; label: string; section: string; message: string };

const requirementPaths: Record<string, string> = {
  first_name: "personal.first_name", last_name: "personal.last_name", date_of_birth: "personal.dob",
  gender: "personal.gender", marital_status: "personal.marital_status", height: "vitals.height",
  structured_location: "personal.current_location", career_title: "career.title",
  introduction: "personal.short_bio", primary_photo: "media.primary_photo",
};

const fieldLabels: Record<string, string> = {
  "personal.first_name": "First name", "personal.middle_name": "Middle name", "personal.last_name": "Last name",
  "personal.dob": "Date of birth", "personal.profile_summary": "Personal story",
  "personal.long_term_goals": "Life goals", "personal.shared_life_plans": "Quality time with your partner",
  "personal.current_location": "Current location", "personal.privacy_mode": "Sharing settings",
  "personal.country": "Current country", "personal.region": "Current state", "personal.city": "Current city",
  "personal.postal_code": "ZIP or PIN code", "career.title": "Current profession title",
  "astrology.time_of_birth": "Time of birth", "privacy_mode": "Sharing settings",
  "family.paternal_origin": "Paternal family origin", "family.maternal_origin": "Maternal family origin",
  "family.ancestral_origin": "Paternal family origin", "family.sibling_count": "Number of siblings",
  "preferences.age_range": "Preferred age range", "preferences.height_range": "Preferred height range",
  "career.income_currency": "Income currency", "career.job_type": "Work status",
  "personal.community": "Community or cultural background", "personal.religion": "Religion or outlook",
};

export function editorFieldLabel(path: string) {
  const contact = /^contact\.contacts\.(\d+)\.(.+)$/.exec(path);
  if (contact) return `Contact ${Number(contact[1]) + 1}: ${contact[2].replaceAll("_", " ")}`;
  const sibling = /^family\.siblings\.(\d+)\.(.+)$/.exec(path);
  if (sibling) return `Sibling ${Number(sibling[1]) + 1}: ${sibling[2].replaceAll("_", " ")}`;
  const fallback = (path.split(".").at(-1) || "Introduction").replaceAll("_", " ");
  return fieldLabels[path] || fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

export function portfolioFieldAnchor(path: string) {
  return `portfolio-answer-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/** Both local and API errors must target a control that exists in the active UI mode. */
export function editorFieldTarget(path: string) {
  if (path === "family.ancestral_origin") return "family.paternal_origin";
  return /^personal\.(country|country_code|region|region_code|city|postal_code|location_source|city_geoname_id)$/.test(path)
    ? "personal.current_location" : path;
}

/** UI guidance uses the same publication schema/checklist as the server; never authorizes publication. */
export function editorFieldIssues(data: PortfolioDraftData, hasPrimaryPhoto: boolean, stored?: unknown): EditorFieldIssue[] {
  const issues = new Map<string, EditorFieldIssue>();
  const parsed = portfolioEditorPublishSchema.safeParse(data);
  if (!parsed.success) for (const issue of parsed.error.issues) {
    const path = issue.path.join(".");
    if (path === "personal.name") continue; // The editable name parts have their own errors.
    const message = path === "family.sibling_count" ? "Enter a whole number from 0 to 20, or leave it blank."
      : issue.code === "too_big" && "maximum" in issue ? `Use at most ${issue.maximum} ${issue.origin === "array" ? "items" : "characters"}.`
      : issue.code === "invalid_format" && path.endsWith("email") ? "Enter an email address such as name@example.com, or leave it blank."
      : issue.message;
    issues.set(path, { path, label: editorFieldLabel(path), section: editorSectionForPath(path), message });
  }
  for (const [path, messages] of Object.entries(authoringChoiceErrors(data, stored))) {
    issues.set(path, { path, label: editorFieldLabel(path), section: editorSectionForPath(path), message: messages[0] });
  }
  // Checklist order is the natural reading order, and also covers photo/geography rules beyond Zod.
  const required = calculatePortfolioCompletion(data, hasPrimaryPhoto).missing.map(requirement => {
    const path = requirementPaths[requirement.key];
    const existing = issues.get(path);
    issues.delete(path);
    const value = path.split(".").reduce<unknown>((current, key) =>
      current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, data);
    return { path, label: requirement.label, section: requirement.editorSection,
      message: requirement.key === "structured_location" ? "Choose a country, state and city, and enter a valid ZIP or PIN code."
        : requirement.key === "primary_photo" ? "Choose a primary photo that can be shared with viewers."
        : typeof value !== "string" || !value.trim() ? "This field is required."
        : existing?.message || "Check this answer before continuing." };
  });
  // Composite and legacy fields resolve to their actual rendered controls.
  for (const [path, issue] of issues) {
    const target = editorFieldTarget(path);
    if (target !== path) {
      issues.delete(path);
      if (!required.some(item => item.path === target) && !issues.has(target)) {
        issues.set(target, { ...issue, path: target, label: editorFieldLabel(target), section: editorSectionForPath(target) });
      }
    }
  }
  return [...required, ...issues.values()];
}
