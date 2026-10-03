import type { Metadata } from "next";
import Link from "next/link";
import { getApiUser } from "@/lib/auth";
import { getPilotInvitationToken } from "@/lib/security/redirect";
import InviteAcceptanceClient from "./invite-acceptance-client";

export const metadata: Metadata = {
  title: "Private pilot invitation · VivIntro",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const safeToken = getPilotInvitationToken(`/invite/${token}`);
  const auth = await getApiUser();
  const path = `/invite/${safeToken}`;
  return <main className="min-h-screen bg-[light-dark(#f8f6f0,var(--app-dark-canvas))] px-4 py-16 text-[light-dark(#18272e,var(--app-dark-ink))]">
    <div className="mx-auto max-w-xl rounded-2xl border border-[light-dark(#d0d3ce,var(--app-dark-border))] bg-[light-dark(#fffdf8,var(--app-dark-surface))] p-6 shadow-sm sm:p-9">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[light-dark(#477b77,var(--app-dark-accent))]">VivIntro private pilot</p>
      <h1 className="mt-3 font-[family-name:var(--font-portfolio-display)] text-3xl">Your invitation</h1>
      {!safeToken ? <p className="mt-4">This invitation link is invalid. Ask the person who invited you for a new one.</p>
        : auth.status === "authenticated" ? <InviteAcceptanceClient token={safeToken} />
          : <>
            <p className="mt-4 text-sm leading-6">Use the exact email address that received this invitation. Google or email and password both work. Your portfolio will start as a private draft.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link className="dashboard-primary-action justify-center" href={`/signup?redirect=${encodeURIComponent(path)}`}>Create an account</Link>
              <Link className="dashboard-secondary-action justify-center" href={`/login?redirect=${encodeURIComponent(path)}`}>Sign in</Link>
            </div>
            {auth.status === "service_unavailable" ? <p role="alert" className="mt-4 text-sm">Sign-in status is temporarily unavailable. Please try again in a moment.</p> : null}
          </>}
    </div>
  </main>;
}
