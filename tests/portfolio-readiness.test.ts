import { describe, expect, it } from "vitest";
import { calculatePortfolioCompletion } from "@/features/portfolio/readiness";
import type { PortfolioDraftData } from "@/types/portfolio";

const completeDraft: PortfolioDraftData = {
  personal: {
    name: "Aditi Rao",
    first_name: "Aditi",
    last_name: "Rao",
    dob: "1996-08-12",
    gender: "female",
    current_location: "Boston, United States",
    country: "United States",
    city: "Boston",
    place_of_birth: "Bengaluru",
    short_bio: "A thoughtful introduction.",
    marital_status: "Never Married",
  },
  career: { title: "Engineer" },
  vitals: { gotra: "Kashyap", height: "5'5\"" },
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
      completedCount: 11,
      totalCount: 11,
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
    }, false);

    expect(result.readyToPublish).toBe(false);
    expect(result.nextEditorSection).toBe("foundation");
    expect(result.missing.map((item) => item.label)).toEqual([
      "First name",
      "Shareable primary photo",
    ]);
    expect(result.percentage).toBe(82);
  });

  it("rejects an invalid or under-18 date of birth", () => {
    const thisYear = new Date().getUTCFullYear();
    const result = calculatePortfolioCompletion({
      ...completeDraft,
      personal: { ...completeDraft.personal, dob: `${thisYear - 17}-01-01` },
    }, true);

    expect(result.readyToPublish).toBe(false);
    expect(result.missing.map((item) => item.key)).toContain("date_of_birth");
  });

  it("guides a fully complete draft back to an invalid optional answer", () => {
    const result = calculatePortfolioCompletion({
      ...completeDraft,
      personal: { ...completeDraft.personal, profile_summary: "Too short" },
    }, true);
    expect(result.completedCount).toBe(11);
    expect(result.missing).toEqual([]);
    expect(result.readyToPublish).toBe(false);
    expect(result.nextEditorSection).toBe("story");
    expect(result.invalidAnswers[0].label).toContain("at least 80 characters");
  });
});
