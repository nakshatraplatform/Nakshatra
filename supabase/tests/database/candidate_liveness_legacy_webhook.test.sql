begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(19);
-- Reproduce a finished attempt A followed by active retry B using public RPCs.
select pg_temp.create_auth_actor('e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111','late-review@test.local');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values ('e3000000-1111-4111-8111-111111111111','e1000000-1111-4111-8111-111111111111','Test','e1000000-1111-4111-8111-111111111111');
select pg_temp.create_self_verification_draft('e3000000-1111-4111-8111-111111111111');
set local role authenticated;
select pg_temp.set_authenticated_claims('e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111');
select * from public.begin_candidate_liveness_verification('e3000000-1111-4111-8111-111111111111',null,repeat('a',64)) \gset a_
select public.register_candidate_liveness_provider_create(:'a_attempt_id',repeat('a',64),'e4000000-1111-4111-8111-111111111111',1);
select public.attach_candidate_liveness_provider_session(:'a_attempt_id',repeat('a',64),'e5000000-1111-4111-8111-111111111111','e4000000-1111-4111-8111-111111111111',1);
reset role;
update app_private.identity_verification_worker_state set run_after=now() where attempt_id=:'a_attempt_id' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select public.complete_identity_verification_reconciliation(:'a_attempt_id',:'claim_token','declined',false,true,false,false,false,false);
select ok(public.record_identity_verification_webhook(repeat('1',64),repeat('2',64),:'a_attempt_id','e5000000-1111-4111-8111-111111111111',:'a_provider_subject_ref','e4000000-1111-4111-8111-111111111111'),'terminal event before deletion is acknowledged');
reset role;
select ok((select completed_at is not null from app_private.identity_verification_worker_state where attempt_id=:'a_attempt_id' and task_type='reconcile'),'terminal event does not restart completed decision polling');
select ok((select completed_at is null from app_private.identity_verification_worker_state where attempt_id=:'a_attempt_id' and task_type='provider_redaction'),'terminal event leaves evidence deletion pending');
set local role service_role;
select pg_temp.set_service_role_claims();
select claim_token from public.claim_identity_verification_work(1) \gset
select public.complete_identity_verification_provider_redaction(:'a_attempt_id',:'claim_token');
set local role authenticated;
select pg_temp.set_authenticated_claims('e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111');
select * from public.retry_candidate_liveness_verification(repeat('a',64),repeat('b',64)) \gset b_
select public.register_candidate_liveness_provider_create(:'b_attempt_id',repeat('b',64),'e4000000-1111-4111-8111-111111111111',1);
select public.attach_candidate_liveness_provider_session(:'b_attempt_id',repeat('b',64),'e6000000-1111-4111-8111-111111111111','e4000000-1111-4111-8111-111111111111',1);
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(public.record_identity_verification_webhook(repeat('e',64),repeat('f',64),:'a_attempt_id','e5000000-1111-4111-8111-111111111111',:'a_provider_subject_ref','e4000000-1111-4111-8111-111111111111'),'late terminal event is acknowledged');
select ok(public.record_identity_verification_webhook(repeat('e',64),repeat('f',64),:'a_attempt_id','e5000000-1111-4111-8111-111111111111',:'a_provider_subject_ref','e4000000-1111-4111-8111-111111111111'),'duplicate terminal event remains idempotent');
reset role;
select is((select count(*)::integer from app_private.identity_verification_webhook_events where attempt_id=:'a_attempt_id'),2,'each unique terminal receipt is recorded once');
select is((select attempt_id from app_private.identity_verification_worker_state where candidate_id='e3000000-1111-4111-8111-111111111111' and task_type='reconcile'),:'b_attempt_id'::uuid,'late event does not replace current polling job');
update app_private.identity_verification_worker_state set run_after=now() where candidate_id='e3000000-1111-4111-8111-111111111111' and task_type='reconcile';
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(public.record_identity_verification_webhook(repeat('3',64),repeat('4',64),:'b_attempt_id','e6000000-1111-4111-8111-111111111111',:'b_provider_subject_ref','e4000000-1111-4111-8111-111111111111'),'current active event still schedules reconciliation');
reset role;
select is((select attempt_id from app_private.identity_verification_worker_state where candidate_id='e3000000-1111-4111-8111-111111111111' and task_type='reconcile'),:'b_attempt_id'::uuid,'current event preserves current polling ownership');
set local role service_role;
select pg_temp.set_service_role_claims();
create temporary table claimed_current as select * from public.claim_identity_verification_work(1);
select is((select attempt_id from claimed_current),:'b_attempt_id'::uuid,'new session remains claimable after late event');
reset role;
-- Test legacy entry points with actual anonymous/authenticated callers. Savepoints
-- keep a vulnerable implementation from contaminating subsequent assertions.
set local role authenticated;
select pg_temp.set_authenticated_claims('e1000000-1111-4111-8111-111111111111','e2000000-1111-4111-8111-111111111111');
savepoint old_begin_auth;
select throws_ok($$select public.begin_identity_verification('e3000000-1111-4111-8111-111111111111',null,repeat('c',64))$$,'42501',null,'authenticated callers cannot invoke original candidate begin');
rollback to old_begin_auth;
savepoint old_retry_auth;
select throws_ok($$select public.retry_identity_verification(repeat('b',64),repeat('c',64))$$,'42501',null,'authenticated callers cannot invoke original candidate retry');
rollback to old_retry_auth;
savepoint old_attach_auth;
select throws_ok(format('select public.attach_identity_verification_provider_session(%L,%L,%L)',:'b_attempt_id','e6000000-1111-4111-8111-111111111111',repeat('b',64)),'42501',null,'shared representative attach rejects liveness candidate even with valid credential');
rollback to old_attach_auth;
set local role anon;
select pg_temp.set_anon_claims();
savepoint old_begin_anon;
select throws_ok($$select public.begin_identity_verification(null,null,repeat('c',64))$$,'42501',null,'anonymous callers cannot invoke original candidate begin');
rollback to old_begin_anon;
savepoint old_retry_anon;
select throws_ok($$select public.retry_identity_verification(repeat('b',64),repeat('c',64))$$,'42501',null,'anonymous callers cannot invoke original candidate retry');
rollback to old_retry_anon;
savepoint old_attach_anon;
select throws_ok(format('select public.attach_identity_verification_provider_session(%L,%L,%L)',:'b_attempt_id','e6000000-1111-4111-8111-111111111111',repeat('b',64)),'42501',null,'anonymous shared attach rejects candidate credentials');
rollback to old_attach_anon;
reset role;
update app_private.identity_verification_attempts set verification_method='document_identity' where id=:'b_attempt_id';
set local role anon;
savepoint old_document_attach;
select throws_ok(format('select public.attach_identity_verification_provider_session(%L,%L,%L)',:'b_attempt_id','e6000000-1111-4111-8111-111111111111',repeat('b',64)),'42501',null,'shared attach also rejects legacy document candidate');
rollback to old_document_attach;
reset role;
update app_private.identity_verification_attempts set verification_method='candidate_liveness_ip' where id=:'b_attempt_id';
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(public.complete_identity_verification_reconciliation(:'b_attempt_id',(select claim_token from claimed_current),'verified',false,true,false,false,false,true),'current session can finish after late old webhook');
reset role;
select is((select status from app_private.identity_verification_attempts where id=:'b_attempt_id'),'verified','current liveness and IP proof reaches verified');
select * from finish();
rollback;
