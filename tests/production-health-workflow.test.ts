import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("checks and alerts on main even when the dispatcher enable variable is absent", () => {
  const workflow = readFileSync(".github/workflows/production-health.yml", "utf8").replace(/\r\n/g, "\n");
  const health = workflow.split("  health:\n")[1]?.split("\n  alert:")[0];
  const alert = workflow.split("\n  alert:\n")[1];
  expect(health).toContain("    if: ${{ github.ref == 'refs/heads/main' }}");
  expect(alert).toContain("    if: ${{ always() && github.ref == 'refs/heads/main' && needs.health.result != 'success' }}");
  expect(workflow).not.toContain("vars.PRODUCTION_WORKER_ENABLED");
  expect(health).toContain("    environment: production");
  expect(health).toContain("https://www.vivintro.com/api/internal/production-health");
  expect(workflow).not.toContain("/api/internal/production-maintenance");
  expect(health).toContain("test ${#PRODUCTION_WORKER_SECRET} -ge 32");
});
