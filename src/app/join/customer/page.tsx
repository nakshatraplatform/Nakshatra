import { CustomerInvitationClient } from "./customer-invitation-client";

export const metadata = {
  title: "Join your broker · VivIntro",
  description: "Accept a private VivIntro BrokerDesk customer invitation.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function CustomerInvitationPage() {
  return <CustomerInvitationClient />;
}

