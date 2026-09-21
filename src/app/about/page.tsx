import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  const founderName = process.env.VIVINTRO_FOUNDER_NAME?.trim();
  const founderUrl = process.env.VIVINTRO_FOUNDER_URL?.trim();
  return (
    <PolicyLayout
      eyebrow="About VivIntro"
      title="Consent infrastructure for private marriage introductions."
      summary="VivIntro is not a biodata generator or matchmaking directory. It separates a thoughtful first introduction from the sensitive information that should be disclosed only with permission."
    >
      <PolicySection title="The product idea">
        <p>Create one current introduction, share it through the family network you already use, and decide who can see contact details and private documents. The public link remains active until its owner unpublishes it.</p>
      </PolicySection>
      <PolicySection title="The design promise">
        <p>VivIntro uses readable typography, plain language, and explicit privacy cues. The person stays at the centre; approval and “set aside” decisions stay private and dignified.</p>
      </PolicySection>
      <PolicySection title="Who is building VivIntro">
        {founderName ? <p>VivIntro was founded by {founderUrl ? <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={founderUrl}>{founderName}</a> : <strong>{founderName}</strong>}. The product is being developed as an independently operated private pilot.</p> : <p>VivIntro is an independently built private pilot. A named founder profile will appear here when the operator details have been formally confirmed; VivIntro will not invent a biography or borrowed social proof in the meantime.</p>}
      </PolicySection>
      <PolicySection title="Contact">
        <p>Questions or feedback are welcome at <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href="mailto:hello@vivintro.com">hello@vivintro.com</a>.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
