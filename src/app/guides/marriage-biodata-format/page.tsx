import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";
import { MarketingBreadcrumb } from "@/components/marketing/StructuredData";

export const metadata: Metadata = {
  title: "Marriage biodata format: what to include and keep private",
  description: "A simple marriage biodata format for families: what to include, what can wait, and how to share an introduction with care using VivIntro.",
  alternates: { canonical: "/guides/marriage-biodata-format" },
};

export default function MarriageBiodataFormatGuide() {
  return <PolicyLayout
    eyebrow="A practical guide"
    title="Marriage biodata format: what to include and what to keep private"
    summary="Start with a clear introduction, not a complete personal dossier. You can share enough to begin a conversation and decide later whether to share more."
  >
    <MarketingBreadcrumb name="Marriage biodata format" path="/guides/marriage-biodata-format" />
    <PolicySection title="What to include">
      <p>A useful first view introduces the person in a few short parts:</p>
      <ol className="list-decimal space-y-2 pl-6">
        <li>Name and age, rather than an exact date of birth.</li>
        <li>Current city, state and country, rather than a street address.</li>
        <li>Education or work, in plain language.</li>
        <li>A brief description of interests, values and the kind of conversation you hope to start.</li>
        <li>A current photo you are comfortable sharing publicly.</li>
      </ol>
      <p>Family background, partner preferences and astrology can add context when relevant. Keep them concise and do not guess at details you do not know.</p>
    </PolicySection>
    <PolicySection title="What to keep private">
      <p>Do not put a home address, personal phone number, exact birth details, income or documents in the public introduction. Share sensitive information only if you are comfortable and have the person’s permission to use it.</p>
      <p>Anyone with an active link can read the public view, and recipients may forward or screenshot it. Choose the first view with that in mind. Copies already saved cannot be recalled.</p>
    </PolicySection>
    <PolicySection title="A simple order that is easy to read">
      <p>Lead with who you are and where you live. Follow with work or study, a few sentences about yourself, then optional family or preference details. Short, accurate answers are more useful than a long checklist.</p>
      <p>Ask a trusted family member to read it before sharing, while keeping the final choice of what to publish with the person whose introduction it is.</p>
    </PolicySection>
    <PolicySection title="How VivIntro helps you share it">
      <p>VivIntro is the product used to create your introduction. Your Vivara is the link you share. Saving edits keeps them in your private draft; publishing updates the public view at the same link.</p>
      <p>Private details stay separate. A viewer who wants to see more must sign in, confirm their email and Show interest; you decide whether to share. Email confirmation is not identity verification.</p>
      <p><Link href="/demo" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">See a sample introduction</Link> or <Link href="/signup" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">create your introduction</Link>. For more about the sharing boundary, <Link href="/faq" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">read the questions families ask</Link>.</p>
    </PolicySection>
  </PolicyLayout>;
}
