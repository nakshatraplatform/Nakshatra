import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, ChevronDown, Globe2, LockKeyhole, MessageCircle, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { GuidedTour } from "./GuidedTour";
import { VivaraMeaning } from "./VivaraMeaning";
import { ProductStory } from "./ProductStory";
import { AnanyaPhone } from "./AnanyaPhone";
import styles from "./LandingExperience.module.css";

export type LandingVariant = "clarity" | "control" | "story";

const concepts = {
  clarity: { headline: "Share your story before you share your number.", lead: "Create your Vivara, a personal page for marriage conversations. Share one Vivara link. Update it without resending. Choose who can see your private details." },
  control: { headline: "Your Vivara. Private details shared by your decision.", lead: "Give a prospective partner a first look at your life. Share your Vivara through one current link and review requests before giving access to private details." },
  story: { headline: "Let someone get to know the person behind the details.", lead: "Your Vivara gives you room to share your family, the things you value and the future you hope to build. Send one link and decide when to share more." },
} as const;

export const landingFaqs = [
  { question: "What is a Vivara?", answer: "A Vivara is your personal page for marriage conversations, shared through one link. The name draws on Kannada usage of vivara for an explanation or account in detail. Add your story and photos, keep the published page current and review requests for private details." },
  { question: "Is this a matchmaking site?", answer: "No. There’s no profile directory and no match suggestions. You choose who gets your link." },
  { question: "Does someone need an account to read my Vivara?", answer: "The public view opens without signup or an app. To request and view approved private details, a viewer must sign in and confirm their email. They do not need to create a Vivara of their own. Confirming an email does not by itself grant access or prove identity." },
  { question: "Can a parent or sibling create my Vivara?", answer: "For now, create and publish your own Vivara. Your family can help you prepare it and share your link. Creating and managing a Vivara on someone else’s behalf is not currently offered." },
  { question: "How is a Vivara different from a PDF?", answer: "You publish updates at the same link instead of sending new files. Private details stay separate until you approve access. You can end access in VivIntro, but copies someone has already saved cannot be erased." },
  { question: "Do saved edits change the Vivara I have shared?", answer: "Not until you publish the update. Edits stay in your private draft when you save them. Publishing makes the updated version available at your existing link, so you do not need to send another PDF." },
  { question: "Can my link be forwarded?", answer: "Yes. The first view can be forwarded or screenshotted, so share only what you’re comfortable with there. You choose who sees your private details. You can replace your link anytime to stop the old one from opening." },
  { question: "What happens after I share details?", answer: "They can see your private details for up to 15 days. You can end access early or renew it. We can’t erase copies they’ve already saved. Unpublishing pauses viewing; a sharing period that hasn’t ended or been stopped can resume when you publish again." },
  { question: "What does “Liveness checked” mean?", answer: "Before publishing, you complete a live camera check through Didit. The badge means a live person passed that check. It doesn’t verify legal identity, compare photos, or confirm anything written in a Vivara. VivIntro stores consent and normalized results, not the live camera capture. Provider processing and cleanup are explained in the Privacy Policy. A test publication without this check has no badge." },
  { question: "Is it free?", answer: "Yes. Creating and sharing is free. If we ever add paid options, we’ll tell you before asking you to pay." },
] as const;

