import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, ChevronDown, FileText, Globe2, LockKeyhole, MessageCircle, RefreshCw, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { GuidedTour } from "./GuidedTour";
import styles from "./LandingExperience.module.css";

export type LandingVariant = "clarity" | "control" | "story";

const concepts = {
  clarity: { headline: "One introduction. One link. Always current.", lead: "VivIntro gives families one thoughtful marriage introduction to share—without sending another PDF. Update it anytime. Contact details, horoscope files, and other sensitive information stay protected until you approve access." },
  control: { headline: "Share an introduction. Keep personal details personal.", lead: "One private link gives families a thoughtful first introduction. You decide who can see the details that should not be forwarded freely." },
  story: { headline: "A more human way to make a marriage introduction.", lead: "Present the person, not another attachment. VivIntro keeps the story clear and disclosure under the owner’s control." },
} as const;

export const landingFaqs = [
  { question: "Who is VivIntro for?", answer: "VivIntro is for people and families already making marriage introductions through relatives, friends, community networks, or matchmakers. It helps them share an introduction; it does not find someone to introduce." },
  { question: "Is VivIntro a matchmaking website?", answer: "No. VivIntro does not list profiles, recommend matches, or search on your behalf. It helps a person or family make a private introduction to people they already choose." },
  { question: "How is this different from a biodata PDF?", answer: "You can update a VivIntro introduction without sending a new file. The shared view and protected details are separate, so a viewer must request and receive your approval before seeing the latter. A forwarded PDF cannot be updated or withdrawn." },
  { question: "Who can open a shared link?", answer: "Anyone who receives or is forwarded the link can read the public Introduction. It is not listed in a VivIntro directory and is marked not to appear in search results. A viewer can still forward or capture what they see, so put only information you are comfortable sharing in that first view." },
  { question: "What stays protected?", answer: "Contact details and owner-designated private information stay outside the public introduction. A viewer must confirm their email and request access; the owner can approve or set the request aside." },
  { question: "What does Live photo checked mean?", answer: "When this badge appears, Didit matched a live camera capture to the portfolio’s current primary photo and checked liveness. It does not verify legal identity, profile statements, or suitability. A test publication without this check has no badge." },
  { question: "Can I change or stop sharing it?", answer: "Yes. Edit the published Introduction and the current link shows the update. You can also unpublish it or rotate the link, which makes the previous link stop working. If you approve a viewer, protected access lasts up to 15 days and can end earlier." },
  { question: "Is the private pilot free?", answer: "Yes. The current creator pilot is free and invitation-only. VivIntro is not offering a paid creator plan during the pilot." },
  { question: "Can I join now?", answer: "VivIntro is inviting people gradually during its private pilot. You sign in with email or Google to request an invitation. Creating an Introduction becomes available only after an invitation is issued." },
] as const;

const problems = [
  { icon: FileText, title: "Different versions circulate", body: "A corrected detail means another file. Someone may still be reading the older one." },
  { icon: MessageCircle, title: "Personal details travel too soon", body: "A phone number or horoscope can move through chats before either family has decided to continue." },
  { icon: LockKeyhole, title: "The next step feels awkward", body: "Sharing more, waiting, or saying no can become a conversation before the person is ready for one." },
] as const;

const values = [
  { icon: RefreshCw, label: "One current introduction", title: "Correct it once", body: "Update the published Introduction and people opening the current link see the latest version." },
  { icon: LockKeyhole, label: "A protected next step", title: "Share details when ready", body: "Keep direct contact, horoscope files, and other protected information behind a request you approve." },
  { icon: UserCheck, label: "A private decision", title: "Respond without pressure", body: "Review an email-confirmed request. Approve it or set it aside without a public rejection." },
] as const;

