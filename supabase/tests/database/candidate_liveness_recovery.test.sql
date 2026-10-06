begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(35);
select pg_temp.create_auth_actor('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111','recovery-owner@test.local');
select pg_temp.create_auth_actor('b1000000-2222-4222-8222-222222222222','b2000000-2222-4222-8222-222222222222','recovery-other@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values ('b3000000-1111-4111-8111-111111111111','b1000000-1111-4111-8111-111111111111','Recovery candidate','b1000000-1111-4111-8111-111111111111');
select pg_temp.create_self_verification_draft('b3000000-1111-4111-8111-111111111111');
set local role anon;
select pg_temp.set_anon_claims();
select throws_ok($$select public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')$$,'42501',null,'anonymous recovery is denied');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-2222-4222-8222-222222222222','b2000000-2222-4222-8222-222222222222');
select throws_ok($$select public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')$$,'42501',null,'non-owner recovery is denied');
reset role;
select pg_temp.set_invalid_session_claims('b1000000-1111-4111-8111-111111111111','b2000000-2222-4222-8222-222222222222');
set local role authenticated;
select throws_ok($$select public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')$$,'42501',null,'cross-user session cannot recover');
reset role;
select pg_temp.set_invalid_session_claims('b1000000-1111-4111-8111-111111111111',null);
set local role authenticated;
select throws_ok($$select public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')$$,'42501',null,'missing session cannot recover');
reset role;
select pg_temp.set_invalid_session_claims('b1000000-1111-4111-8111-111111111111','malformed-session');
set local role authenticated;
select throws_ok($$select public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')$$,'42501',null,'malformed session cannot recover');
reset role;
select pg_temp.create_auth_session('b1000000-1111-4111-8111-111111111111','b2000000-3333-4333-8333-333333333333');
delete from auth.sessions where id='b2000000-3333-4333-8333-333333333333';
select pg_temp.set_invalid_session_claims('b1000000-1111-4111-8111-111111111111','b2000000-3333-4333-8333-333333333333');
set local role authenticated;
select throws_ok($$select public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')$$,'42501',null,'revoked or absent session cannot recover');
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select is(public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')->>'state','not_started','owner recovers without a management link');
select is(public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')->>'canCancel','false','an absent attempt returns a nonnullable cancellation flag');
select * from public.begin_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',null,repeat('a',64)) \gset
reset role;
select ok((select resume_deadline=created_at+interval '30 minutes' from app_private.identity_verification_attempts where id=:'attempt_id'),'deadline uses the original creation time');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select public.register_candidate_liveness_provider_create(:'attempt_id',repeat('a',64),'b4000000-1111-4111-8111-111111111111',null);
select public.attach_candidate_liveness_provider_session(:'attempt_id',repeat('a',64),'b5000000-1111-4111-8111-111111111111','b4000000-1111-4111-8111-111111111111',1);
select is(public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')->>'state','active','attached check is resumable after refresh');
select throws_ok($$select public.begin_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',null,repeat('b',64))$$,'IV002',null,'duplicate start does not create another attempt');
reset role;
select is((select request_count from app_private.api_rate_limits where action='candidate_liveness_create' and subject_key='user:b1000000-1111-4111-8111-111111111111'),1,'duplicate start does not spend the creation quota');
update app_private.identity_verification_worker_state set run_after=now() where attempt_id=:'attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select is(public.cancel_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',:'attempt_id')->>'state','cleanup_pending','cancellation fences approval and exposes cleanup');
select lives_ok(format('select public.cancel_candidate_liveness_verification(%L,%L)','b3000000-1111-4111-8111-111111111111',:'attempt_id'),'duplicate cancellation is idempotent');
select throws_ok($$select public.begin_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',null,repeat('b',64))$$,'IV002',null,'restart waits for provider cleanup');
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(not public.complete_identity_verification_reconciliation(:'attempt_id',:'claim_token','verified',false,true,false,false,false,false),'a pre-cancellation lease cannot approve');
select claim_token from public.claim_identity_verification_work(1) \gset
select ok(public.complete_identity_verification_provider_absence(:'attempt_id',:'claim_token'),'a known absent session completes cleanup');
reset role;
select is((select provider_cleanup_outcome from app_private.identity_verification_attempts where id=:'attempt_id'),'absent','absence is not recorded as affirmative biometric deletion');
select ok((select provider_redacted_at is null from app_private.identity_verification_attempts where id=:'attempt_id'),'404 does not manufacture a biometric purge timestamp');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select is(public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')->>'canStart','true','fresh consent can start after cleanup');
select :'attempt_id' as old_attempt_id \gset
select * from public.begin_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',null,repeat('b',64)) \gset
select throws_ok(format('select public.cancel_candidate_liveness_verification(%L,%L)','b3000000-1111-4111-8111-111111111111',:'old_attempt_id'),'IV002',null,'stale cancellation cannot affect a replacement');
select public.register_candidate_liveness_provider_create(:'attempt_id',repeat('b',64),'b4000000-1111-4111-8111-111111111111',null);
select public.attach_candidate_liveness_provider_session(:'attempt_id',repeat('b',64),'b5000000-2222-4222-8222-222222222222','b4000000-1111-4111-8111-111111111111',1);
reset role;
update app_private.identity_verification_attempts set resume_deadline=clock_timestamp()-interval '1 minute' where id=:'attempt_id';
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select is(public.get_current_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111')->>'canResume','false','resume stops at the deadline');
reset role;
update app_private.identity_verification_worker_state set run_after=now() where attempt_id=:'attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select ok(public.complete_identity_verification_reconciliation(:'attempt_id',:'claim_token','pending',false,false,false,false,false,false),'final unfinished lookup expires the check');
reset role;
select is((select status::text from app_private.identity_verification_attempts where id=:'attempt_id'),'expired','unfinished final lookup is terminal');
select is((select count(*)::integer from app_private.current_identity_verification('b3000000-1111-4111-8111-111111111111')),0,'expired check creates no proof');
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select public.complete_identity_verification_provider_redaction(:'attempt_id',:'claim_token');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',null,repeat('c',64)) \gset
reset role;
update app_private.api_rate_limits set request_count=5 where action='candidate_liveness_create' and subject_key='user:b1000000-1111-4111-8111-111111111111';
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select throws_ok(format('select public.register_candidate_liveness_provider_create(%L,repeat(''c'',64),%L,null)',:'attempt_id','b4000000-1111-4111-8111-111111111111'),'IV004',null,'sixth provider reservation is blocked atomically');
reset role;
select ok((select provider_create_registered_at is null from app_private.identity_verification_attempts where id=:'attempt_id'),'denied reservation has no provider-create side effect');
update app_private.identity_verification_attempts set resume_deadline=clock_timestamp()-interval '6 minutes' where id=:'attempt_id';
set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.expire_candidate_liveness_attempts(10),1,'worker expires abandoned creation after the grace bound');
reset role;
select ok(not has_function_privilege('authenticated','public.expire_candidate_liveness_attempts(integer)','execute'),'expiry remains worker-only');
update app_private.api_rate_limits set request_count=1 where action='candidate_liveness_create';
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('b3000000-1111-4111-8111-111111111111',null,repeat('d',64)) \gset
select public.register_candidate_liveness_provider_create(:'attempt_id',repeat('d',64),'b4000000-1111-4111-8111-111111111111',null);
select public.attach_candidate_liveness_provider_session(:'attempt_id',repeat('d',64),'b5000000-4444-4444-8444-444444444444','b4000000-1111-4111-8111-111111111111',1);
reset role;
update app_private.identity_verification_attempts set resume_deadline=clock_timestamp()-interval '1 minute' where id=:'attempt_id';
update app_private.identity_verification_worker_state set run_after=clock_timestamp()-interval '1 second' where attempt_id=:'attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select ok(public.complete_identity_verification_reconciliation(:'attempt_id',:'claim_token','verified',false,true,false,false,false,false),'valid final result during grace is accepted');
reset role;
select is((select count(*)::integer from app_private.current_identity_verification('b3000000-1111-4111-8111-111111111111')),1,'grace completion creates one current proof');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-1111-4111-8111-111111111111','b2000000-1111-4111-8111-111111111111');
select throws_ok(format('select public.cancel_candidate_liveness_verification(%L,%L)','b3000000-1111-4111-8111-111111111111',:'attempt_id'),'IV002',null,'cancellation preserves an already verified proof');
reset role;
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values ('b3000000-2222-4222-8222-222222222222','b1000000-2222-4222-8222-222222222222','Late candidate','b1000000-2222-4222-8222-222222222222');
select pg_temp.create_self_verification_draft('b3000000-2222-4222-8222-222222222222');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-2222-4222-8222-222222222222','b2000000-2222-4222-8222-222222222222');
select * from public.begin_candidate_liveness_verification('b3000000-2222-4222-8222-222222222222',null,repeat('e',64)) \gset
select public.register_candidate_liveness_provider_create(:'attempt_id',repeat('e',64),'b4000000-1111-4111-8111-111111111111',null);
select public.attach_candidate_liveness_provider_session(:'attempt_id',repeat('e',64),'b5000000-5555-4555-8555-555555555555','b4000000-1111-4111-8111-111111111111',1);
reset role;
update app_private.identity_verification_attempts set resume_deadline=clock_timestamp()-interval '6 minutes' where id=:'attempt_id';
update app_private.identity_verification_worker_state set run_after=clock_timestamp()-interval '1 second' where attempt_id=:'attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select ok(public.complete_identity_verification_reconciliation(:'attempt_id',:'claim_token','verified',false,true,false,false,false,false),'late approval is handled without accepting it');
reset role;
select is((select status::text from app_private.identity_verification_attempts where id=:'attempt_id'),'expired','approval after 35 minutes cannot revive an attempt');
select is((select count(*)::integer from app_private.current_identity_verification('b3000000-2222-4222-8222-222222222222')),0,'late approval creates no proof');
select * from finish();
rollback;
