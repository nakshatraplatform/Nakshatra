"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { useLayoutEffect, useRef, useState } from "react";
import { useAppTheme } from "@/components/theme/AppThemeProvider";
import type { AppTheme } from "@/lib/app-theme";
import styles from "./LoadingStatus.module.css";

type LoadingStatusProps = {
  title: string;
  detail?: string;
  state?: OrbState;
  compact?: boolean;
  /** Public portfolio dialogs keep the owner's appearance, independent of the app theme. */
  appearance?: AppTheme;
  className?: string;
};

/** Decorative animation; the adjacent status text supplies its accessible meaning. */
export function LoadingOrb({ size = 32, state = "working", appearance }: {
  size?: 20 | 32 | 64;
  state?: OrbState;
  appearance?: AppTheme;
}) {
  const { theme } = useAppTheme();
  const host = useRef<HTMLSpanElement>(null);
  const [ink, setInk] = useState<{ color: string; polarity: AppTheme } | null>(null);

  useLayoutEffect(() => {
    if (!host.current) return;
    // Canvas cannot inherit currentColor. Resolve CSS here, not a second palette.
    // Bright button text needs the dark-substrate ramp even in the Light app.
    const color = getComputedStyle(host.current).color;
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    const bright = channels && channels.length === 3
      ? channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0) > 127
      : (appearance ?? theme) === "dark";
    const polarity = bright ? "dark" : "light";
    setInk(current => current?.color === color && current.polarity === polarity ? current : { color, polarity });
  }, [theme, appearance]);

  return <span ref={host} className={styles.orb} data-size={size} aria-hidden="true"
    style={appearance ? { colorScheme: appearance } : undefined}>
    {ink && <ThinkingOrb size={size} state={state} theme={ink.polarity}
      color={ink.color} aria-hidden="true" />}
  </span>;
}

/** Render only while its owning operation is pending; never delays that operation. */
export function LoadingStatus({ title, detail, state = "working", compact = false, appearance, className = "" }: LoadingStatusProps) {
  return <div className={`${styles.status} ${compact ? styles.compact : ""} ${className}`}
    role="status" aria-live="polite" aria-atomic="true" data-loading-status="true"
    style={appearance ? { colorScheme: appearance } : undefined}>
    <LoadingOrb size={compact ? 32 : 64} state={state} appearance={appearance} />
    <div className={styles.copy}>
      <p className={styles.title}>{title}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
    </div>
  </div>;
}
