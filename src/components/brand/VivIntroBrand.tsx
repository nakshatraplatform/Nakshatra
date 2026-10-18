import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "./VivIntroBrand.module.css";

export type VivIntroBrandVariant = "full-symbol" | "horizontal" | "stacked";
export type VivIntroBrandTone = "primary" | "reverse" | "monochrome" | "adaptive";

type BrandMetrics = {
  width: number;
  height: number;
  defaultDisplayWidth: number;
  assetName: string;
};

const BRAND_METRICS: Record<VivIntroBrandVariant, BrandMetrics> = {
  "full-symbol": { width: 650, height: 646, defaultDisplayWidth: 32, assetName: "symbol" },
  horizontal: { width: 680, height: 180, defaultDisplayWidth: 196, assetName: "lockup-horizontal" },
  stacked: { width: 1041, height: 887, defaultDisplayWidth: 168, assetName: "lockup-stacked" },
};

export type VivIntroBrandProps = {
  variant?: VivIntroBrandVariant;
  tone?: VivIntroBrandTone;
  href?: string;
  openInNewTab?: boolean;
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  displayWidth?: number;
};

/**
 * Renders the approved VivIntro artwork with stable dimensions and one accessible name.
 * Use the horizontal lockup in application navigation, the ornate symbol for icon-only placements,
 * and the stacked lockup on standalone trust-sensitive screens.
 */
export function VivIntroBrand({
  variant = "full-symbol",
  tone = "adaptive",
  href,
  openInNewTab = false,
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
  const accessibleLabel = decorative ? undefined : href
    ? openInNewTab ? "VivIntro home — opens in a new tab" : "VivIntro home"
    : "VivIntro";

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
          <BrandImage metrics={metrics} tone="primary" priority={priority} adaptive className={styles.primaryArtwork} />
          <BrandImage metrics={metrics} tone="reverse" priority={priority} adaptive className={styles.reverseArtwork} />
        </>
      ) : (
        <BrandImage metrics={metrics} tone={tone} priority={priority} />
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} target={openInNewTab ? "_blank" : undefined} rel={openInNewTab ? "noopener noreferrer" : undefined} className={rootClassName} aria-label={accessibleLabel}>
        {artwork}
      </Link>
    );
  }

  return <span className={rootClassName}>{artwork}</span>;
}

function BrandImage({
  adaptive = false,
  metrics,
  tone,
  priority,
  className,
}: {
  metrics: BrandMetrics;
  tone: Exclude<VivIntroBrandTone, "adaptive">;
  adaptive?: boolean;
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
      loading={priority ? "eager" : "lazy"}
      // CSS chooses one adaptive artwork; React must not preload both alternatives.
      fetchPriority={adaptive ? "low" : undefined}
    />
  );
}