const trustFacts = [
  { icon: ShieldCheck, title: "Choose your first view", body: "Anything someone can see can be saved or screenshotted. Share only what you’re comfortable with." },
  { icon: Globe2, title: "No profile directory", body: "Your Vivara is not listed in any VivIntro directory. You choose who gets your link; recipients may forward it." },
  { icon: Smartphone, title: "Public viewing without signup", body: "Read the public view in your browser. Private details require confirmed-email sign-in and the person’s approval. Forwarding a link does not transfer an approved account’s access." },
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
            <p className={styles.eyebrow}>For arranged-marriage conversations</p><h1>{concept.headline}</h1><p className={styles.heroLead}>{concept.lead}</p>
            <div className={styles.heroActions}><Link href="/signup" className={styles.primaryButton}>Create your Vivara <ArrowRight aria-hidden="true" /></Link><Link href="/demo" className={styles.secondaryButton}>See a sample Vivara</Link></div>
            <p className={styles.heroNote}><Check aria-hidden="true" /> Free. Private until you publish.</p>
            <ul className={styles.heroAssurances} aria-label="VivIntro privacy assurances">
              <li><Globe2 aria-hidden="true" /><span><strong>Not listed in any directory</strong><small>You choose who gets your link</small></span></li>
              <li><LockKeyhole aria-hidden="true" /><span><strong>Contact details shared when you choose</strong><small>You decide when to share more</small></span></li>
              <li><BadgeCheck aria-hidden="true" /><span><strong>Stop sharing anytime</strong><small>Copies already saved can’t be recalled</small></span></li>
            </ul>
          </div><div className={styles.heroDemo}><AnanyaPhone priority /><Link href="/demo" className={styles.demoLink}>Open the sample Vivara <ArrowRight aria-hidden="true" /></Link></div>
        </section>

        <ProductStory />

        <GuidedTour />

        <VivaraMeaning />

        <section id="beta" className={styles.betaSection} aria-labelledby="founder-heading">
          <div className={styles.betaCopy}><h2 id="founder-heading">Why Rahul started VivIntro</h2><p>A family shares a PDF, another person forwards it, and the details keep travelling. Rahul’s idea was to give that familiar marriage introduction a current link and a decision before private information is shared.</p><p>Your Vivara gives a prospective partner room to get to know you before a meeting. Understanding each other still takes conversation, time and your own judgment.</p></div>
          <div className={styles.betaDetails}><span><BadgeCheck aria-hidden="true" /><strong>Your family can help you prepare</strong>For this release, you create and publish your own Vivara. Parents or siblings can help with the details and share your link.</span><span><MessageCircle aria-hidden="true" /><strong>Share through people you already know</strong>Send your published link through WhatsApp, email, relatives or a broker you work with. VivIntro does not find or recommend matches.</span></div>
        </section>

        <section id="viewer" className={styles.familySection}>
          <div className={styles.sectionHeading}><h2>Sharing, from both sides.</h2></div>
          <div className={styles.sharingCards}>
            <article><UserCheck aria-hidden="true" /><h3>Received someone’s Vivara?</h3><p>No app or account needed to read the public view.</p><p>To request private details, sign in, confirm your email and introduce yourself. You do not need a Vivara of your own. They review your request and decide whether to share.</p><Link href="/received-a-link" className={styles.secondaryButton}>Read the viewer guide <ArrowRight aria-hidden="true" /></Link></article>
            <article id="trust"><ShieldCheck aria-hidden="true" /><h3>What to know before you share.</h3><div className={styles.trustList}>{trustFacts.map(({ icon: Icon, title, body }) => <details key={title}><summary><Icon aria-hidden="true" /><span>{title}</span><ChevronDown className={styles.disclosureChevron} aria-hidden="true" /></summary><p>{body}</p></details>)}</div><div className={styles.betaActions}><Link href="/trust" className={styles.secondaryButton}>Read how VivIntro handles trust</Link><Link href="/privacy" className={styles.secondaryButton}>Privacy policy</Link></div></article>
          </div>
        </section>

        <section id="questions" className={styles.faqSection}><div className={styles.sectionHeading}><h2>Questions families ask</h2></div><div className={styles.faqList}>{landingFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></section>
        <section className={styles.finalCta}><div><h2>Let the next conversation begin with your Vivara.</h2><p>Prepare it privately. Publish when you’re ready. Review requests before sharing private details.</p></div><div className={styles.finalAction}><Link href="/signup" className={styles.lightButton}>Create your Vivara <ArrowRight aria-hidden="true" /></Link><span>Free. Private until you publish.</span></div></section>
      </main>

      <footer className={styles.footer}><VivIntroBrand href="/" variant="full-symbol" className={styles.brand} /><p>Your Vivara. Shared through your network.</p><div><Link href="/about">About</Link><Link href="/trust">Trust</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </div>
  );
}
