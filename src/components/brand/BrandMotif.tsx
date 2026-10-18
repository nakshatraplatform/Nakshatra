import styles from "./BrandMotif.module.css";

/** Decorative logo-derived arch and V; never participates in layout or focus. */
export function BrandMotif() {
  return <svg className={styles.motif} viewBox="0 0 480 480" fill="none" aria-hidden="true" focusable="false">
    <path d="M80 440V240a160 160 0 0 1 320 0v200M112 440V240a128 128 0 0 1 256 0v200M144 440V240a96 96 0 0 1 192 0v200M176 208l64 168 64-168" />
  </svg>;
}
