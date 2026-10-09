import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const severities = ["info", "low", "moderate", "high", "critical"];
const blocks = (finding) => ["high", "critical"].includes(finding.severity);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// npm audit v2 includes inherited findings as package-name references in `via`.
// Validate the complete report before deciding whether the audit passes.
export function validateReport(report) {
  if (report?.auditReportVersion !== 2 || report.error || !isObject(report.vulnerabilities)) {
    throw new Error("Missing or unsupported npm audit report");
  }
  const counts = Object.fromEntries(severities.map((severity) => [severity, 0]));
  for (const [name, finding] of Object.entries(report.vulnerabilities)) {
    if (!finding || finding.name !== name || !severities.includes(finding.severity)
      || !Array.isArray(finding.nodes) || !finding.nodes.length
      || !finding.nodes.every((node) => typeof node === "string")
      || !Array.isArray(finding.via) || !finding.via.length) {
      throw new Error(`Malformed npm audit finding: ${name}`);
    }
    for (const via of finding.via) {
      if (typeof via === "string" ? !Object.hasOwn(report.vulnerabilities, via)
        : !isObject(via) || typeof via.url !== "string" || !severities.includes(via.severity)) {
        throw new Error(`Malformed npm audit advisory: ${name}`);
      }
      const causeSeverity = typeof via === "string" ? report.vulnerabilities[via]?.severity : via.severity;
      if (!severities.includes(causeSeverity)
        || severities.indexOf(finding.severity) < severities.indexOf(causeSeverity)) {
        throw new Error(`Inconsistent npm audit severity: ${name}`);
      }
    }
    counts[finding.severity]++;
  }
  counts.total = Object.keys(report.vulnerabilities).length;
  for (const [key, count] of Object.entries(counts)) {
    if (report.metadata?.vulnerabilities?.[key] !== count) {
      throw new Error("Inconsistent npm audit summary");
    }
  }
  return Object.values(report.vulnerabilities);
}

export function parseAuditResult(result) {
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error("npm audit failed to execute or timed out");
  }
  let report;
  try { report = JSON.parse(result.stdout); }
  catch { throw new Error("npm audit did not return valid JSON"); }
  const findings = validateReport(report);
  if (result.status !== (findings.some(blocks) ? 1 : 0)) {
    throw new Error("npm audit exit status contradicts its report");
  }
  return report;
}

export function evaluateAudit(full, production) {
  const findings = validateReport(full);
  const productionFindings = validateReport(production);
  if (productionFindings.some(blocks)) {
    throw new Error("Production dependencies contain high/critical vulnerabilities; no exceptions allowed");
  }
  const rejected = findings.filter(blocks);
  if (rejected.length) {
    throw new Error(`Unaccepted high/critical findings: ${rejected.map((finding) => finding.name).join(", ")}`);
  }
  return { total: findings.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const root = new URL("../", import.meta.url);
    if (!process.env.npm_execpath) throw new Error("Run this check through npm run security:audit");
    const audit = (scope) => parseAuditResult(spawnSync(process.execPath, [
      process.env.npm_execpath, "audit", "--json", "--audit-level=high",
      "--include=prod", "--include=optional", "--include=peer", scope,
    ], { cwd: fileURLToPath(root), encoding: "utf8", timeout: 60000, maxBuffer: 10 * 1024 * 1024 }));
    const production = audit("--omit=dev");
    const full = audit("--include=dev");
    const result = evaluateAudit(full, production);
    console.log("Production audit: no high/critical findings.");
    console.log(`Full audit: ${result.total} affected packages; no high/critical findings. No exceptions.`);
  } catch (error) {
    console.error(`Security audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
