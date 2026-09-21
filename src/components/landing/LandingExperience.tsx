import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, ChevronDown, FileText, Globe2, LockKeyhole, MessageCircle, RefreshCw, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { PORTFOLIO_VIEW_LABELS } from "@/features/portfolio/template";
import { GuidedTour } from "./GuidedTour";
import styles from "./LandingExperience.module.css";

export type LandingVariant = "clarity" | "control" | "story";

const concepts = {
  clarity: { headline: "One introduction. One link. Always current.", lead: "VivIntro gives families one thoughtful marriage introduction to share—without sending another PDF. Update it anytime. Contact details, horoscope files, and other sensitive information stay protected until you approve access." },
  control: { headline: "Share an introduction. Keep personal details personal.", lead: "One private link gives families a thoughtful first introduction. You decide who can see the details that should not be forwarded freely." },
  story: { headline: "A more human way to make a marriage introduction.", lead: "Present the person, not another attachment. VivIntro keeps the story clear and disclosure under the owner’s control." },
} as const;

export const landingFaqs = [
  { question: "Who is VivIntro for?", answer: "VivIntro is for individuals and families who already exchange marriage introductions through relatives, friends, community networks, matchmakers, WhatsApp, or email—and want a more controlled alternative to forwarding biodata files." },
  { question: "Is VivIntro a matchmaking website?", answer: "No. VivIntro does not list profiles, recommend matches, or search on your behalf. It helps a person or family make a private introduction to people they already choose." },
  { question: "Is this a biodata or PDF maker?", answer: "No. A biodata or PDF is a file that can keep travelling after it is forwarded. VivIntro is a controlled introduction link: the public introduction stays current, while protected details require the owner’s approval." },
  { question: "Who can open a shared link?", answer: "Anyone who receives or is forwarded the link can read the public introduction. It is not listed in a VivIntro directory and is marked not to appear in search results. Do not treat a shared link as a secret." },
  { question: "What stays protected?", answer: "Contact details and owner-designated private information stay outside the public introduction. A viewer must confirm their email and request access; the owner can approve or set the request aside." },
  { question: "What does identity checked mean?", answer: "It means the introduction creator completed VivIntro’s hosted identity-check flow before publishing. It does not mean VivIntro guarantees every statement in the introduction or the suitability of a match." },
  { question: "How long does the link work?", answer: "The public introduction remains available until its owner unpublishes it. If the owner approves a viewer, protected access lasts 15 days and can be ended earlier." },
  { question: "Can I join now?", answer: "VivIntro is inviting people gradually during its private pilot. Request an invitation with verified contact details; creating an account or introduction begins only after an invitation is issued." },
] as const;

const problems = [
  { icon: FileText, title: "Old copies stay in circulation", body: "Correct one detail and another PDF must be sent. Recipients may still open or forward the earlier version." },
  { icon: MessageCircle, title: "Private information travels with the profile", body: "Phone numbers, photographs, family details, and horoscope files are often forwarded together before either side knows whether the introduction is relevant." },
  { icon: LockKeyhole, title: "A forwarded file cannot be updated", body: "Once an attachment leaves your phone, you cannot correct, replace, or withdraw that copy." },
] as const;

const values = [
  { icon: RefreshCw, label: "One current introduction", title: "Update without resending", body: "Publish a change and the same link shows the current version. Your family does not need to send another PDF." },
  { icon: LockKeyhole, label: "A protected next step", title: "Share the introduction first", body: "Contact details, horoscope files, and other sensitive information remain protected until you approve access." },
  { icon: UserCheck, label: "A private decision", title: "Approve or set aside", body: "Review an email-confirmed request privately. VivIntro does not publish rejection activity or pressure either family to respond." },
] as const;

const trustFacts = [
  { icon: ShieldCheck, title: "Can someone forward the link?", body: "Yes. Anyone who receives the link can forward and open the shared introduction. Protected details still require the owner’s approval." },
  { icon: Globe2, title: "Is this a matchmaking website?", body: "No. VivIntro has no searchable profile directory and does not recommend matches. You choose who receives the introduction." },
  { icon: Smartphone, title: "Does the viewer need an app?", body: "No. The introduction opens in a regular browser on a phone or computer." },
  { icon: BadgeCheck, title: "What does identity checked mean?", body: "It means the creator completed the required identity-check process. It does not guarantee every profile statement or the suitability of a match." },
] as const;

