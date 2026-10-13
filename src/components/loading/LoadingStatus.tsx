"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";
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
  const resolvedTheme = appearance ?? theme;
  return <span className={styles.orb} data-size={size} aria-hidden="true">
    <ThinkingOrb size={size} state={state} theme={resolvedTheme}
      color={resolvedTheme === "dark" ? "#edc978" : "#16505a"} aria-hidden="true" />
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
