import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";
import { allFaqs } from "@/content/landing";
import { MarketingBreadcrumb, StructuredData, marketingSchema } from "@/components/marketing/StructuredData";
export const metadata: Metadata = { title: "Questions about VivIntro", description: "Answers about your Vivara link, public and private details, publishing, liveness checks and sharing.", alternates: { canonical: "/faq" } };
export default function FaqPage() {
  return <PolicyLayout eyebrow="Questions" title="Before you create or share." summary="VivIntro is the product. Your Vivara is the link you share to your marriage introduction.">
    <MarketingBreadcrumb name="Questions" path="/faq" /><StructuredData value={marketingSchema(allFaqs)} />
    {allFaqs.map(faq => <PolicySection key={faq.question} title={faq.question}><p>{faq.answer}</p></PolicySection>)}
  </PolicyLayout>;
}
