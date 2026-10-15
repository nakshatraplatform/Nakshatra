import type { ReactNode } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandMotif } from "@/components/brand/BrandMotif";
import styles from "./PortfolioPrimitives.module.css";

export function ChapterHeading({ number, eyebrow, title, id }: {
  number?: number; eyebrow: string; title: string; id: string;
}) {
  return <div className={styles.chapterHeading} data-portfolio-heading="">
    <p className={styles.eyebrow}>
      {number !== undefined && <span aria-hidden="true">{String(number).padStart(2, "0")}</span>}
      <span>{eyebrow}</span>
    </p>
    <h2 id={id} tabIndex={-1}>{title}</h2>
  </div>;
}

export function TrustBadge() {
  return <span className={styles.trustBadge} aria-label="Liveness checked. A live person completed liveness checks. This does not verify legal identity, portfolio photo ownership, profile statements, or endorse a match." title="Liveness checked">
    <ShieldCheck aria-hidden="true" strokeWidth={1.5} />Liveness checked
  </span>;
}

export function IconDataRow({ icon, label, title, subtitle, children }: {
  icon: ReactNode; label?: string; title: string; subtitle?: string; children?: ReactNode;
}) {
  return <article className={styles.dataRow}>
    <div className={styles.dataIcon} aria-hidden="true">{icon}</div>
    <div className={styles.dataContent}>
      {label && <span className={styles.dataLabel}>{label}</span>}
      <h3>{title}</h3>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children}
    </div>
  </article>;
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className={styles.pill}>{children}</span>;
}

/** A presentation gate, never an authorization decision or a source of data. */
export function ProtectedDataVault({ title = "More details shared after approval", detail = "Names, occupations, and exact locations stay protected.", showAction = false }: {
  title?: string; detail?: string; showAction?: boolean;
}) {
  return <div className={styles.vault}>
    <BrandMotif />
    <LockKeyhole className={styles.vaultIcon} aria-hidden="true" strokeWidth={1.5} />
    <p><strong>{title}</strong><span>{detail}</span></p>
    {showAction && <a href="#portfolio-interest" className={styles.textAction}>Show interest</a>}
  </div>;
}
