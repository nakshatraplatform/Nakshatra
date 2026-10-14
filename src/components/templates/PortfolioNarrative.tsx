"use client";

import { useId, useState } from "react";

/** Disclosure changes only presentation of text already authorized for this view. */
export function PortfolioNarrative({ text, label, className = "portfolio-long-copy" }: {
  text: string; label: string; className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > 600;
  const boundary = text.lastIndexOf(" ", 480);
  const preview = text.slice(0, boundary >= 320 ? boundary : 480).trimEnd();
  return <div className="portfolio-narrative-disclosure">
    <p id={id} className={className}>{long && !expanded ? `${preview}…` : text}</p>
    {long && <button type="button" className="portfolio-text-action" aria-expanded={expanded} aria-controls={id}
      aria-label={`${expanded ? "Read less" : "Read more"}: ${label}`} onClick={() => setExpanded(value => !value)}>
      {expanded ? "Read less" : "Read more"}
    </button>}
  </div>;
}
