import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const severities = ["info", "low", "moderate", "high", "critical"];
const blocks = (finding) => ["high", "critical"].includes(finding.severity);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// npm audit v2 includes inherited findings as package-name references in `via`.
// Validate the complete report before making any exception decision.
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

export function evaluateAudit(full, production, lock, exception, now = new Date()) {
  const findings = validateReport(full);
  const productionFindings = validateReport(production);
  if (productionFindings.some(blocks)) {
    throw new Error("Production dependencies contain high/critical vulnerabilities; no exceptions allowed");
  }
  if (lock?.lockfileVersion !== 3 || !isObject(lock.packages)
    || !/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(exception?.advisory ?? "")
    || typeof exception?.reason !== "string" || !exception.reason.trim()
    || !Array.isArray(exception.chain) || !exception.chain.length
    || exception.chain.some((entry) => !entry || typeof entry.name !== "string" || typeof entry.version !== "string")
    || new Set(exception.chain.map((entry) => entry.name)).size !== exception.chain.length) {
    throw new Error("Invalid audit exception or lockfile");
  }
  const expiry = Date.parse(exception.expiresAt);
  if (!Number.isFinite(expiry) || !Number.isFinite(now.getTime()) || now.getTime() >= expiry) {
    throw new Error("Audit exception expired or has an invalid expiry; remove it or obtain a new risk review");
  }

  // Match the entire reviewed graph, not a package-name allowlist. A new
  // advisory, dependency version/path, or production use invalidates acceptance.
  const matches = exception.chain.every((entry, index) => {
    const node = `node_modules/${entry.name}`;
    const finding = full.vulnerabilities[entry.name];
    const installed = lock.packages[node];
    if (!finding || finding.severity !== "high" || installed?.dev !== true
      || installed.version !== entry.version || finding.nodes.length !== 1
      || finding.nodes[0] !== node || finding.via.length !== 1
      || Object.hasOwn(production.vulnerabilities, entry.name)) return false;
    const via = finding.via[0];
    const next = exception.chain[index + 1];
    return next ? via === next.name
      : isObject(via) && via.name === entry.name && via.dependency === entry.name
        && via.severity === "high" && via.url === `https://github.com/advisories/${exception.advisory}`;
  });
  const accepted = new Set(matches ? exception.chain.map((entry) => entry.name) : []);
  const rejected = findings.filter((finding) => blocks(finding) && !accepted.has(finding.name));
  if (rejected.length) {
    throw new Error(`Unaccepted high/critical findings: ${rejected.map((finding) => finding.name).join(", ")}`);
  }
  return { accepted: accepted.size, total: findings.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const root = new URL("../", import.meta.url);
    const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
    if (!process.env.npm_execpath) throw new Error("Run this check through npm run security:audit");
    const audit = (scope) => parseAuditResult(spawnSync(process.execPath, [
      process.env.npm_execpath, "audit", "--json", "--audit-level=high",
      "--include=prod", "--include=optional", "--include=peer", scope,
    ], { cwd: fileURLToPath(root), encoding: "utf8", timeout: 60000, maxBuffer: 10 * 1024 * 1024 }));
    const production = audit("--omit=dev");
    const full = audit("--include=dev");
    const exception = read("security/audit-exception.json");
    const result = evaluateAudit(full, production, read("package-lock.json"), exception);
    console.log("Production audit: no high/critical findings.");
    console.log(`Full audit: ${result.total} affected packages; ${result.accepted} covered by the temporary exception.`);
    if (result.accepted) {
      console.warn(`TEMPORARY RISK ACCEPTED: ${exception.advisory}; expires ${exception.expiresAt}. The vulnerability is not fixed.`);
    }
  } catch (error) {
    console.error(`Security audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
