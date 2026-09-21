import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, ChevronDown, FileText, Globe2, LockKeyhole, MessageCircle, RefreshCw, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { PORTFOLIO_VIEW_LABELS } from "@/features/portfolio/template";
import { GuidedTour } from "./GuidedTour";
import styles from "./LandingExperience.module.css";

export type LandingVariant = "clarity" | "control" | "story";

const concepts = {
  clarity: { headline: "Your introduction and your phone number shouldn’t travel together.", lead: "VivIntro gives Indian families one private introduction link to share—while contact details, horoscope files, and other sensitive information stay closed until you approve a request." },
  control: { headline: "Share an introduction. Keep personal details personal.", lead: "One private link gives families a thoughtful first introduction. You decide who can see the details that should not be forwarded freely." },
  story: { headline: "A more human way to make a marriage introduction.", lead: "Present the person, not another attachment. VivIntro keeps the story clear and disclosure under the owner’s control." },
} as const;

export const landingFaqs = [
  { question: "Is VivIntro a matchmaking website?", answer: "No. VivIntro does not list profiles, recommend matches, or search on your behalf. It helps a person or family make a private introduction to people they already choose." },
  { question: "Is this a biodata or PDF maker?", answer: "No. A biodata or PDF is a file that can keep travelling after it is forwarded. VivIntro is a controlled introduction link: the public introduction stays current, while protected details require the owner’s approval." },
  { question: "Who can open a shared link?", answer: "Anyone who receives or is forwarded the link can read the public introduction. It is not listed in a VivIntro directory and is marked not to appear in search results. Do not treat a shared link as a secret." },
  { question: "What stays protected?", answer: "Contact details and owner-designated private information stay outside the public introduction. A viewer must confirm their email and request access; the owner can approve or set the request aside." },
  { question: "What does identity checked mean?", answer: "It means the portfolio owner completed VivIntro’s hosted identity-check flow before publishing. It does not mean VivIntro guarantees every statement in the portfolio or the suitability of a match." },
  { question: "How long does the link work?", answer: "The public introduction remains available until its owner unpublishes it. If the owner approves a viewer, Complete Portfolio access lasts 15 days and can be ended earlier." },
  { question: "Can I join now?", answer: "VivIntro is inviting people gradually during its private pilot. Request an invitation with verified contact details; creating an account or portfolio begins only after an invitation is issued." },
] as const;

const problems = [
  { icon: FileText, title: "Files go stale", body: "A correction creates another version, while older copies continue to circulate." },
  { icon: MessageCircle, title: "Details travel together", body: "A biodata, photos, phone number, and horoscope are often forwarded as one bundle." },
  { icon: LockKeyhole, title: "Forwarding cannot be undone", body: "VivIntro cannot stop someone from forwarding a link—but it can keep sensitive details out of the first view." },
] as const;

const values = [
  { icon: RefreshCw, label: "One current link", title: "Update once", body: "Publish a change and the same link shows the current introduction. No replacement PDF." },
  { icon: LockKeyhole, label: "Controlled disclosure", title: "Separate introduction from access", body: "Your public introduction can travel without carrying your contact details with it." },
  { icon: UserCheck, label: "A dignified decision", title: "Approve or set aside", body: "Review a verified-email request privately. There is no awkward public rejection." },
] as const;

