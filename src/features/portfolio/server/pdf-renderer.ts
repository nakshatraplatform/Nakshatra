import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import QRCode from "qrcode";
import { create, type Font } from "fontkit";
import { pdfSnapshotSchema, type PdfSnapshot } from "../pdf-snapshot";

const C = { ink: "#1C2B36", teal: "#174B55", gold: "#8F6628", muted: "#586862", line: "#DAD5C8", soft: "#F5F2EB" };
const WIDTH = 595.28, HEIGHT = 841.89, M = 42, CONTENT = WIDTH - M * 2;
const ASSETS = path.join(process.cwd(), "assets/portfolio-pdf");
type Doc = PDFKit.PDFDocument;
type FontName = "body" | "medium" | "semi" | "display";
let assetPromise: ReturnType<typeof loadAssets> | undefined;

async function loadAssets() {
  const [body, medium, semi, display, logo, symbol] = await Promise.all([
    ...["Inter-Regular.ttf", "Inter-Medium.ttf", "Inter-Semibold.ttf", "Jakarta-Semibold.ttf"].map(name => readFile(path.join(ASSETS, "fonts", name))),
    readFile(path.join(ASSETS, "brand/lockup-primary.svg")), readFile(path.join(ASSETS, "brand/symbol.svg")),
  ]);
  return { body, medium, semi, display, logo: logo.toString(), symbol: symbol.toString(), bodyFont: create(body) as Font, nameFont: create(display) as Font };
}

export class PdfRenderError extends Error {
  constructor(message: string, readonly code = "PDF_LAYOUT_UNAVAILABLE") { super(message); }
}

function ensureGlyphs(font: Font, value: string) {
  if ([...value].some(char => !/\s/u.test(char) && !font.hasGlyphForCodePoint(char.codePointAt(0)!))) {
    throw new PdfRenderError("Some characters are not supported in the PDF yet. Your saved details have not changed.", "PDF_FONT_UNSUPPORTED");
  }
}

