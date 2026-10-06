begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(10);

select pg_temp.create_auth_actor('dd100000-0000-4000-8000-000000000001','dd200000-0000-4000-8000-000000000001','worker-scope@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,legal_name,birth_date,created_by)
values('dd300000-0000-4000-8000-000000000001','dd100000-0000-4000-8000-000000000001','Scope Candidate','Synthetic Person','1990-01-01','dd100000-0000-4000-8000-000000000001');
insert into public.organizations(id,type,name,created_by)
values('dd400000-0000-4000-8000-000000000001','matchmaker_agency','Scope Agency','dd100000-0000-4000-8000-000000000001');
insert into app_private.identity_verification_subjects(id,subject_type,organization_id,subject_user_id,expected_birth_date_hash)
values('dd500000-0000-4000-8000-000000000001','organization_representative','dd400000-0000-4000-8000-000000000001','dd100000-0000-4000-8000-000000000001',repeat('a',64));
insert into app_private.identity_verification_attempts(id,subject_id,candidate_id,provider_subject_ref,provider_session_ref,status,verification_method)
select 'dd600000-0000-4000-8000-000000000001',id,candidate_id,provider_subject_ref,'scope-candidate-session','expired','candidate_liveness_only'
from app_private.identity_verification_subjects where candidate_id='dd300000-0000-4000-8000-000000000001';
insert into app_private.identity_verification_attempts(id,subject_id,provider_subject_ref,provider_session_ref,status)
select 'dd600000-0000-4000-8000-000000000002',id,provider_subject_ref,'scope-representative-session','in_progress'
from app_private.identity_verification_subjects where id='dd500000-0000-4000-8000-000000000001';
select app_private.enqueue_identity_verification_work(subject_id,id,'provider_redaction',now()-interval '1 hour')
from app_private.identity_verification_attempts where id='dd600000-0000-4000-8000-000000000001';
select app_private.enqueue_identity_verification_work(subject_id,id,'reconcile',now()-interval '2 hours')
from app_private.identity_verification_attempts where id='dd600000-0000-4000-8000-000000000002';

select ok(not has_function_privilege('anon','public.claim_candidate_identity_verification_work(integer)','execute'),'anonymous callers cannot lease candidate work');
select ok(not has_function_privilege('authenticated','public.claim_candidate_identity_verification_work(integer)','execute'),'signed-in owners cannot lease worker work');
set local role anon;
select pg_temp.set_anon_claims();
select throws_ok('select * from public.claim_candidate_identity_verification_work(1)','42501',null,'anonymous execution is denied');
reset role;
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_candidate_identity_verification_work(1)),1,'candidate work is leased despite an older representative job');
reset role;
select ok((select claim_token is not null from app_private.identity_verification_worker_state where attempt_id='dd600000-0000-4000-8000-000000000001'),'candidate cleanup receives a lease');
select ok((select claim_token is null and attempts=0 from app_private.identity_verification_worker_state where attempt_id='dd600000-0000-4000-8000-000000000002'),'representative state remains untouched');
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_candidate_identity_verification_work(25)),0,'a representative-only backlog does not occupy the candidate batch');
select throws_ok('select * from public.claim_candidate_identity_verification_work(0)','22023',null,'invalid batch size is rejected');
select is((select subject_type from public.claim_identity_verification_work(25) where attempt_id='dd600000-0000-4000-8000-000000000002'),'organization_representative','legacy shared RPC remains compatible for separate representative processing');
reset role;
select ok((select claim_token is not null from app_private.identity_verification_worker_state where attempt_id='dd600000-0000-4000-8000-000000000002'),'only the explicit shared claim leases the representative');
select * from finish();
rollback;
