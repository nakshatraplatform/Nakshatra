import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout, PolicySection } from "@/components/legal/PolicyLayout";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  const grievanceEmail = process.env.VIVINTRO_GRIEVANCE_EMAIL?.trim() || "nakshathra.platform@gmail.com";
  const grievanceContact = process.env.VIVINTRO_GRIEVANCE_CONTACT?.trim() || "Nagarjun Mallesh and Rahul Gollapalli Rangnatha";
  return (
    <PolicyLayout
      eyebrow="Privacy"
      title="Your introduction should never reveal more than you intend."
      summary="This notice explains what VivIntro uses to create and share your introduction, what can become public, and the controls currently available to you."
    >
      <PolicySection title="Information you provide">
        <p>VivIntro is designed for Indians living in India and abroad who are exploring arranged marriage. India is the primary market; the initial launch countries are India and the United States.</p>
        <p>Depending on what you choose to complete, VivIntro may store identity and contact details, education and work information, family background, lifestyle and partner preferences, astrology details, photos, and an optional horoscope document.</p>
        <p>We use this information to save your private draft, create your public Introduction and owner-approved Complete Portfolio, operate your personal sharing controls, and maintain your account. The sharing descriptions below cover the portfolio you create and share through your own VivIntro link.</p>
        <p>After completing your portfolio details, you may optionally rate the onboarding experience, choose the step you found hardest, and leave a short comment. This feedback is kept separate from your portfolio, is never shown to viewers, and is available only to the VivIntro platform administrator to improve onboarding.</p>
      </PolicySection>

      <PolicySection title="Creating and publishing your portfolio">
        <p>Your saved draft is private. Saving answers, opening a preview, or editing a published introduction does not publish those changes. Complete the publishing checks and give explicit consent in Review and publish. You can open either preview if you wish; previews are optional.</p>
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

      <PolicySection id="providers" title="Storage and service providers">
        <p>VivIntro uses Supabase for account authentication, portfolio records, and file storage; Vercel for hosting and marketing-page analytics; Google when you choose Google sign-in; and Resend for transactional emails when delivery is enabled. Email delivery involves sharing the recipient address and message content with the email provider.</p>
        <p>Our page-view analytics filter allows public marketing pages and removes URL query strings and fragments. It excludes Introduction links and account routes from those page-view events. This filter is not a claim that no scripts or technical requests load elsewhere in the application. See <a href="#browser-storage" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">cookies and browser storage</a> for the distinction between analytics and sign-in cookies.</p>
        <p>Personal Introduction pages are marked not to be indexed by search engines; public marketing pages can appear in search results. This indexing instruction cannot prevent a person who has an Introduction link from saving or forwarding what they can view.</p>
      </PolicySection>

      <PolicySection id="location-search" title="Location search and manual entry">
        <p>When you use location search, VivIntro sends the search input through its server to a lookup provider to suggest a country, state, and city. A six-digit Indian PIN can be sent to PostalPincode (api.postalpincode.in); a United States ZIP lookup sends the first five digits to Zippopotam.us. When Google Places is configured, a search or fallback can send your input, country filter, and a randomly generated lookup-session identifier to Google. Selecting a Google suggestion can also send its place identifier to resolve location details.</p>
        <p>These lookup requests do not include your full portfolio or sign-in credentials. They are separate from saving the location you choose in VivIntro. Avoid entering names or private notes into location search. Choose <strong>Enter location manually</strong> before typing a search to enter your location without these external lookup requests; manual entry also remains available when a provider cannot return a match.</p>
      </PolicySection>

      <PolicySection id="liveness" title="Liveness checks and provider handling">
        <p>The current self-created candidate flow uses Didit for camera liveness. It does not request an identity document, compare a portfolio photo, or verify legal identity, age, marital status, or the accuracy of profile details. VivIntro stores consent and normalized check results, not the live camera capture or IP reports.</p>
        <p>Didit processes the camera capture and may process biometric signals and technical data on its hosted verification pages. VivIntro not storing camera evidence does not mean Didit never processes or retains it. Read Didit&apos;s <a href="https://didit.me/terms/verification-privacy-notice/" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">verification privacy notice</a> and <a href="https://didit.me/terms/biometric-data-policy/" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">biometric retention policy</a> before starting.</p>
        <p>The application has a background process for requesting deletion of provider sessions without retaining face embeddings. A queued request is not proof that deletion has completed; provider failures can delay cleanup. If you delete your account while provider cleanup is pending, we retain only the provider references needed to finish that cleanup separately from your deleted portfolio. Those references are removed when provider deletion is confirmed. The deployed provider settings, data-use choices, processing locations, and completed cleanup still require verification, so we do not promise an immediate or fixed provider-erasure deadline here.</p>
        <p>You can choose not to start a liveness check, but a completed check is required for personal portfolio publication. If you need help withdrawing consent, requesting deletion, or challenging a result, contact <a href={`mailto:${grievanceEmail}`} className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">{grievanceEmail}</a>. Contacting support does not by itself approve a check or bypass publication safeguards.</p>
      </PolicySection>

      <PolicySection id="browser-storage" title="Cookies and browser storage">
        <p>The personal portfolio flow uses cookies to support sign-in and sensitive account actions, and local storage to remember your appearance preference. Cookie-free analytics does not mean the whole application is cookie-free.</p>
        <p>To prevent an old Introduction link from later pointing to a different person, we retain a one-way fingerprint of each issued link indefinitely, including after account deletion. This reservation has no account reference or portfolio content. Name-based link fingerprints can still be guessed from names; they are not anonymous records.</p>
        <dl className="space-y-4">
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Sign-in cookies — Supabase</dt>
            <dd>These keep your sign-in session available to VivIntro in the browser and on the server. Temporary sign-in checks also use cookies during the return from an email or Google sign-in. The current client sets a browser lifetime of up to 400 days when writing authentication cookies, and session refresh can renew them. This is not a promise that an account session or access token stays valid that long: sign-out, revocation, server rules, and browser limits can end access earlier.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Account-deletion security cookies — 10 minutes each</dt>
            <dd>VivIntro uses short-lived cookies to connect a fresh sign-in to a deletion request and prove that confirmation belongs to the same browser. They are cleared as the relevant steps complete or expire. These are not tracking or marketing cookies.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Light or Dark preference — local storage</dt>
            <dd>The <code>nakshatra-app-theme</code> entry remembers your chosen appearance on this browser. It has no automatic application expiry and stays until replaced or cleared. It does not change your portfolio&apos;s sharing permissions.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--workspace-ink)]">Marketing-page analytics — Vercel</dt>
            <dd>Vercel describes Web Analytics as cookie-free. Our configured page-view filter limits the pages and URL information sent, as described above. Cookie-free processing can still involve technical request data; see <a href="https://vercel.com/docs/analytics/privacy-policy" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">Vercel&apos;s analytics privacy explanation</a>.</dd>
          </div>
        </dl>
        <p>You can remove cookies and local storage through your browser&apos;s site-data settings. This may sign you out or reset appearance preferences; it does not delete your account, submitted requests, or portfolio. Blocking sign-in cookies may prevent account features from working. Pages hosted by Google or Didit can use their own cookies or storage under their notices.</p>
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
        <p>To correct profile information, open Dashboard → Introduction details, edit the original answer, save, then review and publish your changes. Manage your devices or request deletion from <Link href="/account" className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">Account settings</Link>; deletion requires a fresh sign-in and confirmation. To request a copy of your data, correction, deletion, consent withdrawal, or help with a privacy concern, email <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a>. We may need to confirm that a request relates to your account before disclosing information or taking action. Do not send passwords, sign-in codes, camera captures, or another person&apos;s private details in a support message.</p>
      </PolicySection>

      <PolicySection title="Privacy and grievance contact">
        <p>Privacy and grievance requests are handled by {grievanceContact}. You can contact them at <a className="font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4" href={`mailto:${grievanceEmail}`}>{grievanceEmail}</a>.</p>
      </PolicySection>

      <PolicySection title="Age and safety">
        <p>VivIntro is intended for adults aged 18 and over. Do not upload another person&apos;s private information or documents unless you have their permission and are authorized to manage the introduction.</p>
      </PolicySection>

      <p className="text-sm text-[color:var(--workspace-ink-muted)]">Last updated: October 15, 2026. Pilot wording is subject to legal review.</p>
    </PolicyLayout>
  );
}