export function LandingExperience({ variant = "clarity" }: { variant?: LandingVariant }) {
  const concept = concepts[variant];
  return (
    <div className={`${styles.page} ${styles[variant]}`} data-landing-variant={variant}>
      <header className={styles.header}>
        <VivIntroBrand href="/" variant="horizontal" className={styles.brand} priority />
        <nav className={styles.navigation} aria-label="Main navigation">
          <ThemeSwitch />
          <div className={styles.navigationLinks}><a href="#how">How it works</a><a href="#privacy">Your privacy</a><Link href="/received-a-link">Received a link?</Link><a href="#questions">Questions</a></div>
          <Link href="/login" className={styles.signIn}>Sign in</Link><Link href="/waitlist" className={styles.primaryButton}>Request invitation</Link>
        </nav>
      </header>

      <main id="main-content">
        <section id="top" className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Private marriage introductions, shared with care</p><h1>{concept.headline}</h1><p className={styles.heroLead}>{concept.lead}</p>
            <div className={styles.heroActions}><Link href="/demo" className={styles.primaryButton}>View a sample introduction <ArrowRight aria-hidden="true" /></Link><Link href="/waitlist" className={styles.secondaryButton}>Request an invitation</Link></div>
            <p className={styles.heroNote}><Check aria-hidden="true" /> Private pilot · invitations are released gradually</p>
            <ul className={styles.heroAssurances} aria-label="VivIntro privacy assurances">
              <li><BadgeCheck aria-hidden="true" /><span><strong>Identity-checked creator</strong><small>Required before publication</small></span></li>
              <li><Globe2 aria-hidden="true" /><span><strong>Not searchable</strong><small>No public profile directory</small></span></li>
              <li><LockKeyhole aria-hidden="true" /><span><strong>Sensitive details stay protected</strong><small>Approval required for protected access</small></span></li>
            </ul>
          </div><PortfolioPreview />
        </section>

        <section id="why" className={styles.problemSection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>The familiar forwarding problem</p><h2>One introduction quickly becomes five different files.</h2><p className={styles.heroLead}>Marriage introductions already move through parents, relatives, friends, community groups, and matchmakers. But the information is usually shared as PDFs, photographs, phone numbers, and horoscope files. A correction creates another version, while personal information travels farther than the family intended.</p></div>
          <div className={styles.problemGrid}>{problems.map(({ icon: Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
        </section>

        <section id="privacy" className={styles.controlSection}>
          <div className={styles.controlIntro}><p className={styles.eyebrow}>What VivIntro changes</p><h2>The introduction can travel. Your private details do not have to.</h2><p>VivIntro separates the first introduction from the information that should be shared only when both sides want to continue. Anyone with the link can read the shared introduction; protected information is shown only after an email-confirmed request and the owner’s approval.</p><div className={styles.accessFlow}><span>Shared introduction</span><ArrowRight aria-hidden="true" /><span>Email-confirmed request</span><ArrowRight aria-hidden="true" /><strong>15-day approved access</strong></div></div>
          <div className={styles.controlGrid}>{values.map(({ icon: Icon, label, title, body }) => <article key={title}><Icon aria-hidden="true" /><span>{label}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          <div className={styles.trustFacts}><span><LockKeyhole aria-hidden="true" />Phone number stays out of the public view.</span><span><BadgeCheck aria-hidden="true" />The owner sees who is asking.</span><span><UserCheck aria-hidden="true" />Requests can be approved or set aside.</span><span><RefreshCw aria-hidden="true" />The owner can end access early.</span></div>
        </section>

        <GuidedTour />

        <section id="viewer" className={styles.familySection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>If you received a link</p><h2>Read the introduction first. Share your information only if you want to continue.</h2></div>
          <div className={styles.familyGrid}><article><span className={styles.eyebrow}>01</span><h3>Open the introduction</h3><p>No app or account is required to read the shared view.</p></article><article><span className={styles.eyebrow}>02</span><h3>Decide whether it feels relevant</h3><p>If you want to continue, confirm your email and request protected access.</p></article><article><span className={styles.eyebrow}>03</span><h3>Respect the owner’s decision</h3><p>The owner may approve the request or set it aside privately. Approved access lasts up to 15 days.</p></article><article><Link href="/received-a-link" className={styles.secondaryButton}>Read the viewer guide <ArrowRight aria-hidden="true" /></Link></article></div>
        </section>

        <section id="samples" className={styles.samplesSection}>
          <div className={styles.samplesHeading}><div className={styles.sectionHeading}><p className={styles.eyebrow}>See before you request an invitation</p><h2>Explore a complete fictional introduction.</h2></div><p>Meet Ananya Mehta and experience the same mobile-friendly introduction a family receives. See what is visible immediately, what remains protected, and what happens when a viewer wants to continue.</p></div>
          <div className={styles.betaActions}><Link href="/demo" className={styles.primaryButton}>View Ananya Mehta’s sample introduction <ArrowRight aria-hidden="true" /></Link><Link href="/received-a-link" className={styles.secondaryButton}>What happens as a viewer?</Link></div><p className={styles.sampleNote}>Ananya Mehta, her family, and every detail in this demonstration are fictional.</p>
        </section>

        <section id="trust" className={styles.familySection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Before you share</p><h2>What the link can—and cannot—protect.</h2></div>
          <div className={styles.familyGrid}>{trustFacts.map(({ icon: Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{body}</p></article>)}</div><div className={styles.betaActions}><Link href="/trust" className={styles.secondaryButton}>Read how VivIntro handles trust</Link><Link href="/privacy" className={styles.secondaryButton}>Privacy policy</Link></div>
        </section>

        <section id="beta" className={styles.betaSection}>
          <div className={styles.betaCopy}><p className={styles.eyebrow}>A considered private pilot</p><h2>Built for families with introductions already in motion.</h2><p>VivIntro is inviting a small number of individuals and families who already exchange marriage introductions through relatives, friends, community networks, or matchmakers. It is not a matrimonial marketplace. It is for families who know where an introduction should go—and want a better way to share it.</p></div>
          <div className={styles.betaDetails}><span><BadgeCheck aria-hidden="true" /><strong>One person remains in control</strong>Trusted family members can help shape the introduction without deciding who receives protected access.</span><span><MessageCircle aria-hidden="true" /><strong>Use the network you already trust</strong>Share through WhatsApp, email, relatives, or the matchmaker your family already uses.</span><span><UserCheck aria-hidden="true" /><strong>Designed to learn carefully</strong>The pilot is improving how clearly families understand each view and how confidently owners use the sharing controls.</span></div>
          <div className={styles.betaActions}><Link href="/waitlist" className={styles.primaryButton}>Request an invitation <ArrowRight aria-hidden="true" /></Link><Link href="/login" className={styles.secondaryButton}>Existing participant? Sign in</Link></div>
        </section>

        <section id="questions" className={styles.faqSection}><div className={styles.sectionHeading}><p className={styles.eyebrow}>Questions</p><h2>Know exactly what happens.</h2></div><div className={styles.faqList}>{landingFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></section>
        <section className={styles.finalCta}><div><p className={styles.eyebrow}>Private pilot</p><h2>One current introduction for the network you already trust.</h2><p>Request an invitation to share with more clarity and keep sensitive details under your control.</p></div><div className={styles.finalAction}><Link href="/waitlist" className={styles.lightButton}>Request an invitation <ArrowRight aria-hidden="true" /></Link><span>No account is created until you are invited.</span></div></section>
      </main>

      <footer className={styles.footer}><VivIntroBrand href="/" variant="full-symbol" className={styles.brand} /><p>A thoughtful way to share private marriage introductions.</p><div><Link href="/about">About</Link><Link href="/trust">Trust</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </div>
  );
}

function PortfolioPreview() {
  return <div className={styles.visual} aria-label="Example VivIntro introduction"><div className={styles.visualGlow} aria-hidden="true" /><div className={styles.floatingMessage}><ShieldCheck aria-hidden="true" /><span><strong>Protected details</strong>Approval required</span></div><article className={styles.portfolioCard}><header><span><VivIntroBrand variant="full-symbol" tone="primary" decorative displayWidth={20} /></span><span><ShieldCheck aria-hidden="true" /> {PORTFOLIO_VIEW_LABELS.detailed}</span></header><div className={styles.portfolioBody}><div className={styles.portrait}><span>AR</span></div><div className={styles.introduction}><span className={styles.verified}><BadgeCheck aria-hidden="true" /> Identity checked</span><p>A private introduction</p><h2>Ananya</h2><strong>Product designer · Bengaluru</strong><p>Thoughtful, curious, close to family, and always learning.</p></div></div><footer><span>Story</span><span>Journey</span><span>Family</span><span>Gallery</span></footer></article><div className={styles.previewLifecycle}><span><small>01 · Link shared</small><strong>Introduction</strong></span><ArrowRight aria-hidden="true" /><span><small>02 · Email confirmed</small><strong>Access request</strong></span><ArrowRight aria-hidden="true" /><span data-approved><small>03 · Owner decides</small><strong>Approve or set aside</strong></span></div></div>;
}
