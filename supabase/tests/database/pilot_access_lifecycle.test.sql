begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(19);

select pg_temp.create_auth_actor(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'applicant@pilot.test'
);
select pg_temp.create_auth_actor(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002',
  'operator@pilot.test'
);

select has_table('app_private', 'pilot_access_requests', 'pilot applications are stored privately');
select has_table('app_private', 'pilot_administrators', 'pilot administrator authority is explicit');
select has_table('app_private', 'pilot_access_audit_events', 'pilot decisions have a dedicated audit log');
select has_table('app_private', 'notification_outbox', 'pilot notifications use a durable outbox');
select ok(
  not has_table_privilege('authenticated', 'app_private.pilot_access_requests', 'SELECT'),
  'applicants cannot enumerate private pilot requests'
);
select ok(
  not has_table_privilege('authenticated', 'app_private.pilot_administrators', 'SELECT'),
  'clients cannot enumerate pilot administrators'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001'
);
select is(
  public.get_current_pilot_access_state() ->> 'canCreatePortfolio',
  'false',
  'a verified account starts as a viewer without creator capability'
);
select is(
  public.consume_api_rate_limit('pilot_access_submit') ->> 'allowed',
  'true',
  'pilot applications have a database-backed quota'
);
select is(
  public.submit_pilot_access_request(
    'Pilot Applicant', '+14155550100', 'launch_waitlist_v1',
    'pilot-submit:00000001'
  ) ->> 'status',
  'pending',
  'a verified account can submit a pilot application'
);

reset role;
select is(
  (select verified_email_hash from app_private.pilot_access_requests
   where applicant_user_id = '81000000-0000-4000-8000-000000000001'),
  app_private.normalized_email_hash('applicant@pilot.test'),
  'the request is bound to the verified Auth email hash'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'app_private' and table_name = 'pilot_access_requests'
      and column_name in ('email', 'verified_email')
  ),
  'the private request table does not duplicate raw email'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001'
);
select is(
  public.submit_pilot_access_request(
    'Pilot Applicant', '+14155550100', 'pilot_access_v1',
    'pilot-submit:00000001'
  ) ->> 'status',
  'pending',
  'an exact retry returns the recorded result'
);
select throws_ok(
  $$select public.submit_pilot_access_request(
    'Different Applicant', '+14155550100', 'launch_waitlist_v1',
    'pilot-submit:00000001'
  )$$,
  '22023',
  'idempotency key was already used for a different request',
  'an idempotency key cannot be reused for a different application'
);
select throws_ok(
  $$select count(*) from public.list_pilot_access_requests('pending', 50)$$,
  '42501',
  'pilot administration unavailable',
  'an applicant cannot read the administration queue'
);

reset role;
insert into app_private.pilot_administrators(user_id)
values ('81000000-0000-4000-8000-000000000002');

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);
select is(
  (select verified_email from public.list_pilot_access_requests('pending', 50) limit 1),
  'applicant@pilot.test',
  'an authorized operator sees the verified email projection'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);
select is(
  public.get_current_pilot_access_state() ->> 'canCreatePortfolio',
  'true',
  'a Nakshatra administrator automatically has creator capability'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.review_pilot_access_request(text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot turn waitlist entries into creator access'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001'
);
select is(
  public.get_current_pilot_access_state() ->> 'canCreatePortfolio',
  'false',
  'joining the waitlist does not grant creator capability'
);

reset role;
select throws_ok(
  $$update app_private.pilot_access_audit_events set outcome = 'failed'$$,
  '55000',
  'pilot access audit events are append-only',
  'pilot audit history cannot be rewritten'
);

select * from finish();
rollback;
