/** Destructive synthetic proof; loopback-only isolated Supabase with disposable fixtures. */
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = new URL(process.env.STORAGE_PROOF_URL ?? "http://127.0.0.1:55421");
const container = process.env.STORAGE_PROOF_CONTAINER ?? "supabase_db_nak74-readiness";
if (url.protocol !== 'http:' || url.port !== '55421' || !['localhost','127.0.0.1'].includes(url.hostname) || !/^supabase_db_nak74-readiness$/.test(container)) throw new Error("Isolated local proof only");
const secret = process.env.STORAGE_PROOF_JWT_SECRET;
const serviceKey = process.env.STORAGE_PROOF_SERVICE_KEY;
const anonKey = process.env.STORAGE_PROOF_ANON_KEY;
if (!secret || !serviceKey || !anonKey) throw new Error("Supply isolated local credentials; never production credentials");
const sql = source => execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: source, encoding: "utf8" });
const fixture = readFileSync(new URL('../supabase/tests/database/interest_details_and_photos.test.sql', import.meta.url), 'utf8');
const setup = fixture.slice(0, fixture.indexOf("select ok(public.can_read_approved_photo("))
  .replace('\\ir auth-fixtures.psql', () => readFileSync(new URL('../supabase/tests/database/auth-fixtures.psql', import.meta.url), 'utf8'));
const cleanup = "begin; alter table public.access_audit_events disable trigger prevent_access_audit_mutation; delete from public.portfolios where id::text like 'a3000000-0000-4000-8000-00000000000%'; delete from public.candidates where id::text like 'a2000000-0000-4000-8000-00000000000%'; delete from auth.users where id::text like 'a1000000-0000-4000-8000-00000000000%'; alter table public.access_audit_events enable trigger prevent_access_audit_mutation; delete from app_private.b2c_creator_entitlements where email_hash=app_private.normalized_email_hash('owner@access.test'); delete from public.reference_cities where geoname_id in(999000002,999000003); delete from public.reference_regions where geoname_id in(999000001,999000004); commit;";
const path = 'a1000000-0000-4000-8000-000000000001/interest-fixture/approved_only.webp';
const admin = createClient(url.href, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const jwt = payload => {
  const encoded = [ { alg: 'HS256', typ: 'JWT' }, payload ].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  return `${encoded}.${createHmac('sha256',secret).update(encoded).digest('base64url')}`;
};
const viewer = createClient(url.href, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${jwt({ sub:'a1000000-0000-4000-8000-000000000003', session_id:'a1100000-0000-4000-8000-000000000003', role:'authenticated', aud:'authenticated', exp: Math.floor(Date.now()/1000)+600 })}` } } });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
try {
  await admin.storage.from('photos').remove(['approved_only','interest_required','hidden','owner_only'].map(v=>path.replace('approved_only',v)));
  sql(cleanup);
  const output = sql(`${setup}\nreset role; commit;`);
  assert(!output.includes('not ok'), 'Synthetic fixture setup failed');
  // pgTAP fixtures contain metadata-only objects; create actual bytes through Storage.
  await admin.storage.from('photos').remove([path]);
  const image = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#13535a' } }).webp().toBuffer();
  const upload = await admin.storage.from('photos').upload(path, image, { contentType:'image/webp', upsert: true });
  assert(!upload.error, 'Synthetic upload failed');
  const projection = await viewer.rpc('resolve_approved_portfolio', { p_share_token:'phase2_secure_token_1' });
  assert(!projection.error && projection.data?.media?.some(m => m.accessPath === path), 'Approved viewer fixture lacks authorized descriptor');
  const long = await viewer.storage.from('photos').createSignedUrl(path,86_400);
  assert(!!long.error && !long.data?.signedUrl, 'Viewer minted a long-lived protected URL');
  const direct = await viewer.storage.from('photos').download(path);
  assert(!!direct.error, 'Viewer directly downloaded protected bytes');
  const trusted = await admin.storage.from('photos').createSignedUrl(path, 3);
  assert(!trusted.error && trusted.data?.signedUrl, 'Trusted short signing failed');
  const retrieval = await fetch(trusted.data.signedUrl);
  assert(retrieval.ok, `Signed URL did not retrieve real bytes: HTTP ${retrieval.status}; ${await retrieval.text()}`);
  sql("update public.reveal_grants set revoked_at=now() where viewer_user_id='a1000000-0000-4000-8000-000000000003';");
  const revoked = await viewer.rpc('resolve_approved_portfolio', { p_share_token:'phase2_secure_token_1' });
  assert(!revoked.error && revoked.data === null, 'Revoked viewer still resolves protected descriptors');
  const denied = await viewer.storage.from('photos').createSignedUrl(path,86_400);
  assert(!!denied.error, 'Revoked viewer minted URL');
  // A previously issued bearer URL remains valid until TTL. Revocation is not immediate byte recall.
  const residualBearerWorks = (await fetch(trusted.data.signedUrl)).ok;
  await new Promise(resolve => setTimeout(resolve, 4_500));
  assert(!(await fetch(trusted.data.signedUrl)).ok, 'Short capability survived expiry');
  console.log(JSON.stringify({ approvedDescriptor: true, viewerLongTtlDenied: true, directReadDenied: true,
    trustedRealBytes: true, postRevocationNewAccessDenied: true, residualBearerWorks, expiredBearerDenied: true,
    storageImage: execFileSync('docker',['inspect',container.replace('supabase_db_', 'supabase_storage_'),'--format','{{.Config.Image}}'],{encoding:'utf8'}).trim(), scope: 'isolated local synthetic; deployed Storage not exercised' }));
} finally {
  await admin.storage.from('photos').remove(['approved_only','interest_required','hidden','owner_only'].map(v=>path.replace('approved_only',v)));
  sql(cleanup);
}
