import type { ReactNode } from "react";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import styles from "./BrokerDeskHeader.module.css";

type BrokerDeskHeaderProps = {
  children: ReactNode;
  homeHref?: string;
  label?: string;
  navigationLabel?: string;
  sticky?: boolean;
};

export function BrokerDeskHeader({
  children,
  homeHref = "/brokerdesk",
  label = "BrokerDesk",
  navigationLabel = "BrokerDesk navigation",
  sticky = false,
}: BrokerDeskHeaderProps) {
  return (
    <header className={styles.header} data-sticky={sticky}>
      <VivIntroBrand href={homeHref} variant="horizontal" />
      <span className={styles.context}>{label}</span>
      <nav className={styles.navigation} aria-label={navigationLabel}>{children}</nav>
      <div className={styles.actions}><ThemeSwitch /></div>
    </header>
  );
}
