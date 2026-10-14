begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(22);

select has_column('public', 'portfolios', 'country_code', 'portfolio country code is relational');
select has_column('public', 'portfolios', 'subdivision_code', 'portfolio subdivision code is relational');
select has_column('public', 'portfolios', 'district_city', 'portfolio district or city is relational');
select has_column('public', 'portfolios', 'pin_zip', 'portfolio postal code is relational');
select has_column('public', 'portfolios', 'is_active', 'portfolio active state is queryable');
select has_function(
  'public',
  'get_hierarchical_matches',
  array['uuid', 'integer'],
  'hierarchical match RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.get_hierarchical_matches(uuid,integer)', 'execute'),
  'anonymous callers cannot enumerate matching portfolios'
);
select ok(
  not has_function_privilege('authenticated', 'public.get_hierarchical_matches(uuid,integer)', 'execute'),
  'authenticated clients cannot enumerate full portfolio rows'
);
select ok(
  has_function_privilege('service_role', 'public.get_hierarchical_matches(uuid,integer)', 'execute'),
  'trusted workflow services can execute the matcher'
);
select has_index('public', 'portfolios', 'portfolios_active_geo_hierarchy_idx', 'hierarchy index exists');
select has_index('public', 'portfolios', 'portfolios_active_country_postal_idx', 'country and postal index exists');

select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000001', '8b000000-0000-4000-8000-000000000001', 'source@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000002', '8b000000-0000-4000-8000-000000000002', 'one-old@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000003', '8b000000-0000-4000-8000-000000000003', 'one-new@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000004', '8b000000-0000-4000-8000-000000000004', 'two@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000005', '8b000000-0000-4000-8000-000000000005', 'three@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000006', '8b000000-0000-4000-8000-000000000006', 'four@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000007', '8b000000-0000-4000-8000-000000000007', 'india@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000008', '8b000000-0000-4000-8000-000000000008', 'inactive@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000009', '8b000000-0000-4000-8000-000000000009', 'expired@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000010', '8b000000-0000-4000-8000-000000000010', 'derived@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000011', '8b000000-0000-4000-8000-000000000011', 'missing-boundary@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000012', '8b000000-0000-4000-8000-000000000012', 'missing-city@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000013', '8b000000-0000-4000-8000-000000000013', 'missing-state@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000014', '8b000000-0000-4000-8000-000000000014', 'legacy-region@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000015', '8b000000-0000-4000-8000-000000000015', 'same-city-no-postal@geo.test');
select pg_temp.create_auth_actor('8a000000-0000-4000-8000-000000000016', '8b000000-0000-4000-8000-000000000016', 'same-city-no-postal-peer@geo.test');

insert into public.reference_regions(
  geoname_id, country_code, region_code, name, ascii_name, is_active
) values (
  9876543211, 'GB', 'ENG', 'England', 'England', true
)
on conflict (country_code, region_code) do update
set name = excluded.name, ascii_name = excluded.ascii_name, is_active = true;

insert into public.portfolios(id, user_id, draft_data)
values (
  '8c000000-0000-4000-8000-000000000010',
  '8a000000-0000-4000-8000-000000000010',
  '{"personal":{"country_code":"in","region_code":"in-ka","city":"Bengaluru","postal_code":"560092"}}'::jsonb
);

select is(
  (
    select concat_ws('|', country_code, subdivision_code, district_city, pin_zip)
    from public.portfolios
    where id = '8c000000-0000-4000-8000-000000000010'
  ),
  'IN|IN-KA|Bengaluru|560092',
  'portfolio draft synchronization normalizes ISO codes and preserves postal text'
);

update public.portfolios
set draft_data = '{"personal":{"country_code":"US","region_code":"US-MA","city":"Boston","postal_code":"02108-1234"}}'::jsonb
where id = '8c000000-0000-4000-8000-000000000010';

select is(
  (select pin_zip from public.portfolios where id = '8c000000-0000-4000-8000-000000000010'),
  '02108',
  'portfolio matching columns normalize direct ZIP+4 draft writes'
);

insert into public.portfolios(id, user_id, draft_data)
values (
  '8c000000-0000-4000-8000-000000000014',
  '8a000000-0000-4000-8000-000000000014',
  '{"personal":{"country_code":"GB","region_code":"ENG","city":"London","postal_code":"SW1A 1AA"}}'::jsonb
);

select is(
  (
    select concat_ws('|', country_code, coalesce(subdivision_code, 'null'), district_city, pin_zip)
    from public.portfolios
    where id = '8c000000-0000-4000-8000-000000000014'
  ),
  'GB|null|London|SW1A 1AA',
  'legacy non-ISO regions retain country and postal matching data without violating subdivision constraints'
);

-- These fixtures intentionally bypass unrelated publication/payment triggers.
-- The matcher itself, generated active flag, constraints, and indexes remain active.
set local session_replication_role = replica;

