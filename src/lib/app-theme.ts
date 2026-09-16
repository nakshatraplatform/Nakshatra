export type AppTheme = "light" | "dark";

export const APP_THEME_STORAGE_KEY = "nakshatra-app-theme";

export function parseAppTheme(value: unknown): AppTheme {
  return value === "dark" ? "dark" : "light";
}

// Static trusted source only. Never interpolate a stored value into executable code.
// Runs during HTML parsing, before React or the first body paint.
export const APP_THEME_INIT_SCRIPT = `(()=>{let theme="light";try{if(window.localStorage.getItem("nakshatra-app-theme")==="dark")theme="dark"}catch{}document.documentElement.dataset.appTheme=theme})()`;
