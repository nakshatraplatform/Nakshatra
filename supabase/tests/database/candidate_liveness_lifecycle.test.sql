begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(15);
select pg_temp.create_auth_actor('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111','lifecycle@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values ('b3000000-1111-4111-8111-111111111111','b1000000-1111-4111-8111-111111111111','Test','b1000000-1111-4111-8111-111111111111');
select pg_temp.create_self_verification_draft('b3000000-1111-4111-8111-111111111111');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',null,repeat('a',64)) \gset a_
reset role;
-- Recovery may terminate a create before a session is attached.
update app_private.identity_verification_attempts set status='failed' where id=:'a_attempt_id';
set local role authenticated;
select * from public.begin_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',null,repeat('b',64)) \gset b_
select public.register_candidate_liveness_provider_create(:'b_attempt_id',repeat('b',64),'b4000000-1111-4111-8111-111111111111',1);
select public.attach_candidate_liveness_provider_session(:'b_attempt_id',repeat('b',64),'b5000000-1111-4111-8111-111111111111','b4000000-1111-4111-8111-111111111111',1);
select is(public.get_identity_verification_link_status(repeat('a',64))->>'status','failed','old link reports its exact attempt, not the newer session');
select is(public.get_identity_verification_link_status(repeat('a',64))->>'canRetry','false','superseded link does not offer retry');
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('a',64),repeat('c',64))$$,'IV002',null,'old failed-attempt token cannot create a competing session');
reset role;
select is((select count(*)::integer from app_private.identity_verification_attempts where candidate_id='b3000000-1111-4111-8111-111111111111' and status in ('created','in_progress')),1,'only the current session stays active');
select is((select count(*)::integer from app_private.identity_verification_worker_state where attempt_id=:'b_attempt_id' and task_type='reconcile' and completed_at is null),1,'current reconciliation job is preserved');
update app_private.identity_verification_worker_state set run_after=now() where attempt_id=:'b_attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select ok(public.complete_identity_verification_reconciliation(:'b_attempt_id',:'claim_token','declined',false,false,false,false,false,false),'declined result schedules deletion');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select is(public.get_identity_verification_link_status(repeat('b',64))->>'canRetry','false','retry waits for evidence cleanup');
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('b',64),repeat('c',64))$$,'IV002',null,'pending cleanup cannot lose its subject-keyed worker slot');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select throws_ok($$select public.begin_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',null,repeat('c',64))$$,'IV002',null,'dashboard start also waits for cleanup');
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select ok(public.complete_identity_verification_provider_redaction(:'b_attempt_id',:'claim_token'),'worker confirms evidence cleanup');
reset role;
select ok((select status='declined' and provider_redacted_at is not null from app_private.identity_verification_attempts where id=:'b_attempt_id'),'deletion preserves the normalized outcome');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select is(public.get_identity_verification_link_status(repeat('b',64))->>'canRetry','true','cleaned-up declined check is retryable');
select * from public.retry_candidate_liveness_verification(repeat('b',64),repeat('c',64)) \gset c_
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('b',64),repeat('d',64))$$,'IV001',null,'successful retry consumes its old token');
reset role;
select is((select count(*)::integer from app_private.identity_verification_attempts where candidate_id='b3000000-1111-4111-8111-111111111111' and status='created'),1,'retry after cleanup creates exactly one active attempt');
update app_private.identity_verification_attempts set status='failed' where id=:'c_attempt_id';
set local role authenticated;
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('a',64),repeat('d',64))$$,'IV002',null,'superseded credential remains unable to retry even when the newer attempt terminates');
reset role;
select * from finish();
rollback;
