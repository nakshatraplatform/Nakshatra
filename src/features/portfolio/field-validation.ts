/** Authoring rules only: historical snapshots keep their broader read schemas. */
export const NAME_PART_PATTERN = /^(?=.*\p{L})[\p{L}\p{M} '’-]+$/u;
export const HAS_LETTER_PATTERN = /\p{L}/u;

const personNamePath = /^(?:personal\.(?:first_name|middle_name|last_name)|family\.(?:father|mother|siblings\.\d+)\.name|contact\.(?:contact_person|contacts\.\d+\.name))$/;
const descriptivePaths = new Set(["career.title", "personal.short_bio", "personal.city"]);

/** Optional blanks stay editable; requiredness and length belong to the form contract. */
export function portfolioTextError(path: string | undefined, value: string): string | undefined {
  if (!path || !value.trim()) return undefined;
  if (personNamePath.test(path) && !NAME_PART_PATTERN.test(value.trim())) {
    return "Use letters, spaces, apostrophes or hyphens only.";
  }
  if (descriptivePaths.has(path) && !HAS_LETTER_PATTERN.test(value)) {
    return "Include at least one letter; numbers and symbols alone are not enough.";
  }
  return undefined;
}
