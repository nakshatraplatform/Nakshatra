begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(12);
select pg_temp.create_auth_actor('c1000000-1111-4111-8111-111111111111','c2000000-1111-4111-8111-111111111111','self-check@test.local');
select pg_temp.create_auth_actor('c1000000-2222-4222-8222-222222222222','c2000000-2222-4222-8222-222222222222','other-check@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values ('c3000000-1111-4111-8111-111111111111','c1000000-1111-4111-8111-111111111111','Test','c1000000-1111-4111-8111-111111111111');
set local role authenticated;
select pg_temp.set_authenticated_claims('c1000000-1111-4111-8111-111111111111','c2000000-1111-4111-8111-111111111111');
select throws_ok($$select public.begin_candidate_liveness_verification('c3000000-1111-4111-8111-111111111111',null,repeat('a',64))$$,'42501',null,'a saved self-owned draft is required');
reset role;
select pg_temp.create_self_verification_draft('c3000000-1111-4111-8111-111111111111');
set local role authenticated;
select * from public.begin_candidate_liveness_verification('c3000000-1111-4111-8111-111111111111',null,repeat('a',64)) \gset
select pg_temp.set_authenticated_claims('c1000000-2222-4222-8222-222222222222','c2000000-2222-4222-8222-222222222222');
select throws_ok(format('select public.register_candidate_liveness_provider_create(%L,%L,%L,1)',:'attempt_id',repeat('a',64),'c4000000-1111-4111-8111-111111111111'),'42501',null,'a bearer credential cannot let a stranger register provider work');
select pg_temp.set_authenticated_claims('c1000000-1111-4111-8111-111111111111','c2000000-1111-4111-8111-111111111111');
select public.register_candidate_liveness_provider_create(:'attempt_id',repeat('a',64),'c4000000-1111-4111-8111-111111111111',1);
select pg_temp.set_authenticated_claims('c1000000-2222-4222-8222-222222222222','c2000000-2222-4222-8222-222222222222');
select throws_ok(format('select public.attach_candidate_liveness_provider_session(%L,%L,%L,%L,1)',:'attempt_id',repeat('a',64),'c5000000-1111-4111-8111-111111111111','c4000000-1111-4111-8111-111111111111'),'42501',null,'a bearer credential cannot let a stranger attach provider work');
select pg_temp.set_authenticated_claims('c1000000-1111-4111-8111-111111111111','c2000000-1111-4111-8111-111111111111');
select public.attach_candidate_liveness_provider_session(:'attempt_id',repeat('a',64),'c5000000-1111-4111-8111-111111111111','c4000000-1111-4111-8111-111111111111',1);
reset role;
update app_private.identity_verification_worker_state set run_after=now() where attempt_id=:'attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select public.complete_identity_verification_reconciliation(:'attempt_id',:'claim_token','declined',false,true,false,false,false,false);
select claim_token from public.claim_identity_verification_work(1) \gset
select public.complete_identity_verification_provider_redaction(:'attempt_id',:'claim_token');
set local role anon;
select pg_temp.set_anon_claims();
select is(public.get_identity_verification_link_status(repeat('a',64))->>'canRetry','false','anonymous management view does not offer retry');
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('a',64),repeat('b',64))$$,'42501',null,'anonymous bearer cannot retry');
select throws_ok($$select public.begin_candidate_liveness_verification(null,repeat('a',64),repeat('b',64))$$,'42501',null,'anonymous invitation cannot start');
set local role authenticated;
select pg_temp.set_authenticated_claims('c1000000-2222-4222-8222-222222222222','c2000000-2222-4222-8222-222222222222');
select is(public.get_identity_verification_link_status(repeat('a',64))->>'canRetry','false','stranger does not see retry authority');
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('a',64),repeat('b',64))$$,'42501',null,'stranger cannot retry even with an active credential');
select pg_temp.set_authenticated_claims('c1000000-1111-4111-8111-111111111111','c2000000-1111-4111-8111-111111111111');
select is(public.get_identity_verification_link_status(repeat('a',64))->>'canRetry','true','self owner can retry after cleanup');
reset role;
update public.candidate_personal_details set profile_for='son' where candidate_id='c3000000-1111-4111-8111-111111111111';
set local role authenticated;
select is(public.get_identity_verification_link_status(repeat('a',64))->>'canRetry','false','a representative draft does not offer retry');
select throws_ok($$select public.retry_candidate_liveness_verification(repeat('a',64),repeat('b',64))$$,'42501',null,'non-self draft cannot retry');
reset role;
update public.candidate_personal_details set profile_for='self' where candidate_id='c3000000-1111-4111-8111-111111111111';
set local role authenticated;
select lives_ok($$select public.retry_candidate_liveness_verification(repeat('a',64),repeat('b',64))$$,'self owner can restart without adding a primary photo');
reset role;
select * from finish();
rollback;
