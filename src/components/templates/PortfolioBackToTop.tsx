"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function PortfolioBackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > Math.max(600, window.innerHeight * 0.8));
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="portfolio-back-to-top"
      onClick={() => window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })}
      aria-label="Back to top of introduction"
    >
      <ArrowUp aria-hidden="true" />
      <span>Top</span>
    </button>
  );
}
