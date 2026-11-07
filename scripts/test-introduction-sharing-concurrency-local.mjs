import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

// Synthetic rows remain only in the disposable CI database until stack teardown.
const databaseUrl = process.env.INTRODUCTION_SHARE_TEST_DB_URL;
if (!databaseUrl) throw new Error("Set INTRODUCTION_SHARE_TEST_DB_URL to a disposable local Supabase database.");
const target = new URL(databaseUrl);
if (!["postgres:", "postgresql:"].includes(target.protocol)
  || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
  || target.port !== "54322" || target.pathname !== "/postgres" || target.search || target.hash) {
  throw new Error("Introduction concurrency verification requires disposable loopback Supabase on port 54322.");
}
const run = promisify(execFile);
const args = ["--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl];
const fixtures = fileURLToPath(new URL("../supabase/tests/database/auth-fixtures.psql", import.meta.url));
const sqlEnv = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TMP", "TEMP", "LANG", "LC_ALL"]
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
sqlEnv.PGCONNECT_TIMEOUT = "5";
const query = async (sql, name = "intro-sharing-check", withFixtures = false) => {
  const result = await run("psql", [...args, ...(withFixtures ? ["--file", fixtures] : []), "--command", sql], {
    env: { ...sqlEnv, PGAPPNAME: name }, timeout: 20_000, maxBuffer: 1024 * 1024,
  });
  return result.stdout.trim();
};

// Reuse the maintained readiness/mandate fixture rather than constructing a
// second interpretation of publication or consent requirements in this harness.
const source = readFileSync(new URL("../supabase/tests/database/introduction_action_workspace.test.sql", import.meta.url), "utf8");
const marker = "-- END NAK-204 CONCURRENCY FIXTURE";
assert.ok(source.includes(marker), "the concurrency fixture boundary must exist");
const ids = new Map();
const mapped = id => {
  if (!ids.has(id)) ids.set(id, randomUUID());
  return ids.get(id);
};
const tag = randomUUID();
const setup = source.split(marker)[0]
  .replace(/^\\ir auth-fixtures\.psql\s*$/gm, "")
  .replace(/^select plan\(\d+\);\s*$/gm, "")
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, mapped)
  .replace("'bir_'||lpad(n::text,32,'0')", `'bir_'||md5('${tag}'||n::text)`);
const broker = mapped("78000000-0000-4000-8000-000000000001");
const session = mapped("78100000-0000-4000-8000-000000000001");
const organization = mapped("78200000-0000-4000-8000-000000000001");
const seeded = await query(`${setup}
  select jsonb_build_object('workspaceRef',(select workspace_ref from public.organizations where id='${organization}'),
    'introductionRef',(select introduction_ref from app_private.broker_introductions where organization_id='${organization}' and status='created'));
  commit;`, "intro-sharing-seed", true);
const refs = JSON.parse(seeded.split(/\r?\n/).find(line => line.startsWith("{")));
assert.match(refs.workspaceRef, /^wrk_[0-9a-f]{32}$/);
assert.match(refs.introductionRef, /^bir_[0-9a-f]{32}$/);
const claims = `set local role authenticated; select pg_temp.set_authenticated_claims('${broker}','${session}');`;
await query(`begin; ${claims} select public.mark_broker_introduction_shared('${refs.workspaceRef}','${refs.introductionRef}',1); commit;`, "intro-sharing-activate", true);
const share = (side, action, version, key) => `select public.record_introduction_share_action('${refs.workspaceRef}','${refs.introductionRef}','${side}','${action}',${version},'${key}');`;
const state = async () => JSON.parse(await query(`select jsonb_object_agg(participant_side,row_version)
  from app_private.broker_introduction_share_states where introduction_id=(select id from app_private.broker_introductions where introduction_ref='${refs.introductionRef}')`));
const countEvents = async () => Number(await query(`select count(*) from app_private.broker_introduction_events where introduction_id=(select id from app_private.broker_introductions where introduction_ref='${refs.introductionRef}') and event_type in ('share_initiated','share_confirmed','reminder_initiated')`));

