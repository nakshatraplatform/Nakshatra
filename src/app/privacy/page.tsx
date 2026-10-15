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
        <p>We use this information to save your private draft, create your public Introduction and owner-approved Complete Portfolio, operate your personal sharing controls, and maintain your account. The sharing descriptions below cover the portfolio you create and share through your own VivIntro link.</p>
        <p>After completing your portfolio details, you may optionally rate the onboarding experience, choose the step you found hardest, and leave a short comment. This feedback is kept separate from your portfolio, is never shown to viewers, and is available only to the VivIntro platform administrator to improve onboarding.</p>
      </PolicySection>

      <PolicySection title="Creating and publishing your portfolio">
        <p>Your saved draft is private. Saving answers, opening a preview, or editing a published portfolio does not publish those changes. Review the public Introduction and Complete Portfolio previews, complete the publication steps, and confirm before publishing.</p>
        <p>Publishing makes the reviewed version available through your personal link. Later draft edits stay private until you publish an update. The link stays the same when you publish an update, so people with that link can see the updated published information.</p>
      </PolicySection>

      <PolicySection title="Public, approved, and owner-only information">
        <p>Your public Introduction can be opened without an account by anyone who receives its link, and recipients may forward that link.</p>
        <p>When you publish or update under the current pilot setup, the public Introduction shows your full name, age, and Marital Status. It may also show the story, work, family, lifestyle, and selected astrology you entered. Photos follow the sharing settings you review before publishing. Exact birth details, contact fields, income fields, and original horoscope documents are kept outside the public Introduction. Keep private details out of answers that appear in your public story. Light or Dark changes appearance, not who can see your information.</p>
        <p>Your Complete Portfolio is available to a signed-in viewer only after you approve their request. It can include contact details, exact birth details, family, work and income information, protected photo originals, and an optional horoscope file, as shown in your preview. Complete does not mean every saved field: street address fields, secure contact notes, and private preference notes stay out of both shared views.</p>
        <p>Someone can save or photograph information they can see, including protected details after you approve access. Ending access stops future portfolio viewing in VivIntro, but it cannot erase copies someone already made. Temporary file links already issued may remain usable until they expire.</p>
      </PolicySection>

      <PolicySection title="Interest requests and approved access">
        <p>A viewer signs in and confirms their email before requesting protected access. The request shares the details they submit, such as their name, contact information, family context, and message, with the portfolio owner. Submit another person&apos;s details only with their permission.</p>
        <p>You can approve a request or set it aside. Personal Complete Portfolio access lasts 15 days from approval; you can renew it for another 15 days or revoke it earlier. The approval belongs to the signed-in requester, so forwarding the link does not give another account protected access.</p>
        <p>Access expiry or revocation does not itself delete the submitted request. Request records have a separate retention schedule, described below.</p>
      </PolicySection>

      <PolicySection title="Storage and service providers">
        <p>VivIntro currently uses Supabase for authentication, database and file storage; Vercel for hosting and privacy-focused, cookie-free traffic analytics on public marketing pages; Didit for hosted verification checks; Google when you choose Google sign-in; and Resend when transactional email delivery is enabled. Introduction links, account routes, and URL query strings are excluded from traffic analytics.</p>
        <p>The current self-created candidate flow uses Didit for camera liveness; it does not request an identity document, compare a portfolio photo, or verify legal identity. VivIntro stores consent and normalized results, not the live capture or IP reports. Separate broker verification may use different checks.</p>
        <p>Personal Introduction pages are marked not to be indexed by search engines; public marketing pages can appear in search results. This indexing instruction cannot prevent a person who has an Introduction link from saving or forwarding what they can view.</p>
      </PolicySection>

      <PolicySection id="retention" title="How long information is kept">
        <p>A viewer&apos;s 15-day Complete Portfolio access period controls how long they can view protected information. When it expires, their submitted request stays in your request history. Revoking access also does not delete the request.</p>
        <p>The cleanup rules below cover different records for different reasons. These periods do not set an expiry date for your account or saved portfolio. Unpublishing pauses sharing; it does not delete your saved information.</p>
        <dl className="space-y-4">
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Abuse-control counters — 2 days after their last update</dt>
            <dd>Short-lived counts help limit repeated or abusive requests. They are separate from your portfolio answers.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Viewer-session records — 90 days after a visit session starts</dt>
            <dd>Technical records group visits to an Introduction. Removing a viewer-session record does not delete a viewer&apos;s account or submitted request.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Portfolio activity — 395 days after each event</dt>
            <dd>View and activity records support roughly 13 months of portfolio trends. This is separate from analytics on our public marketing pages.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Rejected or closed requests — personal details cleared after 180 days without an update</dt>
            <dd>The cleanup rule clears the requester&apos;s name, contact details, family context, message, and account link, while retaining the request&apos;s status and history record. This rule does not automatically clear open or approved requests. An approval expiring after 15 days does not start this cleanup period or close the request.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Portfolio access logs — 730 days after each event</dt>
            <dd>These records help investigate access and sharing disputes, including approvals, renewals, revocations, and link changes. They contain event times and related account or request references, rather than a full copy of your portfolio. This period does not apply to every kind of application log.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Completed deletion receipts — a 30-day retention window</dt>
            <dd>A short operational record supports deletion follow-up and retries. It is separate from the portfolio being deleted.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Database backups — a 30-day provider-managed target</dt>
            <dd>Recovery copies are managed by our hosting provider, separately from cleanup in the live application. This is a retention target, not a promise that every backup is erased immediately when you delete information.</dd>
          </div>
        </dl>
        <p>These are the application&apos;s configured cleanup rules. Production cleanup execution and the provider&apos;s backup settings still require verification; the periods above should not be read as confirmed deletion deadlines. Account-deletion requests and Didit&apos;s handling of verification captures follow separate processes.</p>
      </PolicySection>

      <PolicySection id="corrections" title="Your choices and requests">
        <p>You can edit and save a draft, review and publish updates, change appearance, unpublish an Introduction, or replace its public link. Publishing an update does not cancel approvals that remain unexpired and unrevoked; those viewers can see the updated Complete Portfolio. Review what you are sharing before each publication.</p>
        <p>Unpublishing pauses public and approved viewing but preserves requests and approvals. If you publish again, approvals that remain unexpired and unrevoked can resume. Revoke an approval or replace the public link to end that access; replacing the link invalidates the old URL and revokes its existing approvals. Unpublishing is not the same as deleting your account or saved portfolio.</p>
        <p>To correct profile information, open Dashboard → Portfolio details, edit the original answer, save, then review and publish your changes. Signed-in users can download an account export or schedule account deletion from <a href="/account" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">Account and Privacy</a> after a fresh sign-in. You can also request access, correction, deletion, consent withdrawal, or help with a privacy concern by emailing <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a>.</p>
      </PolicySection>

      <PolicySection title="Privacy and grievance contact">
        <p>{grievanceContact ? `${grievanceContact} is the designated grievance contact for VivIntro.` : "VivIntro’s designated grievance-contact name will be published when formally appointed."} Privacy and grievance requests can be sent to <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a>.</p>
      </PolicySection>

      <PolicySection title="Age and safety">
        <p>VivIntro is intended for adults aged 18 and over. Do not upload another person&apos;s private information or documents unless you have their permission and are authorized to manage the introduction.</p>
      </PolicySection>

      <p className="text-sm text-[color:var(--workspace-ink-muted)]">Last updated: October 14, 2026. Pilot wording is subject to legal review.</p>
    </PolicyLayout>
  );
}
