import type { PortfolioData } from "@/types/portfolio";
import { formatPortfolioLocation, isPortfolioAudienceLocked } from "./presentation";

/** Input must be the public resolver's projection, never an owner's draft or full snapshot. */
export function buildWhatsAppShareMessage(url: string, publicData?: PortfolioData | null): string {
  const personal = publicData?.personal;
  const location = personal ? formatPortfolioLocation(personal) : undefined;
  const parts = location?.split(",").map(value => value.trim());
  const country = parts?.at(-1);
  const shortLocation = parts && parts.length >= 2 && ["United States", "US", "USA"].includes(country || "")
    ? `${parts[0]}, USA` : location;
  const careerVisible = publicData && publicData.visibility?.journey !== "restricted"
    && !isPortfolioAudienceLocked(publicData, "career", "public");
  const summary = [
    personal?.name?.trim(),
    typeof personal?.age === "number" && personal.age >= 18 && personal.age <= 120 ? personal.age : undefined,
    careerVisible ? publicData.career?.title?.trim() : undefined,
    shortLocation,
  ].filter(value => value !== undefined && value !== "").join(" · ");

  return `Here’s my marriage introduction 🙏\n\n${summary ? `${summary}\n` : ""}${url}\n\nIf you’d like to know more, tap “Show interest” on the page.`;
}
