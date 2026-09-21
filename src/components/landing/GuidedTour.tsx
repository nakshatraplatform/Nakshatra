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
    body: "Add your story, family background, photographs, and horoscope in a guided form. Save as you go and finish in your own time.",
    points: ["Guided sections", "Save as you go", "Private until publication"],
    icon: FilePenLine,
  },
  {
    number: "02",
    label: "Preview and verify",
    title: "See every view before anyone else does.",
    body: "Compare the shared Introduction with the protected Complete Portfolio, then complete the required identity check before publication.",
    points: ["Shared Introduction preview", "Protected view preview", "Identity check"],
    icon: BadgeCheck,
  },
  {
    number: "03",
    label: "Share",
    title: "Send one link that stays current.",
    body: "Publish when you are ready and share through WhatsApp, email, or wherever your family already talks. Future updates remain at the same link.",
    points: ["One current link", "No app required", "Unpublish or replace anytime"],
    icon: Send,
  },
  {
    number: "04",
    label: "Approve",
    title: "Open protected details deliberately.",
    body: "Review verified interest in your dashboard and decide who receives Complete Portfolio access for 15 days.",
    points: ["Verified email request", "Owner approval", "Access can end early"],
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
          <h2>Four moves from a private draft to approved access.</h2>
          <p>Choose a step or scroll through the four-stage path from private draft to approved access.</p>
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
      <div className={styles.tourVisual} data-visual="create" aria-label="Example private portfolio draft">
        <div className={styles.tourWindowBar}><span /><span /><span /><small>Private draft</small></div>
        <div className={styles.tourFormRows}><span /><span /><span /><span /></div>
        <div className={styles.tourSaveState}><Check aria-hidden="true" />Changes saved</div>
      </div>
    );
  }

  if (step === "02") {
    return (
      <div className={styles.tourVisual} data-visual="preview" aria-label="Introduction preview choices">
        <div className={styles.tourWindowBar}><span /><span /><span /><small>Preview views</small></div>
        <div className={styles.tourPreviewTabs}><strong>Introduction</strong><strong>Protected</strong><strong>Owner</strong></div>
        <div className={styles.tourPreviewCard}><BadgeCheck aria-hidden="true" /><span><small>Identity status</small><strong>Ready for verification</strong></span></div>
      </div>
    );
  }

  if (step === "03") {
    return (
      <div className={styles.tourVisual} data-visual="share" aria-label="Current portfolio link">
        <div className={styles.tourWindowBar}><span /><span /><span /><small>Published link</small></div>
        <div className={styles.tourLinkCard}><Link2 aria-hidden="true" /><span><small>vivintro.com/p/</small><strong>3Gk7mP2xQ8vL5cN1</strong></span></div>
        <div className={styles.tourChannels}><span>WhatsApp</span><span>Email</span><span>Copy link</span></div>
      </div>
    );
  }

  return (
    <div className={styles.tourVisual} data-visual="approve" aria-label="Verified interest request">
      <div className={styles.tourWindowBar}><span /><span /><span /><small>Interest request</small></div>
      <div className={styles.tourRequestCard}><ShieldCheck aria-hidden="true" /><span><small>Email confirmed</small><strong>Protected access requested</strong></span></div>
      <div className={styles.tourDecision}><span>Set aside</span><strong>Approve 15 days</strong></div>
    </div>
  );
}
