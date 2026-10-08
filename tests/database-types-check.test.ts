import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifyDatabaseTypes } from "../scripts/check-database-types.mjs";

const types = 'export type Database = { public: { Tables: { example: { Row: { id: string } } } } }\n';

describe("clean database type verification", () => {
  it("accepts identical generated types and checkout newline differences", () => {
    expect(() => verifyDatabaseTypes(types.replace(/\n/g, "\r\n"), types + "\n")).not.toThrow();
  });

  it.each([
    types.replace("id: string", "id: number"),
    types.replace("id: string", "id: string | null"),
    types.replace("id: string", "id?: string"),
    types.replace("example", "other"),
  ])("rejects meaningful schema drift", (generated) => {
    expect(() => verifyDatabaseTypes(types, generated)).toThrow("differ from the clean database");
  });

  it.each(["", "generation failed", "{}"])("rejects empty or invalid generator output even if files match", (generated) => {
    expect(() => verifyDatabaseTypes(generated, generated)).toThrow("did not produce a Database declaration");
  });

  it("fails the real command when input is missing", () => {
    const result = spawnSync(process.execPath, ["scripts/check-database-types.mjs"], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected the generated database types file path");
  });

  it("passes the real command for the committed file", () => {
    const result = spawnSync(process.execPath, ["scripts/check-database-types.mjs", "src/types/database.generated.ts"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Database types match");
  });

  it("keeps generation local, after clean replay, with diagnosis and unconditional cleanup", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8").replace(/\r\n/g, "\n");
    const database = workflow.split("  database:\n")[1];
    expect(database.indexOf("npm run test:db:reset")).toBeLessThan(database.indexOf("supabase gen types"));
    expect(database).toContain('npx supabase gen types typescript --local --schema public > "$RUNNER_TEMP/database.generated.ts"');
    expect(database).not.toMatch(/--linked|--project-id|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD/);
    expect(database).toContain('node scripts/check-database-types.mjs "$RUNNER_TEMP/database.generated.ts"');
    expect(database).toContain("always() && steps.database_types.outcome == 'success'");
    expect(database).toMatch(/Stop local Supabase stack\n        if: always\(\)/);
  });
});
