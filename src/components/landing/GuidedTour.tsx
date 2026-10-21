"use client";

import { useRef, useState } from "react";
import { useBookshelfMotion } from "./useBookshelfMotion";
import shelf from "./GuidedTour.module.css";
import {
  BadgeCheck,
  Check,
  FilePenLine,
  Link2,
  Send,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import styles from "./LandingExperience.module.css";

const tourSteps = [
  {
    number: "01",
    label: "Create",
    title: "Begin with a private draft.",
    body: "Write about yourself and your family. Add photos, choose your primary picture and include a horoscope document if you wish.",
    points: ["Guided sections", "Light or dark appearance", "Private until publication"],
    icon: FilePenLine,
  },
  {
    number: "02",
    label: "Review and consent",
    title: "Choose what you share.",
    body: "Check what a family can see and what stays private. Complete the camera liveness check and give consent before publishing. Previews are optional.",
    points: ["Optional previews", "Clear publication consent", "Private details stay separate"],
    icon: BadgeCheck,
  },
  {
    number: "03",
    label: "Share",
    title: "Send one link that stays current.",
    body: "Publish your Vivara and share its link through WhatsApp, email or your family. Save later edits privately, then publish the update at the same link.",
    points: ["One current link", "No app required", "Unpublish or replace anytime"],
    icon: Send,
  },
  {
    number: "04",
    label: "Share details",
    title: "Decide when to share more.",
    body: "A viewer signs in and confirms their email to Show interest. Review the request in your dashboard. Share private details for up to 15 days, or set their interest aside.",
    points: ["Your approval", "Revoke access early", "Renew for another 15 days"],
    icon: UserCheck,
  },
] as const;

export function GuidedTour() {
  const root = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [enhanced, setEnhanced] = useState(false);
  const navigate = useBookshelfMotion(root, setActiveStep, setEnhanced);

  function selectStep(event: React.MouseEvent<HTMLAnchorElement>, index: number) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!navigate.current) return;
    event.preventDefault();
    event.stopPropagation();
    navigate.current(index);
  }

  return (
    <section ref={root} id="how" className={shelf.tour} aria-labelledby="tour-heading">
      {tourSteps.map((step) => (
        <span key={step.number} id={enhanced ? `tour-step-${step.number}` : undefined} className={shelf.anchor} data-shelf-anchor aria-hidden="true" />
      ))}
      <div className={shelf.scene} data-shelf-scene>
        <header className={shelf.intro}>
          <h2 id="tour-heading">How <span className={shelf.wordmark}><span className={shelf.wordmarkText}>VivIntro</span></span> works</h2>
          <p>Create your Vivara, share its link and decide who sees more.</p>
        </header>

        <div className={shelf.stage} data-shelf-stage>
          <div className={shelf.ledge} aria-hidden="true" />
          {tourSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article
                key={step.number}
                id={enhanced ? undefined : `tour-step-${step.number}`}
                data-tour-step={step.number}
                data-shelf-book
                data-active={activeStep === index ? "true" : undefined}
                className={shelf.book}
              >
                <div className={shelf.paper} data-shelf-paper data-native-scroll aria-hidden={enhanced && activeStep !== index ? true : undefined}>
                  <span className={shelf.chapter}>Step {step.number} · {step.label}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <ul>{step.points.map((point) => <li key={point}><Check aria-hidden="true" />{point}</li>)}</ul>
                  <span className={shelf.pageNumber} aria-hidden="true">{step.number} / 04</span>
                </div>
                <div className={shelf.cover} data-shelf-cover>
                  <a
                    className={shelf.coverFront}
                    href={`#tour-step-${step.number}`}
                    onClick={(event) => selectStep(event, index)}
                    tabIndex={enhanced && activeStep === -1 ? 0 : -1}
                    aria-hidden={enhanced && activeStep >= 0 ? true : undefined}
                    aria-label={`Open step ${step.number}: ${step.label}`}
                  >
                    <span className={`${shelf.wordmark} ${shelf.coverBrand}`}><span className={shelf.wordmarkText}>VivIntro</span></span>
                    <Icon aria-hidden="true" />
                    <strong>{step.label}</strong>
                    <span className={shelf.coverNumber}>{step.number}</span>
                  </a>
                  <div className={shelf.coverInside} aria-hidden="true">
                    <TourVisual step={step.number} />
                    <small>Illustration with fictional details</small>
                  </div>
                </div>
                <div className={shelf.spine} aria-hidden="true"><span>{step.label}</span></div>
                <div className={shelf.pageEdge} aria-hidden="true" />
                <div className={shelf.staticVisual}><TourVisual step={step.number} /></div>
              </article>
            );
          })}
        </div>

        <footer className={shelf.footer}>
          <nav className={shelf.navigation} aria-label="Guided tour steps">
            {tourSteps.map((step, index) => (
              <a key={step.number} href={`#tour-step-${step.number}`} onClick={(event) => selectStep(event, index)} aria-current={activeStep === index ? "step" : undefined}>
                <span>{step.number}</span><strong>{step.label}</strong>
              </a>
            ))}
          </nav>
          <div className={shelf.footerNotes}>
            <p className={shelf.scrollHint}>Scroll to open each step, or choose a book.</p>
            <p>Illustrations use fictional details.</p>
            <a href="#viewer" className={shelf.skip}>Continue past the tour <span aria-hidden="true">↓</span></a>
          </div>
        </footer>
      </div>
    </section>
  );
}

function TourVisual({ step }: { step: string }) {
  if (step === "01") {
    return (
      <div className={styles.tourVisual} data-visual="create" aria-label="Example private Vivara draft">
        <div className={styles.tourWindowBar}><span /><span /><span /><small>Private draft</small></div>
        <dl className={styles.tourFormRows}>
          <div><dt>Name</dt><dd>Ananya Mehta</dd></div>
          <div><dt>City</dt><dd>Bengaluru</dd></div>
          <div><dt>Profession</dt><dd>Product designer</dd></div>
        </dl>
        <div className={styles.tourSaveState}><Check aria-hidden="true" />Changes saved</div>
      </div>
    );
  }

  if (step === "02") {
    return (
      <div className={styles.tourVisual} data-visual="preview" aria-label="Vivara preview choices">
        <div className={styles.tourWindowBar}><span /><span /><span /><small>Optional previews</small></div>
        <div className={styles.tourPreviewTabs}><strong>Public Vivara</strong><strong>Private details</strong></div>
        <div className={styles.tourPreviewCard}><BadgeCheck aria-hidden="true" /><span><small>Before publishing</small><strong>Confirm your consent</strong></span></div>
      </div>
    );
  }

  if (step === "03") {
    return (
      <div className={styles.tourVisual} data-visual="share" aria-label="Current Vivara link">
        <div className={styles.tourWindowBar}><span /><span /><span /><small>Published link</small></div>
        <div className={styles.tourLinkCard}><Link2 aria-hidden="true" /><span><small>Example share link</small><strong>vivintro.com/p/…</strong></span></div>
        <div className={styles.tourChannels}><span>WhatsApp</span><span>Email</span><span>Copy link</span></div>
      </div>
    );
  }

  return (
    <div className={styles.tourVisual} data-visual="approve" aria-label="Illustrated email-confirmed interest">
      <div className={styles.tourWindowBar}><span /><span /><span /><small>Interest</small></div>
      <div className={styles.tourRequestCard}><ShieldCheck aria-hidden="true" /><span><small>Email confirmed</small><strong>Interest received</strong></span></div>
      <div className={styles.tourDecision}><span>Set aside</span><strong>Share details</strong></div>
    </div>
  );
}
