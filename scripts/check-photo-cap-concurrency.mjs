import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Only disposable loopback databases may run this fixture; never accept a remote URL.
if (!["127.0.0.1", "localhost", "::1"].includes(process.env.PGHOST) || process.env.PGHOSTADDR || !process.env.PGPORT || process.env.PGSERVICE || process.env.PGSERVICEFILE) {
  throw new Error("Set PGHOST to loopback and PGPORT for a disposable local test database");
}
const owner = "e1840000-1111-4111-8111-111111111111";
const portfolio = "e4840000-1111-4111-8111-111111111111";
const fixture = fileURLToPath(new URL("../supabase/tests/database/auth-fixtures.psql", import.meta.url));
function query(sql, applicationName = "photo-cap-test") {
  const child = spawn("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], {
    env: { ...process.env, PGAPPNAME: applicationName, PGOPTIONS: "-c statement_timeout=15000 -c lock_timeout=10000" }, stdio: ["pipe", "pipe", "pipe"],
  });
  let output = ""; let error = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { error += chunk; });
  const result = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code => resolve({ code, output, error }));
  });
  child.stdin.end(sql);
  return { child, result };
}
async function checked(sql) {
  const result = await query(sql).result;
  if (result.code !== 0) throw new Error(`Local photo-cap fixture failed: ${result.error}`);
  return result.output.trim();
}
const insert = suffix => `insert into public.portfolio_media(portfolio_id,media_type,storage_path,visibility) values('${portfolio}','gallery','${owner}/${portfolio}/${suffix}.webp','public');`;
const authenticate = String.raw`\ir ${fixture}
begin; set local role authenticated;
select pg_temp.set_authenticated_claims('${owner}','e2840000-1111-4111-8111-111111111111');`;
try {
  await checked(String.raw`\ir ${fixture}
select pg_temp.create_auth_actor('${owner}','e2840000-1111-4111-8111-111111111111','concurrent-photo@test.local');
insert into public.portfolios(id,user_id,draft_data) values('${portfolio}','${owner}','{}');
${Array.from({ length: 7 }, (_, i) => insert(`seed-${i}`)).join("\n")}`);
  const first = query(`${authenticate} ${insert("first")} select 'locked'; select pg_sleep(3); commit;`, "photo-cap-first");
  await new Promise((resolve, reject) => {
    first.child.stdout.on("data", chunk => { if (String(chunk).includes("locked")) resolve(); });
    first.child.on("close", () => reject(new Error("First photo transaction did not acquire its lock")));
  });
  const second = query(`${authenticate} set statement_timeout='10s'; ${insert("second")} commit;`, "photo-cap-second");
  let blocked = "0";
  for (let tries = 0; tries < 10 && blocked !== "1"; tries++) {
    blocked = await checked(`select count(*) from pg_stat_activity where application_name='photo-cap-second' and wait_event_type='Lock';`);
    if (blocked !== "1") await new Promise(resolve => setTimeout(resolve, 100));
  }
  const [a, b] = await Promise.all([first.result, second.result]);
  if (blocked !== "1" || a.code !== 0 || b.code === 0 || !b.error.includes("23514") || !b.error.includes("at most 8 profile photos")) {
    throw new Error("Overlapping photo writes did not enforce the eight-photo limit");
  }
  if (await checked(`select count(*) from public.portfolio_media where portfolio_id='${portfolio}';`) !== "8") throw new Error("Photo cap was exceeded");
  console.log("Concurrent photo cap passed: one write committed, the competing write was rejected, eight photos remain.");
} finally {
  await checked(`delete from public.portfolios where id='${portfolio}'; delete from auth.users where id='${owner}'; delete from app_private.photo_object_cleanup where portfolio_id='${portfolio}';`);
}
