begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(12);

select pg_temp.create_auth_actor('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'admin@pilot.test');
select pg_temp.create_auth_actor('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 'creator@pilot.test');
select pg_temp.create_auth_actor('91000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003', 'other@pilot.test');

select has_table('app_private', 'b2c_creator_invites', 'historical creator invitations remain private');
select ok(not has_table_privilege('authenticated', 'app_private.b2c_creator_invites', 'SELECT'), 'clients cannot read historical invited emails');
select ok(not has_function_privilege('authenticated', 'public.service_b2c_invite_matches(text,text)', 'EXECUTE'), 'pre-signup matcher is service-only');
select ok(not has_function_privilege('authenticated', 'public.admin_manage_b2c_creator_invite(text,text,text)', 'EXECUTE'), 'even administrators cannot issue or revoke retired creator invitations');
select ok(not has_function_privilege('authenticated', 'public.accept_b2c_creator_invite(text)', 'EXECUTE'), 'old invitation links cannot grant creator access');

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002');
select ok(public.current_user_can_create_portfolio(), 'a confirmed account can create a portfolio without an invitation');
select throws_ok(
  $$select public.accept_b2c_creator_invite(repeat('a',64))$$,
  '42501', null, 'authenticated clients cannot call the retired acceptance function'
);
select throws_ok(
  $$select count(*) from public.list_b2c_creator_invites(50)$$,
  '42501', 'pilot administrator required', 'ordinary creators cannot inspect historical invitations'
);

reset role;
update auth.users set email_confirmed_at = null where id = '91000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002');
select ok(not public.current_user_can_create_portfolio(), 'unconfirmed accounts remain ineligible');

reset role;
insert into app_private.pilot_administrators(user_id) values ('91000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.list_b2c_creator_invites(50)), 0, 'admin can inspect retained invitation history');
select throws_ok(
  $$select public.admin_manage_b2c_creator_invite('other@pilot.test','grant',repeat('a',64))$$,
  '42501', null, 'admin cannot create a new pilot invitation after retirement'
);

reset role;
select is((select count(*)::integer from app_private.b2c_creator_invites), 0, 'retired route creates no private invitation record');

select * from finish();
rollback;
