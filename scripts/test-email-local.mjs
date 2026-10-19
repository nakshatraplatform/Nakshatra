import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--workdir")) {
  throw new Error("Only --workdir <local Supabase directory> is supported");
}
// Status reads local Docker configuration. Never use linked/project flags or
// emit the status output, which includes local-only credentials.
const status = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["supabase", "status", "--output", "json", ...args], { encoding: "utf8" });
if (status.status !== 0) throw new Error("Start a disposable local Supabase stack before email integration");
let local;
try { local = JSON.parse(status.stdout); } catch { throw new Error("Local Supabase status was unavailable"); }
const url = new URL(local.API_URL);
if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || !url.port || !local.SERVICE_ROLE_KEY) {
  throw new Error("Email integration refuses a non-loopback target or missing local credential");
}
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.email.config.ts"], {
  env: { ...process.env, EMAIL_TEST_SUPABASE_URL: url.href, EMAIL_TEST_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY }, stdio: "inherit",
});
process.exit(result.status ?? 1);
