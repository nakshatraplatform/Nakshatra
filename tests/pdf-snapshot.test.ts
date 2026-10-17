import { describe, expect, it } from "vitest";
import { cleanPdfText, pdfSnapshotSchema, projectPdfSnapshot } from "../src/features/portfolio/pdf-snapshot";

const publicData = {
  personal: { name: "Ananya Srinivasan", age: 29, current_location: "Bengaluru, KA, India", marital_status: "Single", religion: "Hindu", community: "Tamil", citizenship: "India", short_bio: "A thoughtful introduction." },
  vitals: { height: "5'6\"", gotra: "Bharadwaja" },
  education: { degree: "Master of Design", institution: "Design school" },
  career: { title: "Product Designer", location: "Bengaluru", job_type: "Full-time" },
  family: { paternal_origin: "Chennai", maternal_origin: "Madurai", sibling_count: 1 },
  astrology: { rashi: "karka", nakshatra: "Pushya" },
  lifestyle: { hobbies: "Music, Reading, Music", values_statement: "Kindness, Honesty" },
};

describe("public PDF projection", () => {
  it("maps verified schema fields and does not invent entries or sibling details", () => {
    const result = projectPdfSnapshot(publicData);
    expect(result.name).toBe("Ananya Srinivasan");
    expect(result.interests).toEqual(["Music", "Reading"]);
    expect(result.family.at(-1)?.fields).toEqual([{ label: "Siblings", value: "1 sibling" }]);
    expect(result.education).toHaveLength(1);
    expect(result.values).toEqual(["Kindness", "Honesty"]);
  });

  it("explicitly excludes private sentinels even if an upstream projection contains extra fields", () => {
    const result = projectPdfSnapshot({ ...publicData,
      personal: { ...publicData.personal, dob: "1997-01-01", address_line_1: "SECRET-ADDRESS", postal_code: "SECRET-POSTAL" },
      contact: { email: "secret@example.test", secure_note: "SECRET-CONTACT" },
      family: { ...publicData.family, father: { name: "SECRET-PARENT" }, siblings: [{ name: "SECRET-SIBLING" }] },
      astrology: { ...publicData.astrology, time_of_birth: "03:27", lagnam: "SECRET-LAGNAM" },
      identityVerified: true,
    });
    const text = JSON.stringify(result);
    for (const value of ["SECRET", "1997-01-01", "03:27", "secret@example.test", "identityVerified"]) expect(text).not.toContain(value);
    expect(pdfSnapshotSchema.safeParse({ ...result, contact: "sensitive" }).success).toBe(false);
  });

  it("respects access and visibility locks without fallback to private content", () => {
    const result = projectPdfSnapshot({ ...publicData, access: { career: "approved", astrology: "owner", family: "broker", lifestyle: "approved" } });
    expect(result.education).toEqual([]); expect(result.work).toEqual([]);
    expect(result.family).toEqual([]); expect(result.values).toEqual([]); expect(result.interests).toEqual([]);
    expect(result.headline).not.toContain("Designer");
    expect(projectPdfSnapshot({ ...publicData, visibility: { journey: "restricted", family: "restricted", astrology: "restricted" } }).family).toEqual([]);
  });

  it("supports sparse data, zero siblings, and full Unicode names without title-case mutation", () => {
    expect(projectPdfSnapshot({ personal: { name: "ಮೀರಾ Rao" } }).name).toBe("ಮೀರಾ Rao");
    expect(projectPdfSnapshot({ personal: { name: "Meera" }, family: { sibling_count: 0 } }).family[0].fields[0].value).toBe("Only child");
    expect(cleanPdfText("A\u0000  B\u202e C")).toBe("A B C");
    expect(cleanPdfText("a\u200db")).toBe("a\u200db");
    expect(projectPdfSnapshot({ personal: { name: "Meera" }, lifestyle: { values_statement: "I care deeply about family." } }).values).toEqual([]);
  });
});
