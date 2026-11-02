import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";
import { MarketingBreadcrumb } from "@/components/marketing/StructuredData";

export const metadata: Metadata = { title: "Received a link?", description: "Read a VivIntro marriage introduction and show interest without creating an account.", alternates: { canonical: "/received-a-link" } };

export default function ReceivedALinkPage() {
  return <PolicyLayout eyebrow="For viewers and families" title="Received a Vivara link? Here is what happens next." summary="You can read the public introduction without an account. Continue only if the introduction feels relevant to you and your family.">
    <MarketingBreadcrumb name="Received a link?" path="/received-a-link" />
    <PolicySection title="1. Read the introduction"><p>The link may have reached you directly or through a family member. Anyone with the active Vivara link can read its public view, so do not treat it as a secret. VivIntro does not list it in a public directory.</p></PolicySection>
    <PolicySection title="2. Show interest"><p>Tap Show interest, introduce yourself, and confirm your email with a code. You can contact for yourself or a family member. This does not create an account or sign you in. Email confirmation is not proof of identity.</p></PolicySection>
    <PolicySection title="3. Let them decide"><p>The owner may approve full portfolio viewing for 15 days or set your interest aside. If approved, you receive a viewing link. Refreshing the Vivara in your verified browser also opens the approved view. On another device, verify the same email again. Forwarding the URL alone does not transfer access.</p></PolicySection>
    <PolicySection title="Try the experience"><p><Link href="/demo" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">Open the fictional sample introduction</Link> to see the format without sharing any personal information.</p></PolicySection>
  </PolicyLayout>;
}
