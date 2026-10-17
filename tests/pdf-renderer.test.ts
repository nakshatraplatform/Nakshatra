import { describe, expect, it } from "vitest";
import { projectPdfSnapshot } from "../src/features/portfolio/pdf-snapshot";
import { renderIntroductionPdf } from "../src/features/portfolio/server/pdf-renderer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const snapshot = projectPdfSnapshot({ personal: { name: "Ananya Srinivasan", age: 29, current_location: "Bengaluru, KA, India", short_bio: "A thoughtful introduction." },
  education: { degree: "Master of Design", institution: "Design school" }, career: { title: "Product Designer" },
  lifestyle: { hobbies: "Reading, Music, Cooking", values_statement: "Kindness, Honesty" } });
const args = { qrUrl: `https://www.vivintro.com/i/${"a".repeat(32)}`, generatedAt: new Date("2026-10-17T12:00:00Z") };

describe("editorial PDF renderer", () => {
  it.each([snapshot, projectPdfSnapshot({ personal: { name: "Meera Rao" } }), { ...snapshot, name: "Venkata Subrahmanya Satyanarayana Gollapalli Ranganatha" }])("produces one bounded A4 PDF for full, sparse and long names", async data => {
    const bytes = await renderIntroductionPdf({ ...args, snapshot: data });
    const raw = bytes.toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(raw).toContain("595.28"); expect(raw).toContain("841.89");
    expect(raw).toContain(args.qrUrl);
    expect(raw).toContain("Inter"); expect(raw).toContain("PlusJakartaSans");
    expect(bytes.length).toBeLessThan(2 * 1024 * 1024);
  });
  it("rejects unknown glyphs clearly instead of corrupting a person's name", async () => {
    await expect(renderIntroductionPdf({ ...args, snapshot: { ...snapshot, name: "ಮೀರಾ Rao" } })).rejects.toMatchObject({ code: "PDF_FONT_UNSUPPORTED" });
  });
  it("rejects extra fields at the closed renderer boundary", async () => {
    await expect(renderIntroductionPdf({ ...args, snapshot: { ...snapshot, contact: "SECRET" } as never })).rejects.toThrow();
  });
  it("renders the approved editorial composition with the full allowed content", async () => {
    const full = projectPdfSnapshot({ personal: { name: "Ananya Srinivasan", age: 29, current_location: "Bengaluru, KA, India", marital_status: "Single", religion: "Hindu", community: "Tamil", citizenship: "India", short_bio: "Thoughtful, curious and close to family. I enjoy music, quiet weekends and discovering new places." },
      vitals: { height: "5'6\"", gotra: "Bharadwaja" },
      family: { paternal_origin: "Chennai", maternal_origin: "Madurai", sibling_count: 1 },
      astrology: { rashi: "karka", nakshatra: "Pushya" },
      education: { degree: "Master of Design", institution: "National Institute of Design" },
      career: { title: "Product Designer", location: "Bengaluru", job_type: "Full-time" },
      lifestyle: { values_statement: "Kindness, Honesty, Family, Curiosity, Mutual respect", hobbies: "Photography, Music, Cooking, Travel, Reading, Walking" },
    });
    for (const name of [full.name, "Venkata Subrahmanya Satyanarayana Gollapalli Ranganatha", "A".repeat(160)]) {
      const candidate = await renderIntroductionPdf({ ...args, snapshot: { ...full, name } })
        .catch(error => { throw new Error(`Full profile / ${name.length}-character name: ${error.message}`); });
      expect(candidate.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
      if (process.env.PDF_RENDER_PROOF_DIR) {
        await mkdir(process.env.PDF_RENDER_PROOF_DIR, { recursive: true });
        await writeFile(path.join(process.env.PDF_RENDER_PROOF_DIR, `production-name-${name.length}.pdf`), candidate);
      }
    }
    const bytes = await renderIntroductionPdf({ ...args, snapshot: full });
    expect(bytes.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
    if (process.env.PDF_RENDER_PROOF_DIR) {
      await mkdir(process.env.PDF_RENDER_PROOF_DIR, { recursive: true });
      await writeFile(path.join(process.env.PDF_RENDER_PROOF_DIR, "production-editorial.pdf"), bytes);
    }
  });
  it("checks escaped and quoted body strings for missing glyphs", async () => {
    await expect(renderIntroductionPdf({ ...args, snapshot: { ...snapshot, interests: ['Reading "📚"'] } })).rejects.toMatchObject({ code: "PDF_FONT_UNSUPPORTED" });
  });
  it("embeds sanitized public portrait bytes without a remote image dependency", async () => {
    const photo = await sharp({ create: { width: 120, height: 160, channels: 3, background: "#eeeeee" } }).jpeg().toBuffer();
    const bytes = await renderIntroductionPdf({ ...args, snapshot, photo });
    expect(bytes.toString("latin1")).toContain("/Subtype /Image");
    expect(bytes.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  });
});
