"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function MeaningMotion({ children, className }: { children: ReactNode; className: string }) {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(min-width: 1000px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)", () => {
      if (!root.current) return;
      const letters = root.current.querySelectorAll("[data-vivara-letter]");
      const rule = root.current.querySelector("[data-meaning-rule]");
      // Lettering settles into a name; this finite reveal is deliberately
      // different from the scroll-scrubbed product and bookshelf sequences.
      gsap.from(letters, { y: 16, rotation: -5, stagger: .065, duration: .65, ease: "power3.out", scrollTrigger: { trigger: root.current, start: "top 75%", once: true } });
      gsap.from(rule, { scaleX: 0, transformOrigin: "left center", duration: 1, ease: "power3.out", scrollTrigger: { trigger: root.current, start: "top 75%", once: true } });
    });
    return () => media.revert();
  }, { scope: root });
  return <section id="vivara" className={className} aria-labelledby="vivara-heading" ref={root}>{children}</section>;
}
