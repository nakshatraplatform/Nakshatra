import {
  AGE_OPTIONS, ALCOHOL_USE_OPTIONS, CAREER_AFTER_MARRIAGE_OPTIONS, CASTE_PREFERENCE_OPTIONS,
  CHILDREN_OPTIONS, FAMILY_RESPONSIBILITY_OPTIONS, HEIGHT_OPTIONS, HOROSCOPE_PREFERENCE_OPTIONS,
  JOB_TYPE_OPTIONS, LIVING_ARRANGEMENT_OPTIONS, MANGLIK_OPTIONS, MARITAL_STATUS_OPTIONS,
  MARRIAGE_TIMELINE_OPTIONS, NAKSHATRA_OPTIONS, RELOCATION_OPTIONS, SIBLING_POSITION_OPTIONS,
  TOBACCO_USE_OPTIONS, VISA_OPTIONS, CONTACT_RELATIONSHIPS, incomeRangeOptions, type BlueprintOption,
} from "./blueprint-options";

const choices: Record<string, BlueprintOption[]> = {
  "personal.marital_status": MARITAL_STATUS_OPTIONS,
  "personal.immigration_status": VISA_OPTIONS,
  "personal.relocation_preference": RELOCATION_OPTIONS,
  "career.job_type": JOB_TYPE_OPTIONS,
  "family.sibling_position": SIBLING_POSITION_OPTIONS,
  "lifestyle.drinking": ALCOHOL_USE_OPTIONS,
  "lifestyle.smoking": TOBACCO_USE_OPTIONS,
  "astrology.nakshatra": NAKSHATRA_OPTIONS,
  "astrology.manglik_status": MANGLIK_OPTIONS,
  "preferences.caste_preference": CASTE_PREFERENCE_OPTIONS,
  "preferences.horoscope_preference": HOROSCOPE_PREFERENCE_OPTIONS,
  "preferences.marriage_timeline": MARRIAGE_TIMELINE_OPTIONS,
  "preferences.children_preference": CHILDREN_OPTIONS,
  "preferences.career_after_marriage": CAREER_AFTER_MARRIAGE_OPTIONS,
  "preferences.living_arrangement": LIVING_ARRANGEMENT_OPTIONS,
  "preferences.family_responsibilities": FAMILY_RESPONSIBILITY_OPTIONS,
};

function answer(data: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object"
    ? (value as Record<string, unknown>)[key] : undefined, data);
}

function validRange(value: string, options: BlueprintOption[]) {
  const parts = value.split(/\s*(?:–|—|\bto\b|-)\s*/i);
  if (parts.length !== 2 || !parts.some(Boolean)) return false;
  const allowed = options.filter(option => option.value).map(option => option.value);
  const [minimum, maximum] = parts;
  return (!minimum || allowed.includes(minimum)) && (!maximum || allowed.includes(maximum))
    && (!minimum || !maximum || allowed.indexOf(minimum) <= allowed.indexOf(maximum));
}

/** New authoring choices are closed sets; broad read schemas retain historical data.
 * A server-owned stored draft is the only acceptable legacy baseline.
 * Self-described fields intentionally remain bounded free text, not closed enums.
 */
export function authoringChoiceErrors(data: unknown, stored?: unknown): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const changed = (path: string) => stored === undefined || answer(data, path) !== answer(stored, path);
  const changedChoice = (path: string) => {
    const row = /^(contact\.contacts|family\.siblings)\.(\d+)\.(relationship|marital_status)$/.exec(path);
    if (!row) return changed(path);
    const [, prefix, index, field] = row;
    const rows = answer(data, prefix);
    const previous = answer(stored, prefix);
    const limit = prefix === "contact.contacts" ? 5 : 10;
    const value = answer(data, path);
    // Rows have no stable IDs. Retain at most the owner's stored occurrence
    // count of each historical choice, independent of deletion/reordering.
    const count = (items: unknown[], length: number) => items.slice(0, length).filter(item => answer(item, field) === value).length;
    return !Array.isArray(rows) || !Array.isArray(previous)
      || count(rows, Number(index) + 1) > count(previous, limit);
  };
  const dynamicChoices = { ...choices };
  const siblings = answer(data, "family.siblings");
  if (Array.isArray(siblings)) siblings.slice(0, 10).forEach((_, index) => { dynamicChoices[`family.siblings.${index}.marital_status`] = MARITAL_STATUS_OPTIONS; });
  const contacts = answer(data, "contact.contacts");
  if (Array.isArray(contacts)) contacts.slice(0, 5).forEach((_, index) => { dynamicChoices[`contact.contacts.${index}.relationship`] = CONTACT_RELATIONSHIPS; });
  for (const [path, options] of Object.entries(dynamicChoices)) {
    const value = answer(data, path);
    if (typeof value === "string" && value && !options.some(option => option.value === value) && changedChoice(path)) {
      errors[path] = [path === "personal.marital_status" ? "Choose a marital status from the list." : "Choose an option from the list, or leave this optional answer blank."];
    }
  }
  for (const [path, options] of [["preferences.age_range", AGE_OPTIONS], ["preferences.height_range", HEIGHT_OPTIONS]] as const) {
    const value = answer(data, path);
    if (typeof value === "string" && value && !validRange(value, options) && changed(path)) {
      errors[path] = ["Choose a valid minimum and maximum; the maximum must not be lower than the minimum."];
    }
  }
  const income = answer(data, "career.annual_income");
  if (typeof income === "string" && income && income !== "Prefer not to say" && !answer(data, "career.income_currency")
      && (changed("career.annual_income") || changed("career.income_currency"))) {
    errors["career.income_currency"] = ["Choose the currency for this income range, or clear the income range."];
  }
  const currency = answer(data, "career.income_currency");
  if (typeof income === "string" && income && typeof currency === "string" && currency
    && !incomeRangeOptions(currency).some(option => option.value === income)
    && (changed("career.annual_income") || changed("career.income_currency"))) {
    errors["career.annual_income"] = ["Choose an income range for the selected currency, or leave it blank."];
  }
  return errors;
}
