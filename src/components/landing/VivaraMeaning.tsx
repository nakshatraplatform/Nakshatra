import styles from "./LandingExperience.module.css";
import { MeaningMotion } from "./MeaningMotion";

export function VivaraMeaning() {
  return (
    <MeaningMotion className={styles.meaningSection}>
      <div className={styles.sectionHeading}>
        <h2 id="vivara-heading">Why we call it a <span className={styles.vivaraWord} data-vivara-word aria-label="Vivara"><span aria-hidden="true">{[..."Vivara"].map((letter, index) => <span key={index} data-vivara-letter>{letter}</span>)}</span></span></h2>
        <p className={styles.kannadaWord} lang="kn">ವಿವರ</p>
        <div className={styles.meaningRule} data-meaning-rule aria-hidden="true" />
      </div>
      <div className={styles.meaningCopy}>
        <p>In Kannada, <em>vivara</em> can mean an explanation or account in detail. We chose it for the space you share when you want a prospective partner to get to know you.</p>
        <p>Getting to know a prospective partner involves more than qualifications and photographs. There is family, everyday life, what matters to you and the future you hope to build together.</p>
        <p>We call your shared page a Vivara because it makes room for that fuller account. A formal, soulful beginning to a conversation, with private details shared when you choose. Understanding each other still takes time and conversation.</p>
        <dl className={styles.meaningTerms}>
          <div><dt>VivIntro</dt><dd>The application. “Viv” comes from Vivah, meaning marriage; “Intro” refers to making an introduction.</dd></div>
          <div><dt>Vivara</dt><dd>Your personal page, shared through one link. You keep it current and decide who can access its private details.</dd></div>
        </dl>
        <a className={styles.meaningSource} href="https://alar.ink/dictionary/kannada/english/%E0%B2%B5%E0%B2%BF%E0%B2%B5%E0%B2%B0">Read the Kannada dictionary entry for vivara</a>
      </div>
    </MeaningMotion>
  );
}
