import { describe, expect, it, vi } from "vitest";
import {
  formListValues,
  portfolioEditorDraftSchema,
  portfolioEditorPublishSchema,
  validAdultBirthDate,
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
  it("accepts concise optional narratives without a minimum while retaining maximum lengths", () => {
    const concise = { ...validPortfolio, personal: { ...validPortfolio.personal,
      profile_summary: "Quiet and kind.", long_term_goals: "A caring home.", shared_life_plans: "Evening walks.",
    } };
    expect(portfolioEditorPublishSchema.safeParse(concise).success).toBe(true);
    expect(portfolioEditorPublishSchema.safeParse({ ...concise, personal: { ...concise.personal, profile_summary: "x".repeat(1601) } }).success).toBe(false);
  });
  it("does not report a contradictory location for an untouched empty draft", () => {
    const result = portfolioEditorPublishSchema.safeParse({ personal: { name: "" } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => issue.path.join(".") === "personal.current_location")).toBe(false);
      expect(result.error.issues.some(issue => issue.path.join(".") === "personal.first_name")).toBe(true);
    }
    const inconsistent = portfolioEditorPublishSchema.safeParse({ ...validPortfolio,
      personal: { ...validPortfolio.personal, current_location: "Wrong city" } });
    expect(inconsistent.success).toBe(false);
    if (!inconsistent.success) expect(inconsistent.error.issues.some(issue => issue.path.join(".") === "personal.current_location")).toBe(true);
  });
  it.each(["24:00", "12:60", "99:99"])("rejects impossible optional birth time %s in drafts and publication", (time) => {
    const data = { ...validPortfolio, astrology: { time_of_birth: time } };
    for (const schema of [portfolioEditorDraftSchema, portfolioEditorPublishSchema]) {
      const parsed = schema.safeParse(data);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ["astrology", "time_of_birth"] })]));
    }
  });
  it.each(["00:00", "23:59", ""])("keeps a valid or unanswered optional birth time %s", (time) => {
    expect(portfolioEditorDraftSchema.safeParse({ ...validPortfolio, astrology: { time_of_birth: time } }).success).toBe(true);
  });
  it.each(["-------", "123", "+1 22222222222222222222"])("rejects invalid protected contact phone %s", (phone) => {
    for (const contact of [{ phone }, { contacts: [{ phone }] }]) {
      expect(portfolioEditorDraftSchema.safeParse({ ...validPortfolio, contact }).success).toBe(false);
    }
  });
  it("keeps contacts optional, including empty contact rows and email-only entries", () => {
    expect(portfolioEditorDraftSchema.safeParse({ ...validPortfolio, contact: { contacts: [{ phone: "", email: "family@example.com" }, {}] } }).success).toBe(true);
  });
  it("does not roll the adult date cutoff into March on a leap day", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2024-02-29T12:00:00Z"));
      expect(validAdultBirthDate("2006-03-01")).toBe(false);
      expect(validAdultBirthDate("2006-02-28")).toBe(true);
      expect(validAdultBirthDate("2006-02-29")).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it("rejects control characters and punctuation-only portfolio name parts", () => {
    for (const first_name of ["Ana\nMarie", "---", "''"]) {
      expect(portfolioEditorDraftSchema.safeParse({ ...validPortfolio, personal: { ...validPortfolio.personal, first_name } }).success).toBe(false);
    }
  });
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

  it("allows optional narratives to be blank or concise, up to the existing maximum", () => {
    for (const length of [0, 1, 79, 80, 81, 1600, 1601]) {
      const result = portfolioEditorPublishSchema.safeParse({
        ...validPortfolio,
        personal: { ...validPortfolio.personal, profile_summary: "a".repeat(length) },
      });
      expect(result.success).toBe(length <= 1600);
    }
  });

  it("preserves concise optional narratives in both draft and publication", () => {
    const partial = {
      ...validPortfolio,
      personal: { ...validPortfolio.personal, profile_summary: "Still composing this introduction." },
    };
    expect(portfolioEditorDraftSchema.safeParse(partial).success).toBe(true);
    expect(portfolioEditorPublishSchema.safeParse(partial).success).toBe(true);
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
