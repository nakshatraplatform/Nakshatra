import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

const databaseUrl = process.env.FAMILY_VIEWER_TEST_DB_URL;
if (!databaseUrl) throw new Error("Set FAMILY_VIEWER_TEST_DB_URL to a disposable local Supabase database.");
let target;
try { target = new URL(databaseUrl); }
catch { throw new Error("Family Viewer concurrency verification requires a valid disposable local database URL."); }
if (!["postgres:", "postgresql:"].includes(target.protocol)
  || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
  || target.port !== "54322" || target.pathname !== "/postgres" || target.search || target.hash) {
  throw new Error("Family Viewer concurrency verification requires the disposable loopback Supabase database on port 54322.");
}

const args = ["--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl];
const fixtures = fileURLToPath(new URL("../supabase/tests/database/auth-fixtures.psql", import.meta.url));
const run = promisify(execFile);
const sqlEnv = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TMP", "TEMP", "LANG", "LC_ALL"]
  .filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
sqlEnv.PGCONNECT_TIMEOUT = "5";
const query = async (sql, withFixtures = false) => {
  const result = await run("psql", [...args, ...(withFixtures ? ["--file", fixtures] : []), "--command", sql],
    { env: sqlEnv, timeout: 20_000, maxBuffer: 1024 * 1024 });
  return result.stdout.trim();
};

const live = new Set();
function session(name) {
  const child = spawn("psql", [...args, "--file", fixtures, "--file", "-"], {
    env: { ...sqlEnv, PGAPPNAME: name }, stdio: ["pipe", "pipe", "pipe"],
  });
  live.add(child);
  let output = "", errors = "", ended = false;
  const timer = setTimeout(() => child.kill(), 25_000);
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { errors += chunk; });
  child.stdin.on("error", () => {});
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      ended = true; clearTimeout(timer); live.delete(child);
      if (code === 0) resolve(output);
      else reject(new Error(`Family Viewer concurrency session failed (${code}): ${errors}`));
    });
  });
  done.catch(() => {});
  return {
    name,
    send(sql) { child.stdin.write(`${sql}\n`); },
    async marker(text) {
      const until = Date.now() + 10_000;
      while (!output.split(/\r?\n/).includes(text)) {
        if (ended) { await done; throw new Error(`Session ended before ${text}`); }
        if (Date.now() > until) throw new Error(`Session did not reach ${text}`);
        await delay(25);
      }
    },
    async finish() { child.stdin.end("\\q\n"); return done; },
  };
}

async function blockedBy(waiter, holder) {
  const until = Date.now() + 8_000;
  while (Date.now() < until) {
    if (await query(`select exists(select 1 from pg_stat_activity a
      join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid))
      where a.application_name='${waiter.name}' and b.application_name='${holder.name}'
        and a.wait_event_type='Lock')`) === "t") return;
    await delay(50);
  }
  throw new Error("Expected overlapping Family Viewer transactions were not observed");
}

const ids = Object.fromEntries([
  "owner", "ownerSession", "viewer1", "viewer1Session", "viewer2", "viewer2Session",
  "viewer3", "viewer3Session", "viewer4", "viewer4Session", "candidate", "organization",
  "entitlement", "relationship", "mandate", "active1", "active2", "pending3", "pending4",
  "invitation3", "invitation4",
].map((key) => [key, randomUUID()]));
const email = (name) => `${name}-${ids.candidate}@family-concurrency.test`;
const token3 = "3".repeat(64), token4 = "4".repeat(64);

function claims(user, authSession) {
  return `set local role authenticated;
    select pg_temp.set_authenticated_claims('${user}','${authSession}');`;
}

