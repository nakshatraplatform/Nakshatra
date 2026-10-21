import { defineConfig, devices } from "@playwright/test";

// Asset authoring against an already-running LOCAL production preview only.
// No real accounts, provider sessions, or external app targets are accepted.
export default defineConfig({
  testDir: "./e2e", testMatch: "ananya-demo-recording.spec.ts", workers: 1,
  outputDir: "test-results/demo-authoring", reporter: "list",
  use: { baseURL: "http://127.0.0.1:3195", ...devices["Pixel 7"], channel: "chrome" },
});
