import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";

export const metadata: Metadata = { title: "Received a VivIntro link?", description: "Read an introduction, show interest, and understand how private details are shared.", alternates: { canonical: "/received-a-link" } };

export default function ReceivedALinkPage() {
  return <PolicyLayout eyebrow="For viewers and families" title="Received a VivIntro link? Here is what happens next." summary="You can read the public introduction without an account. Continue only if the introduction feels relevant to you and your family.">
    <PolicySection title="1. Read the introduction"><p>The link may have reached you directly or through a family member. Anyone with the link can read this first view, so do not treat it as a secret. VivIntro does not list it in a public directory.</p></PolicySection>
    <PolicySection title="2. Show interest"><p>Tap Show interest, introduce yourself, and confirm your email. You can contact for yourself or a family member; you don’t need to create your own introduction. Email confirmation is not proof of identity.</p></PolicySection>
    <PolicySection title="3. Let them decide"><p>They can approve your interest or quietly set it aside. Approval lets you see the available private details for up to 15 days. Private notes stay private. They can end or renew your access.</p><p>When opening approved access, sign in with the same email you used to show interest. If the introduction is unpublished, viewing pauses. An approval that is still valid can resume when it is published again. Approval is permission to view, not permission to redistribute someone’s details.</p></PolicySection>
    <PolicySection title="Try the experience"><p><Link href="/demo" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">Open the fictional sample introduction</Link> to see the format without sharing any personal information.</p></PolicySection>
  </PolicyLayout>;
}
