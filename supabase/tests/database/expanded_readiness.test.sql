begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(45);
select pg_temp.create_auth_actor('b5740000-1111-4111-8111-111111111111','b6740000-1111-4111-8111-111111111111','foreign@test.local');
select pg_temp.create_auth_actor('b1740000-1111-4111-8111-111111111111','b2740000-1111-4111-8111-111111111111','expanded@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values('b3740000-1111-4111-8111-111111111111','b1740000-1111-4111-8111-111111111111','Expanded','b1740000-1111-4111-8111-111111111111');
insert into public.portfolios(id,user_id,candidate_id,draft_data)
values('b4740000-1111-4111-8111-111111111111','b1740000-1111-4111-8111-111111111111','b3740000-1111-4111-8111-111111111111','{}');
select ok(not has_table_privilege('authenticated','public.portfolio_horoscopes','insert'),'browser cannot bypass CAS with direct insert');
select ok(not has_table_privilege('authenticated','public.portfolio_horoscopes','update'),'browser cannot reattach a retired object');
select ok(not has_function_privilege('authenticated','public.claim_horoscope_cleanup(integer)','execute'),'cleanup is service-only');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1740000-1111-4111-8111-111111111111','b2740000-1111-4111-8111-111111111111');
select public.reserve_horoscope_upload('b4740000-1111-4111-8111-111111111111') as upload_a \gset
select public.reserve_horoscope_upload('b4740000-1111-4111-8111-111111111111') as upload_b \gset
select is((public.replace_horoscope('b4740000-1111-4111-8111-111111111111',null,
  jsonb_build_object('storage_path',:'upload_b','mime_type','image/webp','file_extension','webp','byte_size',10,'page_count',1))).storage_path,:'upload_b','first successful commit wins initial-create race');
select throws_ok(format('select public.replace_horoscope(%L,null,%L::jsonb)','b4740000-1111-4111-8111-111111111111',
  jsonb_build_object('storage_path',:'upload_a','mime_type','image/webp','file_extension','webp','byte_size',10,'page_count',1)::text),
  'PT409','horoscope changed; refresh and try again','late commit cannot replace winner');
select is((public.replace_horoscope('b4740000-1111-4111-8111-111111111111',null,
  jsonb_build_object('storage_path',:'upload_b'))).storage_path,:'upload_b','lost response can be retried idempotently');
select public.reserve_horoscope_upload('b4740000-1111-4111-8111-111111111111') as upload_c \gset
select is((public.replace_horoscope('b4740000-1111-4111-8111-111111111111',:'upload_b',
  jsonb_build_object('storage_path',:'upload_c','mime_type','image/webp','file_extension','webp','byte_size',10,'page_count',1))).storage_path,:'upload_c','replacement commits against expected current object');
reset role;
select is((select count(*)::integer from app_private.horoscope_object_cleanup where storage_path=:'upload_b' and state='retired'),1,'obsolete object is queued atomically');
-- A genuine due queue row for the live object must still be excluded.
insert into app_private.horoscope_object_cleanup(storage_path,portfolio_id,state)
values(:'upload_c','b4740000-1111-4111-8111-111111111111','retired');
update app_private.horoscope_object_cleanup set run_after=now();
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_horoscope_cleanup(5)),2,'only abandoned and obsolete objects are claimable; live object is not');
reset role;
select is((select storage_path from public.portfolio_horoscopes where portfolio_id='b4740000-1111-4111-8111-111111111111'),:'upload_c','cleanup claim preserves live pointer');
select ok((select claim_token is null from app_private.horoscope_object_cleanup where storage_path=:'upload_c'),'live queued object was not leased');
select claim_token as cleanup_token from app_private.horoscope_object_cleanup where storage_path=:'upload_b' \gset
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(not public.finish_horoscope_cleanup(:'upload_b','b7740000-1111-4111-8111-111111111111'),'wrong cleanup token cannot acknowledge deletion');
select ok(public.finish_horoscope_cleanup(:'upload_b',:'cleanup_token','STORAGE_CLEANUP_FAILED'),'storage failure keeps durable retry');
reset role;
select ok((select run_after>now() and claim_token is null and last_error_code='STORAGE_CLEANUP_FAILED' from app_private.horoscope_object_cleanup where storage_path=:'upload_b'),'failure records backoff without discarding object');
update app_private.horoscope_object_cleanup set run_after=now() where storage_path=:'upload_b';
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token as cleanup_token_2 from public.claim_horoscope_cleanup(5) where storage_path=:'upload_b' \gset
select ok(not public.finish_horoscope_cleanup(:'upload_b',:'cleanup_token'),'previous lease cannot complete reclaimed job');
reset role;
update app_private.horoscope_object_cleanup set lease_expires_at=now()-interval '1 second' where storage_path=:'upload_b';
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(not public.finish_horoscope_cleanup(:'upload_b',:'cleanup_token_2'),'expired lease cannot discard cleanup obligation');
select claim_token as cleanup_token_3 from public.claim_horoscope_cleanup(5) where storage_path=:'upload_b' \gset
select ok(public.finish_horoscope_cleanup(:'upload_b',:'cleanup_token_3'),'current lease acknowledges confirmed object deletion');
reset role;
select is((select count(*)::integer from app_private.horoscope_object_cleanup where storage_path=:'upload_b'),0,'successful cleanup removes only its obligation');
-- Remove the synthetic live queue row so normal deletion creates its own obligation.
delete from app_private.horoscope_object_cleanup where storage_path=:'upload_c';
select id as current_attachment_id from public.portfolio_horoscopes where portfolio_id='b4740000-1111-4111-8111-111111111111' \gset
set local role authenticated;
select pg_temp.set_authenticated_claims('b5740000-1111-4111-8111-111111111111','b6740000-1111-4111-8111-111111111111');
select throws_ok($$select public.reserve_horoscope_upload('b4740000-1111-4111-8111-111111111111')$$,'42501','portfolio unavailable','foreign owner cannot reserve another portfolio');
select throws_ok($$select public.replace_horoscope('b4740000-1111-4111-8111-111111111111',null,'{}')$$,'42501','portfolio unavailable','foreign owner cannot replace attachment');
select throws_ok(format('select public.delete_owned_horoscope(%L)',:'current_attachment_id'),'42501','attachment unavailable','foreign owner cannot delete attachment');
select throws_ok($$select public.publish_owned_horoscope('b4740000-1111-4111-8111-111111111111',now())$$,'42501','portfolio unavailable','foreign owner cannot publish attachment');
reset role;
select pg_temp.set_invalid_session_claims('b1740000-1111-4111-8111-111111111111','b7740000-1111-4111-8111-111111111111');
set local role authenticated;
select throws_ok($$select public.reserve_horoscope_upload('b4740000-1111-4111-8111-111111111111')$$,'42501',null,'revoked session cannot reserve uploads');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('b1740000-1111-4111-8111-111111111111','b2740000-1111-4111-8111-111111111111');
select public.delete_owned_horoscope((select id from public.portfolio_horoscopes where portfolio_id='b4740000-1111-4111-8111-111111111111'));
reset role;
delete from public.portfolios where id='b4740000-1111-4111-8111-111111111111';
select is((select count(*)::integer from app_private.horoscope_object_cleanup),2,'cleanup obligations survive parent deletion');