const trustFacts = [
  { icon: ShieldCheck, title: "Can someone forward the link?", body: "Yes. The public Introduction can be forwarded or captured. Only place details there that you are comfortable sharing; protected details still require approval." },
  { icon: Globe2, title: "Is this a matchmaking website?", body: "No. VivIntro has no searchable profile directory and does not recommend matches. You choose who receives the introduction." },
  { icon: Smartphone, title: "Does the viewer need an app?", body: "No. The introduction opens in a regular browser on a phone or computer." },
  { icon: BadgeCheck, title: "What does the photo badge mean?", body: "It appears only after a live-photo match and liveness check. It does not verify legal identity or the claims in an introduction." },
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
          <Link href="/login" className={styles.signIn}>Sign in</Link><Link href="/waitlist" className={styles.primaryButton}>Request an invitation</Link>
        </nav>
      </header>

      <main id="main-content">
        <section id="top" className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Private marriage introductions, shared with care</p><h1>{concept.headline}</h1><p className={styles.heroLead}>{concept.lead}</p>
            <div className={styles.heroActions}><Link href="/demo" className={styles.primaryButton}>View a sample introduction <ArrowRight aria-hidden="true" /></Link><Link href="/waitlist" className={styles.secondaryButton}>Request an invitation</Link></div>
            <p className={styles.heroNote}><Check aria-hidden="true" /> Private pilot · invitations are released gradually</p>
            <ul className={styles.heroAssurances} aria-label="VivIntro privacy assurances">
              <li><BadgeCheck aria-hidden="true" /><span><strong>Photo checks are clearly marked</strong><small>Badge shown only after a live check</small></span></li>
              <li><Globe2 aria-hidden="true" /><span><strong>Not searchable</strong><small>No public profile directory</small></span></li>
              <li><LockKeyhole aria-hidden="true" /><span><strong>Sensitive details stay protected</strong><small>Approval required for protected access</small></span></li>
            </ul>
          </div><PortfolioPreview />
        </section>

        <section id="why" className={styles.problemSection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>The familiar forwarding problem</p><h2>A simple introduction becomes a trail of files.</h2><p className={styles.heroLead}>Someone asks for an introduction. A family member forwards a file. Then come requests for a newer photo, a corrected detail, or a horoscope. Soon different conversations hold different versions and more personal information than anyone meant to share.</p></div>
          <div className={styles.problemGrid}>{problems.map(({ icon: Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
        </section>

        <section id="privacy" className={styles.controlSection}>
          <div className={styles.controlIntro}><p className={styles.eyebrow}>What VivIntro changes</p><h2>Share the introduction. Decide on the rest.</h2><p>Make one Introduction for people with the link. Keep contact details, horoscope files, and other protected information for a later step. A viewer confirms their email and asks; the owner decides whether to give access.</p><div className={styles.accessFlow}><span>Shared introduction</span><ArrowRight aria-hidden="true" /><span>Email-confirmed request</span><ArrowRight aria-hidden="true" /><strong>Up to 15 days of approved access</strong></div></div>
          <div className={styles.controlGrid}>{values.map(({ icon: Icon, label, title, body }) => <article key={title}><Icon aria-hidden="true" /><span>{label}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          <div className={styles.trustFacts}><span><Globe2 aria-hidden="true" />A shared link can be forwarded.</span><span><LockKeyhole aria-hidden="true" />Protected details need approval.</span><span><UserCheck aria-hidden="true" />A request can be set aside privately.</span><span><RefreshCw aria-hidden="true" />Access can be ended early.</span></div>
        </section>

        <GuidedTour />

        <section id="viewer" className={styles.familySection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>If you received a link</p><h2>Read first. Request more only if you want to continue.</h2></div>
          <div className={styles.familyGrid}><article><span className={styles.eyebrow}>01</span><h3>Open the introduction</h3><p>No app or account is required to read the shared view.</p></article><article><span className={styles.eyebrow}>02</span><h3>Decide whether it feels relevant</h3><p>If you want to continue, confirm your email and request protected access.</p></article><article><span className={styles.eyebrow}>03</span><h3>Respect the owner’s decision</h3><p>The owner may approve the request or set it aside privately. Approved access lasts up to 15 days.</p></article><article><Link href="/received-a-link" className={styles.secondaryButton}>Read the viewer guide <ArrowRight aria-hidden="true" /></Link></article></div>
        </section>

        <section id="samples" className={styles.samplesSection}>
          <div className={styles.samplesHeading}><div className={styles.sectionHeading}><p className={styles.eyebrow}>See the format</p><h2>See what a family actually receives.</h2></div><p>Open Ananya Mehta’s fictional Introduction. You can read the shared view and see where a real viewer would request protected access. The sample does not reveal a Complete Portfolio.</p></div>
          <div className={styles.betaActions}><Link href="/demo" className={styles.primaryButton}>View a sample introduction <ArrowRight aria-hidden="true" /></Link><Link href="/received-a-link" className={styles.secondaryButton}>Read the viewer guide</Link></div><p className={styles.sampleNote}>Ananya Mehta, her family, and every detail in this demonstration are fictional.</p>
        </section>

        <section id="trust" className={styles.familySection}>
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Before you share</p><h2>Know what remains in your control.</h2></div>
          <div className={styles.familyGrid}>{trustFacts.map(({ icon: Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{body}</p></article>)}</div><div className={styles.betaActions}><Link href="/trust" className={styles.secondaryButton}>Read how VivIntro handles trust</Link><Link href="/privacy" className={styles.secondaryButton}>Privacy policy</Link></div>
        </section>

        <section id="beta" className={styles.betaSection}>
          <div className={styles.betaCopy}><p className={styles.eyebrow}>A considered private pilot</p><h2>For families already making introductions.</h2><p>When someone comes through a relative, friend, community network, or matchmaker, share one current Introduction instead of assembling another file. VivIntro helps you introduce someone to the people you choose. It does not search for or recommend matches.</p></div>
          <div className={styles.betaDetails}><span><BadgeCheck aria-hidden="true" /><strong>The person stays in control</strong>Family members can offer input, but the person creates and publishes their own portfolio and decides who receives protected access.</span><span><MessageCircle aria-hidden="true" /><strong>Use familiar channels</strong>Send the link through WhatsApp, email, relatives, or the matchmaker your family already uses.</span><span><UserCheck aria-hidden="true" /><strong>Free during the private pilot</strong>Request an invitation first. Creating a portfolio begins only after an invitation is issued.</span></div>
          <div className={styles.betaActions}><Link href="/waitlist" className={styles.primaryButton}>Request an invitation <ArrowRight aria-hidden="true" /></Link><Link href="/login" className={styles.secondaryButton}>Existing participant? Sign in</Link></div>
        </section>

        <section id="questions" className={styles.faqSection}><div className={styles.sectionHeading}><p className={styles.eyebrow}>Questions</p><h2>Know exactly what happens.</h2></div><div className={styles.faqList}>{landingFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></section>
        <section className={styles.finalCta}><div><p className={styles.eyebrow}>Private pilot</p><h2>Make the next introduction easier to share.</h2><p>Keep one current view for the first conversation and decide when to share more.</p></div><div className={styles.finalAction}><Link href="/waitlist" className={styles.lightButton}>Request an invitation <ArrowRight aria-hidden="true" /></Link><span>Portfolio creation begins only after you are invited.</span></div></section>
      </main>

      <footer className={styles.footer}><VivIntroBrand href="/" variant="full-symbol" className={styles.brand} /><p>A thoughtful way to share private marriage introductions.</p><div><Link href="/about">About</Link><Link href="/trust">Trust</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </div>
  );
}

function PortfolioPreview() {
  return <div className={styles.visual} aria-label="Fictional example VivIntro introduction"><div className={styles.visualGlow} aria-hidden="true" /><div className={styles.floatingMessage}><ShieldCheck aria-hidden="true" /><span><strong>Protected details</strong>Approval required</span></div><article className={styles.portfolioCard}><header><span><VivIntroBrand variant="full-symbol" tone="primary" decorative displayWidth={20} /></span><span><ShieldCheck aria-hidden="true" /> Public Introduction</span></header><div className={styles.portfolioBody}><div className={styles.portrait}><span>AR</span></div><div className={styles.introduction}><span className={styles.verified}>Fictional example</span><p>A marriage introduction</p><h2>Ananya</h2><strong>Product designer · Bengaluru</strong><p>Thoughtful, curious, close to family, and always learning.</p></div></div><footer><span>Story</span><span>Journey</span><span>Family</span><span>Gallery</span></footer></article><div className={styles.previewLifecycle}><span><small>01 · Link shared</small><strong>Introduction</strong></span><ArrowRight aria-hidden="true" /><span><small>02 · Email confirmed</small><strong>Access request</strong></span><ArrowRight aria-hidden="true" /><span data-approved><small>03 · Owner decides</small><strong>Approve or set aside</strong></span></div></div>;
}
