import Link from "next/link";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import styles from "./PortfolioChrome.module.css";

export function PortfolioFooter({ livenessChecked, appearance = "light" }: { livenessChecked: boolean; appearance?: "light" | "dark" }) {
  return (
    <footer className={styles.footer} data-portfolio-footer>
      <div className={styles.footerIdentity}>
        <VivIntroBrand href="/" openInNewTab variant="horizontal" tone={appearance === "dark" ? "reverse" : "primary"} displayWidth={132} />
        <p>One introduction, shared with care.</p>
      </div>
      <nav className={styles.policies} aria-label="Portfolio help and policies">
        <Link href="/received-a-link">Viewer guide</Link>
        <Link href="/terms#data-accuracy">Terms &amp; data accuracy</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/privacy#corrections">Report or correct information</Link>
      </nav>
      <div className={styles.footerNote}>
        <p>{livenessChecked ? "Liveness checked means a live person completed the check. It does not verify identity, photos or profile details, or endorse a match." : "Profile details are provided by the introduction owner. Review them carefully before making a decision."}</p>
        <a href="#portfolio-top">Back to top</a>
      </div>
    </footer>
  );
}
