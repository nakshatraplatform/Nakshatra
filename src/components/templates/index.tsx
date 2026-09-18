import CelestialUnion from "./CelestialUnion";
import type { PortfolioPhoto } from "@/features/media/portfolio-photo";
import type { ReactNode } from "react";
import type { PortfolioData, PortfolioHoroscopeAttachment } from "@/types/portfolio";

export interface TemplateProps {
  data: PortfolioData;
  sunSign: string | null;
  accessMode?: "owner" | "approved" | "public";
  accessExpiresAt?: string;
  identityVerified?: boolean;
  photos?: PortfolioPhoto[];
  horoscopeAttachment?: PortfolioHoroscopeAttachment;
  interestAction?: ReactNode;
}

/**
 * Routes every persisted template ID to the single supported Nakshatra portfolio renderer.
 * Input: legacy template ID plus portfolio props. Output: canonical portfolio markup.
 */
export function BiodataTemplate(
  props: TemplateProps & { templateId: number }
) {
  return (
    <CelestialUnion
      data={props.data}
      sunSign={props.sunSign}
      accessMode={props.accessMode}
      accessExpiresAt={props.accessExpiresAt}
      identityVerified={props.identityVerified}
      photos={props.photos}
      horoscopeAttachment={props.horoscopeAttachment}
      interestAction={props.interestAction}
    />
  );
}
