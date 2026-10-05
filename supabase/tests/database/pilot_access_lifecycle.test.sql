begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(14);

select pg_temp.create_auth_actor('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'creator@pilot.test');
select pg_temp.create_auth_actor('81000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', 'operator@pilot.test');

select has_table('app_private', 'pilot_access_requests', 'historical pilot applications remain private');
select has_table('app_private', 'pilot_administrators', 'operator authority remains explicit');
select has_table('app_private', 'pilot_access_audit_events', 'historical audit log is retained');
select has_table('app_private', 'notification_outbox', 'notification records are retained');
select ok(not has_table_privilege('authenticated', 'app_private.pilot_access_requests', 'SELECT'), 'clients cannot enumerate historical requests');
select ok(not has_table_privilege('authenticated', 'app_private.pilot_administrators', 'SELECT'), 'clients cannot enumerate administrators');
select ok(not has_function_privilege('authenticated', 'public.submit_pilot_access_request(text,text,text,text)', 'EXECUTE'), 'retired waitlist submission is not callable');
select ok(not has_function_privilege('authenticated', 'public.review_pilot_access_request(text,text,text,text)', 'EXECUTE'), 'clients cannot revive waitlist approvals');

set local role authenticated;
select pg_temp.set_authenticated_claims('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001');
select is(public.get_current_pilot_access_state() ->> 'canCreatePortfolio', 'true', 'every confirmed account has creator capability');
select is(public.get_current_pilot_access_state() ->> 'isPilotAdministrator', 'false', 'creator capability does not confer administration');
select throws_ok(
  $$select count(*) from public.list_pilot_access_requests('pending', 50)$$,
  '42501', 'pilot administration unavailable',
  'a creator cannot inspect private pilot history'
);

reset role;
insert into app_private.pilot_administrators(user_id) values ('81000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.set_authenticated_claims('81000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002');
select is(public.get_current_pilot_access_state() ->> 'isPilotAdministrator', 'true', 'explicitly granted operator retains administration');

reset role;
update auth.users set email_confirmed_at = null where id = '81000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001');
select is(public.get_current_pilot_access_state() ->> 'canCreatePortfolio', 'false', 'unconfirmed email cannot create a portfolio');

reset role;
insert into app_private.pilot_access_audit_events(event_name, outcome)
values ('pilot.test', 'succeeded');
select throws_ok(
  $$update app_private.pilot_access_audit_events set outcome = 'failed' where event_name = 'pilot.test'$$,
  '55000', 'pilot access audit events are append-only',
  'historical audit events cannot be rewritten'
);

select * from finish();
rollback;
