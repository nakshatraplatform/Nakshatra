import { describe, expect, it } from "vitest";
import { authoringChoiceErrors } from "@/features/portfolio/authoring-choices";

describe("portfolio authoring choices", () => {
  it("retains legacy row choices after deletion or reordering without allowing extra copies", () => {
    const aunt = { relationship: "aunt", name: "A" };
    const stored = { contact: { contacts: [{ relationship: "self" }, aunt] } };
    expect(authoringChoiceErrors({ contact: { contacts: [aunt] } }, stored)).toEqual({});
    expect(authoringChoiceErrors({ contact: { contacts: [aunt, { relationship: "self" }] } }, stored)).toEqual({});
    expect(authoringChoiceErrors({ contact: { contacts: [aunt, aunt] } }, stored)).toHaveProperty("contact.contacts.1.relationship");
    expect(authoringChoiceErrors({ contact: { contacts: [{ relationship: "uncle" }] } }, stored)).toHaveProperty("contact.contacts.0.relationship");
    const sibling = { name: "Sibling", marital_status: "Historical status" };
    expect(authoringChoiceErrors({ family: { siblings: [sibling] } }, { family: { siblings: [{ marital_status: "Single" }, sibling] } })).toEqual({});
  });
  it("keeps empty optional sections valid", () => {
    expect(authoringChoiceErrors({ personal: {}, family: {}, astrology: {} })).toEqual({});
  });
  it("rejects unsupported new dropdown values, but retains exactly unchanged stored answers", () => {
    const data = { personal: { marital_status: "Never Married" }, career: { job_type: "Historic work status" } };
    expect(Object.keys(authoringChoiceErrors(data))).toEqual(["personal.marital_status", "career.job_type"]);
    expect(authoringChoiceErrors(data, data)).toEqual({});
    expect(authoringChoiceErrors({ ...data, career: { job_type: "New arbitrary choice" } }, data))
      .toHaveProperty("career.job_type");
  });
  it("rejects reversed or out-of-list ranges and accepts open boundaries", () => {
    for (const age_range of ["40–20", "4–10", "not a range", "24–28–32"]) {
      expect(authoringChoiceErrors({ preferences: { age_range } })).toHaveProperty("preferences.age_range");
    }
    for (const age_range of ["18–80", "–28", "24–", ""]) {
      expect(authoringChoiceErrors({ preferences: { age_range } })).toEqual({});
    }
  });
  it("requires currency only for a new nonempty income range, not a new mandatory field", () => {
    expect(authoringChoiceErrors({ career: { annual_income: "Prefer not to say" } })).toEqual({});
    const historic = { career: { annual_income: "50k-75k" } };
    expect(authoringChoiceErrors(historic)).toHaveProperty("career.income_currency");
    expect(authoringChoiceErrors(historic, historic)).toEqual({});
    expect(authoringChoiceErrors({ career: { annual_income: "75k-100k" } }, historic)).toHaveProperty("career.income_currency");
  });
});
