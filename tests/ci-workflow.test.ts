import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const job = (name: string) => workflow.split(`  ${name}:\n`)[1]?.split(/^  \w+:$/m)[0];
const bash = process.platform === "win32"
  ? resolve(spawnSync("git", ["--exec-path"], { encoding: "utf8" }).stdout.trim(), "../../../bin/bash.exe")
  : "/bin/bash";

describe("split CI validation", () => {
  it("retains all quality checks and separates browser execution", () => {
    for (const command of ["npm ci", "npm run security:audit", "npm run lint", "npm run typecheck", "npm run test:unit:coverage", "npm run build"]) {
      expect(job("quality")).toContain(`run: ${command}`);
    }
    expect(job("quality")).not.toContain("playwright");
    expect(job("browser")).toContain("npm run test:e2e -- --global-timeout=900000");
    expect(job("browser")).toContain("timeout-minutes: 30");
    expect(job("browser")).not.toContain("secrets.");
    expect(workflow).not.toContain("continue-on-error");
  });

  it("keys browser downloads to the pinned OS, architecture and lockfile, while always installing system libraries", () => {
    expect(job("browser")).toContain("runs-on: ubuntu-24.04");
    expect(job("browser")).toContain("key: playwright-ubuntu-24.04-${{ runner.arch }}-${{ hashFiles('package-lock.json') }}");
    expect(job("browser")).not.toContain("restore-keys");
    expect(job("browser")).toMatch(/- name: Install Playwright system dependencies\n        run: npx playwright install-deps chromium/);
    expect(job("browser")).toMatch(/- name: Install Playwright browser\n        if: steps.playwright_cache.outputs.cache-hit != 'true'\n        run: npx playwright install chromium/);
    expect(job("browser")).toMatch(/- name: Upload Playwright report\n        if: always\(\)/);
  });

  it("preserves the required check and evaluates failed, cancelled or skipped dependencies", () => {
    expect(job("validate")).toContain("name: Lint, Test, Coverage & Build");
    expect(job("validate")).toContain("needs: [quality, browser]");
    expect(job("validate")).toContain("if: always()");
  });

  it.each(["success", "failure", "cancelled", "skipped"])("required gate handles dependency outcome %s", outcome => {
    const command = job("validate")?.match(/        run: \|\n((?:          .+\n)+)/)?.[1].replace(/^          /gm, "");
    expect(command).toBeDefined();
    for (const results of [{ QUALITY_RESULT: outcome, BROWSER_RESULT: "success" }, { QUALITY_RESULT: "success", BROWSER_RESULT: outcome }]) {
      const result = spawnSync(bash, ["-e", "-o", "pipefail", "-c", command!], { env: { ...process.env, ...results }, encoding: "utf8" });
      expect(result.status).toBe(outcome === "success" ? 0 : 1);
    }
  });
});