async function overlap(first, second, { firstClaims = claims, secondClaims = claims, waitForDeadline, holdSeconds = 2 } = {}) {
  const name = `intro-sharing-${randomUUID()}`;
  // Keep the first transaction open after the command has acquired its locks.
  const held = query(`begin; set local statement_timeout='12s'; ${firstClaims} ${first} select pg_sleep(${holdSeconds}); commit;`, name, true);
  held.catch(() => {});
  const until = Date.now() + 10_000;
  while (await query(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event='PgSleep'`) !== "1") {
    if (Date.now() >= until) { await held; throw new Error("First transaction did not reach its held-lock phase"); }
    await delay(25);
  }
  if (waitForDeadline) await waitForDeadline();
  const competing = query(`begin; set local statement_timeout='12s'; ${secondClaims} ${second} commit;`, "intro-sharing-competing", true);
  competing.catch(() => {});
  const blockedUntil = Date.now() + 1000;
  let blocked = false;
  while (Date.now() < blockedUntil) {
    blocked = await query(`select exists(select 1 from pg_stat_activity holder,pg_stat_activity waiter
      where holder.application_name='${name}' and waiter.application_name='intro-sharing-competing'
      and holder.pid=any(pg_blocking_pids(waiter.pid)))`) === "t";
    if (blocked) break;
    await delay(25);
  }
  const results = await Promise.allSettled([held, competing]);
  assert.ok(blocked, "the competing transaction must actually overlap and wait on the first");
  return results;
}

const key = `share-concurrency:${randomUUID()}`;
const duplicate = await overlap(share("source", "initiate", 1, key), share("source", "initiate", 1, key));
assert.ok(duplicate.every(result => result.status === "fulfilled"), "same-key retries both return success");
assert.deepEqual(await state(), { source: 2, recipient: 1 });
assert.equal(await countEvents(), 1, "same-key overlap writes exactly one event");

const stale = await overlap(share("source", "confirm", 2, `confirm:${randomUUID()}`), share("source", "confirm", 2, `confirm:${randomUUID()}`));
assert.equal(stale[0].status, "fulfilled");
assert.equal(stale[1].status, "rejected", "a distinct stale command must fail instead of overwriting");
assert.match(stale[1].reason?.stderr || "", /share state changed; refresh and retry/);
assert.deepEqual(await state(), { source: 3, recipient: 1 });
assert.equal(await countEvents(), 2);

const separate = await overlap(share("source", "initiate", 3, `side:${randomUUID()}`), share("recipient", "initiate", 1, `side:${randomUUID()}`));
assert.ok(separate.every(result => result.status === "fulfilled"), "different sides serialize without losing either operation");
assert.deepEqual(await state(), { source: 4, recipient: 2 });
assert.equal(await countEvents(), 4);
console.log("Introduction sharing concurrency passed: duplicate retry, stale version and independent-side overlap.");

// A response can acquire the Introduction row before the response deadline
// while a later source-side pause begins after it. The pause must wait and
// permanently revoke the Complete window written by the in-flight response.
const sourceUser = mapped("78000000-0000-4000-8000-000000000002");
const sourceSession = mapped("78100000-0000-4000-8000-000000000002");
const recipientUser = mapped("78000000-0000-4000-8000-000000000003");
const recipientSession = mapped("78100000-0000-4000-8000-000000000003");
const sourceRelationship = mapped("78800000-0000-4000-8000-000000000001");
const actorClaims = (user, sessionId) => `set local role authenticated; select pg_temp.set_authenticated_claims('${user}','${sessionId}');`;
const sourceClaims = actorClaims(sourceUser, sourceSession);
const recipientClaims = actorClaims(recipientUser, recipientSession);
const respond = `select public.respond_to_broker_introduction_with_family_consent('${refs.introductionRef}','accepted','',true);`;
const relationshipRef = await query(`update public.broker_clients set claimed_at=starts_at where id='${sourceRelationship}' returning relationship_ref`);
assert.match(relationshipRef, /^bcr_[0-9a-f]{32}$/);
const manage = (action) => `select public.manage_customer_broker_consent('${relationshipRef}','${action}','mandate:${randomUUID()}');`;
await query(`begin; ${sourceClaims} ${respond} commit;`, "intro-consent-first", true);
await query(`update app_private.broker_introductions set expires_at=clock_timestamp()+interval '3 seconds' where introduction_ref='${refs.introductionRef}'`);
async function waitForDeadline() {
  const stop = Date.now() + 5_000;
  while (await query(`select expires_at<=clock_timestamp() from app_private.broker_introductions where introduction_ref='${refs.introductionRef}'`) !== "t") {
    if (Date.now() >= stop) throw new Error("The response deadline did not pass");
    await delay(30);
  }
}
const concurrentPause = await overlap(respond, manage("pause"), {
  firstClaims: recipientClaims, secondClaims: sourceClaims, holdSeconds: 7, waitForDeadline,
});
assert.ok(concurrentPause.every(result => result.status === "fulfilled"), "mutual response and pause must both finish");
assert.match(concurrentPause[0].value, /"disclosureLevel": "complete"/);
assert.match(concurrentPause[1].value, /"relationshipStatus": "paused"/);
await query(`begin; ${sourceClaims} ${manage("renew")} commit;`, "intro-consent-renew", true);
const afterRenewal = await query(`begin; ${recipientClaims}
  select public.resolve_broker_introduction('${refs.introductionRef}',null)->>'available'; commit;`, "intro-consent-after-renew", true);
assert.equal(afterRenewal.split(/\r?\n/).at(-1), "false", "renewal must never restore the in-flight Complete window");
console.log("Introduction consent concurrency passed: a pause at the response deadline revokes an in-flight Complete window.");

// Reverse the lock order. The responder starts before expiry but reaches the
// command while a post-deadline pause holds the expired pending row.
await query(`update app_private.broker_introductions set revoked_at=null,
  response=null,responded_at=null,recipient_complete_access_confirmed_at=null,
  recipient_family_complete_consented=false,mutual_interest_confirmed_at=null,
  complete_access_expires_at=null,expires_at=clock_timestamp()+interval '3 seconds'
  where introduction_ref='${refs.introductionRef}'`);
const queuedResponse = query(`begin; ${recipientClaims} select pg_sleep(5); ${respond} commit;`, "intro-consent-queued", true);
queuedResponse.catch(() => {});
await waitForDeadline();
const heldPause = query(`begin; ${sourceClaims} ${manage("pause")} select pg_sleep(5); commit;`, "intro-consent-hold-pause", true);
heldPause.catch(() => {});
const waitLimit = Date.now() + 4500;
let queued = false;
while (Date.now() < waitLimit) {
  queued = await query(`select exists(select 1 from pg_stat_activity holder,pg_stat_activity waiter
    where holder.application_name='intro-consent-hold-pause' and waiter.application_name='intro-consent-queued'
    and holder.pid=any(pg_blocking_pids(waiter.pid)))`) === "t";
  if (queued) break;
  await delay(25);
}
const [staleResponse, pauseResult] = await Promise.all([queuedResponse, heldPause]);
assert.ok(queued, "the pre-deadline response transaction must wait on the post-deadline pause");
assert.match(staleResponse, /"available": false/);
assert.match(pauseResult, /"relationshipStatus": "paused"/);
await query(`begin; ${sourceClaims} ${manage("renew")} commit;`, "intro-consent-renew-after-stale", true);
const afterStale = await query(`select mutual_interest_confirmed_at is null and complete_access_expires_at is null
  from app_private.broker_introductions where introduction_ref='${refs.introductionRef}'`);
assert.equal(afterStale, "t", "a stale response cannot open Complete after pause or renewal");
console.log("Introduction consent concurrency passed: a pre-deadline transaction cannot respond after waiting on a post-deadline pause.");
