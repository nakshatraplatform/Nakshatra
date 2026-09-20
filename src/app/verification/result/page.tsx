import { ThemeNavigation } from "@/components/theme/ThemeNavigation";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Verification submitted · VivIntro",
  robots: { index: false, follow: false },
};

/** Provider return parameters are deliberately not trusted or rendered; the protected provider process determines final state. */
export default function VerificationResultPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20"><ThemeNavigation />
      <div className="my-8 flex justify-center"><VivIntroBrand variant="stacked" decorative displayWidth={146} priority /></div>
      <p className="site-eyebrow">Identity verification</p>
      <h1>Verification submitted</h1>
      <p>Your identity-verification provider has received the session. This page does not determine the result.</p>
      <p>Use the private verification-management link you were given to check the current status or withdraw consent.</p>
    </main>
  );
}
