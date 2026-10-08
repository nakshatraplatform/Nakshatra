begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(25);
select pg_temp.create_auth_actor('d1000000-1111-4111-8111-111111111111','d2000000-1111-4111-8111-111111111111','completion-owner@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values ('d3000000-1111-4111-8111-111111111111','d1000000-1111-4111-8111-111111111111','Completion candidate','d1000000-1111-4111-8111-111111111111');
select pg_temp.create_self_verification_draft('d3000000-1111-4111-8111-111111111111');
select ok(not has_function_privilege('anon','public.claim_candidate_liveness_emails(integer)','execute'),'anonymous cannot claim email');
select ok(not has_function_privilege('authenticated','public.complete_candidate_liveness_email(uuid,uuid,uuid,text,boolean)','execute'),'owners cannot forge email completion');
select ok(not has_table_privilege('authenticated','app_private.candidate_liveness_email_outbox','select'),'addresses are private');
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-1111-4111-8111-111111111111','d2000000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('d3000000-1111-4111-8111-111111111111',null,repeat('a',64)) \gset
select public.register_candidate_liveness_provider_create(:'attempt_id',repeat('a',64),'d4000000-1111-4111-8111-111111111111',null);
select public.attach_candidate_liveness_provider_session(:'attempt_id',repeat('a',64),'d5000000-1111-4111-8111-111111111111','d4000000-1111-4111-8111-111111111111',1);
reset role;
select is((select count(*)::integer from app_private.candidate_liveness_email_outbox),0,'creating a session does not send an approval email');
update app_private.identity_verification_worker_state set run_after=now(),last_error_code='DIDIT_DECISION_UNEXPECTED_CHECKS' where attempt_id=:'attempt_id' and task_type='reconcile';
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-1111-4111-8111-111111111111','d2000000-1111-4111-8111-111111111111');
select is(public.get_current_candidate_liveness_verification('d3000000-1111-4111-8111-111111111111')->>'processingIssue','policy_error','owner sees an actionable safe policy category');
set local role service_role;
select pg_temp.set_service_role_claims();
select throws_ok(format('select public.claim_candidate_liveness_result(%L,%L,%L,%L)','d3000000-1111-4111-8111-111111111111',:'attempt_id','d1000000-2222-4222-8222-222222222222','d2000000-1111-4111-8111-111111111111'),'42501',null,'privileged lookup still checks ownership');
select throws_ok(format('select public.claim_candidate_liveness_result(%L,%L,%L,%L)','d3000000-1111-4111-8111-111111111111',:'attempt_id','d1000000-1111-4111-8111-111111111111','d2000000-2222-4222-8222-222222222222'),'42501',null,'privileged lookup still checks the live owner session');
select public.claim_candidate_liveness_result('d3000000-1111-4111-8111-111111111111',:'attempt_id','d1000000-1111-4111-8111-111111111111','d2000000-1111-4111-8111-111111111111')->>'claim_token' as claim_token \gset
select ok(:'claim_token' is not null,'return-page lookup leases one existing attempt');
select ok(public.claim_candidate_liveness_result('d3000000-1111-4111-8111-111111111111',:'attempt_id','d1000000-1111-4111-8111-111111111111','d2000000-1111-4111-8111-111111111111') is null,'concurrent requests cannot claim another lookup');
select ok(public.complete_identity_verification_reconciliation(:'attempt_id',:'claim_token','pending',false,false,false,false,false,false),'unfinished lookup retains the attempt');
select ok(public.claim_candidate_liveness_result('d3000000-1111-4111-8111-111111111111',:'attempt_id','d1000000-1111-4111-8111-111111111111','d2000000-1111-4111-8111-111111111111') is null,'result requests cannot bypass provider retry backoff');
reset role;
update app_private.identity_verification_worker_state set run_after=now() where attempt_id=:'attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select public.claim_candidate_liveness_result('d3000000-1111-4111-8111-111111111111',:'attempt_id','d1000000-1111-4111-8111-111111111111','d2000000-1111-4111-8111-111111111111')->>'claim_token' as claim_token \gset
select ok(public.complete_identity_verification_reconciliation(:'attempt_id',:'claim_token','verified',false,true,false,false,false,false),'authoritative reconciliation records approval');
reset role;
select is((select count(*)::integer from app_private.candidate_liveness_email_outbox),1,'approval atomically enqueues exactly one email');
update app_private.identity_verification_subjects set updated_at=now() where candidate_id='d3000000-1111-4111-8111-111111111111';
select is((select count(*)::integer from app_private.candidate_liveness_email_outbox),1,'subsequent updates do not duplicate email');
set local role service_role;
select pg_temp.set_service_role_claims();
select * from public.claim_candidate_liveness_emails(5) \gset
select ok(not public.complete_candidate_liveness_email(:'delivery_id','d6000000-1111-4111-8111-111111111111','d7000000-1111-4111-8111-111111111111'),'stale lease cannot complete delivery');
select ok(public.complete_candidate_liveness_email(:'delivery_id',:'claim_token',null,'EMAIL_TIMEOUT',true),'uncertain send is durably retried');
reset role;
select is((select status from app_private.candidate_liveness_email_outbox where id=:'delivery_id'),'queued','timeout retains queued message');
select is((select count(*)::integer from app_private.current_identity_verification('d3000000-1111-4111-8111-111111111111')),1,'mail failure does not revoke proof');
select :'claim_token' as old_claim_token \gset
update app_private.candidate_liveness_email_outbox set run_after=now() where id=:'delivery_id';
set local role service_role;
select pg_temp.set_service_role_claims();
select * from public.claim_candidate_liveness_emails(5) \gset
select ok(not public.complete_candidate_liveness_email(:'delivery_id',:'old_claim_token','d7000000-1111-4111-8111-111111111111'),'previous lease cannot complete a reclaimed email');
select ok(public.complete_candidate_liveness_email(:'delivery_id',:'claim_token','d7000000-1111-4111-8111-111111111111'),'accepted provider response is stored');
select is((select count(*)::integer from public.claim_candidate_liveness_emails(5)),0,'accepted email is not claimed again');
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-1111-4111-8111-111111111111','d2000000-1111-4111-8111-111111111111');
select is(public.get_current_candidate_liveness_verification('d3000000-1111-4111-8111-111111111111')->>'emailStatus','accepted','owner sees accepted, not an unverified delivery claim');
reset role;
update app_private.candidate_liveness_email_outbox set status='queued',first_attempt_at=now()-interval '24 hours',run_after=now() where id=:'delivery_id';
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_candidate_liveness_emails(5)),0,'uncertain retry is fenced after idempotency window');
reset role;
select is((select last_error_code from app_private.candidate_liveness_email_outbox where id=:'delivery_id'),'EMAIL_RETRY_WINDOW_EXPIRED','expired delivery is explicit');
update app_private.candidate_liveness_email_outbox set status='queued',first_attempt_at=null,run_after=now() where id=:'delivery_id';
update app_private.identity_verification_subjects set status='revoked',revoked_at=now() where candidate_id='d3000000-1111-4111-8111-111111111111';
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_candidate_liveness_emails(5)),0,'revoked proof is not emailed');
reset role;
select * from finish();
rollback;
