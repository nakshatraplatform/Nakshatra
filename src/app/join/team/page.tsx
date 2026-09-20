import { TeamInvitationClient } from "./team-invitation-client";

export const metadata = {
  title: "Join a BrokerDesk team · VivIntro",
  description: "Accept a private VivIntro BrokerDesk team invitation.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function TeamInvitationPage() {
  return <TeamInvitationClient />;
}
