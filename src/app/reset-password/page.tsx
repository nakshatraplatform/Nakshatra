import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset password · VivIntro",
  description: "Choose a new password for your VivIntro account.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({ searchParams }: { searchParams?: Promise<{ redirect?: string | string[] }> } = {}) {
  const returnTo = (await searchParams)?.redirect;
  return <ResetPasswordForm returnTo={typeof returnTo === "string" ? returnTo : undefined} />;
}
