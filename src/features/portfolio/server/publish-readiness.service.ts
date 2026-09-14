import "server-only";

import type { PortfolioData } from "@/types/portfolio";
import { calculatePortfolioCompletion } from "@/features/portfolio/readiness";

export class PortfolioPublishReadinessError extends Error {}

/**
 * Validates the minimum content required for a public portfolio generation.
 * Input: validated portfolio data and whether the owner has a shareable primary photo.
 * Output: resolves when ready or throws a user-safe readiness error.
 */
export function requirePortfolioPublishReadiness({
  data,
  hasShareablePrimaryPhoto,
}: {
  data: PortfolioData;
  hasShareablePrimaryPhoto: boolean;
}) {
  const completion = calculatePortfolioCompletion(data, hasShareablePrimaryPhoto);
  if (completion.missing.length) {
    const labels = completion.missing.map((requirement) => requirement.label.toLowerCase());
    const firstItems = labels.slice(0, 4).join(", ");
    const remainder = labels.length > 4 ? ` and ${labels.length - 4} more` : "";
    throw new PortfolioPublishReadinessError(
      `Complete these required details before generating: ${firstItems}${remainder}`
    );
  }
}
