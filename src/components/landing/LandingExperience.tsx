import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, ChevronDown, Globe2, MessageCircle, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { GuidedTour } from "./GuidedTour";
import { VivaraMeaning } from "./VivaraMeaning";
import { ProductStory } from "./ProductStory";
import { AnanyaPhone } from "./AnanyaPhone";
import { MarketingLink } from "@/components/marketing/MarketingLink";
import { landingConcepts, landingFaqs } from "@/content/landing";
import styles from "./LandingExperience.module.css";

export type LandingVariant = keyof typeof landingConcepts;
export { landingFaqs };

const trustFacts = [
  { icon: ShieldCheck, title: "Choose your first view", body: "Anything someone can see can be saved or screenshotted. Share only what you’re comfortable with." },
  { icon: Globe2, title: "No profile directory", body: "Your introduction is not listed in any VivIntro directory. You choose who gets your link; recipients may forward it." },
  { icon: Smartphone, title: "Public viewing without signup", body: "Read the public view in your browser. Private details require confirmed-email sign-in and the person’s approval. Forwarding a link does not transfer an approved account’s access." },
  { icon: BadgeCheck, title: "Stay in control", body: "You can stop sharing private details or unpublish your link. Copies already saved by someone else can’t be recalled." },
] as const;

export function LandingExperience({ variant = "clarity" }: { variant?: LandingVariant }) {
  const concept = landingConcepts[variant];
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
            <p className={styles.eyebrow}>A simple way to introduce yourself</p><h1>{concept.headline}</h1><p className={styles.heroLead}>{concept.lead}</p>
            <div className={styles.heroActions}><MarketingLink action="create" href="/signup" className={styles.primaryButton}>Create your introduction <ArrowRight aria-hidden="true" /></MarketingLink><MarketingLink action="sample" href="/demo" className={styles.secondaryButton}>See a sample introduction</MarketingLink></div>
            <p className={styles.heroNote}><Check aria-hidden="true" /> Free. Private until you publish.</p>
          </div><div className={styles.heroDemo}><AnanyaPhone priority /><Link href="/demo" className={styles.demoLink}>Open the sample introduction <ArrowRight aria-hidden="true" /></Link></div>
        </section>

        <ProductStory />

        <GuidedTour />

        <VivaraMeaning />

        <section id="beta" className={styles.betaSection} aria-labelledby="founder-heading">
          <div className={styles.betaCopy}><h2 id="founder-heading">Why Rahul started VivIntro</h2><p>Families often share a marriage biodata as a file. When details change, old copies may still circulate. VivIntro gives you one link to update, while keeping private details separate.</p><p>An introduction is a first step. Getting to know someone still takes conversation, time and your own judgment.</p></div>
          <div className={styles.betaDetails}><span><BadgeCheck aria-hidden="true" /><strong>Your family can help you prepare</strong>You create and publish your own introduction. Parents or siblings can help with the details and share your link.</span><span><MessageCircle aria-hidden="true" /><strong>Share with people you know</strong>Send your published link through WhatsApp, email, relatives or a broker you work with. VivIntro does not find or recommend matches.</span></div>
        </section>

        <section id="viewer" className={styles.familySection}>
          <div className={styles.sectionHeading}><h2>Sharing, from both sides.</h2></div>
          <div className={styles.sharingCards}>
            <article><UserCheck aria-hidden="true" /><h3>Received a Vivara link?</h3><p>You can read the public introduction without an app or account.</p><p>To ask for private details, sign in, confirm your email and introduce yourself. You do not need an introduction of your own. The person decides whether to share more.</p><Link href="/received-a-link" className={styles.secondaryButton}>Read the viewer guide <ArrowRight aria-hidden="true" /></Link></article>
            <article id="trust"><ShieldCheck aria-hidden="true" /><h3>What to know before you share.</h3><div className={styles.trustList}>{trustFacts.map(({ icon: Icon, title, body }) => <details key={title}><summary><Icon aria-hidden="true" /><span>{title}</span><ChevronDown className={styles.disclosureChevron} aria-hidden="true" /></summary><p>{body}</p></details>)}</div><div className={styles.betaActions}><Link href="/trust" className={styles.secondaryButton}>Read how VivIntro handles trust</Link><Link href="/privacy" className={styles.secondaryButton}>Privacy policy</Link></div></article>
          </div>
        </section>

        <section id="testimonials" className={styles.testimonialSection} aria-labelledby="testimonials-heading">
          <div><h2 id="testimonials-heading">What early users think</h2><p>We are listening to people who create and receive introductions. We will share their words here only after they review and approve a quote.</p></div>
          <div className={styles.testimonialInvitation}><MessageCircle aria-hidden="true" /><h3>Help shape VivIntro</h3><p>Used VivIntro, or received a Vivara link? Tell us what helped and what could be clearer.</p><Link href="/share-feedback" className={styles.secondaryButton}>Share your experience <ArrowRight aria-hidden="true" /></Link></div>
        </section>
        <section id="questions" className={styles.faqSection}><div className={styles.sectionHeading}><h2>Questions families ask</h2><p>Short answers to the questions that matter before you share.</p><p>New to the format? <Link href="/guides/marriage-biodata-format" className={styles.guideLink}>Read the marriage biodata guide</Link>.</p></div><div className={styles.faqList}>{landingFaqs.map((faq) => <details name="landing-faq" key={faq.question}><summary>{faq.question}<ChevronDown aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div><Link href="/faq" className={styles.secondaryButton}>Read all questions</Link></section>
        <section className={styles.finalCta}><div><h2>Your next introduction can start with a link.</h2><p>Prepare it privately. Publish when you’re ready. Review requests before sharing private details.</p></div><div className={styles.finalAction}><MarketingLink action="create" href="/signup" className={styles.lightButton}>Create your introduction <ArrowRight aria-hidden="true" /></MarketingLink><span>Free. Private until you publish.</span></div></section>
      </main>

      <footer className={styles.footer}><VivIntroBrand href="/" variant="full-symbol" className={styles.brand} /><p>Your Vivara link. Shared with care.</p><div><Link href="/about">About</Link><Link href="/faq">Questions</Link><Link href="/trust">Trust</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </div>
  );
}
