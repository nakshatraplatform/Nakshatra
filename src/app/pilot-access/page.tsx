import type { Metadata } from "next";
import PilotAccessClient from "./pilot-access-client";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description: "Join the VivIntro launch waitlist.",
};

export default function PilotAccessPage() {
  return <PilotAccessClient />;
}
