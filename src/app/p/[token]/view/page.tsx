import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readGuestViewingProof } from "@/features/access/server/guest-viewing-cookie";
import { resolvePortfolioView } from "@/features/portfolio/server/public-portfolio.service";
import { GuestPortfolioVerification } from "./verification-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "View an approved portfolio", robots: { index: false, follow: false, nocache: true } };

export default async function ApprovedGuestViewingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await createClient();
  const { data } = await client.auth.getUser();
  const portfolio = await resolvePortfolioView(client, token, Boolean(data.user?.email_confirmed_at), {
    guestProofHash: await readGuestViewingProof(token),
  });
  if (!portfolio) notFound();
  if (portfolio.accessMode === "approved") redirect(`/p/${encodeURIComponent(token)}`);
  return <main id="main-content" className="grid min-h-screen place-items-center bg-[var(--workspace-canvas)] px-5 py-12 text-[var(--workspace-ink)]"><GuestPortfolioVerification token={token} /></main>;
}
