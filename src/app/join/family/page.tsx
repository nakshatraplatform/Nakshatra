import { FamilyInvitationClient } from "./family-invitation-client";

export const metadata = {
  title: "Join as a family viewer · VivIntro",
  description: "Accept a private VivIntro family-viewer invitation.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function FamilyInvitationPage() {
  return <FamilyInvitationClient />;
}
