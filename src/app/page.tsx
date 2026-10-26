import type { Metadata } from "next";
import { LandingExperience } from "@/components/landing/LandingExperience";
import { landingDescription, landingTitle, landingConcepts, landingFaqs } from "@/content/landing";
import { StructuredData, marketingSchema } from "@/components/marketing/StructuredData";
export const metadata: Metadata = {
  title: { absolute: landingTitle }, description: landingDescription,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", title: landingConcepts.clarity.headline, description: landingDescription },
  twitter: { card: "summary_large_image", title: landingConcepts.clarity.headline, description: landingDescription },
};
export default function Home() {
  return <><StructuredData value={marketingSchema(landingFaqs)} /><LandingExperience variant="clarity" /></>;
}
