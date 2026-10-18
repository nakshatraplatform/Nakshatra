begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(18);
select pg_temp.create_auth_actor('e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111','owner-e@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by) values ('e3000000-1111-4111-8111-111111111111','e1000000-1111-4111-8111-111111111111','Email test','e1000000-1111-4111-8111-111111111111');
select pg_temp.create_self_verification_draft('e3000000-1111-4111-8111-111111111111');
set local role authenticated;
select pg_temp.set_authenticated_claims('e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('e3000000-1111-4111-8111-111111111111',null,repeat('a',64)) \gset e_
select public.register_candidate_liveness_provider_create(:'e_attempt_id',repeat('a',64),'e4000000-1111-4111-8111-111111111111',null);
select public.attach_candidate_liveness_provider_session(:'e_attempt_id',repeat('a',64),'e5000000-1111-4111-8111-111111111111','e4000000-1111-4111-8111-111111111111',1);
reset role;
update app_private.identity_verification_worker_state set run_after=now() where attempt_id=:'e_attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select public.claim_candidate_liveness_result('e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111')->>'claim_token' as token \gset e_
select public.complete_identity_verification_reconciliation(:'e_attempt_id',:'e_token','verified',false,true,false,false,false,false);
reset role;
select pg_temp.create_auth_actor('f1000000-1111-4111-8111-111111111111','f2000000-1111-4111-8111-111111111111','owner-f@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by) values ('f3000000-1111-4111-8111-111111111111','f1000000-1111-4111-8111-111111111111','Email test','f1000000-1111-4111-8111-111111111111');
select pg_temp.create_self_verification_draft('f3000000-1111-4111-8111-111111111111');
set local role authenticated;
select pg_temp.set_authenticated_claims('f1000000-1111-4111-8111-111111111111','f2000000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('f3000000-1111-4111-8111-111111111111',null,repeat('b',64)) \gset f_
select public.register_candidate_liveness_provider_create(:'f_attempt_id',repeat('b',64),'f4000000-1111-4111-8111-111111111111',null);
select public.attach_candidate_liveness_provider_session(:'f_attempt_id',repeat('b',64),'f5000000-1111-4111-8111-111111111111','f4000000-1111-4111-8111-111111111111',1);
reset role;
update app_private.identity_verification_worker_state set run_after=now() where attempt_id=:'f_attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select public.claim_candidate_liveness_result('f3000000-1111-4111-8111-111111111111',:'f_attempt_id','f1000000-1111-4111-8111-111111111111','f2000000-1111-4111-8111-111111111111')->>'claim_token' as token \gset f_
select public.complete_identity_verification_reconciliation(:'f_attempt_id',:'f_token','verified',false,true,false,false,false,false);
reset role;
select ok(not has_function_privilege('anon','public.claim_owner_candidate_liveness_email(uuid,uuid,uuid,uuid)','execute'),'anonymous cannot dispatch mail');
select ok(not has_function_privilege('authenticated','public.claim_owner_candidate_liveness_email(uuid,uuid,uuid,uuid)','execute'),'browser sessions cannot claim mail directly');
select ok(not has_function_privilege('service_role','app_private.claim_candidate_liveness_email_batch(integer,uuid)','execute'),'internal batch helper is not a callable service API');
set local role service_role;
select pg_temp.set_service_role_claims();
select throws_ok(format('select public.claim_owner_candidate_liveness_email(%L,%L,%L,%L)','e3000000-1111-4111-8111-111111111111',:'e_attempt_id','f1000000-1111-4111-8111-111111111111','f2000000-1111-4111-8111-111111111111'),'42501',null,'another owner cannot claim the candidate email');
select throws_ok(format('select public.claim_owner_candidate_liveness_email(%L,%L,%L,%L)','e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','f2000000-1111-4111-8111-111111111111'),'42501',null,'session must belong to the owner');
select is((select count(*)::integer from public.claim_owner_candidate_liveness_email('e3000000-1111-4111-8111-111111111111',:'f_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111')),0,'another attempt cannot be selected');
reset role;
update auth.sessions set not_after=now()-interval '1 second' where id='e2000000-1111-4111-8111-111111111111';
set local role service_role;
select pg_temp.set_service_role_claims();
select throws_ok(format('select public.claim_owner_candidate_liveness_email(%L,%L,%L,%L)','e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111'),'42501',null,'expired session cannot dispatch');
reset role;
update auth.sessions set not_after=null where id='e2000000-1111-4111-8111-111111111111';
set local role service_role;
select pg_temp.set_service_role_claims();
select * from public.claim_owner_candidate_liveness_email('e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111') \gset
select is(:'recipient_email'::text,'owner-e@test.local','only the verified owner is the recipient');
select is((select count(*)::integer from public.claim_owner_candidate_liveness_email('e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111')),0,'duplicate owner calls cannot lease twice');
reset role;
select is((select status from app_private.candidate_liveness_email_outbox where attempt_id=:'f_attempt_id'),'queued','owner dispatch does not claim another user job');
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(public.complete_candidate_liveness_email(:'delivery_id',:'claim_token',null,'EMAIL_TIMEOUT',true),'timeout preserves durable retry');
select is((select count(*)::integer from public.claim_owner_candidate_liveness_email('e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111')),0,'owner dispatch cannot bypass retry backoff');
reset role;
update app_private.candidate_liveness_email_outbox set run_after=now() where id=:'delivery_id';
select :'delivery_id' as original_delivery_id, :'claim_token' as old_token \gset
set local role service_role;
select pg_temp.set_service_role_claims();
select * from public.claim_owner_candidate_liveness_email('e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111') \gset
select is(:'delivery_id'::text,:'original_delivery_id','retry keeps the same provider idempotency ID');
select ok(not public.complete_candidate_liveness_email(:'delivery_id',:'old_token','e6000000-1111-4111-8111-111111111111'),'stale delivery lease is rejected');
select ok(public.complete_candidate_liveness_email(:'delivery_id',:'claim_token','e6000000-1111-4111-8111-111111111111'),'provider acceptance completes the same outbox job');
select is((select count(*)::integer from public.claim_owner_candidate_liveness_email('e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111')),0,'accepted mail is not dispatched again');
reset role;
update app_private.candidate_liveness_email_outbox set status='queued',run_after=now(),first_attempt_at=now()-interval '24 hours' where id=:'delivery_id';
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_owner_candidate_liveness_email('e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111')),0,'expired idempotency window cannot be reopened');
reset role;
update app_private.candidate_liveness_email_outbox set status='queued',run_after=now(),first_attempt_at=null where id=:'delivery_id';
update app_private.identity_verification_subjects set status='revoked',revoked_at=now() where candidate_id='e3000000-1111-4111-8111-111111111111';
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_owner_candidate_liveness_email('e3000000-1111-4111-8111-111111111111',:'e_attempt_id','e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111')),0,'withdrawn proof cannot dispatch a completion email');
reset role;
select * from finish();
rollback;
