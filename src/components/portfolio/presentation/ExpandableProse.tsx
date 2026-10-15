"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./PortfolioPrimitives.module.css";

/** Discloses only prose already authorized by the server for this viewer. */
export function ExpandableProse({ text, label, className = "portfolio-long-copy" }: {
  text: string; label: string; className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > 600;
  const boundary = text.lastIndexOf(" ", 480);
  const preview = text.slice(0, boundary >= 320 ? boundary : 480).trimEnd();
  const collapsed = long && !expanded;
  return <div className={styles.prose}>
    <p id={id} className={`${styles.proseText} ${className}`} data-collapsed={collapsed}>
      {collapsed ? `${preview}…` : text}
    </p>
    {long && <button type="button" className={styles.textAction} aria-expanded={expanded} aria-controls={id}
      aria-label={`${expanded ? "Read less" : "Read more"}: ${label}`} onClick={() => setExpanded(value => !value)}>
      {expanded ? "Read less" : "Read more"}<ChevronDown aria-hidden="true" data-expanded={expanded} />
    </button>}
  </div>;
}
