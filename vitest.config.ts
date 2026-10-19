import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: [
        "src/**/*.{ts,tsx,mjs}",
        "scripts/account-deletion-worker.mjs",
        "scripts/candidate-liveness-email-worker.mjs",
        "scripts/check-database-types.mjs",
        "scripts/check-development-database-target.mjs",
        "scripts/check-feature-coverage.mjs",
        "scripts/deleted-provider-cleanup.mjs",
        "scripts/identity-verification-worker.mjs",
        "scripts/production-controls.mjs",
        "scripts/security-audit.mjs",
        "scripts/verify-didit-liveness-sandbox.mjs",
        "scripts/verify-migration-history.mjs",
      ],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 88,
        statements: 85,
        perFile: false,
      },
    },
  },
});
