type Question = { readonly question: string; readonly answer: string };
const site = "https://www.vivintro.com";

/** Static public marketing data only, never an introduction snapshot. */
export function StructuredData({ value }: { value: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, "\\u003c") }} />;
}
export function marketingSchema(questions: readonly Question[]) {
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": site + "/#organization", name: "VivIntro", url: site, logo: site + "/brand/vivintro/vivintro-lockup-stacked-primary-og.png", email: "hello@vivintro.com" },
    { "@type": "WebSite", name: "VivIntro", url: site },
    { "@type": "WebApplication", name: "VivIntro", url: site, applicationCategory: "LifestyleApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "INR" } },
    { "@type": "FAQPage", mainEntity: questions.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
  ] };
}
export function MarketingBreadcrumb({ name, path }: { name: string; path: string }) {
  return <StructuredData value={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "VivIntro", item: site },
    { "@type": "ListItem", position: 2, name, item: site + path },
  ] }} />;
}
