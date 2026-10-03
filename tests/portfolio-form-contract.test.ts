import { describe, expect, it } from "vitest";
import {
  formListValues,
  portfolioEditorDraftSchema,
  portfolioEditorPublishSchema,
} from "@/features/portfolio/form-contract";

const validPortfolio = {
  personal: {
    name: "Ana-Marie O'Neil",
    first_name: "Ana-Marie",
    middle_name: "",
    last_name: "O'Neil",
    dob: "1998-01-30",
    gender: "female",
    marital_status: "Single",
    country: "United States",
    city: "Boston",
    current_location: "Boston, United States",
    short_bio: "A thoughtful introduction about me.",
    profile_for: "self",
  },
  career: { title: "Engineer" },
  vitals: { height: "5'5\"" },
};

describe("portfolio editor contract", () => {
  it("counts list selections case-insensitively like the database", () => {
    expect(formListValues("Music,music, Cooking;COOKING")).toEqual(["Music", "Cooking"]);
  });
  it("accepts hyphens, apostrophes and spaces in names", () => {
    expect(portfolioEditorPublishSchema.safeParse(validPortfolio).success).toBe(true);
  });

  it("keeps historical reduced-disclosure drafts editable but blocks their republication", () => {
    const historicalDraft = { ...validPortfolio, privacy_mode: "private" };
    expect(portfolioEditorDraftSchema.safeParse(historicalDraft).success).toBe(true);
    const published = portfolioEditorPublishSchema.safeParse(historicalDraft);
    expect(published.success).toBe(false);
    if (!published.success) expect(published.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["privacy_mode"] }),
    ]));
  });

  it("allows an incomplete draft but validates a name once entered", () => {
    expect(portfolioEditorDraftSchema.safeParse({ personal: { name: "" } }).success).toBe(true);
    expect(portfolioEditorDraftSchema.safeParse({
      ...validPortfolio,
      personal: { ...validPortfolio.personal, first_name: "Rahul2" },
    }).success).toBe(false);
    expect(portfolioEditorDraftSchema.safeParse({
      ...validPortfolio,
      personal: { ...validPortfolio.personal, first_name: "A".repeat(51) },
    }).success).toBe(false);
  });

  it("requires gender, height, structured residence, and an adult DOB from 1920 onward at publication", () => {
    for (const personal of [
      { ...validPortfolio.personal, gender: "" },
      { ...validPortfolio.personal, city: "" },
      { ...validPortfolio.personal, current_location: "Old city" },
      { ...validPortfolio.personal, dob: "1919-12-31" },
      { ...validPortfolio.personal, dob: "2020-01-01" },
    ]) {
      expect(portfolioEditorPublishSchema.safeParse({ ...validPortfolio, personal }).success).toBe(false);
    }
    expect(portfolioEditorPublishSchema.safeParse({ ...validPortfolio, vitals: {} }).success).toBe(false);
  });

  it("allows optional narratives to be blank, but rejects 79 characters and accepts 80 or 81", () => {
    for (const length of [0, 79, 80, 81]) {
      const result = portfolioEditorPublishSchema.safeParse({
        ...validPortfolio,
        personal: { ...validPortfolio.personal, profile_summary: "a".repeat(length) },
      });
      expect(result.success).toBe(length !== 79);
    }
  });

  it("preserves unfinished narratives in autosaved drafts but blocks publication", () => {
    const partial = {
      ...validPortfolio,
      personal: { ...validPortfolio.personal, profile_summary: "Still composing this introduction." },
    };
    expect(portfolioEditorDraftSchema.safeParse(partial).success).toBe(true);
    expect(portfolioEditorPublishSchema.safeParse(partial).success).toBe(false);
  });

  it("rejects more than six interests, five values, or ten languages", () => {
    for (const [field, count, maximum] of [
      ["hobbies", 7, 6], ["values_statement", 6, 5], ["languages", 11, 10],
    ] as const) {
      const result = portfolioEditorDraftSchema.safeParse({
        ...validPortfolio,
        lifestyle: { [field]: Array.from({ length: count }, (_, index) => `Item${index + 1}`).join(", ") },
      });
      expect(result.success, `${field} must stop at ${maximum}`).toBe(false);
    }
  });
});
