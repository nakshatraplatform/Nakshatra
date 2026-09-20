import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { ThemeSwitch } from "./ThemeSwitch";

/** Compact navigation for standalone verification and unavailable-state screens. */
export function ThemeNavigation() {
  return <nav className="app-theme-navigation" aria-label="Application navigation"><VivIntroBrand href="/" variant="compact-symbol" /><ThemeSwitch /></nav>;
}
