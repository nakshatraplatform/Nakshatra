import { PageLoading } from "@/components/loading/PageLoading";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getApiUser } from "@/lib/auth";
import { sanitizeInternalRedirect } from "@/lib/security/redirect";

export const metadata = {
  title: "Sign in",
  description: "Sign in to manage your private VivIntro marriage introduction.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect?: string | string[] | undefined;
    method?: string | string[] | undefined;
  }>;
}) {
  const auth = await getApiUser();
  const params = await searchParams;
  const requested = params.redirect;
  const destination = sanitizeInternalRedirect(typeof requested === "string" ? requested : undefined);
  if (auth.status === "authenticated") redirect(destination);
  const googleOnly = destination === "/join/family" && params.method === "google";

  return (
    <Suspense fallback={<PageLoading title="Preparing sign-in" />}>
      <AuthForm mode="login" googleOnly={googleOnly} />
    </Suspense>
  );
}
