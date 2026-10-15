"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { Heart, Menu, X } from "lucide-react";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import styles from "@/components/templates/PortfolioChrome.module.css";

export type PortfolioSectionLink = { href: string; label: string };

function subscribeToHash(update: () => void) {
  window.addEventListener("hashchange", update);
  return () => window.removeEventListener("hashchange", update);
}
const currentHash = () => window.location.hash || "#main-content";
const initialHash = () => "#main-content";

/** Presentation-only navigation: destinations come from already rendered chapters. */
export function PortfolioNav({ sections, showInterest, appearance = "light" }: { sections: PortfolioSectionLink[]; showInterest: boolean; appearance?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const menuId = useId();
  const interestTipId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const hash = useSyncExternalStore(subscribeToHash, currentHash, initialHash);

  return (
    <header className={styles.header} onKeyDown={event => {
      if (event.key === "Escape") setTipDismissed(true);
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <div className={styles.headerInner}>
        <VivIntroBrand href="#main-content" variant="horizontal" tone={appearance === "dark" ? "reverse" : "primary"} className={styles.brand} />
        {showInterest && <span className={styles.interestAction} data-tip-dismissed={tipDismissed} onMouseEnter={() => setTipDismissed(false)} onFocus={() => setTipDismissed(false)}><a className={styles.interest} href="#portfolio-interest" aria-label="Show Interest" aria-describedby={interestTipId} onClick={() => { setOpen(false); setTipDismissed(true); }}><Heart aria-hidden="true" /></a><span id={interestTipId} role="tooltip" className={styles.tooltip}>Show Interest</span></span>}
        <button ref={trigger} type="button" className={styles.menuButton} aria-label={open ? "Close portfolio sections" : "Open portfolio sections"} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav id={menuId} className={styles.sections} data-open={open} aria-label="Introduction quick actions">
          {sections.map(section => <a key={section.href} href={section.href} aria-current={hash === section.href ? "location" : undefined} onClick={() => {
            setOpen(false);
            document.getElementById(section.href.slice(1))?.focus({ preventScroll: true });
          }}>{section.label}</a>)}
        </nav>
      </div>
    </header>
  );
}
