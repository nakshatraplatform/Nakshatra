import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  FileText,
  Globe2,
  Images,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
} from "lucide-react";
import styles from "./LandingExperience.module.css";
import { PORTFOLIO_VIEW_LABELS } from "@/features/portfolio/template";
import { GuidedTour } from "./GuidedTour";
import { LandingSectionRail } from "./LandingSectionRail";

export type LandingVariant = "clarity" | "control" | "story";

const concepts = {
  clarity: {
    className: styles.clarity,
    eyebrow: "Private pilot · Public waitlist",
    headline: "One marriage introduction. Shared on your terms.",
    lead: "Replace scattered biodata files, photographs, and horoscope attachments with one current portfolio. Families see a clear first introduction. Personal details are shared only after you approve their verified request.",
    primary: "Join the waitlist",
    secondary: "View a sample portfolio",
    visualMode: PORTFOLIO_VIEW_LABELS.detailed,
    visualNote: "Contact details protected",
  },
  control: {
    className: styles.control,
    eyebrow: "Private pilot · Public waitlist",
    headline: "Share your story. Not your privacy.",
    lead: "Choose what a first-time viewer sees, keep contact details protected, and approve 15-day Complete Portfolio access only when an introduction feels relevant.",
    primary: "Join the waitlist",
    secondary: "See how control works",
    visualMode: PORTFOLIO_VIEW_LABELS.brief,
    visualNote: "Complete Portfolio needs approval",
  },
  story: {
    className: styles.story,
    eyebrow: "Private pilot · Public waitlist",
    headline: "A biodata is a list. This is how you’re introduced.",
    lead: "Bring your story, photographs, family, and horoscope together in the way you would actually want someone to understand you. Not as another form or attachment.",
    primary: "Join the waitlist",
    secondary: "See the portfolio structure",
    visualMode: PORTFOLIO_VIEW_LABELS.detailed,
    visualNote: "Story · Journey · Family · Gallery",
  },
} as const;

const problems = [
  { icon: FileText, title: "It goes out of date", body: "One small correction means sending a new file to everyone all over again." },
  { icon: Images, title: "It arrives in pieces", body: "Photographs and horoscope files get separated and lost inside long chats." },
  { icon: LockKeyhole, title: "You cannot take it back", body: "Once a file is forwarded, you have no way to know where it went or who still has it." },
] as const;

const viewModes = [
  { icon: LockKeyhole, label: "Public", title: PORTFOLIO_VIEW_LABELS.brief, body: "A concise introduction that keeps most details behind your approval." },
  { icon: ShieldCheck, label: "Public", title: PORTFOLIO_VIEW_LABELS.detailed, body: "A richer introduction with the details most families expect to see first." },
  { icon: UserCheck, label: "After approval", title: PORTFOLIO_VIEW_LABELS.complete, body: "Your complete portfolio, opened only for a viewer you have approved." },
] as const;

const trustFacts = [
  { icon: LockKeyhole, text: "Contact details are never in either public Introduction." },
  { icon: BadgeCheck, text: "Viewers confirm their email before they can request more." },
  { icon: UserCheck, text: "You approve or set aside every request from your dashboard." },
  { icon: RefreshCw, text: "You can end someone's access at any time." },
] as const;

const heroAssurances = [
  { icon: LockKeyhole, title: "No public directory", body: "Only people with your link can open the public Introduction." },
  { icon: BadgeCheck, title: "Verified before publishing", body: "Every pilot creator completes an identity check." },
  { icon: UserCheck, title: "Protected details need approval", body: "You decide who receives 15-day Complete Portfolio access." },
] as const;

const familyBenefits = [
  { icon: Smartphone, title: "Clear on every phone", body: "Large, readable text and plain labels. Comfortable for parents and grandparents to read." },
  { icon: Globe2, title: "Nothing to install", body: "The link opens straight in a browser. There is no app to download and no account needed to read the public Introduction." },
  { icon: BadgeCheck, title: "Identity verification required", body: "Every pilot creator completes the Didit identity check before publication. The verified badge does not guarantee every portfolio detail." },
  { icon: RefreshCw, title: "Always current", body: "Change a detail, update your published portfolio, and the same link shows the current version." },
] as const;

const samplePortfolios = [
  { initials: "AR", name: "Ananya Rao", detail: "Product designer · Bengaluru", accent: "sea" },
  { initials: "AM", name: "Arjun Mehta", detail: "Architect · Pune", accent: "sand" },
  { initials: "MI", name: "Meera Iyer", detail: "Physician · Chennai", accent: "rose" },
] as const;

