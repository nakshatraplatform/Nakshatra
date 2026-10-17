import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { requireSameOrigin, requestSecurityErrorResponse } from "@/lib/api/request-security";
import { downloadPortfolioPdf, PdfDownloadError } from "@/features/portfolio/server/pdf-download.service";
import { PdfRenderError } from "@/features/portfolio/server/pdf-renderer";

export const runtime = "nodejs";
export const maxDuration = 30;

/** No client-selected portfolio, fields, URLs, filenames or templates. SQL owns the owner quota. */
export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch (error) { return requestSecurityErrorResponse(error); }
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  try {
    const { bytes, filename } = await downloadPortfolioPdf(auth.supabase);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    const known = error instanceof PdfDownloadError || error instanceof PdfRenderError;
    return Response.json({ code: known ? error.code : "PDF_DOWNLOAD_FAILED",
      error: known ? error.message : "We couldn’t prepare your PDF. Please try again." },
    { status: error instanceof PdfDownloadError ? error.status : error instanceof PdfRenderError ? 422 : 503,
      headers: { "Cache-Control": "private, no-store", ...(error instanceof PdfDownloadError && error.status === 429 ? { "Retry-After": "3600" } : {}) } });
  }
}
