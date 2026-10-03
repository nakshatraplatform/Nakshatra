import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getApiUser } from "@/lib/auth";
import { getPilotInvitationToken, isBrokerdeskAuthRedirect, sanitizeInternalRedirect } from "@/lib/security/redirect";

export const metadata = {
  title: "Pilot access · VivIntro",
  description: "Create a VivIntro portfolio with your private-beta invitation.",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] | undefined }>;
}) {
  const auth = await getApiUser();
  const requested = (await searchParams).redirect;
  const destination = sanitizeInternalRedirect(typeof requested === "string" ? requested : undefined);
  if (!isBrokerdeskAuthRedirect(destination) && !getPilotInvitationToken(destination)) redirect("/waitlist");
  if (auth.status === "authenticated") redirect(destination);

  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
