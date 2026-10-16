import type { Metadata } from "next";
import { LandingExperience, landingFaqs } from "@/components/landing/LandingExperience";

const description = "Share your marriage biodata as one link you can update anytime. Your phone number and horoscope file stay hidden until you approve.";

export const metadata: Metadata = {
  title: { absolute: "Marriage biodata link you control | VivIntro" },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Your biodata, as one link you control.",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Your biodata, as one link you control.",
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
