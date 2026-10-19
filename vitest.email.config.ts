import { defineConfig } from "vitest/config";
import base from "./vitest.config";

// Replace (do not concatenate) include: only explicit loopback integration runs.
export default defineConfig({ ...base, test: { ...base.test,
  include: ["integration/resend-delivery.test.ts"], testTimeout: 30_000, maxWorkers: 1,
  coverage: { enabled: false },
} });
