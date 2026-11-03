import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

// No linked project, provider, worker, or email client is used. Synthetic rows
// remain in this disposable database until the CI job stops its local stack.
const databaseUrl = process.env.APPROVAL_RETRY_TEST_DB_URL;
if (!databaseUrl) throw new Error("Set APPROVAL_RETRY_TEST_DB_URL to a disposable local Supabase database.");
let target;
try { target = new URL(databaseUrl); }
catch { throw new Error("Approval/retry verification requires a valid disposable local database URL."); }
if (!["postgres:", "postgresql:"].includes(target.protocol)
  || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
  || target.port !== "54322" || target.pathname !== "/postgres" || target.search || target.hash) {
  throw new Error("Approval/retry verification requires the disposable loopback Supabase database on port 54322.");
}
const args = ["--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl];
const fixtures = fileURLToPath(new URL("../supabase/tests/database/auth-fixtures.psql", import.meta.url));
const run = promisify(execFile);
// libpq accepts PGHOSTADDR/PGSERVICE/PGOPTIONS independently of the URL. Do not
// inherit those overrides (or unrelated production credentials) across the
// process boundary after validating a loopback target.
const sqlEnv = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TMP", "TEMP", "LANG", "LC_ALL"]
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
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
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { errors += chunk; });
  // A terminated SQL process can close stdin while its failure is being
  // observed; the close/error promise below remains the failure authority.
  child.stdin.on("error", () => {});
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code => {
      ended = true; clearTimeout(timer); live.delete(child);
      if (code === 0) resolve(output);
      else reject(new Error(`Concurrency session failed (${code}): ${errors}`));
    });
  });
  // A session can fail while the coordinator is inspecting the other one.
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
  throw new Error("Expected overlapping database transactions were not observed");
}
function claims(user, authSession) {
  return `set local role authenticated;
    select pg_temp.set_authenticated_claims('${user}','${authSession}');`;
}

