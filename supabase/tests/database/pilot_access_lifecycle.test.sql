begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(31);

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
    'Pilot Applicant', '+14155550100', 'pilot_access_v1',
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
    'Different Applicant', '+14155550100', 'pilot_access_v1',
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

reset role;
update auth.users set email = 'changed@pilot.test'
where id = '81000000-0000-4000-8000-000000000001';
create temporary table pilot_request_ref as
select request_ref from app_private.pilot_access_requests
where applicant_user_id = '81000000-0000-4000-8000-000000000001';
grant select on pilot_request_ref to authenticated;

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);
select throws_ok(
  format(
    'select public.review_pilot_access_request(%L,%L,%L,%L)',
    (select request_ref from pilot_request_ref), 'approve', null,
    'pilot-review:00000001'
  ),
  '42501',
  'applicant email changed; a new verified request is required',
  'approval fails when the verified email changed after submission'
);

reset role;
update auth.users set email = 'applicant@pilot.test'
where id = '81000000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);
select is(
  public.review_pilot_access_request(
    (select request_ref from pilot_request_ref), 'approve', 'Pilot cohort one',
    'pilot-review:00000002'
  ) ->> 'status',
  'approved',
  'an operator can approve the verified application'
);

reset role;
select ok(
  exists (
    select 1 from app_private.b2c_creator_entitlements
    where email_hash = app_private.normalized_email_hash('applicant@pilot.test')
      and revoked_at is null
  ),
  'approval grants creator entitlement in the same transaction'
);
select is(
  (select count(*)::integer from app_private.notification_outbox
   where notification_type = 'pilot_access_approved'),
  1,
  'approval queues exactly one approval notification'
);
select ok(
  exists (
    select 1 from app_private.pilot_access_audit_events
    where event_name = 'pilot.application.approved' and outcome = 'succeeded'
  ),
  'approval appends an audit event'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);
select is(
  public.review_pilot_access_request(
    (select request_ref from pilot_request_ref), 'approve', 'Pilot cohort one',
    'pilot-review:00000002'
  ) ->> 'status',
  'approved',
  'an exact approval retry returns its recorded result'
);

reset role;
select is(
  (select count(*)::integer from app_private.notification_outbox
   where notification_type = 'pilot_access_approved'),
  1,
  'an idempotent approval retry does not duplicate notification work'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001'
);
select is(
  public.get_current_pilot_access_state() ->> 'canCreatePortfolio',
  'true',
  'the approved applicant receives creator capability'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);
select is(
  public.review_pilot_access_request(
    (select request_ref from pilot_request_ref), 'revoke', 'Pilot access ended',
    'pilot-review:00000003'
  ) ->> 'status',
  'revoked',
  'an operator can revoke approved pilot access'
);

reset role;
select ok(
  exists (
    select 1 from app_private.b2c_creator_entitlements
    where email_hash = app_private.normalized_email_hash('applicant@pilot.test')
      and revoked_at is not null
  ),
  'revocation disables the creator entitlement'
);
select is(
  (select count(*)::integer from app_private.notification_outbox),
  2,
  'revocation queues a separate notification'
);
select throws_ok(
  $$update app_private.pilot_access_audit_events set outcome = 'failed'$$,
  '55000',
  'pilot access audit events are append-only',
  'pilot audit history cannot be rewritten'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001'
);
select is(
  public.get_current_pilot_access_state() ->> 'canCreatePortfolio',
  'false',
  'revocation removes creator capability without deleting the account'
);

reset role;
select is(
  (select count(*)::integer from app_private.pilot_access_audit_events
   where request_id = (select id from app_private.pilot_access_requests
     where request_ref = (select request_ref from pilot_request_ref))),
  3,
  'submission, approval, and revocation history remains durable'
);
select is(
  (select status from app_private.pilot_access_requests
   where request_ref = (select request_ref from pilot_request_ref)),
  'revoked',
  'the application retains its final reviewed state'
);
select is(
  (select count(*)::integer from app_private.pilot_command_idempotency
   where actor_user_id = '81000000-0000-4000-8000-000000000002'),
  2,
  'operator decisions keep independent idempotency receipts'
);

select * from finish();
rollback;
