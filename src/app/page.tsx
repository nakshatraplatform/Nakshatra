import type { Metadata } from "next";
import { LandingExperience } from "@/components/landing/LandingExperience";

export const metadata: Metadata = {
  title: "VivIntro | Private Wedding Biodata Portfolio",
  description:
    "Create one current wedding biodata portfolio, share a Brief or Detailed Introduction, and approve who receives protected details in the Complete Portfolio. Invite-only private beta.",
  openGraph: {
    type: "website",
    url: "/",
    title: "VivIntro | One introduction. On your terms.",
    description:
      "A private wedding biodata portfolio with one current link and protected details shared only after approval.",
  },
  twitter: {
    card: "summary_large_image",
    title: "VivIntro | One introduction. On your terms.",
    description:
      "A private wedding biodata portfolio with one current link and protected details shared only after approval.",
  },
};

export default function Home() {
  return <LandingExperience variant="clarity" />;
}
