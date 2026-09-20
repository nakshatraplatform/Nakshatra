import { getAuthenticatedUser } from "@/lib/auth";
import { BrokerdeskMfaClient } from "./brokerdesk-mfa-client";

export const metadata = {
  title: "Security check · VivIntro BrokerDesk",
  description: "Complete a private BrokerDesk security check.",
  robots: { index: false, follow: false },
};

export default async function BrokerdeskMfaPage() {
  await getAuthenticatedUser();
  return <BrokerdeskMfaClient />;
}