async function scenario(retryFirst, portfolioAccess = false) {
  const owner = randomUUID(), ownerSession = randomUUID(), viewer = randomUUID(), viewerSession = randomUUID();
  const candidate = randomUUID(), portfolio = randomUUID(), token = `approval_retry_${randomUUID().replaceAll("-", "")}`;
  const ownerEmail = `owner-${owner}@fixture.test`, viewerEmail = `viewer-${viewer}@fixture.test`;
  const details = JSON.stringify({ portfolioToken: token, name: "Concurrency Viewer", email: viewerEmail,
    phone: "+16175550123", profileFor: "self", familyContext: "Our family values kindness, honesty and mutual respect.",
    location: { country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA",
      city: "Boston", postalCode: "02108", locationSource: "manual" } });
  const submit = `select public.submit_interest_details('${details}'::jsonb);`;
  await query(`begin;
    select pg_temp.create_auth_actor('${owner}','${ownerSession}','${ownerEmail}');
    select pg_temp.create_auth_actor('${viewer}','${viewerSession}','${viewerEmail}');
    insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
      values('${candidate}','${owner}','Concurrency Owner','${owner}');
    insert into public.portfolios(id,user_id,candidate_id,share_token,draft_data,template_id)
      values('${portfolio}','${owner}','${candidate}','${token}','{}',3);
    insert into public.portfolio_media(portfolio_id,candidate_id,media_type,storage_path,visibility)
      values('${portfolio}','${candidate}','hero','${owner}/${portfolio}/hero.webp','public');
    update app_private.identity_verification_subjects set status='verified',verified_at=now(),expires_at=now()+interval '365 days'
      where candidate_id='${candidate}';
    select pg_temp.prime_paid_publication('${portfolio}',pg_temp.complete_portfolio_draft());
    set local role service_role;
    select pg_temp.set_service_role_claims();
    select public.service_publish_portfolio_transaction('${owner}','${ownerSession}','${portfolio}',
      pg_temp.complete_portfolio_draft(),'{"personal":{"name":"Concurrency Owner"}}',
      '{"personal":{"name":"Concurrency Owner"},"contact":{"email":"${ownerEmail}"}}',
      '${token}',now()+interval '30 days',3,'#17151c',null);
    reset role;
    ${claims(viewer, viewerSession)}
    ${submit}
    commit;`, true);
  const request = await query(`select id from public.interest_requests where portfolio_id='${portfolio}'`);
  assert.match(request, /^[0-9a-f-]{36}$/, "fixture must create exactly one real interest request");
  const revision = await query(`begin; ${claims(owner, ownerSession)}
    select 'REVISION:'||(public.get_owner_relationship_page()#>>'{disclosure,revision}'); rollback;`, true);
  const review = revision.match(/REVISION:([a-f0-9]{32})/)?.[1];
  assert.ok(review, "owner must review a real published disclosure");
  const approvalCommand = portfolioAccess ? "decide_interest_portfolio_reviewed" : "decide_interest_contact_reviewed";
  const approve = `select public.${approvalCommand}('${request}','${review}');`;
  const retry = session(`retry-${portfolio}`), approval = session(`approval-${portfolio}`);
  const begin = "begin; set local statement_timeout='12s'; set local idle_in_transaction_session_timeout='15s';";
  if (retryFirst) {
    // Hold the actual submission engine's first lock, then pause at that
    // boundary. Approval must wait for the retry's portfolio lock, then
    // decide exactly once under the selected disclosure contract.
    retry.send(`${begin} select id from public.portfolios where id='${portfolio}' for update;
      ${claims(viewer, viewerSession)}
      \\echo RETRY_LOCKED`);
    await retry.marker("RETRY_LOCKED");
    approval.send(`${begin} ${claims(owner, ownerSession)} ${approve} commit;`);
    await blockedBy(approval, retry);
    retry.send(`${submit} commit;`);
  } else {
    approval.send(`${begin} ${claims(owner, ownerSession)} ${approve}
      \\echo APPROVAL_LOCKED`);
    await approval.marker("APPROVAL_LOCKED");
    retry.send(`${begin} ${claims(viewer, viewerSession)} ${submit} commit;`);
    await blockedBy(retry, approval);
    approval.send("commit;");
  }
  const [approvalOutput, retryOutput] = await Promise.all([approval.finish(), retry.finish()]);
  assert.ok(approvalOutput.split(/\r?\n/).includes("approved"), "reviewed approval must succeed");
  assert.ok(retryOutput.split(/\r?\n/).includes("t"), "real submission retry must succeed");
  const state = JSON.parse(await query(`select jsonb_build_object(
    'requests',(select count(*) from public.interest_requests where portfolio_id='${portfolio}'),
    'approved',(select count(*) from public.interest_requests where portfolio_id='${portfolio}' and status='approved'
      and requester_user_id='${viewer}' and viewer_email='${viewerEmail}' and email_verified_at is not null and verification_channel='email'),
    'grants',(select count(*) from public.reveal_grants where portfolio_id='${portfolio}'),
    'grantAudit',(select count(*) from public.access_audit_events where interest_request_id='${request}' and event_type='grant_created'),
    'contactAudit',(select count(*) from app_private.guest_contact_decision_audit where interest_request_id='${request}' and owner_user_id='${owner}' and published_revision='${review}'),
    'submissionAudit',(select count(*) from public.access_audit_events where interest_request_id='${request}' and event_type='request_submitted'),
    'legacyApprovalMail',(select count(*) from app_private.notification_outbox where interest_request_id='${request}' and notification_type='full_view_approved'),
    'contactMail',(select count(*) from app_private.guest_interest_mail_outbox where interest_request_id='${request}' and kind='approved_contact' and recipient_email='${viewerEmail}'),
    'accessMail',(select count(*) from app_private.guest_interest_mail_outbox where interest_request_id='${request}' and kind='approved_access' and recipient_email='${viewerEmail}'),
    'requestMail',(select count(*) from app_private.notification_outbox where interest_request_id='${request}' and notification_type='new_introduction'))`));
  assert.deepEqual(state, { requests: 1, approved: 1, grants: portfolioAccess ? 1 : 0, grantAudit: portfolioAccess ? 1 : 0,
    contactAudit: portfolioAccess ? 0 : 1, submissionAudit: 1, legacyApprovalMail: 0,
    contactMail: portfolioAccess ? 0 : 1, accessMail: portfolioAccess ? 1 : 0, requestMail: 1 },
  "retry must preserve the reviewed disclosure, one verified recipient and one matching delivery without duplication");
  console.log(`Approval/retry: ${retryFirst ? "retry-first" : "approval-first"} overlap passed for ${portfolioAccess ? "approved portfolio viewing" : "contact sharing"}.`);
}
async function memberScenario(mode) {
  const members = [0, 1].map(() => ({ user: randomUUID(), authSession: randomUUID(), candidate: randomUUID(), portfolio: randomUUID(), token: `member_overlap_${randomUUID().replaceAll("-", "")}` }));
  for (const [index, member] of members.entries()) {
    await query(`begin;
      select pg_temp.create_auth_actor('${member.user}','${member.authSession}','member-${member.user}@fixture.test');
      insert into public.candidates(id,primary_owner_user_id,display_name,created_by) values('${member.candidate}','${member.user}','Member ${index}','${member.user}');
      insert into public.portfolios(id,user_id,candidate_id,share_token,draft_data,template_id) values('${member.portfolio}','${member.user}','${member.candidate}','${member.token}','{}',3);
      insert into public.portfolio_media(portfolio_id,candidate_id,media_type,storage_path,visibility) values('${member.portfolio}','${member.candidate}','hero','${member.user}/${member.portfolio}/hero.webp','public');
      update app_private.identity_verification_subjects set status='verified',verified_at=now(),expires_at=now()+interval '365 days' where candidate_id='${member.candidate}';
      select pg_temp.prime_paid_publication('${member.portfolio}',pg_temp.complete_portfolio_draft());
      set local role service_role; select pg_temp.set_service_role_claims();
      select public.service_publish_portfolio_transaction('${member.user}','${member.authSession}','${member.portfolio}',pg_temp.complete_portfolio_draft(),
        '{"personal":{"name":"Member ${index}"}}','{"personal":{"name":"Member ${index}"},"contact":{"email":"member-${member.user}@fixture.test"}}',
        '${member.token}',now()+interval '30 days',3,'#17151c',null); commit;`, true);
  }
  const [a, b] = members;
  const review = async member => {
    const result = await query(`begin; ${claims(member.user, member.authSession)} select 'REVISION:'||(public.get_owner_relationship_page()#>>'{disclosure,revision}'); rollback;`, true);
    const value = result.match(/REVISION:([a-f0-9]{32})/)?.[1]; assert.ok(value); return value;
  };
  const [aRevision, bRevision] = await Promise.all(members.map(review));
  const sendA = `select public.send_member_interest_and_share('${b.token}','${aRevision}');`;
  const sendB = `select public.send_member_interest_and_share('${a.token}','${bRevision}');`;
  const holder = session(`member-holder-${a.portfolio}`), waiter = session(`member-waiter-${a.portfolio}`);
  const begin = "begin; set local statement_timeout='12s'; set local idle_in_transaction_session_timeout='15s';";
  if (mode === "accept-then-send") {
    await query(`begin; ${claims(a.user, a.authSession)} ${sendA} commit;`, true);
    const request = await query(`select id from public.interest_requests where portfolio_id='${b.portfolio}' and requester_user_id='${a.user}'`);
    holder.send(`${begin} ${claims(b.user, b.authSession)} select public.decide_interest_relationship('${request}','approved','${bRevision}'); 
      \\echo MEMBER_LOCKED`);
  } else {
    holder.send(`${begin} ${claims(a.user, a.authSession)} ${sendA} 
      \\echo MEMBER_LOCKED`);
  }
  await holder.marker("MEMBER_LOCKED");
  const waiting = mode === "retry" ? a : b;
  waiter.send(`${begin} ${claims(waiting.user, waiting.authSession)} ${mode === "retry" ? sendA : sendB} commit;`);
  await blockedBy(waiter, holder);
  holder.send("commit;");
  const outputs = await Promise.all([holder.finish(), waiter.finish()]);
  assert.ok(outputs[1].includes(mode === "retry" ? "existing_request" : "submitted"));
  const ids = members.map(m => `'${m.portfolio}'`).join(",");
  const state = JSON.parse(await query(`select jsonb_build_object(
    'requests',(select count(*) from public.interest_requests where portfolio_id in (${ids})),
    'memberShares',(select count(*) from app_private.member_interest_shares where portfolio_id in (${ids}) and revoked_at is null),
    'approvalGrants',(select count(*) from public.reveal_grants where portfolio_id in (${ids}) and revoked_at is null),
    'newIntroductionMail',(select count(*) from app_private.notification_outbox where notification_type='new_introduction' and interest_request_id in (select id from public.interest_requests where portfolio_id in (${ids}))))`));
  const expected = mode === "retry" ? { requests: 1, memberShares: 1, approvalGrants: 0, newIntroductionMail: 1 }
    : mode === "accept-then-send" ? { requests: 2, memberShares: 1, approvalGrants: 1, newIntroductionMail: 2 }
    : { requests: 2, memberShares: 2, approvalGrants: 0, newIntroductionMail: 2 };
  assert.deepEqual(state, expected, "overlapping sends/approval must preserve exactly one permission per direction and one introduction email per real request");
  console.log(`Member sharing: ${mode} overlap passed with bounded independent permissions.`);
}

try {
  await scenario(true);
  await scenario(false);
  await scenario(true, true);
  await scenario(false, true);
  await memberScenario("retry");
  await memberScenario("crossed");
  await memberScenario("accept-then-send");
} finally {
  for (const child of live) { child.stdin.destroy(); child.kill(); }
}
