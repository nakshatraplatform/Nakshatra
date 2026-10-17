import { z } from "zod/v4";
import { portfolioDataSchema, RASHI_OPTIONS } from "@/types/portfolio";
import { formatPortfolioLocation, isPortfolioAudienceLocked, portfolioHobbies } from "./presentation";

const line = z.string().min(1).max(500);
const field = z.object({ label: line, value: line }).strict();
const entry = z.object({ title: line, detail: z.string().max(500) }).strict();

/** Closed renderer boundary. Neither owner data nor Storage capabilities belong in this object. */
export const pdfSnapshotSchema = z.object({
  name: z.string().min(1).max(160),
  headline: z.string().max(500),
  introduction: z.string().max(120),
  facts: z.array(field).max(6),
  family: z.array(z.object({ title: line, fields: z.array(field).max(2) }).strict()).max(4),
  education: z.array(entry).max(1),
  work: z.array(entry).max(1),
  values: z.array(line).max(40),
  interests: z.array(line).max(40),
}).strict();
export type PdfSnapshot = z.infer<typeof pdfSnapshotSchema>;

/** Preserve names and their script. Remove transport controls, not letters or joiners used by scripts. */
export function cleanPdfText(value?: string | null): string {
  return (value || "").normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/gu, " ").trim();
}

/** Must receive the canonical public resolver payload, never draft/approved data. Extra keys are stripped. */
export function projectPdfSnapshot(publicData: unknown): PdfSnapshot {
  const d = portfolioDataSchema.parse(publicData);
  const allowed = (key: "career" | "family" | "astrology" | "lifestyle" | "personal") =>
    !isPortfolioAudienceLocked(d, key, "public")
    && (key !== "career" || !isPortfolioAudienceLocked(d, "journey", "public"))
    && d.visibility?.[key === "career" ? "journey" : key === "personal" ? "personal_story" : key] !== "restricted";
  const pair = (label: string, value?: string | number | null) => {
    const text = cleanPdfText(value == null ? undefined : String(value));
    return text ? [{ label, value: text }] : [];
  };
  const name = cleanPdfText(d.personal.name);
  if (!name) throw new Error("Add your name before downloading your PDF.");
  const facts = [
    ...(typeof d.personal.age === "number" && d.personal.age >= 18 && d.personal.age <= 120 ? pair("Age", `${d.personal.age} years`) : []),
    ...pair("Height", d.vitals?.height),
    ...pair("Marital status", d.personal.marital_status),
    ...(allowed("personal") ? [...pair("Religion", d.personal.religion), ...pair("Community", d.personal.community),
      ...pair("Citizenship", d.personal.citizenship)] : []),
  ];
  const family: PdfSnapshot["family"] = [];
  if (allowed("astrology")) {
    const fields = [...pair("Moon sign", RASHI_OPTIONS.find(r => r.key === d.astrology?.rashi)?.label),
      ...pair("Birth star", d.astrology?.nakshatra)];
    if (fields.length) family.push({ title: "Horoscope basics", fields });
  }
  if (allowed("family")) {
    for (const [title, origin, gotra] of [
      ["Paternal side", d.family?.paternal_origin, allowed("astrology") ? d.vitals?.gotra : undefined],
      ["Maternal side", d.family?.maternal_origin, allowed("astrology") ? d.astrology?.maternal_gotra : undefined],
    ]) {
      const fields = [...pair("Origin", origin), ...pair("Gothram", gotra)];
      if (fields.length) family.push({ title: title!, fields });
    }
    if (typeof d.family?.sibling_count === "number") {
      const n = d.family.sibling_count;
      family.push({ title: "Siblings", fields: pair("", n === 0 ? "Only child" : `${n} sibling${n === 1 ? "" : "s"}`)
        .map(f => ({ ...f, label: "Siblings" })) });
    }
  }
  const educationTitle = cleanPdfText(d.education?.degree || d.education?.qualification_level);
  const careerTitle = allowed("career") ? cleanPdfText(d.career?.title) : "";
  const join = (values: Array<string | undefined>) => values.map(cleanPdfText).filter(Boolean).join(" · ");
  const shortIntro = allowed("personal") ? cleanPdfText(d.personal.short_bio) : "";
  // Prose is optional. A long intro is omitted rather than sliced through a name or word.
  return pdfSnapshotSchema.parse({
    name,
    headline: join([careerTitle, formatPortfolioLocation(d.personal)]),
    introduction: shortIntro.length <= 120 ? shortIntro : "",
    facts,
    family,
    education: allowed("career") && educationTitle ? [{ title: educationTitle, detail: join([d.education?.institution, d.education?.year, d.education?.location]) }] : [],
    work: careerTitle ? [{ title: careerTitle, detail: join([d.career?.location, d.career?.job_type]) }] : [],
    // Structured values do not exist today. Only explicitly comma-separated labels fit pills.
    values: allowed("lifestyle") && d.lifestyle?.values_statement?.includes(",")
      ? portfolioHobbies(d.lifestyle.values_statement).map(cleanPdfText).filter(v => v.length <= 28).slice(0, 40) : [],
    interests: allowed("lifestyle") ? portfolioHobbies(d.lifestyle?.hobbies).map(cleanPdfText).slice(0, 40) : [],
  });
}
