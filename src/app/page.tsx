import type { Metadata } from "next";
import { LandingExperience, landingFaqs } from "@/components/landing/LandingExperience";

export const metadata: Metadata = {
  title: { absolute: "VivIntro — Private Marriage Introductions You Control" },
  description:
    "Share one marriage introduction with any family. Your phone number, horoscope, and documents stay private until you approve each request.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "VivIntro — Private Marriage Introductions You Control",
    description:
      "One private introduction link. Contact details and documents stay protected until the owner approves access.",
  },
  twitter: {
    card: "summary_large_image",
    title: "VivIntro — Private Marriage Introductions You Control",
    description:
      "One private introduction link. Contact details and documents stay protected until the owner approves access.",
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
