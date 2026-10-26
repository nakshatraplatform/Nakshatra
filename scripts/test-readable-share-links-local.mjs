import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";

const databaseUrl = process.env.READABLE_LINK_TEST_DB_URL;
if (!databaseUrl) throw new Error("Set READABLE_LINK_TEST_DB_URL to a disposable local Supabase database.");
const url = new URL(databaseUrl);
if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
  throw new Error("This concurrency check is restricted to a local disposable database.");
}
const run = promisify(execFile);
const query = async sql => {
  const result = await run("psql", ["--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl, "--command", sql], { timeout: 30_000, maxBuffer: 1024 * 1024 });
  return result.stdout.trim();
};
// Only internally generated ASCII letters are interpolated into fixture SQL.
const lastName = `probe${Array.from(randomBytes(12), value => String.fromCharCode(97 + value % 26)).join("")}`;
const base = `concurrency-${lastName}`;
const paths = Array.from({ length: 16 }, (_, index) => base + (index === 0 ? "" : `-${index + 1}`));
const rollbackPath = `rollback-${lastName}`;
try {
  const outputs = await Promise.all(paths.map(() => query(`select app_private.reserve_portfolio_share_path('{"personal":{"first_name":"Concurrency","last_name":"${lastName}"}}');`)));
  assert.deepEqual(new Set(outputs), new Set(paths), "concurrent transactions must allocate distinct consecutive paths");
  await query(`begin; select app_private.reserve_portfolio_share_path('{"personal":{"first_name":"Rollback","last_name":"${lastName}"}}'); rollback;`);
  assert.equal(await query(`select app_private.reserve_portfolio_share_path('{"personal":{"first_name":"Rollback","last_name":"${lastName}"}}');`), rollbackPath, "rollback must not consume a suffix");
  console.log("Readable share links: 16 concurrent transactions and rollback passed.");
} finally {
  // Fixture-only digests; no profile rows or external services are touched.
  const literals = [...paths, rollbackPath].map(path => `'${path}'`).join(",");
  await query(`delete from app_private.portfolio_share_path_reservations where path_hash in (select extensions.digest(path,'sha256') from unnest(array[${literals}]::text[]) path);`);
}
