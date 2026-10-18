begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(18);
select pg_temp.create_auth_actor('c1740000-1111-4111-8111-111111111111','c2740000-1111-4111-8111-111111111111','retention-copy@test.local');
insert into public.portfolios(id,user_id,draft_data)
values('c3740000-1111-4111-8111-111111111111','c1740000-1111-4111-8111-111111111111','{}');

-- Current canonical submissions store the message twice. Keep representative
-- identity fields so a newly closed old request is not mistaken for prior cleanup.
insert into public.interest_requests(id,portfolio_id,status,created_at,updated_at,viewer_name,viewer_email,message,request_reason)
values
 ('c4740000-1111-4111-8111-111111111111','c3740000-1111-4111-8111-111111111111','rejected',now()-interval '200 days',now()-interval '181 days','Expired','expired@test.local','Private expired contact','Private expired contact'),
 ('c5740000-1111-4111-8111-111111111111','c3740000-1111-4111-8111-111111111111','closed',now()-interval '200 days',now()-interval '181 days','Closed','closed@test.local','Private closed contact','Private closed contact'),
 ('c6740000-1111-4111-8111-111111111111','c3740000-1111-4111-8111-111111111111','closed',now()-interval '200 days',now(),'Recently closed','recent@test.local','Recent contact','Recent contact'),
 ('c7740000-1111-4111-8111-111111111111','c3740000-1111-4111-8111-111111111111','new',now()-interval '200 days',now()-interval '181 days','Open','open@test.local','Open contact','Open contact'),
 ('c8740000-1111-4111-8111-111111111111','c3740000-1111-4111-8111-111111111111','approved',now()-interval '200 days',now()-interval '181 days','Approved','approved@test.local','Approved contact','Approved contact'),
 ('c9740000-1111-4111-8111-111111111111','c3740000-1111-4111-8111-111111111111','closed',now()-interval '200 days',now()-interval '180 days','At boundary','boundary@test.local','Boundary contact','Boundary contact');
-- Exact prior cleanup signature. Old cleanup reset updated_at, so merely
-- adding request_reason to the old age predicate would leave this for180 more days.
insert into public.interest_requests(id,portfolio_id,status,created_at,updated_at,request_reason,metadata)
values
 ('ca740000-1111-4111-8111-111111111111','c3740000-1111-4111-8111-111111111111','rejected',now()-interval '200 days',now(),'Leftover legacy contact','{}'),
 ('cb740000-1111-4111-8111-111111111111','c3740000-1111-4111-8111-111111111111','closed',now(),now(),'Fresh skeletal contact','{}');

set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.production_worker_health()#>>'{retention,interestRequestsAnonymized,overdue}','3','health includes expired and already partially scrubbed message copies');
select is(public.run_retention_class('interestRequestsAnonymized',1)->>'affected','1','cleanup respects one-row batch');
select is(public.production_worker_health()#>>'{retention,interestRequestsAnonymized,overdue}','2','health counts actual remaining work after bounded batch');
select is(public.run_retention_class('interestRequestsAnonymized',500)->>'affected','2','remaining legacy and expired records are repaired');
select is(public.production_worker_health()#>>'{retention,interestRequestsAnonymized,overdue}','0','health reports zero only after both text copies are cleared');
select is(public.run_retention_class('interestRequestsAnonymized',500)->>'affected','0','repeated cleanup is idempotent');
reset role;
select ok((select message is null and request_reason is null and viewer_email is null and viewer_name is null from public.interest_requests where id='c4740000-1111-4111-8111-111111111111'),'rejected request loses both message copies');
select ok((select message is null and request_reason is null from public.interest_requests where id='c5740000-1111-4111-8111-111111111111'),'closed request loses both message copies');
select is((select request_reason from public.interest_requests where id='ca740000-1111-4111-8111-111111111111'),null::text,'already partially scrubbed record is repaired despite recent cleanup timestamp');
select is((select request_reason from public.interest_requests where id='c6740000-1111-4111-8111-111111111111'),'Recent contact','recently updated request retains text');
select is((select request_reason from public.interest_requests where id='c7740000-1111-4111-8111-111111111111'),'Open contact','open request retains text');
select is((select request_reason from public.interest_requests where id='c8740000-1111-4111-8111-111111111111'),'Approved contact','approved request retains text');
select is((select request_reason from public.interest_requests where id='c9740000-1111-4111-8111-111111111111'),'Boundary contact','exact180-day boundary is preserved');
select is((select request_reason from public.interest_requests where id='cb740000-1111-4111-8111-111111111111'),'Fresh skeletal contact','fresh sparse request is not mistaken for prior cleanup');
select ok(not has_function_privilege('authenticated','public.run_retention_class(text,integer)','execute'),'retention stays service-only');
-- This is the exact erasure shape used by account-deletion preparation.
-- Ordinary open requests were preserved above; explicit account erasure must
-- remove the duplicate immediately, independent of status or retention age.
update public.interest_requests set viewer_name=null,viewer_phone=null,viewer_email=null,
  viewer_family_context=null,message=null,requester_user_id=null,prospect_key_hash=null,metadata='{}'
where id='c7740000-1111-4111-8111-111111111111';
select is((select request_reason from public.interest_requests where id='c7740000-1111-4111-8111-111111111111'),null::text,'explicit account-erasure transition clears duplicate for an open request too');
select ok(not has_function_privilege('authenticated','app_private.interest_request_retention_due(public.interest_requests)','execute'),'eligibility helper stays private');
select is((select request_reason from public.interest_requests where id='c8740000-1111-4111-8111-111111111111'),'Approved contact','unrelated approved request remains intact after another requester erasure');
select * from finish();
rollback;