const trustFacts = [
  { icon: BadgeCheck, title: "Identity check before publishing", body: "Creators complete a hosted identity check. VivIntro stores the consent and verification result—not identity document images or numbers." },
  { icon: Globe2, title: "No public directory", body: "Portfolios are not browsable on VivIntro and are marked not to appear in search results." },
  { icon: ShieldCheck, title: "Honest sharing boundary", body: "Anyone with a forwarded link can see the public introduction. Protected details still require approval." },
  { icon: Smartphone, title: "Made for family sharing", body: "Readable on a phone, open in a browser, and easy for different generations to understand." },
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
            <div className={styles.heroActions}><Link href="/demo" className={styles.primaryButton}>See a real introduction <ArrowRight aria-hidden="true" /></Link><Link href="/waitlist" className={styles.secondaryButton}>Request an invitation</Link></div>
            <p className={styles.heroNote}><Check aria-hidden="true" /> Private pilot · invitations are released gradually</p>
            <ul className={styles.heroAssurances} aria-label="VivIntro privacy assurances">
              <li><BadgeCheck aria-hidden="true" /><span><strong>Identity-checked creator</strong><small>Required before publication</small></span></li>
              <li><Globe2 aria-hidden="true" /><span><strong>Not searchable</strong><small>No public profile directory</small></span></li>
              <li><LockKeyhole aria-hidden="true" /><span><strong>Private details stay closed</strong><small>Approval required for protected access</small></span></li>
            </ul>
          </div><PortfolioPreview />
        </section>

        <section id="why" className={styles.problemSection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>The forwarding problem</p><h2>A PDF does its job. Then it keeps going.</h2><p className={styles.heroLead}>Marriage introductions move through trusted family networks. The format should respect that reality without sending every private detail along for the ride.</p></div>
          <div className={styles.problemGrid}>{problems.map(({ icon: Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
        </section>

        <section id="privacy" className={styles.controlSection}>
          <div className={styles.controlIntro}><p className={styles.eyebrow}>Introduction first. Disclosure by consent.</p><h2>Let the link travel. Keep sensitive details under your control.</h2><p>Anyone with the link can read the first introduction. Contact details and private documents are shown only after a viewer confirms their email and the owner approves the request.</p><div className={styles.accessFlow}><span>Shared introduction</span><ArrowRight aria-hidden="true" /><span>Verified-email request</span><ArrowRight aria-hidden="true" /><strong>15-day approved access</strong></div></div>
          <div className={styles.controlGrid}>{values.map(({ icon: Icon, label, title, body }) => <article key={title}><Icon aria-hidden="true" /><span>{label}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          <div className={styles.trustFacts}><span><LockKeyhole aria-hidden="true" />Phone number stays out of the public view.</span><span><BadgeCheck aria-hidden="true" />The owner sees who is asking.</span><span><UserCheck aria-hidden="true" />Requests can be approved or set aside.</span><span><RefreshCw aria-hidden="true" />The owner can end access early.</span></div>
        </section>

        <GuidedTour />

        <section id="viewer" className={styles.familySection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>If you received a link</p><h2>You can understand the introduction before sharing anything of your own.</h2></div>
          <div className={styles.familyGrid}><article><span className={styles.eyebrow}>01</span><h3>Open the introduction</h3><p>No app or account is needed to read the public view.</p></article><article><span className={styles.eyebrow}>02</span><h3>Choose whether to continue</h3><p>If it feels relevant, request protected access with a confirmed email.</p></article><article><span className={styles.eyebrow}>03</span><h3>Wait for the owner’s decision</h3><p>The owner may approve the request or set it aside privately.</p></article><article><Link href="/received-a-link" className={styles.secondaryButton}>Read the viewer guide <ArrowRight aria-hidden="true" /></Link></article></div>
        </section>

        <section id="samples" className={styles.samplesSection}>
          <div className={styles.samplesHeading}><div className={styles.sectionHeading}><p className={styles.eyebrow}>See the actual experience</p><h2>Meet Ananya—our fictional demo portfolio.</h2></div><p>Explore the same responsive format a family receives, including the boundary between the public introduction and protected details. No form in the demo sends personal data.</p></div>
          <div className={styles.betaActions}><Link href="/demo" className={styles.primaryButton}>Open the demo portfolio <ArrowRight aria-hidden="true" /></Link><Link href="/received-a-link" className={styles.secondaryButton}>What happens as a viewer?</Link></div><p className={styles.sampleNote}>Ananya and every detail in the demo are fictional.</p>
        </section>

        <section id="trust" className={styles.familySection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Trust, explained plainly</p><h2>Clear boundaries are more useful than broad promises.</h2></div>
          <div className={styles.familyGrid}>{trustFacts.map(({ icon: Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{body}</p></article>)}</div><div className={styles.betaActions}><Link href="/trust" className={styles.secondaryButton}>Read how VivIntro handles trust</Link><Link href="/privacy" className={styles.secondaryButton}>Privacy policy</Link></div>
        </section>

        <section id="beta" className={styles.betaSection}>
          <div className={styles.betaCopy}><p className={styles.eyebrow}>A considered private pilot</p><h2>Small by design. Open by invitation.</h2><p>VivIntro is admitting creators gradually so the consent, sharing, and family-viewing experience can be tested with care. Request an invitation now; we will contact you when a place is available.</p></div>
          <div className={styles.betaDetails}><span><BadgeCheck aria-hidden="true" /><strong>For individuals and families</strong>One person owns the portfolio; trusted family members can help shape the introduction.</span><span><MessageCircle aria-hidden="true" /><strong>For introductions already in motion</strong>Share through WhatsApp, email, or the family network you already use.</span><span><UserCheck aria-hidden="true" /><strong>Built around consent</strong>The owner—not the platform or the viewer—decides when protected information is disclosed.</span></div>
          <div className={styles.betaActions}><Link href="/waitlist" className={styles.primaryButton}>Request an invitation <ArrowRight aria-hidden="true" /></Link><Link href="/login" className={styles.secondaryButton}>Existing participant? Sign in</Link></div>
        </section>

        <section id="questions" className={styles.faqSection}><div className={styles.sectionHeading}><p className={styles.eyebrow}>Questions</p><h2>Know exactly what happens.</h2></div><div className={styles.faqList}>{landingFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></section>
        <section className={styles.finalCta}><div><p className={styles.eyebrow}>Private pilot</p><h2>Make the introduction. Keep the decision.</h2><p>Request an invitation to create a private, controlled marriage introduction.</p></div><div className={styles.finalAction}><Link href="/waitlist" className={styles.lightButton}>Request an invitation <ArrowRight aria-hidden="true" /></Link><span>No account is created until you are invited.</span></div></section>
      </main>

      <footer className={styles.footer}><VivIntroBrand href="/" variant="full-symbol" className={styles.brand} /><p>Consent infrastructure for private marriage introductions.</p><div><Link href="/about">About</Link><Link href="/trust">Trust</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </div>
  );
}

function PortfolioPreview() {
  return <div className={styles.visual} aria-label="Example VivIntro portfolio"><div className={styles.visualGlow} aria-hidden="true" /><div className={styles.floatingMessage}><ShieldCheck aria-hidden="true" /><span><strong>Protected details</strong>Approval required</span></div><article className={styles.portfolioCard}><header><span><VivIntroBrand variant="full-symbol" tone="primary" decorative displayWidth={20} /></span><span><ShieldCheck aria-hidden="true" /> {PORTFOLIO_VIEW_LABELS.detailed}</span></header><div className={styles.portfolioBody}><div className={styles.portrait}><span>AR</span></div><div className={styles.introduction}><span className={styles.verified}><BadgeCheck aria-hidden="true" /> Identity checked</span><p>A private introduction</p><h2>Ananya</h2><strong>Product designer · Bengaluru</strong><p>Thoughtful, curious, close to family, and always learning.</p></div></div><footer><span>Story</span><span>Journey</span><span>Family</span><span>Gallery</span></footer></article><div className={styles.previewLifecycle}><span><small>01 · Link shared</small><strong>Introduction</strong></span><ArrowRight aria-hidden="true" /><span><small>02 · Email confirmed</small><strong>Access request</strong></span><ArrowRight aria-hidden="true" /><span data-approved><small>03 · Owner decides</small><strong>Approve or set aside</strong></span></div></div>;
}
