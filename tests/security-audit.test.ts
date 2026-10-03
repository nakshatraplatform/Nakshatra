import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateAudit, parseAuditResult } from "../scripts/security-audit.mjs";

const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const beforeExpiry = new Date("2026-10-08T23:59:59-04:00");
function fixture() {
  return {
    full: read("./fixtures/security-audit/braces-report.json"),
    production: {
      auditReportVersion: 2, vulnerabilities: {},
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
    },
    lock: read("../package-lock.json"),
    exception: read("../security/audit-exception.json"),
  };
}
type Fixture = ReturnType<typeof fixture>;
const evaluate = (f: Fixture, now = beforeExpiry) => evaluateAudit(f.full, f.production, f.lock, f.exception, now);

describe("temporary npm audit risk acceptance", () => {
  it("accepts the captured advisory and its inherited development findings before expiry", () => {
    expect(evaluate(fixture())).toEqual({ accepted: 5, total: 5 });
  });
  it("accepts a clean audit without claiming that an exception was used", () => {
    const f = fixture();
    f.full = f.production;
    expect(evaluate(f)).toEqual({ accepted: 0, total: 0 });
  });
  it.each(["2026-10-09T00:00:00-04:00", "2026-10-10T00:00:00Z"])("fails at or after expiry: %s", (date) => {
    expect(() => evaluate(fixture(), new Date(date))).toThrow(/expired/);
  });
  it("fails on invalid expiry even when the report is clean", () => {
    const f = fixture(); f.full = f.production; f.exception.expiresAt = "never";
    expect(() => evaluate(f)).toThrow(/invalid expiry/);
  });
  it("never exempts production findings, including the approved advisory", () => {
    const f = fixture(); f.production = f.full;
    expect(() => evaluate(f)).toThrow(/Production dependencies/);
  });
  it.each(["high", "critical"])("blocks an unrelated %s advisory", (severity) => {
    const f = fixture();
    f.full.vulnerabilities.other = {
      name: "other", severity, nodes: ["node_modules/other"],
      via: [{ url: "https://github.com/advisories/GHSA-1111-2222-3333", severity }],
    };
    f.full.metadata.vulnerabilities[severity]++;
    f.full.metadata.vulnerabilities.total++;
    expect(() => evaluate(f)).toThrow(/Unaccepted.*other/);
  });
  it.each([
    (f: Fixture) => { f.full.vulnerabilities.braces.via[0].url += "?other"; },
    (f: Fixture) => { f.full.vulnerabilities.braces.via.push({ ...f.full.vulnerabilities.braces.via[0], url: "https://github.com/advisories/GHSA-1111-2222-3333" }); },
    (f: Fixture) => { f.full.vulnerabilities.micromatch.via = ["fast-glob"]; },
    (f: Fixture) => { f.full.vulnerabilities.braces.nodes.push("node_modules/other/node_modules/braces"); },
    (f: Fixture) => { f.lock.packages["node_modules/braces"].version = "3.0.4"; },
    (f: Fixture) => { f.lock.packages["node_modules/braces"].dev = false; },
    (f: Fixture) => { delete f.lock.packages["node_modules/braces"]; },
    (f: Fixture) => {
      for (const name of Object.keys(f.full.vulnerabilities)) f.full.vulnerabilities[name].severity = "critical";
      f.full.vulnerabilities.braces.via[0].severity = "critical";
      f.full.metadata.vulnerabilities.high = 0;
      f.full.metadata.vulnerabilities.critical = 5;
    },
  ])("rejects changes to advisory, graph, path, version or development scope %#", (mutate) => {
    const f = fixture(); mutate(f);
    expect(() => evaluate(f)).toThrow(/Unaccepted/);
  });
  it("retains the existing nonblocking threshold for unrelated moderate advisories", () => {
    const f = fixture();
    f.full.vulnerabilities.other = {
      name: "other", severity: "moderate", nodes: ["node_modules/other"],
      via: [{ url: "https://github.com/advisories/GHSA-1111-2222-3333", severity: "moderate" }],
    };
    f.full.metadata.vulnerabilities.moderate = 1;
    f.full.metadata.vulnerabilities.total++;
    expect(evaluate(f)).toEqual({ accepted: 5, total: 6 });
  });
  it.each(["direct", "inherited"])("rejects understated aggregate severity for %s findings", (kind) => {
    const f = fixture();
    f.full.vulnerabilities.other = {
      name: "other", severity: "moderate", nodes: ["node_modules/other"],
      via: kind === "direct"
        ? [{ url: "https://github.com/advisories/GHSA-1111-2222-3333", severity: "critical" }]
        : ["braces"],
    };
    f.full.metadata.vulnerabilities.moderate = 1;
    f.full.metadata.vulnerabilities.total++;
    expect(() => parseAuditResult({ status: 1, stdout: JSON.stringify(f.full) })).toThrow(/severity/);
    expect(() => evaluate(f)).toThrow(/severity/);
    f.production = f.full;
    f.full = fixture().production;
    expect(() => evaluate(f)).toThrow(/severity/);
  });
  it.each([
    {},
    { auditReportVersion: 2, vulnerabilities: {} },
    { ...fixture().production, auditReportVersion: 3 },
    { ...fixture().production, error: { code: "E503" } },
    { ...fixture().full, vulnerabilities: {} },
  ])("rejects missing, changed or inconsistent report data %#", (full) => {
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
      const result = spawnSync(process.execPath, ["scripts/security-audit.mjs"], {
        env: { ...process.env, npm_execpath: fakeNpm, NODE_ENV: "production" },
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
