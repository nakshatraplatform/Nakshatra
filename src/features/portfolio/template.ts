export const CELESTIAL_UNION_TEMPLATE_ID = 1;
export const CELESTIAL_UNION_TEMPLATE_NAME = "Nakshatra Portfolio";

export const PORTFOLIO_VIEW_LABELS = {
  complete: "Complete Portfolio",
} as const;

/**
 * Normalizes legacy portfolio style data to the application's single supported template.
 * Input: optional persisted style data. Output: style data identifying the supported Nakshatra portfolio layout.
 */
export function withCanonicalTemplate<T extends Record<string, unknown> | undefined>(
  style: T
) {
  return {
    ...(style ?? {}),
    template_name: CELESTIAL_UNION_TEMPLATE_NAME,
  };
}
