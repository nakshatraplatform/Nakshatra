import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/** Focused Safari-engine regression; does not replace the existing browser gate. */
export default defineConfig({ ...base, testMatch: ["portfolio-interest-polish.spec.ts", "split-accent-publishing.spec.ts"], projects: [
  { name: "mobile-webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } },
] });
