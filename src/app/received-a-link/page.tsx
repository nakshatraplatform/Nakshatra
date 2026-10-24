import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";
import { MarketingBreadcrumb } from "@/components/marketing/StructuredData";

export const metadata: Metadata = { title: "Received a link?", description: "Read an introduction, show interest, and understand how private details are shared.", alternates: { canonical: "/received-a-link" } };

export default function ReceivedALinkPage() {
  return <PolicyLayout eyebrow="For viewers and families" title="Received a Vivara link? Here is what happens next." summary="You can read the public introduction without an account. Continue only if the introduction feels relevant to you and your family.">
    <MarketingBreadcrumb name="Received a link?" path="/received-a-link" />
    <PolicySection title="1. Read the introduction"><p>The link may have reached you directly or through a family member. Anyone with the active Vivara link can read its public view, so do not treat it as a secret. VivIntro does not list it in a public directory.</p></PolicySection>
    <PolicySection title="2. Show interest"><p>Tap Show interest, introduce yourself, and confirm your email. You can contact for yourself or a family member; you don’t need to create your own introduction. Email confirmation is not proof of identity.</p></PolicySection>
    <PolicySection title="3. Let them decide"><p>They’ll share more if they’d like to continue, or quietly set your interest aside. Details are shared for up to 15 days. Private notes stay private. They can stop sharing early or share for another 15 days.</p><p>To view shared details, sign in with the same email you used to show interest. If the introduction is unpublished, viewing pauses. Sharing can resume when it is published again if the sharing period has not ended and they have not stopped sharing. Being able to view someone’s details does not give permission to redistribute them.</p></PolicySection>
    <PolicySection title="Try the experience"><p><Link href="/demo" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">Open the fictional sample introduction</Link> to see the format without sharing any personal information.</p></PolicySection>
  </PolicyLayout>;
}
