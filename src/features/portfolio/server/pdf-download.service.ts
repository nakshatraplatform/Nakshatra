import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { z } from "zod/v4";
import { projectPdfSnapshot } from "../pdf-snapshot";
import { resolvedPortfolioSchema } from "./public-portfolio.contract";
import { createShareUrl } from "./share-url.service";
import { renderIntroductionPdf } from "./pdf-renderer";

const ticketSchema = z.object({ status: z.literal("ready"), code: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  shareToken: z.string().min(8).max(160), projection: z.record(z.string(), z.unknown()) });

export class PdfDownloadError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) { super(message); }
}

/** Owner-scoped SQL atomically prepares a channel and checks canonical publication eligibility. */
export async function downloadPortfolioPdf(supabase: SupabaseClient, now = new Date()) {
  const { data, error } = await supabase.rpc("prepare_portfolio_pdf");
  if (!error && data?.status === "rate_limited") throw new PdfDownloadError("You’ve downloaded several copies recently. Please try again later.", "PDF_RATE_LIMITED", 429);
  if (!error && data?.status === "unavailable") throw new PdfDownloadError("Publish your introduction before downloading a PDF.", "PDF_NOT_AVAILABLE", 409);
  const ticket = ticketSchema.safeParse(data);
  if (error || !ticket.success) throw new PdfDownloadError("We couldn’t prepare your PDF. Please try again.", "PDF_PREPARATION_FAILED", 503);
  const projection = resolvedPortfolioSchema.parse(ticket.data.projection);
  const snapshot = projectPdfSnapshot(projection.data);
  const url = new URL(createShareUrl(ticket.data.code));
  url.pathname = `/i/${ticket.data.code}`;
  url.search = ""; url.hash = "";
  const hero = projection.media.find(item => item.mediaType === "hero" && item.presentation === "clear");
  // Only canonical-public descriptors may reach Storage; no URLs, fetches or arbitrary client paths.
  const photo = hero ? await loadPublicHero(supabase, hero.accessPath) : undefined;
  const bytes = await renderIntroductionPdf({ snapshot, qrUrl: url.toString(), generatedAt: now, photo });
  // Auth, channel rotation, publication, media visibility and public content may change during rendering.
  const checked = await supabase.rpc("validate_portfolio_pdf", { p_code: ticket.data.code, p_projection: ticket.data.projection });
  if (checked.error || checked.data !== true) throw new PdfDownloadError("Your introduction changed while we prepared the PDF. Please download it again.", "PDF_CHANGED", 409);
  const date = now.toISOString().slice(0, 10);
  const slug = snapshot.name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "introduction";
  return { bytes, filename: `vivintro-${slug}-${date}.pdf` };
}

async function loadPublicHero(supabase: SupabaseClient, storagePath: string): Promise<Buffer | undefined> {
  try {
    const { data, error } = await supabase.storage.from("photos").download(storagePath, {}, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    if (error || !data || data.size > 5 * 1024 * 1024) return undefined;
    return await sharp(Buffer.from(await data.arrayBuffer()), { limitInputPixels: 25_000_000, animated: false })
      .rotate().resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 }).toBuffer();
  } catch {
    // A missing/unsupported public photo must not block a usable initials PDF.
    return undefined;
  }
}
