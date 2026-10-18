"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import styles from "./PortfolioChrome.module.css";

/** Only threshold changes cause a render, including jumps past the threshold. */
export function PortfolioBackToTop() {
  const [pastThreshold, setPastThreshold] = useState(false);
  const [nearActions, setNearActions] = useState(false);
  useEffect(() => {
    let threshold = 0;
    let visible = false;
    const update = () => {
      const next = threshold > 0 && window.scrollY >= threshold;
      if (next !== visible) { visible = next; setPastThreshold(next); }
    };
    const position = () => {
      threshold = Math.max(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.35);
      update();
    };
    position();
    const blocked = new Set<Element>();
    const actions = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? blocked.add(entry.target) : blocked.delete(entry.target));
      setNearActions(blocked.size > 0);
    }, { rootMargin: "24px" });
    document.querySelectorAll('[data-portfolio-footer], #portfolio-interest').forEach(element => actions.observe(element));
    const resize = new ResizeObserver(position);
    resize.observe(document.body);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", update, { passive: true });
    return () => { actions.disconnect(); resize.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", update); };
  }, []);
  return pastThreshold && !nearActions ? <button type="button" className={styles.backToTop} aria-label="Back to Top" onClick={() => {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }}><ArrowUp aria-hidden="true" /><span>Top</span></button> : null;
}
