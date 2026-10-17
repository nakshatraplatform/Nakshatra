import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicBiodataPage from "@/app/p/[token]/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Marriage introduction", robots: { index: false, follow: false, noarchive: true } };

/** Separate bearer reference, same public/approved-view rules; never redirects to an owner ID. */
export default async function PdfIntroductionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(code)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_portfolio_pdf_link", { p_code: code });
  if (error || typeof data !== "string" || !/^[A-Za-z0-9_-]{8,160}$/.test(data)) notFound();
  return PublicBiodataPage({ params: Promise.resolve({ token: data }) });
}
