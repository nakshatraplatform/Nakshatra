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
async function held(transaction, marker) {
  await new Promise((resolve, reject) => {
    transaction.child.stdout.on("data", chunk => { if (String(chunk).includes(marker)) resolve(); });
    transaction.child.on("close", () => reject(new Error(`Transaction did not reach ${marker}`)));
  });
}
async function isBlocked(name) {
  for (let tries = 0; tries < 10; tries++) {
    if (await checked(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event_type='Lock';`) === "1") return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
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

  // A new draft has no publication-progress row to incidentally serialize deletes.
  await checked(`delete from public.portfolio_media where portfolio_id='${portfolio}';
    delete from app_private.photo_object_cleanup where portfolio_id='${portfolio}';
    insert into public.portfolio_media(id,portfolio_id,media_type,storage_path,visibility) values
      ('e7840000-1111-4111-8111-111111111111','${portfolio}','gallery','${owner}/shared.webp','public'),
      ('e7840000-1111-4111-8111-222222222222','${portfolio}','gallery','${owner}/shared.webp','public');`);
  const deletion = query(`${authenticate} delete from public.portfolio_media where id='e7840000-1111-4111-8111-111111111111';
    select 'retirement-held'; select pg_sleep(3); commit;`, "photo-retirement-first");
  await held(deletion, "retirement-held");
  const duplicate = query(`${authenticate} delete from public.portfolio_media where id='e7840000-1111-4111-8111-222222222222'; commit;`, "photo-retirement-second");
  const deletionBlocked = await isBlocked("photo-retirement-second");
  const deleted = await Promise.all([deletion.result, duplicate.result]);
  const retired = await checked(`select count(*) from app_private.photo_object_cleanup where storage_path='${owner}/shared.webp';`);
  if (!deletionBlocked || deleted.some(result => result.code !== 0) || retired !== "1") {
    throw new Error(`Overlapping duplicate deletions lost their cleanup obligation (queued: ${retired})`);
  }
  console.log("Concurrent duplicate retirement passed: both deletions committed and exactly one cleanup obligation remains.");

  await checked(insert("reattach"));
  const retirement = query(`${authenticate} delete from public.portfolio_media where storage_path='${owner}/${portfolio}/reattach.webp';
    select 'reattach-held'; select pg_sleep(3); commit;`, "photo-reattach-retire");
  await held(retirement, "reattach-held");
  const attachment = query(`${authenticate} ${insert("reattach")} commit;`, "photo-reattach-write");
  const attachmentBlocked = await isBlocked("photo-reattach-write");
  const [retirementResult, attachmentResult] = await Promise.all([retirement.result, attachment.result]);
  if (!attachmentBlocked || retirementResult.code !== 0 || attachmentResult.code === 0
    || !attachmentResult.error.includes("23514") || !attachmentResult.error.includes("retired photo cannot be reattached")) {
    throw new Error("Overlapping retirement allowed a retired object to be reattached");
  }
  console.log("Concurrent reattachment fencing passed: retirement committed and the competing attachment was rejected.");
} finally {
  await checked(`delete from public.portfolios where id='${portfolio}'; delete from auth.users where id='${owner}'; delete from app_private.photo_object_cleanup where portfolio_id='${portfolio}';`);
}
