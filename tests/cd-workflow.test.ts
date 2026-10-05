import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/cd.yml", import.meta.url), "utf8");
const jobCondition = workflow.match(/^    if: (.+)$/m)?.[1];
const steps = workflow.split(/^      - name: /m).slice(1).map((block) => ({
  name: block.split("\n", 1)[0],
  condition: block.match(/^        if: (.+)$/m)?.[1],
  run: block.match(/^        run: (?!\|)(.+)$/m)?.[1]
    ?? block.match(/^        run: \|\n((?:          .+\n)+)/m)?.[1].replace(/^          /gm, ""),
}));

// These workflow conditions use the shared JS/Actions boolean-expression subset.
// actionlint separately validates the YAML and GitHub expression syntax.
function selectedSteps(ref: string, confirmed: boolean) {
  const context = { github: { ref }, inputs: { confirm_production: confirmed } };
  const enabled = (condition?: string) => condition === undefined || Boolean(
    runInNewContext(condition.replace(/^\$\{\{\s*|\s*\}\}$/g, ""), context, { timeout: 100 }),
  );
  return enabled(jobCondition) ? steps.filter((step) => enabled(step.condition)) : [];
}

describe("production database workflow", () => {
  it("defaults the confirmation checkbox to false", () => {
    expect(workflow).toMatch(/confirm_production:\n(?:.*\n)*?        default: false\n        type: boolean/);
  });

  it("previews on main without confirmation and selects no migration writes or final-history check", () => {
    const selected = selectedSteps("refs/heads/main", false);
    expect(selected.map((step) => step.name)).toContain("Preview pending Supabase migrations");
    expect(selected.map((step) => step.name)).not.toContain("Apply pending Supabase migrations");
    expect(selected.map((step) => step.name)).not.toContain("Verify production migration history");
    const pushes = selected.filter((step) => step.run?.includes("supabase db push"));
    expect(pushes).toHaveLength(1);
    expect(pushes[0].run).toContain("--dry-run");
    expect(pushes[0].run).toContain("--skip-vault");
  });

  it("previews before explicitly confirmed application and verifies history afterwards", () => {
    const names = selectedSteps("refs/heads/main", true).map((step) => step.name);
    const preview = names.indexOf("Preview pending Supabase migrations");
    const apply = names.indexOf("Apply pending Supabase migrations");
    const verify = names.indexOf("Verify production migration history");
    expect(preview).toBeGreaterThanOrEqual(0);
    expect(apply).toBeGreaterThan(preview);
    expect(verify).toBeGreaterThan(apply);
  });

  it.each([false, true])("does not select production steps from a feature branch (confirmed=%s)", (confirmed) => {
    expect(selectedSteps("refs/heads/fix/test", confirmed)).toEqual([]);
  });

  it("retains manual dispatch, serialized production execution, and the dispatch revision", () => {
    expect(workflow).toMatch(/^  workflow_dispatch:/m);
    expect(workflow).not.toMatch(/^  (push|pull_request|workflow_run):/m);
    expect(workflow).toMatch(/group: cd-production\n  cancel-in-progress: false/);
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("ref: ${{ github.sha }}");
  });

  const secretNames = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", "SUPABASE_DB_PASSWORD"];
  it.each(secretNames)("identifies missing %s without disclosing other credentials", (missing) => {
    const command = steps.find((step) => step.name === "Validate Supabase migration deployment secrets")?.run;
    expect(command).toBeDefined();
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", ...Object.fromEntries(secretNames.map((name) => [name, name === missing ? "" : "private-test-sentinel"])) };
    const result = spawnSync("/bin/bash", ["-e", "-o", "pipefail", "-c", command!], { env, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(missing);
    expect(result.stdout + result.stderr).not.toContain("private-test-sentinel");
  });

  it("accepts all deployment credentials without printing their values", () => {
    const command = steps.find((step) => step.name === "Validate Supabase migration deployment secrets")?.run;
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", ...Object.fromEntries(secretNames.map((name) => [name, "private-test-sentinel"])) };
    const result = spawnSync("/bin/bash", ["-e", "-o", "pipefail", "-c", command!], { env, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain("private-test-sentinel");
  });
});
