import type { Metadata } from "next";
import { LandingExperience, landingFaqs } from "@/components/landing/LandingExperience";

export const metadata: Metadata = {
  title: { absolute: "Marriage Introduction Link | VivIntro" },
  description:
    "Share one up-to-date marriage introduction link instead of forwarding biodata PDFs. Keep contact details and horoscope files protected until you approve access.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "One Introduction. One Link. Always Current. | VivIntro",
    description:
      "Share one current marriage introduction. Keep contact details and horoscope files protected until you approve access.",
  },
  twitter: {
    card: "summary_large_image",
    title: "One Introduction. One Link. Always Current. | VivIntro",
    description:
      "Share one current marriage introduction. Keep contact details and horoscope files protected until you approve access.",
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