const faqs = [
  { question: "Is Nakshatra a matchmaking website?", answer: "No. Nakshatra does not suggest matches or search for people on your behalf. It gives you one clear portfolio to share with the families you choose." },
  { question: "Can I create a portfolio after joining the waitlist?", answer: "Not yet. The waitlist only records your interest and contact details. We will send signup instructions separately when launch access becomes available. People who receive a shared portfolio can still read its public Introduction and express interest." },
  { question: "Is the pilot paid?", answer: "No. The private beta is free for invited pilot participants. Paid plans are not available during the pilot." },
  { question: "Does someone need to sign in to open my link?", answer: "No. Anyone with your link can read your Brief or Detailed Introduction straight away. A viewer verifies their email before asking to see your Complete Portfolio." },
  { question: "Is identity verification required?", answer: "Yes. Every pilot creator must complete the Didit identity check before publishing. The verified badge confirms that the owner completed the identity check; it does not guarantee that every portfolio detail is accurate." },
  { question: "How long does a public link remain active?", answer: "A published portfolio link is active for 30 days by default. The owner can unpublish or replace the link earlier." },
  { question: "How long does approved access last?", answer: "Complete Portfolio access lasts for 15 days. You can end it earlier or renew it from your dashboard." },
  { question: "Can someone find my portfolio by searching my name?", answer: "No. Nakshatra has no public portfolio directory, and portfolio pages tell search engines not to list them. Anyone who receives or is forwarded your link can still open its public Introduction." },
] as const;

