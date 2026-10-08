import { ThemeNavigation } from "@/components/theme/ThemeNavigation";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import type { Metadata } from "next";
import Link from "next/link";
import { getApiUser } from "@/lib/auth";
import { DashboardRepository } from "@/features/portfolio/server/dashboard.repository";
import { IdentityVerificationDashboard } from "@/features/identity-verification/client/identity-verification-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Verification submitted · VivIntro",
  robots: { index: false, follow: false },
};

/** Provider return parameters are deliberately not trusted or rendered; the protected provider process determines final state. */
export default async function VerificationResultPage() {
  const auth = await getApiUser();
  const portfolio = auth.status === "authenticated"
    ? await new DashboardRepository(auth.supabase).findPortfolioForUser(auth.user.id)
    : null;
  const candidateId = portfolio?.error ? null : portfolio?.data?.candidate_id;
  return (
    <main className="mx-auto max-w-xl px-6 py-20"><ThemeNavigation />
      <div className="my-8 flex justify-center"><VivIntroBrand variant="stacked" decorative displayWidth={146} priority /></div>
      <p className="site-eyebrow">Liveness check</p>
      <h1>Your liveness result</h1>
      <p>Returning from Didit does not confirm approval. We check the result securely before updating your portfolio.</p>
      {candidateId ? <IdentityVerificationDashboard candidateId={candidateId} checkResultOnLoad /> : <p>{auth.status === "authenticated" || auth.status === "service_unavailable"
        ? "We could not load your check here. Open your dashboard to check its status."
        : "Sign in to view your private result. If you used another device for the camera check, return to your signed-in dashboard."}</p>}
      <Link className="dashboard-primary-action mt-6" href={auth.status === "authenticated" ? "/dashboard" : "/login"}>{auth.status === "authenticated" ? "Return to dashboard" : "Sign in to view result"}</Link>
    </main>
  );
}
