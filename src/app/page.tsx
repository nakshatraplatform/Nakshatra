import type { Metadata } from "next";
import { LandingExperience, landingFaqs } from "@/components/landing/LandingExperience";

const description = "Create your Vivara, a personal page for marriage conversations. Share one current link and keep contact details private until you approve access.";

export const metadata: Metadata = {
  title: { absolute: "Vivara: your personal page for marriage | VivIntro" },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Share your story before you share your number.",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Share your story before you share your number.",
    description,
  },
};

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "VivIntro", url: "https://www.vivintro.com", email: "hello@vivintro.com" },
      { "@type": "WebSite", name: "VivIntro", url: "https://www.vivintro.com" },
      { "@type": "FAQPage", mainEntity: landingFaqs.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /><LandingExperience variant="clarity" /></>;
}
