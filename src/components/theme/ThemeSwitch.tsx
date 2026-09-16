"use client";

import { Moon, Sun } from "lucide-react";
import { useAppTheme } from "./AppThemeProvider";

export function ThemeSwitch() {
  const { theme, setTheme } = useAppTheme();
  const next = theme === "light" ? "dark" : "light";
  const label = `Switch to ${next === "dark" ? "Dark" : "Light"} theme`;

  return (
    <button type="button" className="app-theme-switch" aria-label={label} title={label} onClick={() => setTheme(next)}>
      <Moon className="app-theme-moon" aria-hidden="true" size={18} />
      <Sun className="app-theme-sun" aria-hidden="true" size={18} />
    </button>
  );
}
