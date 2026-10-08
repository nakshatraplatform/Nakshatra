begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(13);

select pg_temp.create_auth_actor('86000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','snapshot@fixture.test');
select pg_temp.create_auth_actor('86000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000002','snapshot-other@fixture.test');
insert into app_private.b2c_creator_entitlements(email_hash) values (app_private.normalized_email_hash('snapshot@fixture.test'));
insert into public.candidates(id,primary_owner_user_id,display_name,created_by) values('88000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','Snapshot Person','86000000-0000-4000-8000-000000000001');
insert into public.candidate_personal_details(candidate_id,profile_for) values('88000000-0000-4000-8000-000000000001','self');
insert into public.portfolios(id,user_id,candidate_id,draft_data,is_published) values('89000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft(),false);
insert into public.portfolio_media(id,portfolio_id,candidate_id,media_type,storage_path,visibility,sort_order) values('90000000-0000-4000-8000-000000000001','89000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001','hero','snapshot/hero.webp','public',0);

select ok(not has_function_privilege('anon','public.get_owner_dashboard_review_snapshot()','EXECUTE'),'anonymous viewers cannot read private owner snapshot');
select is((select provolatile::text from pg_proc where oid='public.get_owner_dashboard_review_snapshot()'::regprocedure),'s','snapshot reads use one calling-statement snapshot');
set local role authenticated;
select pg_temp.set_authenticated_claims('86000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001');
select is(public.get_owner_dashboard_review_snapshot()#>>'{portfolio,user_id}',auth.uid()::text,'snapshot contains only the current owner');
select is(public.get_owner_dashboard_review_snapshot()#>'{portfolio,draft_data}',pg_temp.complete_portfolio_draft(),'snapshot carries saved answers');
select is(public.get_owner_dashboard_review_snapshot()#>>'{readiness,reviewFingerprint}',public.get_portfolio_publication_readiness()->>'reviewFingerprint','review version agrees within the statement');
select is(public.get_owner_dashboard_review_snapshot()#>>'{media,0,storage_path}','snapshot/hero.webp','snapshot carries the matching photo facts');
select ok(not ((public.get_owner_dashboard_review_snapshot()#>'{media,0}') ? 'candidate_id'),'photo projection excludes unrelated owner linkage');
select is(public.get_owner_dashboard_review_snapshot()->'horoscope','null'::jsonb,'missing attachment is explicit');
select is(public.get_owner_dashboard_review_snapshot()#>>'{readiness,disclosureConfirmed}','false','snapshot never grants disclosure consent');
select pg_temp.set_authenticated_claims('86000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000002');
select is(public.get_owner_dashboard_review_snapshot()->'portfolio','null'::jsonb,'other owner cannot read saved answers');
select is(public.get_owner_dashboard_review_snapshot()->'media','[]'::jsonb,'other owner cannot read private photo paths');
select is(public.get_owner_dashboard_review_snapshot()#>>'{readiness,reviewFingerprint}',null::text,'other owner receives no portfolio review hash');
reset role;
select pg_temp.set_authenticated_claims('86000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001');
delete from auth.sessions where id='87000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok('select public.get_owner_dashboard_review_snapshot()','42501','authentication session is no longer active','revoked sessions cannot load snapshot');
reset role;
select * from finish();
rollback;
