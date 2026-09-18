"use client";

import { useEffect, useState } from "react";
import styles from "./LandingExperience.module.css";

const sections = [
  { id: "top", label: "Top" },
  { id: "why", label: "Why" },
  { id: "control", label: "Control" },
  { id: "how", label: "Tour" },
  { id: "samples", label: "Samples" },
  { id: "beta", label: "Beta" },
  { id: "questions", label: "Questions" },
] as const;

export function LandingSectionRail() {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("top");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
        const id = visible[0]?.target.id as (typeof sections)[number]["id"] | undefined;
        if (id) setActiveSection(id);
      },
      { rootMargin: "-18% 0px -68%", threshold: [0, 0.1, 0.5] }
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <nav className={styles.sectionRail} aria-label="Page sections">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={activeSection === section.id ? "location" : undefined}
          onClick={() => setActiveSection(section.id)}
        >
          <span>{section.label}</span>
          <i aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}
