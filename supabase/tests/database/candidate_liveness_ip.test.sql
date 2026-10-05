begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(30);

select pg_temp.create_auth_actor('a1000000-1111-4111-8111-111111111111','a2000000-1111-4111-8111-111111111111','liveness-owner@test.local');
select pg_temp.create_auth_actor('a1000000-2222-4222-8222-222222222222','a2000000-2222-4222-8222-222222222222','liveness-other@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values ('a3000000-1111-4111-8111-111111111111','a1000000-1111-4111-8111-111111111111','Test candidate','a1000000-1111-4111-8111-111111111111');

select pg_temp.create_self_verification_draft('a3000000-1111-4111-8111-111111111111');
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-2222-4222-8222-222222222222','a2000000-2222-4222-8222-222222222222');
select throws_ok($$select public.begin_candidate_liveness_verification('a3000000-1111-4111-8111-111111111111',null,repeat('a',64))$$,'42501',null,'strangers cannot start a candidate check');
select pg_temp.set_authenticated_claims('a1000000-1111-4111-8111-111111111111','a2000000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('a3000000-1111-4111-8111-111111111111',null,repeat('a',64)) \gset
reset role;
select is((select verification_method from app_private.identity_verification_attempts where id=:'attempt_id'), 'candidate_liveness_ip','starts from a saved draft without any photo');
select ok((select reference_media_id is null and reference_storage_path is null and reference_sha256 is null from app_private.identity_verification_attempts where id=:'attempt_id'),'no photo reference is retained');
select is((select consent_version from app_private.identity_verification_attempts where id=:'attempt_id'),'2026-10-03-liveness-ip','new consent is recorded');

set local role authenticated;
select throws_ok(format('select public.register_candidate_liveness_provider_create(%L,repeat(''a'',64),%L,null)',:'attempt_id','a4000000-1111-4111-8111-111111111111'),'IV003',null,'missing workflow version fails closed');
select public.register_candidate_liveness_provider_create(:'attempt_id',repeat('a',64),'a4000000-1111-4111-8111-111111111111',1);
select throws_ok($$select public.begin_candidate_liveness_verification('a3000000-1111-4111-8111-111111111111',null,repeat('b',64))$$,'IV002',null,'duplicate start cannot create a second provider session');
select public.attach_candidate_liveness_provider_session(:'attempt_id',repeat('a',64),'a5000000-1111-4111-8111-111111111111','a4000000-1111-4111-8111-111111111111',1);
reset role;
select is((select status::text from app_private.identity_verification_attempts where id=:'attempt_id'),'in_progress','provider attaches without a photo');
select ok((select completed_at is not null from app_private.identity_verification_worker_state where attempt_id=:'attempt_id' and task_type='provider_recovery'),'successful attachment cancels uncertain-create recovery');
update app_private.identity_verification_worker_state set run_after=now() where attempt_id=:'attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select throws_ok(format('select public.complete_identity_verification_reconciliation(%L,%L,''verified'',false,true,false,false,false)',:'attempt_id',:'claim_token'),'23514',null,'legacy worker signature cannot approve liveness/IP proof');
select throws_ok(format('select public.complete_identity_verification_reconciliation(%L,%L,''verified'',false,true,false,false,false,null)',:'attempt_id',:'claim_token'),'23514',null,'null IP approval cannot bypass the policy');
select throws_ok(format('select public.complete_identity_verification_reconciliation(%L,%L,''verified'',false,true,false,false,false,false)',:'attempt_id',:'claim_token'),'23514',null,'failed IP check cannot pass');
select ok(public.complete_identity_verification_reconciliation(:'attempt_id',:'claim_token','verified',false,true,false,false,false,true),'both approved checks produce new proof');
reset role;
select is((select count(*)::integer from app_private.current_identity_verification('a3000000-1111-4111-8111-111111111111')),1,'new proof is current');
select ok(exists(select 1 from app_private.identity_verification_worker_state where attempt_id=:'attempt_id' and task_type='provider_redaction' and completed_at is null),'terminal result schedules provider cleanup');
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select ok(public.complete_identity_verification_provider_redaction(:'attempt_id',:'claim_token'),'successful session evidence is deleted');
reset role;
select is((select status::text from app_private.identity_verification_attempts where id=:'attempt_id'),'verified','provider deletion preserves a verified liveness result');
update app_private.identity_verification_subjects set current_proof_method='portfolio_photo_liveness' where candidate_id='a3000000-1111-4111-8111-111111111111';
select is((select count(*)::integer from app_private.current_identity_verification('a3000000-1111-4111-8111-111111111111')),0,'old proof is never relabelled as liveness/IP');
update app_private.identity_verification_subjects set current_proof_method='candidate_liveness_ip' where candidate_id='a3000000-1111-4111-8111-111111111111';
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-1111-4111-8111-111111111111','a2000000-1111-4111-8111-111111111111');
select public.withdraw_identity_verification_consent(repeat('a',64));
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('a',64),repeat('b',64))$$,'IV001',null,'withdrawn token cannot retry');
select throws_ok($$select public.begin_candidate_liveness_verification(null,repeat('f',64),repeat('c',64))$$,'42501',null,'invitation start is blocked by the self-only pilot');
reset role;
select is((select count(*)::integer from app_private.current_identity_verification('a3000000-1111-4111-8111-111111111111')),0,'withdrawal removes the current proof');
select ok(not has_function_privilege('authenticated','public.complete_identity_verification_reconciliation(uuid,uuid,text,boolean,boolean,boolean,boolean,boolean,boolean)','execute'),'clients cannot manufacture IP/liveness approval');
select ok(not has_function_privilege('authenticated','public.begin_candidate_photo_verification(uuid,text,text)','execute'),'old photo start is retired');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-1111-4111-8111-111111111111','a2000000-1111-4111-8111-111111111111');
select throws_ok($$select public.create_identity_verification_invitation('a3000000-1111-4111-8111-111111111111',repeat('d',64))$$,'42501',null,'even owner cannot create a delegated verification invitation');
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-1111-4111-8111-111111111111','a2000000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('a3000000-1111-4111-8111-111111111111',null,repeat('e',64)) \gset
select throws_ok($$select public.begin_candidate_liveness_verification(null,repeat('d',64),repeat('f',64))$$,'42501',null,'invitation cannot authorize another check');
reset role;
select is((select status::text from app_private.identity_verification_subjects where candidate_id='a3000000-1111-4111-8111-111111111111'),'pending','fresh consent after withdrawal prepares a new check');
select is((select count(*)::integer from app_private.current_identity_verification('a3000000-1111-4111-8111-111111111111')),0,'fresh consent alone is not proof');
set local role authenticated;
select * from public.retry_candidate_liveness_verification(repeat('e',64),repeat('f',64)) \gset
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('e',64),repeat('b',64))$$,'IV001',null,'retry rotates and consumes the old management token');
reset role;
select is((select status::text from app_private.identity_verification_attempts where id=:'attempt_id'),'created','retry creates a photo-free attempt');
select is((select count(*)::integer from app_private.identity_verification_attempts where candidate_id='a3000000-1111-4111-8111-111111111111' and status='created'),1,'retry leaves only one active unregistered attempt');
update app_private.identity_verification_management_tokens set created_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' where token_hash=repeat('f',64);
set local role authenticated;
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('f',64),repeat('b',64))$$,'IV001',null,'expired management token cannot retry');
reset role;
select * from finish();
rollback;
