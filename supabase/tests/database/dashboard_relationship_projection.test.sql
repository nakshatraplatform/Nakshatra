begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(12);

select pg_temp.create_auth_actor(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'owner@dashboard.test'
);
select pg_temp.create_auth_actor(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002',
  'direct@dashboard.test'
);
select pg_temp.create_auth_actor(
  '81000000-0000-4000-8000-000000000003',
  '82000000-0000-4000-8000-000000000003',
  'broker@dashboard.test'
);

insert into app_private.b2c_creator_entitlements (email_hash)
values (app_private.normalized_email_hash('direct@dashboard.test'));

insert into public.candidates (id, primary_owner_user_id, display_name, created_by)
values (
  '82500000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  'Maya Shah',
  '81000000-0000-4000-8000-000000000002'
);

update app_private.identity_verification_subjects
set status = 'verified', verified_at = now() - interval '1 day', expires_at = now() + interval '365 days'
where candidate_id = '82500000-0000-4000-8000-000000000001';

insert into public.portfolios (
  id, user_id, candidate_id, share_token, draft_data, published_data, is_published, expires_at
) values
  (
    '83000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    null,
    'owner_dashboard_token_01', '{}', '{}', false, now() + interval '30 days'
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000002',
    '82500000-0000-4000-8000-000000000001',
    'direct_dashboard_token_01', pg_temp.complete_portfolio_draft(), '{}', false, now() + interval '30 days'
  );

insert into public.portfolio_media (
  portfolio_id, candidate_id, media_type, storage_path, visibility, sort_order
) values (
  '83000000-0000-4000-8000-000000000002',
  '82500000-0000-4000-8000-000000000001',
  'hero',
  '81000000-0000-4000-8000-000000000002/83000000-0000-4000-8000-000000000002/hero.webp',
  'public',
  0
);

select pg_temp.prime_paid_publication(
  '83000000-0000-4000-8000-000000000002',
  pg_temp.complete_portfolio_draft()
);

update public.portfolios
set is_published = true
where id = '83000000-0000-4000-8000-000000000002';

insert into public.public_portfolio_snapshots (
  portfolio_id, share_token, data, template_id, expires_at, is_active
) values (
  '83000000-0000-4000-8000-000000000002',
  'direct_dashboard_token_01',
  '{"personal":{"name":"Maya Shah"}}',
  1,
  now() + interval '30 days',
  true
);

insert into public.organizations (
  id, type, name, slug, created_by
) values (
  '84000000-0000-4000-8000-000000000001',
  'matchmaker_agency',
  'Sanskriti Introductions',
  'sanskriti-dashboard-test',
  '81000000-0000-4000-8000-000000000003'
);

insert into public.matchmaker_profiles (
  id, organization_id, display_name, slug
) values (
  '85000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  'Priya Menon',
  'priya-dashboard-test'
);

insert into public.interest_requests (
  id, portfolio_id, requester_user_id, viewer_name, viewer_phone, viewer_email,
  email_verified_at, verification_channel, status, metadata,
  referring_organization_id, referring_matchmaker_profile_id, created_at
) values
  (
    '86000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000002',
    'Maya Shah', '+1 555 010 3300', 'direct@dashboard.test',
    now(), 'email', 'new',
    '{"profile_for":"self","portfolio_url":"https://untrusted.example/claim"}',
    null, null, now() - interval '2 minutes'
  ),
  (
    '86000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000003',
    'Arjun Nair', '+91 90000 10000', 'broker@dashboard.test',
    now(), 'email', 'approved', '{"profile_for":"son"}',
    '84000000-0000-4000-8000-000000000001',
    '85000000-0000-4000-8000-000000000001',
    now() - interval '1 minute'
  );

insert into public.reveal_grants (
  id, interest_request_id, portfolio_id, viewer_user_id, access_level,
  granted_sections, granted_by, expires_at
) values (
  '87000000-0000-4000-8000-000000000001',
  '86000000-0000-4000-8000-000000000002',
  '83000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000003',
  'full', array['full']::text[],
  '81000000-0000-4000-8000-000000000001',
  now() + interval '7 days'
);

select ok(
  not has_function_privilege('anon', 'public.list_dashboard_interests(integer)', 'EXECUTE'),
  'anonymous visitors cannot read owner relationships'
);
select ok(
  has_function_privilege('authenticated', 'public.list_dashboard_interests(integer)', 'EXECUTE'),
  'authenticated owners can call the guarded relationship projection'
);
select ok(
  not has_function_privilege('authenticated', 'app_private.list_dashboard_interests(integer)', 'EXECUTE'),
  'authenticated callers cannot bypass the guarded public entry point'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001'
);

select is(
  pg_catalog.jsonb_array_length(public.list_dashboard_interests(12)),
  2,
  'the owner sees both direct and broker introductions'
);
select is(
  public.list_dashboard_interests(12) #>> '{1,source_type}',
  'direct',
  'a relationship without broker attribution is labeled direct'
);
select is(
  public.list_dashboard_interests(12) #>> '{0,source_type}',
  'broker',
  'an attributed relationship is labeled broker'
);
select is(
  public.list_dashboard_interests(12) #>> '{0,broker_name}',
  'Sanskriti Introductions',
  'the owner sees the referring broker organization name'
);
select is(
  public.list_dashboard_interests(12) #>> '{0,broker_representative_name}',
  'Priya Menon',
  'the owner sees the referring representative name'
);
select is(
  public.list_dashboard_interests(12) #>> '{1,requester_portfolio_token}',
  'direct_dashboard_token_01',
  'the requester portfolio is resolved from authenticated database ownership'
);
select ok(
  not ((public.list_dashboard_interests(12) #> '{1,metadata}') ? 'portfolio_url'),
  'caller-supplied portfolio URLs are never returned'
);
select is(
  public.list_portfolio_access() #>> '{grants,0,sourceType}',
  'broker',
  'Full View access retains the relationship source'
);

reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims(
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000002'
);
select is(
  public.list_dashboard_interests(12),
  '[]'::jsonb,
  'a non-owner cannot enumerate another portfolio relationships'
);

select * from finish();
rollback;
