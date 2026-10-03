import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Supabase CLI 2.119 JSON output. Fail closed on a changed output contract.
export function verifyMigrationHistory(history, expectedVersions) {
  if (!Array.isArray(history?.migrations) || expectedVersions.length === 0) {
    throw new Error("Missing migration history or local migrations");
  }
  const expected = new Set(expectedVersions);
  const verified = new Set();
  for (const row of history.migrations) {
    if (!row || typeof row.local !== "string" || !/^\d{14}$/.test(row.local)
      || row.remote !== row.local || !expected.has(row.local) || verified.has(row.local)) {
      throw new Error("Migration history differs from this checkout: pending, remote-only, duplicate or invalid entry");
    }
    verified.add(row.local);
  }
  if (verified.size !== expected.size || expected.size !== expectedVersions.length) {
    throw new Error("Migration history does not include every local migration exactly once");
  }
  return verified.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const history = JSON.parse(readFileSync(process.argv[2], "utf8"));
    const versions = readdirSync(new URL("../supabase/migrations/", import.meta.url))
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .map((name) => name.slice(0, 14));
    console.log(`Verified ${verifyMigrationHistory(history, versions)} applied migrations; none pending.`);
  } catch (error) {
    console.error(`Migration verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
