import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
const run = promisify(execFile);
const script = fileURLToPath(new URL("./test-introduction-sharing-concurrency-local.mjs", import.meta.url));
// The guard rejects these targets before authentication, so fixtures need no password.
for (const target of ["postgresql://postgres@db.example.test:54322/postgres",
  "postgresql://postgres@127.0.0.1:5432/postgres",
  "postgresql://postgres@127.0.0.1:54322/production",
  "postgresql://postgres@127.0.0.1:54322/postgres?hostaddr=203.0.113.1"]) {
  test(`refuses non-disposable target ${new URL(target).hostname}:${new URL(target).port}${new URL(target).pathname}`, async () => {
    await assert.rejects(run(process.execPath, [script], {
      env: { ...process.env, INTRODUCTION_SHARE_TEST_DB_URL: target }, timeout: 5000,
    }), error => {
      assert.match(error.stderr, /requires disposable loopback Supabase/);
      return true;
    });
  });
}