export function LandingExperience({ variant }: { variant: LandingVariant }) {
  const concept = concepts[variant];

  return (
    <div className={`${styles.page} ${concept.className}`} data-landing-variant={variant}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <LandingSectionRail />

      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Nakshatra home">
          <Sparkles aria-hidden="true" /><span>NAKSHATRA</span>
        </Link>
        <nav className={styles.navigation} aria-label="Main navigation">
          <ThemeSwitch />
          <div className={styles.navigationLinks}>
            <a href="#how">How it works</a><a href="#control">Your control</a><a href="#beta">Beta access</a><a href="#questions">Questions</a>
          </div>
          <Link href="/login" className={styles.signIn}>Sign in</Link>
          <Link href="/pilot-access" className={styles.primaryButton}>Join waitlist</Link>
        </nav>
      </header>

      <main id="main-content">
        <section id="top" className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{concept.eyebrow}</p>
            <h1>{concept.headline}</h1>
            <p className={styles.heroLead}>{concept.lead}</p>
            <div className={styles.heroActions}>
              <Link href="/pilot-access" className={styles.primaryButton}>{concept.primary} <ArrowRight aria-hidden="true" /></Link>
              <a href={variant === "control" ? "#control" : "#samples"} className={styles.secondaryButton}>{concept.secondary}</a>
            </div>
            <p className={styles.heroNote}><Check aria-hidden="true" /> Join for launch updates. Waitlist registration does not create product access.</p>
            <ul className={styles.heroAssurances} aria-label="Nakshatra privacy assurances">
              {heroAssurances.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <Icon aria-hidden="true" />
                  <span><strong>{title}</strong><small>{body}</small></span>
                </li>
              ))}
            </ul>
          </div>
          <PortfolioPreview mode={concept.visualMode} note={concept.visualNote} variant={variant} />
        </section>

        <section id="why" className={styles.problemSection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>A familiar problem</p><h2>The biodata file was never built for this.</h2></div>
          <div className={styles.problemGrid}>{problems.map(({ icon: Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
        </section>

        <section id="control" className={styles.controlSection}>
          <div className={styles.controlIntro}>
            <p className={styles.eyebrow}>Your information, your decision</p><h2>One link does not mean everyone sees everything.</h2><p>You choose how much a new family sees when they first open your link. Contact details and personal information stay protected until you approve that viewer yourself.</p>
            <div className={styles.accessFlow} aria-label="Portfolio access flow"><span>Brief or Detailed Introduction</span><ArrowRight aria-hidden="true" /><span>Verified email request</span><ArrowRight aria-hidden="true" /><strong>Complete Portfolio</strong></div>
          </div>
          <div className={styles.controlGrid}>{viewModes.map(({ icon: Icon, label, title, body }) => <article key={title}><Icon aria-hidden="true" /><span>{label}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          <div className={styles.trustFacts}>{trustFacts.map(({ icon: Icon, text }) => <span key={text}><Icon aria-hidden="true" />{text}</span>)}</div>
        </section>

        <GuidedTour />

        <section className={styles.familySection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Built for every family</p><h2>Easy to read on any phone, for any generation.</h2></div>
          <div className={styles.familyGrid}>{familyBenefits.map(({ icon: Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{body}</p></article>)}</div>
        </section>

        <section id="samples" className={styles.samplesSection}>
          <div className={styles.samplesHeading}><div className={styles.sectionHeading}><p className={styles.eyebrow}>See the format</p><h2>Every portfolio follows the same clear layout.</h2></div><p>There are no themes to choose between and no templates to compare. Every portfolio is presented in the same way, so families can read each one on its own terms.</p></div>
          <div className={styles.samplesGrid}>{samplePortfolios.map((sample) => <article key={sample.name} data-accent={sample.accent}><div className={styles.samplePortrait}>{sample.initials}</div><div><span>Sample portfolio</span><h3>{sample.name}</h3><p>{sample.detail}</p><small>Story · Journey · Family · Gallery</small></div></article>)}</div>
          <p className={styles.sampleNote}>Sample layouts. These are not real Nakshatra users.</p>
        </section>

        <section id="beta" className={styles.betaSection}>
          <div className={styles.betaCopy}>
            <p className={styles.eyebrow}>Private beta testing</p>
            <h2>The pilot is private. The launch waitlist is open.</h2>
            <p>Current pilot participants can continue creating and sharing. Everyone else can join the waitlist for launch updates without receiving creator or portfolio access.</p>
          </div>
          <div className={styles.betaDetails}>
            <span><BadgeCheck aria-hidden="true" /><strong>Current pilot creators</strong>Existing participants can sign in and continue testing. Every creator completes Didit identity verification before publication.</span>
            <span><MessageCircle aria-hidden="true" /><strong>Shared-network viewers</strong>Open the public Introduction, verify an email to express interest, and receive 15-day Complete Portfolio access after approval.</span>
            <span><RefreshCw aria-hidden="true" /><strong>Launch waitlist</strong>Leave verified contact details now. Signup instructions will be sent separately when access opens.</span>
          </div>
          <div className={styles.betaActions}>
            <Link href="/pilot-access" className={styles.primaryButton}>Join the waitlist <ArrowRight aria-hidden="true" /></Link>
            <Link href="/login" className={styles.secondaryButton}>Sign in to Nakshatra</Link>
          </div>
        </section>

        <section id="questions" className={styles.faqSection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Questions</p><h2>Know what happens before you begin.</h2></div>
          <div className={styles.faqList}>{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div>
        </section>

        <section className={styles.finalCta}>
          <div><p className={styles.eyebrow}>Launching soon</p><h2>Your introduction deserves more than another file.</h2><p>Join the waitlist and we will let you know when Nakshatra opens for new portfolio creators.</p></div>
          <div className={styles.finalAction}><Link href="/pilot-access" className={styles.lightButton}>Join the waitlist <ArrowRight aria-hidden="true" /></Link><span>No product access is created yet.</span></div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link href="/" className={styles.brand}><Sparkles aria-hidden="true" /><span>NAKSHATRA</span></Link><p>One clear portfolio for the introduction that matters most.</p>
        <div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="#questions">Questions</a><Link href="/login">Sign in</Link></div>
      </footer>
    </div>
  );
}

function PortfolioPreview({ mode, note, variant }: { mode: string; note: string; variant: LandingVariant }) {
  const FloatingIcon = variant === "clarity" ? FileText : MessageCircle;
  const floatingTitle = variant === "clarity" ? "One link, always current" : variant === "control" ? "Access approved" : "Shared with family";
  const floatingBody = variant === "clarity" ? "Updates stay in one place" : variant === "story" ? "Opens in their browser" : "For one verified viewer";

  return (
    <div className={styles.visual} aria-label="Example Nakshatra portfolio">
      <div className={styles.visualGlow} aria-hidden="true" />
      <div className={styles.floatingMessage}><FloatingIcon aria-hidden="true" /><span><strong>{floatingTitle}</strong>{floatingBody}</span></div>
      <article className={styles.portfolioCard}>
        <header><span><Sparkles aria-hidden="true" /> Nakshatra</span><span><ShieldCheck aria-hidden="true" /> {mode}</span></header>
        <div className={styles.portfolioBody}>
          <div className={styles.portrait}><span>AR</span></div>
          <div className={styles.introduction}><span className={styles.verified}><BadgeCheck aria-hidden="true" /> Identity Verified</span><p>A personal portfolio</p><h2>Ananya Rao</h2><strong>Product designer · Bengaluru</strong><p>Thoughtful, curious, close to family, and always learning.</p></div>
        </div>
        <footer><span>Story</span><span>Journey</span><span>Family</span><span>Gallery</span></footer>
      </article>
      <div className={styles.previewLifecycle} aria-label="How protected access works">
        <span><small>01 · Shared link</small><strong>Public Introduction</strong></span>
        <ArrowRight aria-hidden="true" />
        <span><small>02 · Verified email</small><strong>Interest request</strong></span>
        <ArrowRight aria-hidden="true" />
        <span data-approved><small>03 · Your decision</small><strong>{note}</strong></span>
      </div>
    </div>
  );
}
