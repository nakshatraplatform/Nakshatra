import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, ChevronDown, Globe2, LockKeyhole, MessageCircle, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { GuidedTour } from "./GuidedTour";
import styles from "./LandingExperience.module.css";

export type LandingVariant = "clarity" | "control" | "story";

const concepts = {
  clarity: { headline: "Your biodata, as one link you control.", lead: "Share it on WhatsApp like you always do. Update it anytime without sending a new PDF. Your phone number and horoscope file stay hidden until you say yes." },
  control: { headline: "Share an introduction. Keep personal details personal.", lead: "One shareable link gives families a thoughtful first introduction. You decide who can see the details that should not be forwarded freely." },
  story: { headline: "A more human way to make a marriage introduction.", lead: "Present the person, not another attachment. Tell your story and decide when to share private details." },
} as const;

export const landingFaqs = [
  { question: "Is this a matchmaking site?", answer: "No. There’s no profile directory and no match suggestions. You choose who gets your link." },
  { question: "Can a parent or sibling create my profile?", answer: "Support for a parent, sibling, or other family member to create a profile on your behalf is coming soon. For now, create and publish your own introduction. Your family can help you prepare it and share your link." },
  { question: "How is this different from a biodata PDF?", answer: "You update one link instead of sending new files. Private details stay separate until you choose to share them. You can stop future viewing, which a forwarded PDF never allows. Copies someone has already saved cannot be erased." },
  { question: "Can my link be forwarded?", answer: "Yes. The first view can be forwarded or screenshotted, so share only what you’re comfortable with there. You choose who sees your private details. You can replace your link anytime to stop the old one from opening." },
  { question: "What happens after I share details?", answer: "They can see your private details for up to 15 days. You can end access early or renew it. We can’t erase copies they’ve already saved. Unpublishing pauses viewing; a sharing period that hasn’t ended or been stopped can resume when you publish again." },
  { question: "What does “Liveness checked” mean?", answer: "Before publishing, you complete a live camera check through Didit. The badge means a live person passed that check. It doesn’t verify legal identity, compare photos, or confirm anything written in the introduction. A test publication without this check has no badge." },
  { question: "Is it free?", answer: "Yes. Creating and sharing is free. If we ever add paid options, we’ll tell you before asking you to pay." },
] as const;

const problems = [
  { title: "Old versions keep circulating.", body: "Every correction is a new file, and the old one is still being read." },
  { title: "Your number travels too soon.", body: "Phone numbers and horoscopes spread before anyone decides to talk." },
  { title: "“Not now” is awkward.", body: "Saying no in a family group chat is hard for everyone." },
] as const;

const values = [
  { icon: Globe2, label: "Anyone with your link", title: "Your introduction", body: "Your name, age, marital status, profession, story, family background, and the photos you choose to share publicly." },
  { icon: LockKeyhole, label: "When you choose to share", title: "Private details", body: "Phone, email, exact birth details, horoscope file, family names, and more photos, if you’ve added them. A viewer confirms their email and taps Show interest; you decide whether to share." },
  { icon: UserCheck, label: "Only you", title: "Private notes", body: "Your private notes and street address stay in your account. They aren’t included in either shared view." },
] as const;