-- Independently exercise every current application-managed retention class.
insert into public.portfolios(id,user_id,candidate_id,draft_data)
values('b4740000-1111-4111-8111-111111111111','b1740000-1111-4111-8111-111111111111','b3740000-1111-4111-8111-111111111111','{}');
insert into public.viewer_sessions(portfolio_id,started_at) values
 ('b4740000-1111-4111-8111-111111111111',now()-interval '91 days'),('b4740000-1111-4111-8111-111111111111',now());
insert into public.portfolio_views(portfolio_id,viewed_at) values
 ('b4740000-1111-4111-8111-111111111111',now()-interval '396 days'),('b4740000-1111-4111-8111-111111111111',now());
insert into public.portfolio_events(portfolio_id,event_type,created_at) values
 ('b4740000-1111-4111-8111-111111111111','view',now()-interval '396 days'),('b4740000-1111-4111-8111-111111111111','view',now());
insert into public.access_audit_events(portfolio_id,event_type,created_at) values
 ('b4740000-1111-4111-8111-111111111111','portfolio_unpublished',now()-interval '731 days'),('b4740000-1111-4111-8111-111111111111','portfolio_unpublished',now());
insert into public.interest_requests(portfolio_id,candidate_id,viewer_name,viewer_email,status,updated_at) values
 ('b4740000-1111-4111-8111-111111111111','b3740000-1111-4111-8111-111111111111','Old rejected','old@test.local','rejected',now()-interval '181 days'),
 ('b4740000-1111-4111-8111-111111111111','b3740000-1111-4111-8111-111111111111','Old open','open@test.local','new',now()-interval '181 days'),
 ('b4740000-1111-4111-8111-111111111111','b3740000-1111-4111-8111-111111111111','Recent rejected','recent@test.local','rejected',now());
