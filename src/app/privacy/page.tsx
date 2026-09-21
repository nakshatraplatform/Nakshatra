import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  const grievanceEmail = process.env.VIVINTRO_GRIEVANCE_EMAIL?.trim() || "hello@vivintro.com";
  const grievanceContact = process.env.VIVINTRO_GRIEVANCE_CONTACT?.trim();
  return (
    <PolicyLayout
      eyebrow="Privacy"
      title="Your introduction should never reveal more than you intend."
      summary="This notice explains what VivIntro uses to create and share your introduction, what can become public, and the controls currently available to you."
    >
      <PolicySection title="Information you provide">
        <p>Depending on what you choose to complete, VivIntro may store identity and contact details, education and work information, family background, lifestyle and partner preferences, astrology details, photos, and an optional horoscope document.</p>
        <p>We use this information to save your private draft, create the introduction views you request, operate sharing controls, and maintain your account.</p>
      </PolicySection>

      <PolicySection title="Public, approved, and private information">
        <p>Your draft is private until you publish. A public introduction can be opened by anyone who receives its link, and recipients may forward that link.</p>
        <p>Exact birth details, direct contact information, income, and original horoscope documents are kept outside the public introduction. Light or Dark changes appearance; Balanced or Private changes how much the public introduction reveals.</p>
      </PolicySection>

      <PolicySection title="Storage and service providers">
        <p>VivIntro currently uses Supabase for authentication, database and file storage; Vercel for hosting; Didit for the hosted identity-check flow; Google when you choose Google sign-in; and Resend when transactional email delivery is enabled.</p>
        <p>VivIntro stores identity-check consent and verification status. Identity-document images and document numbers are handled in the hosted Didit flow and are not copied into VivIntro.</p>
        <p>Public pages are marked not to be indexed by search engines, but this cannot prevent a person who has the link from saving or forwarding what they can view.</p>
      </PolicySection>

      <PolicySection title="Your choices and requests">
        <p>You can edit a draft, change appearance and privacy mode, unpublish an introduction, or replace its public link. Public introductions remain active until you unpublish them; approved Complete Portfolio access lasts 15 days and can be ended earlier.</p>
        <p>Self-service account deletion is not available yet. To request access, correction, deletion, consent withdrawal, or help with a privacy concern, email <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a>.</p>
      </PolicySection>

      <PolicySection title="Privacy and grievance contact">
        <p>{grievanceContact ? `${grievanceContact} is the designated grievance contact for VivIntro.` : "VivIntro’s designated grievance-contact name will be published when formally appointed."} Privacy and grievance requests can be sent to <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a>.</p>
      </PolicySection>

      <PolicySection title="Age and safety">
        <p>VivIntro is intended for adults aged 18 and over. Do not upload another person&apos;s private information or documents unless you have their permission and are authorized to manage the introduction.</p>
      </PolicySection>

      <p className="text-sm text-[color:var(--workspace-ink-muted)]">Last updated: September 21, 2026.</p>
    </PolicyLayout>
  );
}