const trustFacts = [
  { icon: ShieldCheck, title: "Choose your first view", body: "Anything someone can see can be saved or screenshotted. Share only what you’re comfortable with." },
  { icon: Globe2, title: "No profile directory", body: "Your introduction is not listed in any VivIntro directory. You choose who gets your link." },
  { icon: Smartphone, title: "No app needed", body: "Read an introduction in any browser, on a phone or computer." },
  { icon: BadgeCheck, title: "Stay in control", body: "You can stop sharing private details or unpublish your link. Copies already saved by someone else can’t be recalled." },
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
          <Link href="/login" className={styles.signIn}>Sign in</Link>
        </nav>
      </header>

      <main id="main-content">
        <section id="top" className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>For marriage introductions</p><h1>{concept.headline}</h1><p className={styles.heroLead}>{concept.lead}</p>
            <div className={styles.heroActions}><Link href="/signup" className={styles.primaryButton}>Create your introduction <ArrowRight aria-hidden="true" /></Link><Link href="/demo" className={styles.secondaryButton}>See an example</Link></div>
            <p className={styles.heroNote}><Check aria-hidden="true" /> Free. Private until you publish.</p>
            <ul className={styles.heroAssurances} aria-label="VivIntro privacy assurances">
              <li><Globe2 aria-hidden="true" /><span><strong>Not listed in any directory</strong><small>You choose who gets your link</small></span></li>
              <li><LockKeyhole aria-hidden="true" /><span><strong>Contact details shared when you choose</strong><small>You decide when to share more</small></span></li>
              <li><BadgeCheck aria-hidden="true" /><span><strong>Stop sharing anytime</strong><small>Copies already saved can’t be recalled</small></span></li>
            </ul>
          </div><PortfolioPreview />
        </section>

        <section id="why" className={styles.problemSection}>
          <div className={styles.sectionHeading}><h2>Biodata PDFs don’t stay in your hands.</h2><p className={styles.heroLead}>One file becomes many versions. Your introduction can stay current instead.</p></div>
          <div className={styles.problemGrid}>{problems.map(({ title, body }) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
        </section>

        <section id="privacy" className={styles.controlSection}>
          <div className={styles.controlIntro}><h2>You decide who sees what.</h2><p>Share an introduction first. Decide when to share private details.</p><div className={styles.accessFlow}><span>Share your link</span><ArrowRight aria-hidden="true" /><span>Show interest</span><ArrowRight aria-hidden="true" /><strong>Share details for up to 15 days</strong></div><p className={styles.sharingBoundary}>Anything someone can see, they can screenshot. Keep the first view to what you’re comfortable sharing. Keep phone numbers and other private details out of your public story.</p></div>
          <div className={styles.controlGrid}>{values.map(({ icon: Icon, label, title, body }) => <article key={title}><Icon aria-hidden="true" /><span>{label}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
        </section>

        <section id="samples" className={styles.samplesSection}>
          <div className={styles.samplesHeading}><div className={styles.sectionHeading}><h2>See Ananya’s introduction.</h2></div><p>She’s fictional, but you can explore the same introduction layout before creating yours.</p></div>
          <div className={styles.betaActions}><Link href="/demo" className={styles.primaryButton}>See an example <ArrowRight aria-hidden="true" /></Link></div><p className={styles.sampleNote}>Ananya and every detail in the sample are fictional. Private details are not shown.</p>
        </section>

        <GuidedTour />

        <section id="viewer" className={styles.familySection}>
          <div className={styles.sectionHeading}><h2>Got someone’s introduction?</h2></div>
          <div className={styles.familyGrid}><article><span className={styles.eyebrow}>01</span><h3>Read it in any browser</h3><p>No app or account needed to read the introduction.</p></article><article><span className={styles.eyebrow}>02</span><h3>Show interest</h3><p>If you’d like to continue, introduce yourself and confirm your email.</p></article><article><span className={styles.eyebrow}>03</span><h3>Let them decide</h3><p>They can share details for up to 15 days, or quietly set your interest aside.</p></article></div>
          <div className={styles.betaActions}><Link href="/received-a-link" className={styles.secondaryButton}>Read the viewer guide <ArrowRight aria-hidden="true" /></Link></div>
        </section>

        <section id="trust" className={styles.familySection}>
          <div className={styles.sectionHeading}><h2>What to know before you share.</h2></div>
          <div className={styles.trustList}>{trustFacts.map(({ icon: Icon, title, body }) => <details key={title}><summary><Icon aria-hidden="true" /><span>{title}</span><ChevronDown className={styles.disclosureChevron} aria-hidden="true" /></summary><p>{body}</p></details>)}</div><div className={styles.betaActions}><Link href="/trust" className={styles.secondaryButton}>Read how VivIntro handles trust</Link><Link href="/privacy" className={styles.secondaryButton}>Privacy policy</Link></div>
        </section>

        <section id="beta" className={styles.betaSection}>
          <div className={styles.betaCopy}><p className={styles.eyebrow}>With your family’s help</p><h2>Your introduction. Your choice.</h2><p>Creating a profile for your son, daughter, or sibling? This option is coming soon. For now, they create and publish their own introduction, with your help.</p></div>
          <div className={styles.betaDetails}><span><BadgeCheck aria-hidden="true" /><strong>You stay in control</strong>Family can help. You confirm the details and choose when to publish.</span><span><MessageCircle aria-hidden="true" /><strong>Share in familiar places</strong>Send your published link through WhatsApp, email, or relatives.</span></div>
        </section>

        <section id="questions" className={styles.faqSection}><div className={styles.sectionHeading}><h2>Questions families ask</h2></div><div className={styles.faqList}>{landingFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></section>
        <section className={styles.finalCta}><div><h2>Send your next introduction as a link.</h2><p>One introduction, shared with care.</p></div><div className={styles.finalAction}><Link href="/signup" className={styles.lightButton}>Create your introduction <ArrowRight aria-hidden="true" /></Link><span>Free. Private until you publish.</span></div></section>
      </main>

      <footer className={styles.footer}><VivIntroBrand href="/" variant="full-symbol" className={styles.brand} /><p>One introduction, shared with care.</p><div><Link href="/about">About</Link><Link href="/trust">Trust</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </div>
  );
}

function PortfolioPreview() {
  return <div className={styles.visual} aria-label="Illustration of Ananya’s fictional VivIntro introduction"><p className={styles.mobilePreviewLabel}>A fictional example of the shared introduction</p><div className={styles.visualGlow} aria-hidden="true" /><div className={styles.floatingMessage}><ShieldCheck aria-hidden="true" /><span><strong>Private details</strong>Shared by choice</span></div><article className={styles.portfolioCard}><header><span><VivIntroBrand variant="full-symbol" tone="primary" decorative displayWidth={20} /></span><span><ShieldCheck aria-hidden="true" /> Introduction</span></header><div className={styles.portfolioBody}><div className={styles.portrait}><span>AM</span></div><div className={styles.introduction}><span className={styles.verified}>Fictional example</span><p>A marriage introduction</p><h2>Ananya</h2><strong>Product designer · Bengaluru</strong><p>Thoughtful, optimistic, and happiest around family, books, and the outdoors.</p></div></div><footer><span>Overview</span><span>Family / Journey</span><span>Show interest</span></footer></article><div className={styles.previewLifecycle}><span><small>01 · Link shared</small><strong>Introduction</strong></span><ArrowRight aria-hidden="true" /><span><small>02 · Email confirmed</small><strong>Show interest</strong></span><ArrowRight aria-hidden="true" /><span data-approved><small>03 · You decide</small><strong>Share details or set aside</strong></span></div></div>;
}
