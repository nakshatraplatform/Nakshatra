begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(34);
select pg_temp.create_auth_actor('aa740000-1111-4111-8111-111111111111','ab740000-1111-4111-8111-111111111111','readiness@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values('ac740000-1111-4111-8111-111111111111','aa740000-1111-4111-8111-111111111111','Readiness','aa740000-1111-4111-8111-111111111111');
select pg_temp.create_self_verification_draft('ac740000-1111-4111-8111-111111111111');
select ok(not has_table_privilege('authenticated','app_private.deleted_provider_cleanup','select'),'cleanup references stay private');
select ok(not has_function_privilege('authenticated','public.claim_deleted_provider_cleanup(integer)','execute'),'viewer cannot claim purge');
select ok(not has_function_privilege('anon','public.configure_production_worker_schedule(text,boolean)','execute'),'anonymous cannot activate scheduler');
set local role authenticated;
select pg_temp.set_authenticated_claims('aa740000-1111-4111-8111-111111111111','ab740000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('ac740000-1111-4111-8111-111111111111',null,repeat('a',64)) \gset
select public.register_candidate_liveness_provider_create(:'attempt_id',repeat('a',64),'ad740000-1111-4111-8111-111111111111',null);
select public.attach_candidate_liveness_provider_session(:'attempt_id',repeat('a',64),'ae740000-1111-4111-8111-111111111111','ad740000-1111-4111-8111-111111111111',1);
reset role;
delete from public.candidates where id='ac740000-1111-4111-8111-111111111111';
delete from auth.users where id='aa740000-1111-4111-8111-111111111111';
select is((select count(*)::integer from app_private.deleted_provider_cleanup),1,'provider cleanup survives candidate and Auth cascades');
select is((select count(*)::integer from app_private.identity_verification_attempts where id=:'attempt_id'),0,'original attempt can be removed');
select is((select provider_session_ref from app_private.deleted_provider_cleanup),'ae740000-1111-4111-8111-111111111111','minimum session correlation survives');
set local role service_role;
select pg_temp.set_service_role_claims();
select * from public.claim_deleted_provider_cleanup(1) \gset
select is((select count(*)::integer from public.claim_deleted_provider_cleanup(1)),0,'live cleanup lease excludes concurrent worker');
select ok(not public.finish_deleted_provider_cleanup(:'id','af740000-1111-4111-8111-111111111111'),'stale cleanup token rejected');
select ok(public.finish_deleted_provider_cleanup(:'id',:'claim_token','DIDIT_CLEANUP_FAILED'),'provider failure is durable');
reset role;
select is((select count(*)::integer from app_private.deleted_provider_cleanup),1,'failure never discards provider reference');
update app_private.deleted_provider_cleanup set run_after=now();
set local role service_role;
select pg_temp.set_service_role_claims();
select * from public.claim_deleted_provider_cleanup(1) \gset
select ok(public.finish_deleted_provider_cleanup(:'id',:'claim_token'),'confirmed purge completes');
reset role;
select is((select count(*)::integer from app_private.deleted_provider_cleanup),0,'confirmed purge discards unnecessary provider correlation');

set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.begin_production_maintenance(),null::uuid,'scheduler is dormant on installation');
select is(public.production_worker_health()->>'healthy','false','unstarted scheduler is unhealthy');
select public.configure_production_worker_schedule(repeat('x',32),true);
select public.begin_production_maintenance() as maintenance_token \gset
select ok(:'maintenance_token' is not null,'enabled worker leases batch');
select is(public.begin_production_maintenance(),null::uuid,'overlapping batch skipped');
select ok(not public.finish_production_maintenance('af740000-1111-4111-8111-111111111111',true),'foreign completion rejected');
select ok(public.finish_production_maintenance(:'maintenance_token',true),'leased batch records completion');
select is(public.production_worker_health()->>'healthy','true','fresh successful batch is healthy');
reset role;
update app_private.production_worker_state set last_succeeded_at=now()-interval '16 minutes';
set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.production_worker_health()->>'healthy','false','missing cadence is unhealthy even with empty queues');
select public.configure_production_worker_schedule(null,false);
reset role;
select is(app_private.dispatch_production_maintenance(),null::bigint,'disabled cron makes no network request');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and policyname='Approved viewers can read approved photo originals'),'viewers cannot mint long-lived photo URLs');
select ok(not exists(select 1 from pg_policies where schemaname='storage' and policyname='Approved viewers can read horoscope files'),'viewers cannot mint long-lived horoscope URLs');
select is((select count(*)::integer from cron.job where jobname='vivintro-production-maintenance'),1,'one named schedule installed');
select ok(not has_function_privilege('authenticated','public.begin_production_maintenance(uuid)','execute'),'users cannot run maintenance');
select ok(not has_function_privilege('anon','public.production_worker_health()','execute'),'queue health is private');
select ok(not has_table_privilege('service_role','app_private.production_worker_state','update'),'service changes use checked RPCs');
select is((select schedule from cron.job where jobname='vivintro-production-maintenance'),'*/5 * * * *','independent five-minute schedule');
select ok(not has_table_privilege('authenticated','vault.decrypted_secrets','select'),'users cannot decrypt scheduler secrets');
select ok(not has_table_privilege('authenticated','app_private.production_worker_dispatches','select'),'nonce consumption state is private');
select ok(not (app_private.production_dispatch_headers('af740000-1111-4111-8111-111111111111','1792267200') ? 'Authorization'),'dispatch never queues a permanent bearer');
select ok(app_private.production_dispatch_headers('af740000-1111-4111-8111-111111111111','1792267200')::text not like '%'||repeat('x',32)||'%','queued dispatch does not contain permanent secret');
set local role service_role;
select pg_temp.set_service_role_claims();
select public.configure_production_worker_schedule(repeat('x',32),true);
select public.begin_production_maintenance('af740000-1111-4111-8111-111111111111') as nonce_claim \gset
select ok(public.finish_production_maintenance(:'nonce_claim',true),'signed dispatch completes');
select is(public.begin_production_maintenance('af740000-1111-4111-8111-111111111111'),null::uuid,'replayed dispatch cannot start another completed batch');
select * from finish();
rollback;
