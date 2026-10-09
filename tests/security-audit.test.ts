import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateAudit, parseAuditResult } from "../scripts/security-audit.mjs";
const affected = () => JSON.parse(readFileSync(new URL("./fixtures/security-audit/braces-report.json", import.meta.url), "utf8"));
const clean = () => ({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } });
describe("npm audit without exceptions", () => {
  it("accepts clean reports", () => expect(evaluateAudit(clean(), clean())).toEqual({ total: 0 }));
  it("blocks the formerly accepted development chain", () => expect(() => evaluateAudit(affected(), clean())).toThrow(/Unaccepted/));
  it("never accepts production high findings", () => expect(() => evaluateAudit(clean(), affected())).toThrow(/Production dependencies/));
  it.each(["moderate", "high", "critical"])("retains the severity threshold for %s", severity => {
    const report = affected();
    report.vulnerabilities = { other: { name: "other", severity, nodes: ["node_modules/other"], via: [{ url: "https://example.invalid/advisory", severity }] } };
    report.metadata.vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 1, [severity]: 1 };
    if (severity === "moderate") expect(evaluateAudit(report, clean())).toEqual({ total: 1 });
    else expect(() => evaluateAudit(report, clean())).toThrow(/Unaccepted/);
  });
  it.each(["direct", "inherited"])("rejects understated %s severity", kind => {
    const report = affected();
    report.vulnerabilities.other = { name: "other", severity: "moderate", nodes: ["node_modules/other"], via: kind === "direct" ? [{ url: "https://example.invalid/advisory", severity: "critical" }] : ["braces"] };
    report.metadata.vulnerabilities.moderate++;
    report.metadata.vulnerabilities.total++;
    expect(() => evaluateAudit(report, clean())).toThrow(/severity/);
  });
  it.each([{}, { auditReportVersion: 2, vulnerabilities: {} }, { ...clean(), auditReportVersion: 3 }, { ...clean(), error: { code: "E503" } }, { ...affected(), vulnerabilities: {} }])("rejects invalid reports %#", report => {
    expect(() => evaluateAudit(report, clean())).toThrow();
    expect(() => evaluateAudit(clean(), report)).toThrow();
  });
});
describe("npm audit execution boundary", () => {
  it("accepts only report-consistent exit statuses", () => {
    expect(parseAuditResult({ status: 1, stdout: JSON.stringify(affected()) })).toEqual(affected());
    expect(parseAuditResult({ status: 0, stdout: JSON.stringify(clean()) })).toEqual(clean());
  });
  it.each([
    { status: 1, stdout: "registry unavailable" }, { status: 1, stdout: JSON.stringify(clean()) },
    { status: 0, stdout: JSON.stringify(affected()) }, { status: 2, stdout: JSON.stringify(clean()) },
    { status: null, signal: "SIGTERM", stdout: "" }, { status: 0, error: new Error("spawn failed"), stdout: JSON.stringify(clean()) },
    { status: 1, stdout: JSON.stringify({ error: { code: "E503" } }) },
  ])("fails closed on execution errors %#", result => expect(() => parseAuditResult(result)).toThrow());
  it.each(["invalid", "affected", "clean"])("CLI runs both scopes under NODE_ENV=production: %s", mode => {
    const dir = mkdtempSync(path.join(tmpdir(), "nak-audit-cli-"));
    try {
      const fakeNpm = path.join(dir, "npm.cjs");
      const log = path.join(dir, "calls.jsonl");
      writeFileSync(fakeNpm, `require('node:fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2))+'\\n');
        if(process.argv.includes('--omit=dev')) console.log(${JSON.stringify(JSON.stringify(clean()))});
        else {console.log(${JSON.stringify(mode === "invalid" ? "registry unavailable" : JSON.stringify(mode === "affected" ? affected() : clean()))});process.exitCode=${mode === "clean" ? 0 : 1};}`);
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "npm_execpath"));
      const result = spawnSync(process.execPath, ["scripts/security-audit.mjs"], { env: { ...env, npm_execpath: fakeNpm, NODE_ENV: "production" }, encoding: "utf8", timeout: 10000 });
      expect(result.status).toBe(mode === "clean" ? 0 : 1);
      if (mode === "invalid") expect(result.stderr).toContain("did not return valid JSON");
      if (mode === "affected") expect(result.stderr).toContain("Unaccepted");
      const calls = readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line));
      expect(calls).toHaveLength(2);
      expect(calls[0]).toContain("--omit=dev");
      expect(calls[1]).toContain("--include=dev");
      for (const call of calls) expect(call).toEqual(expect.arrayContaining(["audit", "--json", "--audit-level=high", "--include=optional"]));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
