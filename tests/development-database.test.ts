import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { checkDevelopmentDatabaseTarget } from "../scripts/check-development-database-target.mjs";

const allowed = {
  NODE_ENV: "test" as const,
  GITHUB_REF: "refs/heads/development",
  DEVELOPMENT_DATABASE_ENABLED: "true",
  EXPECTED_DEVELOPMENT_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_ACCESS_TOKEN: "private-access-token-sentinel",
  SUPABASE_DB_PASSWORD: "private-password-sentinel",
};

describe("development database target boundary", () => {
  it("accepts an explicitly enabled, approved non-production project", () => {
    expect(() => checkDevelopmentDatabaseTarget(allowed)).not.toThrow();
  });

  it.each([
    { GITHUB_REF: "refs/heads/main" },
    { GITHUB_REF: "refs/tags/development" },
    { GITHUB_REF: "refs/heads/feat/test" },
    { DEVELOPMENT_DATABASE_ENABLED: "" },
    { DEVELOPMENT_DATABASE_ENABLED: "false" },
    { EXPECTED_DEVELOPMENT_PROJECT_REF: "" },
    { EXPECTED_DEVELOPMENT_PROJECT_REF: "invalid" },
    { SUPABASE_PROJECT_REF: "" },
    { SUPABASE_PROJECT_REF: "bcdefghijklmnopqrstu" },
    { EXPECTED_DEVELOPMENT_PROJECT_REF: "xizzzczzhqzabcipbgep", SUPABASE_PROJECT_REF: "xizzzczzhqzabcipbgep" },
    { SUPABASE_ACCESS_TOKEN: "" },
    { SUPABASE_DB_PASSWORD: " " },
  ])("rejects unsafe or missing configuration %#", overrides => {
    expect(() => checkDevelopmentDatabaseTarget({ ...allowed, ...overrides })).toThrow();
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/check-development-database-target.mjs", import.meta.url))], {
      // Pass only synthetic configuration; no inherited local credentials.
      env: { ...allowed, ...overrides }, encoding: "utf8", timeout: 5000,
    });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain("private-access-token-sentinel");
    expect(result.stdout + result.stderr).not.toContain("private-password-sentinel");
  });

  it("validates the real CLI entrypoint without printing credentials", () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/check-development-database-target.mjs", import.meta.url))], {
      env: allowed, encoding: "utf8", timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Development database target validated");
    expect(result.stdout + result.stderr).not.toContain("private-");
  });
});

const workflow = readFileSync(new URL("../.github/workflows/development-database.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const jobCondition = workflow.match(/^    if: (.+)$/m)?.[1];
const steps = workflow.split(/^      - name: /m).slice(1).map(block => ({
  name: block.split("\n", 1)[0],
  condition: block.match(/^        if: (.+)$/m)?.[1],
  run: block.match(/^        run: (?!\|)(.+)$/m)?.[1]
    ?? block.match(/^        run: \|\n((?:          .+\n)+)/m)?.[1].replace(/^          /gm, ""),
}));

function selectedSteps(ref: string, confirmed: boolean) {
  const context = { github: { ref }, inputs: { confirm_development: confirmed } };
  const enabled = (condition?: string) => condition === undefined || Boolean(
    runInNewContext(condition.replace(/^\$\{\{\s*|\s*\}\}$/g, ""), context, { timeout: 100 }),
  );
  return enabled(jobCondition) ? steps.filter(step => enabled(step.condition)) : [];
}

describe("development migration workflow", () => {
  it.each(["refs/heads/main", "refs/tags/development", "refs/heads/feat/test"])("selects no migration operations for %s", ref => {
    expect(selectedSteps(ref, false)).toEqual([]);
    expect(selectedSteps(ref, true)).toEqual([]);
  });

  it("defaults to a manual preview without application or reset", () => {
    expect(workflow).toMatch(/confirm_development:\n(?:.*\n)*?        default: false\n        type: boolean/);
    expect(workflow).not.toMatch(/^  (push|pull_request|workflow_run|schedule):/m);
    expect(workflow).toContain("environment: development");
    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).toContain("group: cd-development\n  cancel-in-progress: false");
    expect(workflow).not.toContain("db reset");
    const selected = selectedSteps("refs/heads/development", false);
    expect(selected.map(step => step.name)).not.toContain("Apply development migrations");
    expect(selected.map(step => step.name)).not.toContain("Verify development migration history");
    const pushes = selected.filter(step => step.run?.includes("supabase db push"));
    expect(pushes).toHaveLength(1);
    expect(pushes[0].run).toContain("--dry-run --skip-vault");
  });

  it("validates before linking and previews before confirmed application and history verification", () => {
    const names = selectedSteps("refs/heads/development", true).map(step => step.name);
    const requiredOrder = ["Validate isolated development target", "Link approved development project", "Preview development migrations", "Apply development migrations", "Verify development migration history"];
    const indexes = requiredOrder.map(name => names.indexOf(name));
    expect(indexes.every(index => index >= 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
    expect(steps.find(step => step.name === requiredOrder[0])?.run).toBe("node scripts/check-development-database-target.mjs");
    expect(steps.find(step => step.name === "Apply development migrations")?.run).toContain("--skip-vault --yes");
  });

  it("takes every migration credential from the development-specific namespace", () => {
    const secrets = [...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map(match => match[1]);
    expect([...new Set(secrets)].sort()).toEqual([
      "DEVELOPMENT_SUPABASE_ACCESS_TOKEN",
      "DEVELOPMENT_SUPABASE_DB_PASSWORD",
      "DEVELOPMENT_SUPABASE_PROJECT_REF",
    ]);
    expect(workflow).toContain("EXPECTED_DEVELOPMENT_PROJECT_REF: ${{ vars.DEVELOPMENT_SUPABASE_PROJECT_REF }}");
    expect(workflow).toContain("DEVELOPMENT_DATABASE_ENABLED: ${{ vars.DEVELOPMENT_DATABASE_ENABLED }}");
  });
});
