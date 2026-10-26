import { describe, expect, it } from "vitest";
import { calculatePortfolioCompletion, isProfileFullyComplete } from "@/features/portfolio/readiness";
import { editorFieldIssues } from "@/features/portfolio/editor-validation";
import { portfolioEditorPublishSchema } from "@/features/portfolio/form-contract";
import type { PortfolioDraftData } from "@/types/portfolio";

const completeDraft: PortfolioDraftData = {
  personal: {
    name: "Aditi Rao",
    first_name: "Aditi",
    last_name: "Rao",
    dob: "1996-08-12",
    gender: "female",
    current_location: "Boston, Massachusetts, United States",
    country: "United States",
    country_code: "US",
    region: "Massachusetts",
    region_code: "US-MA",
    city: "Boston",
    postal_code: "02108",
    location_source: "manual",
    address_line_1: "1 Beacon Street",
    address_line_2: "Unit 2",
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
  it.each([true, false])("keeps reused validation consistent after answers and photo eligibility change (%s)", (hasPhoto) => {
    for (const draft of [completeDraft,
      { ...completeDraft, personal: { ...completeDraft.personal, first_name: "", postal_code: "invalid" } },
      { ...completeDraft, personal: { ...completeDraft.personal, profile_summary: "x".repeat(1601) } },
    ]) {
      const parsed = portfolioEditorPublishSchema.safeParse(draft);
      const completion = calculatePortfolioCompletion(draft, hasPhoto, parsed);
      expect(completion).toEqual(calculatePortfolioCompletion(draft, hasPhoto));
      expect(editorFieldIssues(draft, hasPhoto, undefined, { completion, parsed })).toEqual(editorFieldIssues(draft, hasPhoto));
      expect(completion.missing.some(item => item.key === "primary_photo")).toBe(!hasPhoto);
    }
  });

  it("fails closed for missing and malformed published snapshots", () => {
    for (const snapshot of [null, undefined, {}, [], "published", { personal: { dob: "1990-99-99" } }]) {
      expect(isProfileFullyComplete(snapshot, true)).toBe(false);
    }
  });

  it("checks current required published answers and a shareable primary photo", () => {
    expect(isProfileFullyComplete(completeDraft, true)).toBe(true);
    expect(isProfileFullyComplete(completeDraft, false)).toBe(false);
    for (const field of ["postal_code", "region_code"] as const) {
      expect(isProfileFullyComplete({ ...completeDraft, personal: { ...completeDraft.personal, [field]: "" } }, true)).toBe(false);
    }
    expect(isProfileFullyComplete({ ...completeDraft, personal: { ...completeDraft.personal, address_line_2: "" } }, true)).toBe(true);
  });

  it("uses one deterministic checklist for completion and publication readiness", () => {
    expect(calculatePortfolioCompletion(completeDraft, true)).toMatchObject({
      percentage: 100,
      completedCount: 10,
      totalCount: 10,
      basicsComplete: true,
      detailsComplete: true,
      readyToPublish: true,
      missing: [],
    });
  });

  it("does not require either legacy street address line", () => {
    const withoutLine2 = calculatePortfolioCompletion({
      ...completeDraft,
      personal: { ...completeDraft.personal, address_line_2: "" },
    }, true);
    expect(withoutLine2.readyToPublish).toBe(true);
    expect(withoutLine2.missing).toEqual([]);

    const withoutLine1 = calculatePortfolioCompletion({
      ...completeDraft,
      personal: { ...completeDraft.personal, address_line_1: "", address_line_2: "Unit 2" },
    }, true);
    expect(withoutLine1.readyToPublish).toBe(true);
    expect(withoutLine1.missing).toEqual([]);
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
    expect(result.percentage).toBe(80);
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
      personal: { ...completeDraft.personal, profile_summary: "x".repeat(1601) },
    }, true);
    expect(result.completedCount).toBe(10);
    expect(result.missing).toEqual([]);
    expect(result.readyToPublish).toBe(false);
    expect(result.nextEditorSection).toBe("story");
    expect(result.invalidAnswers[0].key).toBe("personal.profile_summary");
  });
});
