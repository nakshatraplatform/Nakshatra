begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(11);

select ok(
  not has_function_privilege('authenticated',
    'public.publish_portfolio_transaction(uuid,jsonb,jsonb,jsonb,text,timestamptz,integer,text,text)',
    'EXECUTE'),
  'browser credentials cannot invoke the retired publication RPC'
);
select ok(
  not has_function_privilege('authenticated',
    'public.service_publish_portfolio_transaction(uuid,uuid,uuid,jsonb,jsonb,jsonb,text,timestamptz,integer,text,text)',
    'EXECUTE'),
  'browser credentials cannot invoke the server publication RPC'
);
select ok(
  has_function_privilege('service_role',
    'public.service_publish_portfolio_transaction(uuid,uuid,uuid,jsonb,jsonb,jsonb,text,timestamptz,integer,text,text)',
    'EXECUTE'),
  'the trusted server role can invoke publication'
);

select ok(not has_table_privilege('authenticated', 'public.public_portfolio_snapshots', 'INSERT'),
  'browser credentials cannot insert public snapshots');
select ok(not has_table_privilege('authenticated', 'public.public_portfolio_snapshots', 'UPDATE'),
  'browser credentials cannot edit public snapshots');
select ok(not has_table_privilege('authenticated', 'public.public_portfolio_snapshots', 'DELETE'),
  'browser credentials cannot delete public snapshots');
select ok(not has_table_privilege('authenticated', 'public.approved_portfolio_snapshots', 'INSERT'),
  'browser credentials cannot insert approved snapshots');
select ok(not has_table_privilege('authenticated', 'public.approved_portfolio_snapshots', 'UPDATE'),
  'browser credentials cannot edit approved snapshots');
select ok(not has_table_privilege('authenticated', 'public.approved_portfolio_snapshots', 'DELETE'),
  'browser credentials cannot delete approved snapshots');

select pg_temp.create_auth_actor(
  '99000000-0000-4000-8000-000000000001',
  '99000000-0000-4000-8000-000000000002',
  'owner@publication-boundary.test'
);
set local role service_role;
select pg_temp.set_service_role_claims();
select throws_ok(
  $$select public.service_publish_portfolio_transaction(
    '99000000-0000-4000-8000-000000000001',
    '99000000-0000-4000-8000-000000000003',
    null::uuid, null::jsonb, null::jsonb, null::jsonb,
    null::text, null::timestamptz, null::integer, null::text, null::text
  )$$,
  '42501', 'publication actor session is no longer active',
  'a service call cannot bind a missing or foreign Auth session'
);
reset role;

select ok(
  not has_function_privilege('anon',
    'public.service_publish_portfolio_transaction(uuid,uuid,uuid,jsonb,jsonb,jsonb,text,timestamptz,integer,text,text)',
    'EXECUTE'),
  'anonymous credentials cannot invoke server publication'
);

select * from finish();
rollback;
