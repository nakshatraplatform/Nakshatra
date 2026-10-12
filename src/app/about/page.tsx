import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";

export const metadata: Metadata = { title: "About", description: "Why VivIntro separates a current marriage Introduction from owner-approved personal details, and how to contact the team.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  const founderName = process.env.VIVINTRO_FOUNDER_NAME?.trim();
  const founderUrl = process.env.VIVINTRO_FOUNDER_URL?.trim();
  return (
    <PolicyLayout
      eyebrow="About VivIntro"
      title="A more thoughtful way to share marriage introductions."
      summary="VivIntro helps people create a marriage portfolio, share an Introduction through their existing family network, and decide when to release protected details."
    >
      <PolicySection title="The product idea">
        <p>A relative asks for updated biodata. Another asks for contact details or a horoscope. VivIntro keeps the first introduction at one current link and lets you handle requests for more from your dashboard. It does not list profiles or recommend matches.</p>
      </PolicySection>
      <PolicySection title="The design promise">
        <p>VivIntro uses readable typography, plain language, and explicit privacy cues. The person stays at the centre; approval and “set aside” decisions stay private and dignified.</p>
      </PolicySection>
      <PolicySection title="Who is building VivIntro">
        {founderName ? <p>VivIntro was founded by {founderUrl ? <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={founderUrl}>{founderName}</a> : <strong>{founderName}</strong>}. We are developing the product around feedback from people sharing marriage introductions.</p> : <p>We are developing VivIntro around the practical steps of sharing a marriage introduction: writing it, keeping it current, and deciding when to share more. Questions and product feedback reach the team at the address below.</p>}
      </PolicySection>
      <PolicySection title="Contact">
        <p>Questions or feedback are welcome at <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href="mailto:hello@vivintro.com">hello@vivintro.com</a>.</p>
      </PolicySection>
    </PolicyLayout>
  );
}
