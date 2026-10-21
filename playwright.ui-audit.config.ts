import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/** Real-engine fixture checks; not a substitute for physical iOS/Android. */
export default defineConfig({
  ...base,
  testMatch: ["frontend-hardening.spec.ts", "orb-foreground.spec.ts", "loading-feedback.spec.ts", "auth-accessibility.spec.ts", "account-profile-layout.spec.ts", "portfolio-editor-layout.spec.ts", "consent-form-clarity.spec.ts"],
  projects: [
    { name: "mobile-webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"], browserName: "firefox" } },
  ],
});
