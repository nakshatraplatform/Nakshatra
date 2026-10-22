import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./test-approval-retry-local.mjs", import.meta.url));
for (const [label, target] of Object.entries({
  missing: undefined,
  malformed: "invalid fixture-secret-sentinel",
  remote: "postgresql://postgres@production.example:54322/postgres",
  wrongProtocol: "https://127.0.0.1:54322/postgres",
  wrongPort: "postgresql://postgres@127.0.0.1:5432/postgres",
  wrongDatabase: "postgresql://postgres@127.0.0.1:54322/other",
  hostOverride: "postgresql://postgres@127.0.0.1:54322/postgres?host=production.example",
  serviceOverride: "postgresql://postgres@127.0.0.1:54322/postgres?service=production",
})) {
  test(`approval concurrency target guard: ${label}`, () => {
    // No inherited provider or production credentials are needed for rejection.
    const result = spawnSync(process.execPath, [script], {
      env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        ...(target === undefined ? {} : { APPROVAL_RETRY_TEST_DB_URL: target }) },
      encoding: "utf8", timeout: 5_000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /disposable (?:local|loopback)/);
    assert.doesNotMatch(result.stderr, /fixture-secret-sentinel|production\.example/);
    assert.doesNotMatch(result.stderr, /spawn psql|Command failed/);
  });
}
