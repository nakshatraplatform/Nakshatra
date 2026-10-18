import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod/v4";
import { AccessVerificationClient } from "./access-verification-client";
import { createClient } from "@/lib/supabase/server";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

const grantIdSchema = z.uuid();
const resolutionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("active"), shareToken: z.string().min(1), expiresAt: z.string() }),
  z.object({ status: z.enum(["signin_required", "unavailable", "revoked", "expired"]) }),
]);

export default async function CompletePortfolioAccessPage({ params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await params;
  const parsedGrantId = grantIdSchema.safeParse(grantId);
  if (!parsedGrantId.success) return <AccessState title="This access link is unavailable" copy="Ask the person who shared this introduction to share a current access email." />;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return (
      <AccessShell title="Verify before viewing" copy="Private details are shared with a specific person. Verify the same email address that received this link.">
        <AccessVerificationClient grantId={grantId} />
      </AccessShell>
    );
  }

  const { data, error } = await supabase.rpc("resolve_complete_portfolio_access", { p_grant_id: grantId });
  const resolution = resolutionSchema.safeParse(data);
  if (error || !resolution.success || resolution.data.status === "unavailable" || resolution.data.status === "revoked") {
    return <AccessState title="This access link is unavailable" copy="It may have ended or belong to a different verified account." />;
  }
  if (resolution.data.status === "expired") {
    return <AccessState title="Sharing period ended" copy="Details are shared for up to 15 days. Ask the person who shared this introduction to share them again." />;
  }
  if (resolution.data.status === "signin_required") {
    return <AccessShell title="Verify before viewing" copy="Sign in with the same email address to view the details shared with you."><AccessVerificationClient grantId={grantId} /></AccessShell>;
  }
  if (resolution.data.status === "active") redirect(`/p/${encodeURIComponent(resolution.data.shareToken)}`);
  return <AccessState title="This access link is unavailable" copy="Ask the person who shared this introduction to share a current access email." />;
}

function AccessState({ title, copy }: { title: string; copy: string }) {
  return <AccessShell title={title} copy={copy}><Link href="/received-a-link" className="dashboard-secondary-action mt-7 inline-flex min-h-11 items-center justify-center">Read the viewer guide</Link></AccessShell>;
}

function AccessShell({ title, copy, children }: { title: string; copy: string; children?: React.ReactNode }) {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center bg-[color:var(--workspace-canvas)] px-5 py-16 text-[color:var(--workspace-ink)]">
      <section className="w-full max-w-lg rounded-2xl border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface)] p-7 text-center shadow-sm sm:p-10">
        <div className="mb-6 flex justify-center"><VivIntroBrand variant="stacked" decorative displayWidth={146} priority /></div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--workspace-teal)]">Controlled access</p>
        <h1 className="mt-3 font-[family-name:var(--font-portfolio-display)] text-3xl font-medium">{title}</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-[color:var(--workspace-ink-muted)]">{copy}</p>
        {children}
      </section>
    </main>
  );
}