/** Fixed editorial template. No database, remote fetch, owner data, or file persistence. */
export async function renderIntroductionPdf(input: {
  snapshot: PdfSnapshot; qrUrl: string; generatedAt: Date; photo?: Buffer;
}): Promise<Buffer> {
  const d = pdfSnapshotSchema.parse(input.snapshot);
  const url = new URL(input.qrUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || input.qrUrl.length > 180 || !Number.isFinite(input.generatedAt.getTime())) {
    throw new PdfRenderError("Please try downloading your PDF again.");
  }
  const a = await (assetPromise ??= loadAssets().catch(error => { assetPromise = undefined; throw error; }));
  ensureGlyphs(a.nameFont, d.name);
  // Never silently substitute missing glyphs, including text in metadata or pills.
  const checkStrings = (value: unknown): void => {
    if (typeof value === "string") ensureGlyphs(a.bodyFont, value);
    else if (Array.isArray(value)) value.forEach(checkStrings);
    else if (value && typeof value === "object") Object.values(value).forEach(checkStrings);
  };
  checkStrings(d);
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, bufferPages: true,
    info: { Title: `${d.name} | VivIntro marriage introduction`, Author: "VivIntro", Creator: "VivIntro", Subject: "Dated public introduction", CreationDate: input.generatedAt } });
  for (const name of ["body", "medium", "semi", "display"] as const) doc.registerFont(name, a[name]);
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  // Prevent a failed synchronous layout from producing an unhandled stream rejection.
  void result.catch(() => {});
  try {
    doc.addPage();
    const rule = (x: number, y: number, w: number) => doc.moveTo(x, y).lineTo(x + w, y).lineWidth(.5).strokeColor(C.line).stroke();
    const label = (s: string, x: number, y: number, w: number, color = C.gold) =>
      drawText(doc, s.toUpperCase(), x, y, w, 12, 7.6, "semi", color, { characterSpacing: .7, lineBreak: false, ellipsis: true });
    const heading = (s: string, x: number, y: number, w: number) => { label(s, x, y, w, C.teal); rule(x, y + 17, w); };

    doc.rect(0, 0, WIDTH, 82).fill(C.soft).rect(0, 0, WIDTH, 5).fill(C.teal);
    SVGtoPDF(doc, a.logo, M, 20, { height: 35, width: 165, preserveAspectRatio: "xMinYMin meet" });
    label("Marriage introduction", M, 66, 245);
    drawText(doc, "One introduction, shared with care", WIDTH - M - 220, 27, 220, 14, 8.5, "body", C.muted, { align: "right" });
    const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(input.generatedAt);
    drawText(doc, `Snapshot · ${date}`, WIDTH - M - 220, 42, 220, 14, 8.5, "semi", C.teal, { align: "right" });
    doc.rect(0, 83, WIDTH, 1).fill(C.gold);

    const xPhoto = WIDTH - M - 144, textWidth = CONTENT - 166;
    // Measure the complete name before drawing. Optional prose yields before the name does.
    let size = 25;
    let nameHeight = measured(doc, d.name, textWidth, size, "display");
    while (nameHeight > 84 && size > 18) { size--; nameHeight = measured(doc, d.name, textWidth, size, "display"); }
    const headlineHeight = Math.min(32, measured(doc, d.headline, textWidth, 10.5, "medium"));
    const introHeight = d.introduction ? Math.min(32, measured(doc, d.introduction, textWidth, 10, "body")) : 0;
    const factHeight = d.facts.length ? Math.ceil(d.facts.length / 3) * 43 + 8 : 0;
    const hasBackground = d.education.length > 0 || d.work.length > 0;
    const hasPills = d.values.length > 0 || d.interests.length > 0;
    let backgroundHeight = hasBackground ? Math.max(...[...d.education, ...d.work].map(item =>
      25 + Math.min(27, measured(doc, item.title, (CONTENT - 24) / 2, 10, "semi")) + 3
      + Math.min(24, measured(doc, item.detail, (CONTENT - 24) / 2, 8.8, "body")) + 12)) : 0;
    let top = 106, identityGap = 18, familyGap = 16, pillHeading = 25;
    let wideName = false;
    const trailingHeight = () => (d.family.length ? 25 + 96 + familyGap : 0) + backgroundHeight + (hasPills ? pillHeading + 96 : 0);
    let includeIntro = Boolean(introHeight);
    const identityHeight = () => wideName ? nameHeight + 10 + Math.max(132, headlineHeight + 12 + factHeight)
      : Math.max(190, nameHeight + 9 + headlineHeight + (includeIntro ? introHeight + 12 : 0) + 16 + factHeight);
    const fits = () => top + identityHeight() + identityGap + trailingHeight() <= 662;
    if (!fits()) includeIntro = false;
    while (!fits() && size > 18) {
      size--;
      nameHeight = measured(doc, d.name, textWidth, size, "display");
    }
    if (!fits()) {
      // Same fixed template: reduce only inter-section whitespace, then give an
      // exceptionally long name the full row above the portrait/facts pair.
      top = 100; identityGap = 10; familyGap = 8; pillHeading = 21;
      if (hasBackground) backgroundHeight -= 6;
      if (!fits()) { wideName = true; nameHeight = measured(doc, d.name, CONTENT, size, "display"); }
    }
    const identity = identityHeight();
    if (!fits()) throw new PdfRenderError("Your details need more room than this one-page layout supports. Your saved details have not changed.");
    drawText(doc, d.name, M, top, wideName ? CONTENT : textWidth, nameHeight + 1, size, "display", C.ink);
    let y = top + nameHeight + (wideName ? 10 : 9);
    drawText(doc, d.headline, M, y, textWidth, headlineHeight + 1, 10.5, "medium", C.gold, { ellipsis: true });
    y += headlineHeight + 12;
    if (includeIntro) { drawText(doc, d.introduction, M, y, textWidth, introHeight + 1, 10, "body", C.muted, { ellipsis: true }); y += introHeight + 12; }
    if (d.facts.length) {
      doc.roundedRect(M, y, textWidth, factHeight, 8).fill(C.soft);
      d.facts.forEach((f, i) => {
        const xx = M + 10 + (i % 3) * textWidth / 3, yy = y + 9 + Math.floor(i / 3) * 43;
        label(f.label, xx, yy, textWidth / 3 - 17, C.muted);
        drawText(doc, f.value, xx, yy + 17, textWidth / 3 - 17, 27, 10, "body", C.ink, { ellipsis: true });
      });
    }
    const photoTop = wideName ? top + nameHeight + 10 : top;
    const photoHeight = wideName ? identity - nameHeight - 10 : identity;
    doc.save().roundedRect(xPhoto, photoTop, 144, photoHeight, 14).clip();
    doc.rect(xPhoto, photoTop, 144, photoHeight).fill(C.soft);
    if (input.photo) doc.image(input.photo, xPhoto, photoTop, { cover: [144, photoHeight], align: "center", valign: "center" });
    else {
      doc.save();
      // SVG rendering sets its own opacity; tint the trusted vector paths explicitly.
      const etchedSymbol = a.symbol.replaceAll("#174B55", "#E8E0CF").replaceAll("#8F6628", "#E8E0CF");
      SVGtoPDF(doc, etchedSymbol, xPhoto + 12, photoTop + photoHeight - 130, { width: 120, height: 150 });
      doc.restore();
      doc.save().strokeColor(C.gold).strokeOpacity(.18).lineWidth(.6);
      for (const inset of [12, 20, 28]) {
        doc.moveTo(xPhoto + inset, photoTop + photoHeight - 14).lineTo(xPhoto + inset, photoTop + 80)
          .bezierCurveTo(xPhoto + inset, photoTop + 14, xPhoto + 144 - inset, photoTop + 14, xPhoto + 144 - inset, photoTop + 80)
          .lineTo(xPhoto + 144 - inset, photoTop + photoHeight - 14).stroke();
      }
      doc.restore();
      const cy = photoTop + photoHeight * .43;
      doc.circle(xPhoto + 72, cy, 36).fill(C.teal);
      const initials = d.name.split(/\s+/u).slice(0, 2).map(word => [...word][0]).join("");
      drawText(doc, initials, xPhoto + 22, cy - 18, 100, 40, 26, "display", "#FFFFFF", { align: "center" });
    }
    doc.restore().roundedRect(xPhoto, photoTop, 144, photoHeight, 14).lineWidth(.7).strokeColor(C.line).stroke();
    y = top + identity + identityGap;
    if (d.family.length) {
      heading("Family & roots", M, y, CONTENT); y += 25;
      doc.roundedRect(M, y, CONTENT, 96, 8).lineWidth(.6).strokeColor(C.line).stroke();
      d.family.forEach((col, i) => {
        const width = CONTENT / d.family.length, xx = M + i * width + 12;
        label(col.title, xx, y + 10, width - 21);
        let yy = y + 28;
        for (const f of col.fields) {
          if (f.label !== "Siblings") { drawText(doc, f.label, xx, yy, width - 21, 11, 7.6, "body", C.muted); yy += 12; }
          drawText(doc, f.value, xx, yy, width - 21, 25, 9, "body", C.ink, { ellipsis: true });
          yy += 24;
        }
      });
      y += 96 + familyGap;
    }
    if (hasBackground) {
      const half = (CONTENT - 24) / 2;
      for (const [i, items, title] of [[0, d.education, "Education"], [1, d.work, "Work"]] as const) {
        if (!items.length) continue;
        const xx = M + i * (half + 24);
        heading(title, xx + 17, y, half - 17);
        doc.save().lineWidth(.8).strokeColor(C.teal);
        if (i === 0) {
          doc.moveTo(xx, y + 6).lineTo(xx + 6, y + 3).lineTo(xx + 12, y + 6).lineTo(xx + 6, y + 9).closePath().stroke();
          doc.moveTo(xx + 3, y + 8).lineTo(xx + 3, y + 11).lineTo(xx + 9, y + 11).stroke();
        } else doc.roundedRect(xx, y + 4, 10, 7, 1).stroke().rect(xx + 3, y + 2, 4, 2).stroke();
        doc.restore();
        const titleHeight = Math.min(27, measured(doc, items[0].title, half, 10, "semi"));
        drawText(doc, items[0].title, xx, y + 25, half, titleHeight + 1, 10, "semi", C.ink, { ellipsis: true });
        drawText(doc, items[0].detail, xx, y + 28 + titleHeight, half, 24, 8.8, "body", C.muted, { ellipsis: true });
      }
      y += backgroundHeight;
    }
    if (hasPills) {
      const both = d.values.length && d.interests.length;
      const sections = [["Values", d.values], ["Interests", d.interests]].filter(([, items]) => items.length) as Array<[string, string[]]>;
      const width = both ? (CONTENT - 24) / 2 : CONTENT;
      sections.forEach(([title, items], index) => {
        const xx = M + index * (width + 24);
        heading(title, xx, y, width);
        doc.roundedRect(xx, y + pillHeading, width, 96, 8).lineWidth(.6).strokeColor(C.line).stroke();
        const shown = items.length > 6 ? [...items.slice(0, 5), `+${items.length - 5} more`] : items;
        const pw = (width - 24) / 2;
        shown.forEach((value, i) => {
          const px = xx + 9 + (i % 2) * (pw + 6), py = y + pillHeading + 9 + Math.floor(i / 2) * 28;
          doc.roundedRect(px, py, pw, 22, 11).fill(C.soft);
          drawText(doc, value, px + 6, py + 5, pw - 12, 13, 9, "medium", C.teal, { align: "center", lineBreak: false, ellipsis: true });
        });
      });
    }
    const panelY = HEIGHT - 164;
    doc.roundedRect(M, panelY, CONTENT, 116, 10).fill(C.soft);
    const qr = QRCode.create(input.qrUrl, { errorCorrectionLevel: "M" });
    const box = 92, qx = M + 12, qy = panelY + 12, n = qr.modules.size, unit = box / (n + 8);
    doc.rect(qx, qy, box, box).fill("#FFFFFF");
    // Draw runs, not isolated pixels: avoids hairline seams when rasterized for printing.
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
      if (!qr.modules.get(row, col)) continue;
      const start = col;
      while (col + 1 < n && qr.modules.get(row, col + 1)) col++;
      doc.rect(qx + (start + 4) * unit, qy + (row + 4) * unit, (col - start + 1) * unit, unit).fill("#111111");
    }
    const tx = qx + box + 20, tw = CONTENT - 142;
    drawText(doc, "Open the online introduction", tx, panelY + 17, tw, 22, 13, "display", C.teal);
    drawText(doc, "Scan or tap the link to view the introduction and show interest. Private details are shared only if the person chooses to continue.", tx, panelY + 44, tw, 42, 9, "body", C.muted);
    // Complete URL, never an ellipsis or a different destination from the QR.
    let linkSize = 8;
    doc.font("medium");
    while (doc.fontSize(linkSize).widthOfString(input.qrUrl) > tw && linkSize > 7.6) linkSize -= .1;
    if (doc.widthOfString(input.qrUrl) > tw) throw new PdfRenderError("The introduction link needs a little more room. Please try again.");
    drawText(doc, input.qrUrl, tx, panelY + 96, tw, 14, linkSize, "medium", C.teal);
    doc.link(qx, qy, box, box, input.qrUrl).link(tx, panelY + 92, tw, 20, input.qrUrl);
    drawText(doc, "Details are self-reported, not verified by VivIntro.", M, HEIGHT - 33, CONTENT, 12, 7.6, "body", C.muted);
    drawText(doc, "vivintro.com", WIDTH - M - 80, HEIGHT - 33, 80, 12, 7.6, "body", C.muted, { align: "right" });
    if (doc.bufferedPageRange().count !== 1) throw new PdfRenderError("Your PDF needs a little more room. Please try again.");
    doc.end();
    const bytes = await result;
    if (bytes.byteLength > 2 * 1024 * 1024) throw new PdfRenderError("Your PDF could not be prepared. Please try again.");
    return bytes;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}

function measured(doc: Doc, value: string, width: number, size: number, font: FontName) {
  return value ? doc.font(font).fontSize(size).heightOfString(value, { width, lineGap: 2 }) : 0;
}
function drawText(doc: Doc, value: string, x: number, y: number, width: number, height: number, size: number, font: FontName, color: string, options: PDFKit.Mixins.TextOptions = {}) {
  if (!value) return;
  doc.font(font).fontSize(size).fillColor(color).text(value, x, y, { width, height, lineGap: 2, ...options });
}

