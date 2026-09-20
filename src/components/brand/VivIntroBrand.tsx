import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "./VivIntroBrand.module.css";

export type VivIntroBrandVariant = "compact-symbol" | "full-symbol" | "stacked" | "wordmark";
export type VivIntroBrandTone = "primary" | "reverse" | "monochrome" | "adaptive";

type BrandMetrics = {
  width: number;
  height: number;
  defaultDisplayWidth: number;
  assetName: string;
};

const BRAND_METRICS: Record<VivIntroBrandVariant, BrandMetrics> = {
  "compact-symbol": { width: 100, height: 100, defaultDisplayWidth: 32, assetName: "symbol-compact" },
  "full-symbol": { width: 650, height: 646, defaultDisplayWidth: 72, assetName: "symbol" },
  stacked: { width: 1041, height: 887, defaultDisplayWidth: 168, assetName: "lockup-stacked" },
  wordmark: { width: 1029, height: 241, defaultDisplayWidth: 144, assetName: "wordmark" },
};

export type VivIntroBrandProps = {
  variant?: VivIntroBrandVariant;
  tone?: VivIntroBrandTone;
  href?: string;
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  displayWidth?: number;
};

/**
 * Renders the approved VivIntro artwork with stable dimensions and one accessible name.
 * Use linked compact marks in application chrome and decorative stacked marks beside an existing page heading.
 */
export function VivIntroBrand({
  variant = "compact-symbol",
  tone = "adaptive",
  href,
  className,
  decorative = false,
  priority = false,
  displayWidth,
}: VivIntroBrandProps) {
  const metrics = BRAND_METRICS[variant];
  const rootClassName = [styles.root, href ? styles.link : "", className].filter(Boolean).join(" ");
  const style = {
    "--vivintro-brand-width": `${displayWidth ?? metrics.defaultDisplayWidth}px`,
    "--vivintro-brand-ratio": `${metrics.width} / ${metrics.height}`,
  } as CSSProperties;
  const accessibleLabel = decorative ? undefined : href ? "VivIntro home" : "VivIntro";

  const artwork = (
    <span
      className={styles.artwork}
      data-brand-variant={variant}
      data-brand-tone={tone}
      style={style}
      aria-hidden={decorative || href ? true : undefined}
      aria-label={!href && accessibleLabel ? accessibleLabel : undefined}
      role={!href && accessibleLabel ? "img" : undefined}
    >
      {tone === "adaptive" ? (
        <>
          <BrandImage metrics={metrics} tone="primary" priority={priority} className={styles.primaryArtwork} />
          <BrandImage metrics={metrics} tone="reverse" priority={priority} className={styles.reverseArtwork} />
        </>
      ) : (
        <BrandImage metrics={metrics} tone={tone} priority={priority} />
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={rootClassName} aria-label={accessibleLabel}>
        {artwork}
      </Link>
    );
  }

  return <span className={rootClassName}>{artwork}</span>;
}

function BrandImage({
  metrics,
  tone,
  priority,
  className,
}: {
  metrics: BrandMetrics;
  tone: Exclude<VivIntroBrandTone, "adaptive">;
  priority: boolean;
  className?: string;
}) {
  return (
    <Image
      src={`/brand/vivintro/vivintro-${metrics.assetName}-${tone}.svg`}
      alt=""
      width={metrics.width}
      height={metrics.height}
      className={[styles.image, className].filter(Boolean).join(" ")}
      loading={priority || metrics.assetName === "lockup-stacked" ? "eager" : "lazy"}
    />
  );
}
