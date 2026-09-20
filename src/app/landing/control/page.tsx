import type { Metadata } from "next";
import { LandingExperience } from "@/components/landing/LandingExperience";

export const metadata: Metadata = {
  title: "Privacy-first concept | VivIntro",
  robots: { index: false, follow: false },
};

export default function ControlLandingPage() {
  return <LandingExperience variant="control" />;
}