insert into public.portfolios(
  id, user_id, draft_data, is_published, expires_at,
  country_code, subdivision_code, district_city, pin_zip, created_at
)
values
  ('8c000000-0000-4000-8000-000000000001','8a000000-0000-4000-8000-000000000001','{}',true,pg_catalog.now()+interval '1 year','US','US-MA','Boston','02171','2026-01-01T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000002','8a000000-0000-4000-8000-000000000002','{}',true,pg_catalog.now()+interval '1 year','US','US-MA','Quincy','02171','2026-01-02T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000003','8a000000-0000-4000-8000-000000000003','{}',true,pg_catalog.now()+interval '1 year','US','US-MA','Boston','02171','2026-01-03T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000004','8a000000-0000-4000-8000-000000000004','{}',true,pg_catalog.now()+interval '1 year','US','US-MA','Boston','02108','2026-01-04T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000005','8a000000-0000-4000-8000-000000000005','{}',true,pg_catalog.now()+interval '1 year','US','US-MA','Cambridge','02139','2026-01-05T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000006','8a000000-0000-4000-8000-000000000006','{}',true,pg_catalog.now()+interval '1 year','US','US-NY','Albany','12207','2026-01-06T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000007','8a000000-0000-4000-8000-000000000007','{}',true,pg_catalog.now()+interval '1 year','IN','IN-KA','Boston','02171','2026-01-07T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000008','8a000000-0000-4000-8000-000000000008','{}',false,null,'US','US-MA','Boston','02171','2026-01-08T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000009','8a000000-0000-4000-8000-000000000009','{}',true,pg_catalog.now()-interval '1 day','US','US-MA','Boston','02171','2026-01-09T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000011','8a000000-0000-4000-8000-000000000011','{}',false,null,'US',null,'Boston',null,'2026-01-10T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000012','8a000000-0000-4000-8000-000000000012','{}',true,pg_catalog.now()+interval '1 year','US','US-MA',null,'99999','2026-01-11T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000013','8a000000-0000-4000-8000-000000000013','{}',true,pg_catalog.now()+interval '1 year','US',null,'Boston','99998','2026-01-12T00:00:00Z'),
  ('8c000000-0000-4000-8000-000000000015','8a000000-0000-4000-8000-000000000015','{}',true,pg_catalog.now()+interval '1 year','US','US-MA','Boston',null,'2026-01-13T00:00:00Z');

set local session_replication_role = origin;

select results_eq(
  $$
    select id::text, proximity_tier
    from public.get_hierarchical_matches('8c000000-0000-4000-8000-000000000001', 50)
  $$,
  $$ values
    ('8c000000-0000-4000-8000-000000000003', 1),
    ('8c000000-0000-4000-8000-000000000002', 1),
    ('8c000000-0000-4000-8000-000000000015', 2),
    ('8c000000-0000-4000-8000-000000000004', 2),
    ('8c000000-0000-4000-8000-000000000005', 3),
    ('8c000000-0000-4000-8000-000000000006', 4)
  $$,
  'matches are country-safe, mutually exclusive, active, unexpired, and tier ordered'
);

select is(
  (select count(*)::integer from public.get_hierarchical_matches('8c000000-0000-4000-8000-000000000001', 2)),
  2,
  'limit_count bounds the final ordered result'
);

select is(
  (
    select proximity_tier
    from public.get_hierarchical_matches('8c000000-0000-4000-8000-000000000001', 50)
    where id = '8c000000-0000-4000-8000-000000000015'
  ),
  2,
  'a same-city candidate with a missing postal code expands to tier 2 instead of disappearing'
);

set local session_replication_role = replica;

insert into public.portfolios(
  id, user_id, draft_data, is_published, expires_at,
  country_code, subdivision_code, district_city, pin_zip, created_at
) values (
  '8c000000-0000-4000-8000-000000000016',
  '8a000000-0000-4000-8000-000000000016',
  '{}', true, pg_catalog.now() + interval '1 year',
  'US', 'US-MA', 'Boston', null, '2026-01-14T00:00:00Z'
);

set local session_replication_role = origin;

select is(
  (
    select proximity_tier
    from public.get_hierarchical_matches('8c000000-0000-4000-8000-000000000015', 50)
    where id = '8c000000-0000-4000-8000-000000000016'
  ),
  2,
  'same-city portfolios with two missing postal codes expand to tier 2 because tier 1 is impossible'
);

set local session_replication_role = replica;
insert into public.portfolios(
  id, user_id, draft_data, is_published, expires_at,
  country_code, subdivision_code, district_city, pin_zip, created_at
) values (
  '8c000000-0000-4000-8000-000000000017',
  '8a000000-0000-4000-8000-000000000017',
  '{}', true, pg_catalog.now() + interval '1 year',
  'US', 'US-MA', 'bOStOn', '02109', '2026-01-15T00:00:00Z'
);
set local session_replication_role = origin;

select is(
  (select proximity_tier from public.get_hierarchical_matches('8c000000-0000-4000-8000-000000000001', 50)
    where id = '8c000000-0000-4000-8000-000000000017'),
  2,
  'case-only city spelling differences stay in the same-city tier'
);

select is(
  (select count(*)::integer from public.get_hierarchical_matches('8c000000-0000-4000-8000-000000000011', 50)),
  0,
  'missing source boundaries do not become country or subdivision wildcards'
);

select throws_ok(
  $$ select * from public.get_hierarchical_matches('8c000000-0000-4000-8000-000000000001', 0) $$,
  '22023',
  'limit_count must be between 1 and 200',
  'non-positive limits are rejected'
);

select throws_ok(
  $$ select * from public.get_hierarchical_matches('8c000000-0000-4000-8000-00000000ffff', 50) $$,
  'P0002',
  'source portfolio not found',
  'missing sources fail explicitly'
);

select * from finish();
rollback;
