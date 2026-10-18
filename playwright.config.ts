import { defineConfig, devices } from "@playwright/test";

const appPort = Number(process.env.E2E_APP_PORT || 3100);
const supabasePort = Number(process.env.E2E_SUPABASE_PORT || 54329);

const localBrowser = process.env.CI ? {} : { channel: "chrome" as const };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...localBrowser } },
    { name: "tablet-chromium", use: { ...devices["iPad Pro 11"], browserName: "chromium", ...localBrowser } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], ...localBrowser } },
  ],
  webServer: [
    {
      command: "node e2e/support/mock-supabase.mjs",
      url: `http://127.0.0.1:${supabasePort}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- --hostname 127.0.0.1 --port ${appPort}`,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${supabasePort}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
        SUPABASE_SERVICE_ROLE_KEY: "e2e-loopback-only-service-role-key",
        NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${appPort}`,
        // This key is scoped to the loopback mock server used by Playwright.
        RATE_LIMIT_SUBJECT_HMAC_KEY: "nakshatra-playwright-loopback-only-hmac-key-v1",
      },
      url: `http://127.0.0.1:${appPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
