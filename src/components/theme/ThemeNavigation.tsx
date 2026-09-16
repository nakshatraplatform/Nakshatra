import Link from "next/link";
import { ThemeSwitch } from "./ThemeSwitch";

/** Compact navigation for standalone verification and unavailable-state screens. */
export function ThemeNavigation() {
  return <nav className="app-theme-navigation" aria-label="Application navigation"><Link href="/">Nakshatra home</Link><ThemeSwitch /></nav>;
}
