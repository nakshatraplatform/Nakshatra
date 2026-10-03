begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(25);

select pg_temp.create_auth_actor('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'admin@pilot.test');
select pg_temp.create_auth_actor('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 'candidate@pilot.test');
select pg_temp.create_auth_actor('91000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003', 'other@pilot.test');

select has_table('app_private', 'b2c_creator_invites', 'creator invitations are private records');
select ok(not has_table_privilege('authenticated', 'app_private.b2c_creator_invites', 'SELECT'), 'clients cannot read raw invited emails');
select ok(not has_function_privilege('authenticated', 'public.service_b2c_invite_matches(text,text)', 'EXECUTE'), 'pre-signup matcher is service-only');

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.admin_manage_b2c_creator_invite('candidate@pilot.test','grant',repeat('a',64))$$,
  '42501', 'pilot administrator required', 'a viewer cannot issue invitations'
);
select throws_ok(
  $$select count(*) from public.list_b2c_creator_invites(50)$$,
  '42501', 'pilot administrator required', 'a viewer cannot list invitations'
);

reset role;
insert into app_private.pilot_administrators(user_id) values ('91000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001');
select is(public.admin_manage_b2c_creator_invite('Candidate@Pilot.Test','grant',repeat('a',64))->>'status', 'invited', 'admin issues an exact-email invitation');

reset role;
select is((select email_hash from app_private.b2c_creator_invites where token_hash = repeat('a',64)), app_private.normalized_email_hash('candidate@pilot.test'), 'private invite stores normalized email hash');

set local role service_role;
select pg_temp.set_service_role_claims();
select ok(public.service_b2c_invite_matches('candidate@pilot.test',repeat('a',64)), 'service matcher accepts the exact email and token');
select ok(not public.service_b2c_invite_matches('other@pilot.test',repeat('a',64)), 'service matcher rejects a different email');

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001');
select is(public.admin_manage_b2c_creator_invite('candidate@pilot.test','grant',repeat('b',64))->>'status', 'invited', 'a replacement invite is issued');

set local role service_role;
select pg_temp.set_service_role_claims();
select ok(not public.service_b2c_invite_matches('candidate@pilot.test',repeat('a',64)), 'replaced link is invalid');
select ok(public.service_b2c_invite_matches('candidate@pilot.test',repeat('b',64)), 'replacement link is valid');

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002');
select ok(not public.current_user_can_create_portfolio(), 'invitation alone does not grant creator access');

reset role;
update auth.users set email_confirmed_at = null where id = '91000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.accept_b2c_creator_invite(repeat('b',64))$$,
  '42501', 'verified email required', 'an unverified account cannot accept'
);

reset role;
update auth.users set email_confirmed_at = now() where id = '91000000-0000-4000-8000-000000000002';
update app_private.b2c_creator_invites set expires_at = now() - interval '1 minute' where token_hash = repeat('b',64);
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(not public.service_b2c_invite_matches('candidate@pilot.test',repeat('b',64)), 'expired link cannot start signup');

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.accept_b2c_creator_invite(repeat('b',64))$$,
  '42501', 'invitation unavailable', 'expired link cannot be accepted'
);

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001');
select is(public.admin_manage_b2c_creator_invite('candidate@pilot.test','grant',repeat('c',64))->>'status', 'invited', 'operator may replace an expired link');

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.accept_b2c_creator_invite(repeat('c',64))$$,
  '42501', 'invitation unavailable', 'a different verified account cannot claim the link'
);

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002');
select is(public.accept_b2c_creator_invite(repeat('c',64))->>'status', 'accepted', 'the invited account accepts once');
select ok(public.current_user_can_create_portfolio(), 'acceptance atomically grants creator access');
select is(public.accept_b2c_creator_invite(repeat('c',64))->>'status', 'accepted', 'same-account retry is idempotent');

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.accept_b2c_creator_invite(repeat('c',64))$$,
  '42501', 'invitation unavailable', 'a different account cannot replay an accepted link'
);

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001');
select is(public.admin_manage_b2c_creator_invite('candidate@pilot.test','revoke')->>'status', 'revoked', 'admin can revoke the invitation and entitlement');

set local role authenticated;
select pg_temp.set_authenticated_claims('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002');
select ok(not public.current_user_can_create_portfolio(), 'revocation removes creator capability');
select throws_ok(
  $$select public.accept_b2c_creator_invite(repeat('c',64))$$,
  '42501', 'invitation unavailable', 'revoked link cannot be accepted again'
);

select * from finish();
rollback;
