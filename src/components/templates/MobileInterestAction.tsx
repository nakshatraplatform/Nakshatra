"use client";

import { useEffect, useState } from "react";

/** Keeps the interest action within thumb reach after the compact header leaves view. */
export function MobileInterestAction() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const header = document.querySelector(".portfolio-header");
    if (!header || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return <a className="portfolio-mobile-interest-action" data-visible={visible} href="#portfolio-interest">Show interest</a>;
}
