import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";

export const metadata: Metadata = { title: "Received a VivIntro link?", description: "Understand what a VivIntro link shows and what happens if you request protected access.", alternates: { canonical: "/received-a-link" } };

export default function ReceivedALinkPage() {
  return <PolicyLayout eyebrow="For viewers and families" title="Received a VivIntro link? Here is what happens next." summary="You can read the public introduction without an account. Continue only if the introduction feels relevant to you and your family.">
    <PolicySection title="1. Read the introduction"><p>The link may have reached you directly or through a family member. Anyone with the link can read this first view, so do not treat it as a secret. VivIntro does not list it in a public directory.</p></PolicySection>
    <PolicySection title="2. Request protected access"><p>If you want to continue, confirm your email and send an access request. This tells the owner who is asking; email confirmation is not a full identity guarantee.</p></PolicySection>
    <PolicySection title="3. Respect the owner’s decision"><p>The owner can approve the request or set it aside privately. Approved access to protected details lasts 15 days and may be ended earlier.</p></PolicySection>
    <PolicySection title="Try the experience"><p><Link href="/demo" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">Open the fictional sample introduction</Link> to see the format without sharing any personal information.</p></PolicySection>
  </PolicyLayout>;
}
