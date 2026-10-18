import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const COVERAGE_METRICS = ["statements", "branches", "functions", "lines"];
const FEATURE_FILE_PATTERN = /\.(?:mapper|service|contract)\.[cm]?[jt]sx?$/;

/** Regression floors for small security/data boundaries where aggregate coverage can hide a drop. */
/** @type {Record<string, Record<string, number>>} */
export const PROTECTED_COVERAGE_THRESHOLDS = {
  "scripts/account-deletion-worker.mjs": { statements: 90, branches: 60, functions: 90, lines: 95 },
  "scripts/candidate-liveness-email-worker.mjs": { statements: 100, branches: 95, functions: 100, lines: 100 },
  "scripts/deleted-provider-cleanup.mjs": { statements: 75, branches: 65, functions: 100, lines: 80 },
  "scripts/identity-verification-worker.mjs": { statements: 80, branches: 80, functions: 100, lines: 85 },
  "src/features/access/client/access-dashboard.api.ts": { statements: 100, branches: 85, functions: 100, lines: 100 },
  "src/features/account/client/account.api.ts": { statements: 90, branches: 90, functions: 100, lines: 90 },
  "src/features/auth/client/auth.api.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
  "src/features/broker-introductions/client/broker-introduction.api.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
  "src/features/broker-relationships/client/customer-invitation.api.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
  "src/features/identity-verification/client/identity-verification.api.ts": { statements: 100, branches: 70, functions: 100, lines: 100 },
  "src/features/identity-verification/server/didit.provider.ts": { statements: 85, branches: 60, functions: 80, lines: 90 },
  "src/features/identity-verification/server/webhook.repository.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
  "src/features/organization-access/client/brokerdesk-mfa.api.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
  "src/features/organization-access/client/brokerdesk-reauth.api.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
  "src/features/organization-access/client/brokerdesk-team.api.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
  "src/features/organizations/client/brokerdesk-onboarding.api.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
  "src/features/portfolio/client/location-reference.api.ts": { statements: 75, branches: 80, functions: 100, lines: 80 },
  "src/features/portfolio/server/dashboard.repository.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
};

function normalizedFile(file) {
  return file.replaceAll("\\", "/");
}

/** Returns per-file coverage failures for feature mappers, services, and contracts. */
export function findFeatureCoverageFailures(summary, minimum = 80) {
  const featureEntries = Object.entries(summary).filter(
    ([file]) => file !== "total" && FEATURE_FILE_PATTERN.test(normalizedFile(file))
  );

  if (!featureEntries.length) {
    throw new Error("No feature mapper, service, or contract files were found in the coverage summary.");
  }

  const failures = [];
  for (const [file, coverage] of featureEntries) {
    for (const metric of COVERAGE_METRICS) {
      const percentage = coverage?.[metric]?.pct;
      if (typeof percentage !== "number" || percentage < minimum) {
        failures.push({
          file: normalizedFile(file),
          metric,
          percentage: typeof percentage === "number" ? percentage : 0,
          minimum,
        });
      }
    }
  }

  return { checkedFiles: featureEntries.length, failures };
}

/**
 * Returns failures for explicitly protected application and worker boundaries.
 * @param {Record<string, unknown>} summary
 * @param {Record<string, Record<string, number>>} thresholds
 */
export function findProtectedCoverageFailures(summary, thresholds = PROTECTED_COVERAGE_THRESHOLDS) {
  const entries = new Map(Object.entries(summary)
    .filter(([file]) => file !== "total")
    .map(([file, coverage]) => [normalizedFile(file), coverage]));
  const failures = [];
  for (const [requiredFile, minimums] of Object.entries(thresholds)) {
    const match = [...entries.entries()].find(([file]) => file === requiredFile || file.endsWith(`/${requiredFile}`));
    if (!match) {
      failures.push({ file: requiredFile, metric: "file", percentage: 0, minimum: 1 });
      continue;
    }
    const [, coverage] = match;
    for (const metric of COVERAGE_METRICS) {
      const percentage = coverage?.[metric]?.pct;
      const minimum = minimums[metric];
      if (typeof percentage !== "number" || percentage < minimum) {
        failures.push({
          file: requiredFile,
          metric,
          percentage: typeof percentage === "number" ? percentage : 0,
          minimum,
        });
      }
    }
  }
  return { checkedFiles: Object.keys(thresholds).length, failures };
}

async function main() {
  const summaryPath = path.resolve(process.argv[2] ?? "coverage/coverage-summary.json");
  const summary = JSON.parse(await readFile(summaryPath, "utf8"));
  const featureResult = findFeatureCoverageFailures(summary);
  const protectedResult = findProtectedCoverageFailures(summary);
  const failures = [...featureResult.failures, ...protectedResult.failures];

  if (failures.length) {
    console.error("Feature and protected-boundary coverage requirements were not met:");
    for (const failure of failures) {
      console.error(
        `- ${failure.file}: ${failure.metric} ${failure.percentage}% (minimum ${failure.minimum}%)`
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Coverage passed for ${featureResult.checkedFiles} feature files and ${protectedResult.checkedFiles} protected boundaries.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
