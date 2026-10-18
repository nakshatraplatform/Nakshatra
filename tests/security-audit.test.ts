import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateAudit, parseAuditResult, validateDependencyTree } from "../scripts/security-audit.mjs";

const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
function fixture() {
  return {
    full: read("./fixtures/security-audit/braces-report.json"),
    production: {
      auditReportVersion: 2, vulnerabilities: {},
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
    },
    lock: read("../package-lock.json"),
  };
}
type Fixture = ReturnType<typeof fixture>;
const evaluate = (f: Fixture) => evaluateAudit(f.full, f.production, f.lock);

describe("strict npm audit without exceptions", () => {
  it("rejects the previously accepted development advisory after retirement", () => {
    expect(() => evaluate(fixture())).toThrow(/Unaccepted high/);
  });
  it("accepts a clean report with no acceptance allowance", () => {
    const f = fixture(); f.full = f.production;
    expect(evaluate(f)).toEqual({ accepted: 0, total: 0 });
  });
  it("never exempts production findings", () => {
    const f = fixture(); f.production = f.full;
    expect(() => evaluate(f)).toThrow(/Production dependencies/);
  });
  it.each(["high", "critical"])("blocks new %s findings", severity => {
    const f = fixture();
    f.full = structuredClone(f.production);
    f.full.vulnerabilities.other = {
      name: "other", severity, nodes: ["node_modules/other"],
      via: [{ url: "https://github.com/advisories/GHSA-1111-2222-3333", severity }],
    };
    f.full.metadata.vulnerabilities[severity]++;
    f.full.metadata.vulnerabilities.total++;
    expect(() => evaluate(f)).toThrow(/Unaccepted.*other/);
  });
  it("retains the nonblocking threshold for moderate advisories", () => {
    const f = fixture(); f.full = structuredClone(f.production);
    f.full.vulnerabilities.other = {
      name: "other", severity: "moderate", nodes: ["node_modules/other"],
      via: [{ url: "https://github.com/advisories/GHSA-1111-2222-3333", severity: "moderate" }],
    };
    f.full.metadata.vulnerabilities.moderate = 1; f.full.metadata.vulnerabilities.total = 1;
    expect(evaluate(f)).toEqual({ accepted: 0, total: 1 });
  });
  it.each(["eslint-config-next", "@next/eslint-plugin-next", "fast-glob", "micromatch", "braces"])(
    "rejects root and nested reintroduction of %s even with clean audit reports", name => {
      for (const prefix of ["", "parent/node_modules/"]) {
        const f = fixture(); f.full = f.production;
        f.lock.packages[`node_modules/${prefix}${name}`] = { version: "999.0.0", dev: true };
        expect(() => evaluate(f)).toThrow(/Retired lint dependency/);
      }
    },
  );
  it("fails closed on unsupported lockfiles", () => {
    expect(() => validateDependencyTree({ lockfileVersion: 2, packages: {} })).toThrow(/lockfile/);
    expect(() => validateDependencyTree({ lockfileVersion: 3 })).toThrow(/lockfile/);
  });
  it("rejects an npm alias of a retired dependency", () => {
    const f = fixture(); f.full = f.production;
    f.lock.packages["node_modules/disguised"] = { name: "braces", version: "3.0.3", dev: true };
    expect(() => evaluate(f)).toThrow(/Retired lint dependency/);
  });
  it.each(["direct", "inherited"])("rejects understated aggregate severity for %s findings", kind => {
    const f = fixture();
    f.full.vulnerabilities.other = {
      name: "other", severity: "moderate", nodes: ["node_modules/other"],
      via: kind === "direct"
        ? [{ url: "https://github.com/advisories/GHSA-1111-2222-3333", severity: "critical" }]
        : ["braces"],
    };
    f.full.metadata.vulnerabilities.moderate = 1; f.full.metadata.vulnerabilities.total++;
    expect(() => parseAuditResult({ status: 1, stdout: JSON.stringify(f.full) })).toThrow(/severity/);
    expect(() => evaluate(f)).toThrow(/severity/);
    f.production = f.full; f.full = fixture().production;
    expect(() => evaluate(f)).toThrow(/severity/);
  });
  it.each([
    {}, { auditReportVersion: 2, vulnerabilities: {} },
    { ...fixture().production, auditReportVersion: 3 },
    { ...fixture().production, error: { code: "E503" } },
    { ...fixture().full, vulnerabilities: {} },
  ])("rejects missing, changed or inconsistent report data %#", full => {
    const f = fixture(); f.full = full;
    expect(() => evaluate(f)).toThrow();
  });
});

describe("npm audit execution boundary", () => {
  it("accepts exit 1 only with a complete vulnerability report", () => {
    const f = fixture();
    expect(parseAuditResult({ status: 1, stdout: JSON.stringify(f.full) })).toEqual(f.full);
    expect(parseAuditResult({ status: 0, stdout: JSON.stringify(f.production) })).toEqual(f.production);
  });
  it.each([
    { status: 1, stdout: "registry unavailable" },
    { status: 1, stdout: JSON.stringify(fixture().production) },
    { status: 0, stdout: JSON.stringify(fixture().full) },
    { status: 2, stdout: JSON.stringify(fixture().production) },
    { status: null, signal: "SIGTERM", stdout: "" },
    { status: 0, error: new Error("spawn failed"), stdout: JSON.stringify(fixture().production) },
    { status: 1, stdout: JSON.stringify({ error: { code: "E503" } }) },
  ])("fails closed on command/report errors %#", (result) => {
    expect(() => parseAuditResult(result)).toThrow();
  });
  it("runs both audit scopes and propagates an invalid full-report failure through the CLI", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "vivintro-audit-cli-"));
    try {
      const fakeNpm = path.join(dir, "npm.cjs");
      const log = path.join(dir, "calls.jsonl");
      writeFileSync(fakeNpm, `
        require('node:fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');
        if (process.argv.includes('--omit=dev')) {
          console.log(${JSON.stringify(JSON.stringify(fixture().production))});
        } else { console.log('registry unavailable'); process.exitCode = 1; }
      `);
      // Windows treats environment variable names case-insensitively; npm may
      // supply npm_execPath alongside this test's npm_execpath override.
      const childEnv = Object.fromEntries(Object.entries(process.env)
        .filter(([key]) => key.toLowerCase() !== "npm_execpath"));
      const result = spawnSync(process.execPath, ["scripts/security-audit.mjs"], {
        env: { ...childEnv, npm_execpath: fakeNpm, NODE_ENV: "production" },
        encoding: "utf8", timeout: 10000,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("did not return valid JSON");
      const calls = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line));
      expect(calls).toHaveLength(2);
      expect(calls[0]).toContain("--omit=dev");
      expect(calls[1]).toContain("--include=dev");
      for (const call of calls) expect(call).toEqual(expect.arrayContaining(["audit", "--json", "--audit-level=high", "--include=optional"]));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