insert into public.account_deletion_requests(subject_hash,status,retention_until) values
 (repeat('a',64),'completed',now()-interval '1 day'),(repeat('b',64),'completed',now()+interval '1 day');
-- API counters: cutoff, bounded draining, per-class evidence, and repeatability.
insert into app_private.api_rate_limits(action,subject_key,window_started_at,request_count,updated_at)
values('auth_email','anonymous:expanded-expired',now()-interval '3 days',1,now()-interval '3 days'),
 ('auth_email','anonymous:expanded-current',now(),1,now());
set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.production_worker_health()#>>'{retention,rateLimitsDeleted,lastSucceededAt}',null::text,'missing class success is visible');
select is(public.run_retention_class('rateLimitsDeleted',1)->>'affected','1','bounded scheduled class cleans expired counter');
select is(public.run_retention_class('rateLimitsDeleted',1)->>'affected','0','repeat run is idempotent');
select throws_ok($$select public.run_retention_class('arbitrary_table',1)$$,'22023','invalid retention class','arbitrary targets rejected');
select throws_ok($$select public.run_retention_class('rateLimitsDeleted',null)$$,'22023','invalid retention batch','unbounded cleanup rejected');
reset role;
select is((select count(*)::integer from app_private.api_rate_limits where subject_key='anonymous:expanded-current'),1,'recent counter remains');
select ok((select last_succeeded_at is not null from app_private.retention_run_state where class='rateLimitsDeleted'),'successful class timestamp persists independently');
select is((select last_succeeded_at from app_private.retention_run_state where class='viewerSessionsDeleted'),null::timestamptz,'another class is not falsely marked completed');
set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.run_retention_class('viewerSessionsDeleted',500)->>'affected','1','session retention removes only expired session');
select is(public.run_retention_class('portfolioViewsDeleted',500)->>'affected','1','view retention removes only expired analytics');
select is(public.run_retention_class('portfolioEventsDeleted',500)->>'affected','1','event retention removes only expired event');
select is(public.run_retention_class('accessAuditEventsDeleted',500)->>'affected','1','audit retention respects immutable-window guard');
select is(public.run_retention_class('interestRequestsAnonymized',500)->>'affected','1','only eligible closed-request PII is anonymized');
select is(public.run_retention_class('deletionReceiptsDeleted',500)->>'affected','1','completed receipt respects its own retention deadline');
reset role;
select is((select count(*)::integer from public.viewer_sessions),1,'recent session retained');
select is((select count(*)::integer from public.portfolio_views),1,'recent view retained');
select is((select count(*)::integer from public.portfolio_events),1,'recent event retained');
select is((select count(*)::integer from public.access_audit_events),1,'recent audit retained');
select is((select count(*)::integer from public.interest_requests where viewer_name is not null),2,'open and recent requests retain their submitted details');
select is((select count(*)::integer from public.account_deletion_requests),1,'recent completed receipt retained');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1740000-1111-4111-8111-111111111111','b2740000-1111-4111-8111-111111111111');
select throws_ok($$select public.run_retention_class('rateLimitsDeleted',1)$$,'42501','permission denied for function run_retention_class','browser cannot run destructive retention');
reset role;
select * from finish();
rollback;
