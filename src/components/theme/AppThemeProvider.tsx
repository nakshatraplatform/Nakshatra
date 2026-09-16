"use client";

import { createContext, useContext, useLayoutEffect, useSyncExternalStore } from "react";
import { APP_THEME_STORAGE_KEY, parseAppTheme, type AppTheme } from "@/lib/app-theme";

const THEME_EVENT = "nakshatra:app-theme";

function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.appTheme = theme;
  window.dispatchEvent(new Event(THEME_EVENT));
}

function setTheme(theme: AppTheme) {
  applyTheme(theme);
  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the mounted application's preference still works.
  }
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== APP_THEME_STORAGE_KEY && event.key !== null) return;
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    applyTheme(parseAppTheme(event.newValue));
  }
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => parseAppTheme(document.documentElement.dataset.appTheme);
const getServerSnapshot = (): AppTheme => "light";
const ThemeContext = createContext({ theme: "light" as AppTheme, setTheme });

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useLayoutEffect(() => {
    // Next development StrictMode remounts can reset attributes on <html>.
    // Reapply before paint; the static head script handles the initial paint.
    try {
      applyTheme(parseAppTheme(window.localStorage.getItem(APP_THEME_STORAGE_KEY)));
    } catch {
      applyTheme(getSnapshot());
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
