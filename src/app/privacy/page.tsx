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
        <p>We use this information to save your private draft, create your public Introduction and approval-only Complete Portfolio, operate sharing controls, and maintain your account.</p>
        <p>After completing your portfolio details, you may optionally rate the onboarding experience, choose the step you found hardest, and leave a short comment. This feedback is kept separate from your portfolio, is never shown to viewers, and is available only to the VivIntro platform administrator to improve onboarding.</p>
      </PolicySection>

      <PolicySection title="Public, approved, and private information">
        <p>Your draft is private until you publish. A public introduction can be opened by anyone who receives its link, and recipients may forward that link.</p>
        <p>When you publish or update under the current pilot setup, the public Introduction shows your full name and Marital Status. It may also show the story, work, family, lifestyle, and selected astrology you entered. Older published links keep their previously reviewed snapshot until you publish an update. Exact birth details, direct contact information, income, and original horoscope documents are kept outside the public Introduction. Light or Dark changes appearance, not who can see your information.</p>
        <p>Someone can save or photograph information they can see, including protected details after you approve access. Ending access stops future viewing in VivIntro, but it cannot erase copies someone already made.</p>
      </PolicySection>

      <PolicySection title="Storage and service providers">
        <p>VivIntro currently uses Supabase for authentication, database and file storage; Vercel for hosting and privacy-focused, cookie-free traffic analytics on public marketing pages; Didit for hosted verification checks; Google when you choose Google sign-in; and Resend when transactional email delivery is enabled. Introduction links, account routes, and URL query strings are excluded from traffic analytics.</p>
        <p>The current self-created candidate flow uses Didit for camera liveness; it does not request an identity document, compare a portfolio photo, or verify legal identity. VivIntro stores consent and normalized results, not the live capture or IP reports. Separate broker verification may use different checks.</p>
        <p>Public pages are marked not to be indexed by search engines, but this cannot prevent a person who has the link from saving or forwarding what they can view.</p>
      </PolicySection>

      <PolicySection title="Retention">
        <p>VivIntro deletes anonymous viewer sessions after 90 days and introduction-view analytics after 395 days. Personal details on rejected or closed access requests are anonymized after 180 days. Security audit events are retained for up to 730 days, completed deletion receipts for 30 days, and provider-managed database backups have a 30-day retention target.</p>
      </PolicySection>

      <PolicySection id="corrections" title="Your choices and requests">
        <p>You can edit a draft, change appearance, unpublish an introduction, or replace its public link. Public introductions remain active until you unpublish them; approved access to protected details lasts 15 days and can be ended earlier.</p>
        <p>To correct profile information, open Dashboard → Portfolio details, edit the original answer, save, then review and publish your changes. Signed-in users can download an account export or schedule account deletion from <a href="/account" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">Account and Privacy</a> after a fresh sign-in. You can also request access, correction, deletion, consent withdrawal, or help with a privacy concern by emailing <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a>.</p>
      </PolicySection>

      <PolicySection title="Privacy and grievance contact">
        <p>{grievanceContact ? `${grievanceContact} is the designated grievance contact for VivIntro.` : "VivIntro’s designated grievance-contact name will be published when formally appointed."} Privacy and grievance requests can be sent to <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a>.</p>
      </PolicySection>

      <PolicySection title="Age and safety">
        <p>VivIntro is intended for adults aged 18 and over. Do not upload another person&apos;s private information or documents unless you have their permission and are authorized to manage the introduction.</p>
      </PolicySection>

      <p className="text-sm text-[color:var(--workspace-ink-muted)]">Last updated: October 7, 2026. Pilot wording is subject to legal review.</p>
    </PolicyLayout>
  );
}
