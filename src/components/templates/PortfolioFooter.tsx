import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import styles from "./PortfolioChrome.module.css";

export function PortfolioFooter({ livenessChecked }: { livenessChecked: boolean }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerIdentity}>
        <VivIntroBrand variant="horizontal" decorative displayWidth={132} />
        <p>One introduction, shared with care.</p>
      </div>
      <nav className={styles.policies} aria-label="Portfolio help and policies">
        <a href="/received-a-link">Viewer guide</a>
        <a href="/terms#data-accuracy">Terms &amp; data accuracy</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/privacy#corrections">Report or correct information</a>
      </nav>
      <div className={styles.footerNote}>
        <p>{livenessChecked ? "Liveness checked means a live person completed the check. It does not verify identity, photos or profile details, or endorse a match." : "Profile details are provided by the introduction owner. Review them carefully before making a decision."}</p>
        <a href="#portfolio-top">Back to top</a>
      </div>
    </footer>
  );
}
