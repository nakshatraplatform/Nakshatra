import { describe, expect, it } from "vitest";
import { calculatePortfolioCompletion } from "@/features/portfolio/readiness";
import type { PortfolioDraftData } from "@/types/portfolio";

const completeDraft: PortfolioDraftData = {
  personal: {
    name: "Aditi Rao",
    first_name: "Aditi",
    last_name: "Rao",
    dob: "1996-08-12",
    current_location: "Boston, Massachusetts, United States",
    place_of_birth: "Bengaluru",
    short_bio: "A thoughtful introduction.",
  },
  career: { title: "Engineer" },
  vitals: { gotra: "Kashyap" },
  astrology: {
    time_of_birth: "09:15",
    rashi: "kanya",
    nakshatra: "Uttara Phalguni",
    pada: "2",
    manglik_status: "No",
  },
};

describe("portfolio completion", () => {
  it("uses one deterministic checklist for completion and publication readiness", () => {
    expect(calculatePortfolioCompletion(completeDraft, true)).toMatchObject({
      percentage: 100,
      completedCount: 14,
      totalCount: 14,
      basicsComplete: true,
      detailsComplete: true,
      readyToPublish: true,
      missing: [],
    });
  });

  it("identifies the first incomplete editor section and all missing labels", () => {
    const result = calculatePortfolioCompletion({
      ...completeDraft,
      personal: { ...completeDraft.personal, first_name: "", name: "" },
      astrology: { ...completeDraft.astrology, rashi: "" },
    }, false);

    expect(result.readyToPublish).toBe(false);
    expect(result.nextEditorSection).toBe("foundation");
    expect(result.missing.map((item) => item.label)).toEqual([
      "First name",
      "Moon sign (Rashi)",
      "Shareable primary photo",
    ]);
    expect(result.percentage).toBe(79);
  });
});