try {
  await query(`begin;
    select pg_temp.create_auth_actor('${ids.owner}','${ids.ownerSession}','${email("owner")}');
    select pg_temp.create_auth_actor('${ids.viewer1}','${ids.viewer1Session}','${email("viewer1")}');
    select pg_temp.create_auth_actor('${ids.viewer2}','${ids.viewer2Session}','${email("viewer2")}');
    select pg_temp.create_auth_actor('${ids.viewer3}','${ids.viewer3Session}','${email("viewer3")}');
    select pg_temp.create_auth_actor('${ids.viewer4}','${ids.viewer4Session}','${email("viewer4")}');
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at) values
      ('${randomUUID()}','${ids.viewer3}','google-${ids.viewer3}',jsonb_build_object('sub','google-${ids.viewer3}','email','${email("viewer3")}','email_verified',true),'google',now(),now(),now()),
      ('${randomUUID()}','${ids.viewer4}','google-${ids.viewer4}',jsonb_build_object('sub','google-${ids.viewer4}','email','${email("viewer4")}','email_verified',true),'google',now(),now(),now());
    insert into public.organizations(id,type,name,slug,status,created_by)
      values('${ids.organization}','matchmaker_agency','Concurrency Agency','family-${ids.organization}','active','${ids.owner}');
    insert into public.entitlements(id,organization_id,feature_key,feature_value,source)
      values('${ids.entitlement}','${ids.organization}','brokerdesk.enabled','true'::jsonb,'test');
    insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
      values('${ids.candidate}','${ids.owner}','Concurrency Candidate','${ids.owner}');
    insert into public.broker_clients(id,organization_id,candidate_id,relationship_status,relationship_source,claimed_at,consented_at,starts_at,ends_at)
      values('${ids.relationship}','${ids.organization}','${ids.candidate}','active','customer_invitation',now(),now(),now()-interval '1 day',now()+interval '90 days');
    insert into app_private.broker_client_mandates(id,organization_id,broker_client_id,purpose,permitted_capabilities,evidence_reference,consent_version,customer_approved_by,starts_at,ends_at)
      values('${ids.mandate}','${ids.organization}','${ids.relationship}','Concurrency proof',app_private.broker_mandate_capabilities('broker-representation-v3'),'fixture:concurrency','broker-representation-v3','${ids.owner}',now()-interval '1 day',now()+interval '90 days');
    insert into app_private.candidate_family_viewers(id,candidate_id,intended_email_hash,intended_email_hint,verified_user_id,display_name,relationship_kind,status,candidate_approved_by,candidate_approved_at,verified_at) values
      ('${ids.active1}','${ids.candidate}',app_private.normalized_email_hash('${email("viewer1")}'),'v1***@family-concurrency.test','${ids.viewer1}','Viewer One','parent','active','${ids.owner}',now(),now()),
      ('${ids.active2}','${ids.candidate}',app_private.normalized_email_hash('${email("viewer2")}'),'v2***@family-concurrency.test','${ids.viewer2}','Viewer Two','sibling','active','${ids.owner}',now(),now()),
      ('${ids.pending3}','${ids.candidate}',app_private.normalized_email_hash('${email("viewer3")}'),'v3***@family-concurrency.test',null,'Viewer Three','guardian','pending_verification','${ids.owner}',now(),null),
      ('${ids.pending4}','${ids.candidate}',app_private.normalized_email_hash('${email("viewer4")}'),'v4***@family-concurrency.test',null,'Viewer Four','relative','pending_verification','${ids.owner}',now(),null);
    insert into app_private.candidate_family_viewer_invitations(id,family_viewer_id,token_hash,intended_email_hash,intended_email_hint,invited_by,expires_at) values
      ('${ids.invitation3}','${ids.pending3}','${token3}',app_private.normalized_email_hash('${email("viewer3")}'),'v3***@family-concurrency.test','${ids.owner}',now()+interval '1 day'),
      ('${ids.invitation4}','${ids.pending4}','${token4}',app_private.normalized_email_hash('${email("viewer4")}'),'v4***@family-concurrency.test','${ids.owner}',now()+interval '1 day');
    commit;`, true);

  const third = session(`family-third-${ids.candidate}`);
  const fourth = session(`family-fourth-${ids.candidate}`);
  third.send(`begin; set local statement_timeout='12s'; ${claims(ids.viewer3, ids.viewer3Session)}
    select public.accept_family_viewer_invitation('${token3}','concurrent-third-activation');
    \\echo THIRD_ACTIVATED`);
  await third.marker("THIRD_ACTIVATED");
  fourth.send(`begin; set local statement_timeout='12s'; ${claims(ids.viewer4, ids.viewer4Session)}
    select public.accept_family_viewer_invitation('${token4}','concurrent-fourth-activation'); commit;`);
  await blockedBy(fourth, third);
  third.send("commit;");
  await Promise.all([third.finish(), fourth.finish()]);

  assert.equal(await query(`select count(*) from app_private.candidate_family_viewers where candidate_id='${ids.candidate}' and status='active' and revoked_at is null`), "3",
    "overlapping third/fourth activation must leave exactly three active viewers");
  assert.equal(await query(`select count(*) from app_private.candidate_family_viewers where id='${ids.pending4}' and status='pending_verification'`), "1",
    "the losing fourth activation must remain pending rather than gaining authority");

  const refs = JSON.parse(await query(`select jsonb_build_object(
    'first',(select viewer_ref from app_private.candidate_family_viewers where id='${ids.active1}'),
    'second',(select viewer_ref from app_private.candidate_family_viewers where id='${ids.active2}'),
    'firstVersion',(select row_version from app_private.candidate_family_viewers where id='${ids.active1}'),
    'secondVersion',(select row_version from app_private.candidate_family_viewers where id='${ids.active2}'))`));
  const primaryFirst = session(`primary-first-${ids.candidate}`);
  const primarySecond = session(`primary-second-${ids.candidate}`);
  primaryFirst.send(`begin; set local statement_timeout='12s'; ${claims(ids.owner, ids.ownerSession)}
    select public.set_primary_family_viewer('${refs.first}',${refs.firstVersion},'concurrent-primary-first');
    \\echo FIRST_PRIMARY`);
  await primaryFirst.marker("FIRST_PRIMARY");
  primarySecond.send(`begin; set local statement_timeout='12s'; ${claims(ids.owner, ids.ownerSession)}
    select public.set_primary_family_viewer('${refs.second}',${refs.secondVersion},'concurrent-primary-second'); commit;`);
  await blockedBy(primarySecond, primaryFirst);
  primaryFirst.send("commit;");
  await Promise.all([primaryFirst.finish(), primarySecond.finish()]);

  assert.equal(await query(`select count(*) from app_private.candidate_family_viewers where candidate_id='${ids.candidate}' and status='active' and role='primary' and revoked_at is null`), "1",
    "overlapping primary changes must leave exactly one primary");
  assert.equal(await query(`select (viewer_ref='${refs.second}')::text from app_private.candidate_family_viewers where candidate_id='${ids.candidate}' and status='active' and role='primary'`), "true",
    "the serialized later primary change must win deterministically");
  process.stdout.write("Family Viewer concurrency passed: three-viewer cap and sole-primary invariant survived overlapping transactions.\n");
} finally {
  for (const child of live) { child.stdin.destroy(); child.kill(); }
}
