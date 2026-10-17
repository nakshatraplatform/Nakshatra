"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
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
    body: "Fill in guided sections. Everything saves privately as you go. Add optional details when you’re ready.",
    points: ["Guided sections", "Save as you go", "Private until publication"],
    icon: FilePenLine,
  },
  {
    number: "02",
    label: "Review and consent",
    title: "Choose what you share.",
    body: "Complete the publishing checks, then give consent. Open either preview if you’d like; previews are optional.",
    points: ["Optional previews", "Clear publication consent", "Private details stay separate"],
    icon: BadgeCheck,
  },
  {
    number: "03",
    label: "Share",
    title: "Send one link that stays current.",
    body: "Publish and send one link on WhatsApp or email. Publish future updates at the same link, without sending another PDF.",
    points: ["One current link", "No app required", "Unpublish or replace anytime"],
    icon: Send,
  },
  {
    number: "04",
    label: "Share details",
    title: "Decide when to share more.",
    body: "When someone taps Show interest, they confirm their email. Share details for up to 15 days, or quietly set their interest aside.",
    points: ["Show interest", "Your choice", "Access can end early"],
    icon: UserCheck,
  },
] as const;

export function GuidedTour() {
  const [activeStep, setActiveStep] = useState("01");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
        const step = visible[0]?.target.getAttribute("data-tour-step");
        if (step) setActiveStep(step);
      },
      { rootMargin: "-16% 0px -56%", threshold: [0, 0.2, 0.55] }
    );

    for (const step of tourSteps) {
      const element = document.getElementById(`tour-step-${step.number}`);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="how" className={styles.guidedTour}>
      <div className={styles.guidedTourInner}>
        <div className={styles.guidedTourIntro}>
          <p className={styles.eyebrow}>A guided tour</p>
          <h2>How VivIntro works</h2>
          <p>Create. Share. You decide. No app needed.</p>
          <p className={styles.tourExampleNote}>Illustrations below use fictional details.</p>
          <nav className={styles.tourNavigation} aria-label="Guided tour steps">
            {tourSteps.map((step) => (
              <a
                key={step.number}
                href={`#tour-step-${step.number}`}
                aria-current={activeStep === step.number ? "step" : undefined}
                onClick={() => setActiveStep(step.number)}
              >
                <span>{step.number}</span>
                <strong>{step.label}</strong>
              </a>
            ))}
          </nav>
        </div>

        <div className={styles.tourStack}>
          {tourSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article
                key={step.number}
                id={`tour-step-${step.number}`}
                data-tour-step={step.number}
                className={styles.tourCard}
                style={{ "--tour-index": index } as CSSProperties}
              >
                <div className={styles.tourCardCopy}>
                  <div className={styles.tourCardLabel}><Icon aria-hidden="true" /><span>Step {step.number} · {step.label}</span></div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <ul>{step.points.map((point) => <li key={point}><Check aria-hidden="true" />{point}</li>)}</ul>
                </div>
                <TourVisual step={step.number} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TourVisual({ step }: { step: string }) {
  if (step === "01") {
    return (
      <div className={styles.tourVisual} data-visual="create" aria-label="Example private introduction draft">
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
      <div className={styles.tourVisual} data-visual="preview" aria-label="Introduction preview choices">
        <div className={styles.tourWindowBar}><span /><span /><span /><small>Optional previews</small></div>
        <div className={styles.tourPreviewTabs}><strong>Introduction</strong><strong>Private details</strong></div>
        <div className={styles.tourPreviewCard}><BadgeCheck aria-hidden="true" /><span><small>Before publishing</small><strong>Confirm your consent</strong></span></div>
      </div>
    );
  }

  if (step === "03") {
    return (
      <div className={styles.tourVisual} data-visual="share" aria-label="Current introduction link">
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
