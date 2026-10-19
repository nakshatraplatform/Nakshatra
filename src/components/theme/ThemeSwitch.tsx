"use client";

import { useSyncExternalStore } from "react";
import { Moon, SunMedium } from "lucide-react";
import { useAppTheme } from "./AppThemeProvider";

const subscribeToHydration = () => () => {};

export function ThemeSwitch() {
  const { theme, setTheme } = useAppTheme();
  // A streamed editor may hydrate after its parent theme context has changed.
  // Match its server attributes first; root-theme CSS already paints the saved pose.
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const isDarkMode = hydrated && theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDarkMode}
      aria-label="Dark mode"
      title={isDarkMode ? "Use light theme" : "Use dark theme"}
      className="app-theme-switch"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <span className="app-theme-track" aria-hidden="true">
        <span className="app-theme-thumb">
          <SunMedium className="app-theme-sun" size={16} />
          <Moon className="app-theme-moon" size={16} />
        </span>
      </span>
    </button>
  );
}
