begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(37);

select has_table('public', 'reference_subdivisions', 'ISO subdivision reference table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.reference_subdivisions'::regclass), 'subdivision references have RLS enabled');
select is((select count(*)::integer from public.reference_subdivisions where country_code = 'IN'), 36, 'all India subdivisions are seeded');
select is((select count(*)::integer from public.reference_subdivisions where country_code = 'US'), 57, 'all US states and territories are seeded');
select is((select name from public.reference_subdivisions where subdivision_code = 'IN-KA'), 'Karnataka', 'India ISO code maps correctly');
select is((select name from public.reference_subdivisions where subdivision_code = 'US-MA'), 'Massachusetts', 'US ISO code maps correctly');
select is((select name from public.reference_subdivisions where subdivision_code = 'US-VI'), 'United States Virgin Islands', 'US territory names use the application canonical value');

select has_column('public', 'candidates', 'current_country_code', 'candidate country code is queryable');
select has_column('public', 'candidates', 'current_subdivision_code', 'candidate subdivision code is queryable');
select has_column('public', 'candidates', 'current_postal_code', 'candidate postal code is queryable');
select has_column('public', 'interest_requests', 'country_code', 'interest country code is queryable');
select has_column('public', 'interest_requests', 'subdivision_code', 'interest subdivision code is queryable');
select has_function('public', 'submit_existing_interest', array['text','text','text','jsonb'], 'existing-viewer command accepts structured location fields');
select ok(
  (select pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint where conname = 'candidates_location_source_check') like '%zippopotam%',
  'candidate location provenance accepts Zippopotam'
);
select ok(
  (select pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint where conname = 'interest_location_source_check') like '%zippopotam%',
  'interest location provenance accepts Zippopotam'
);

insert into public.reference_regions(
  geoname_id, country_code, region_code, name, ascii_name, is_active
) values (
  9876543209, 'US', 'MA', 'Massachusetts', 'Massachusetts', true
)
on conflict (country_code, region_code) do update
set name = excluded.name, ascii_name = excluded.ascii_name, is_active = true;

insert into public.reference_cities(
  geoname_id, country_code, region_code, name, ascii_name, alternative_names, is_active
) values (
  9876543210, 'US', 'MA', 'Testopolis', 'Testopolis', array['Test City'], true
);

select ok(
  app_private.reference_city_matches_location(9876543210, 'US', 'testopolis'),
  'GeoNames city identifiers match their canonical country and city name'
);
select ok(
  app_private.reference_city_matches_location(9876543210, 'US', 'Test City'),
  'GeoNames city identifiers accept a canonical alternative city name'
);
select ok(
  not app_private.reference_city_matches_location(9876543210, 'IN', 'Testopolis'),
  'GeoNames city identifiers cannot cross country boundaries'
);
select ok(
  not app_private.reference_city_matches_location(9876543210, 'US', 'Elsewhere'),
  'GeoNames city identifiers cannot attach to a different city name'
);
select is(
  app_private.normalize_portfolio_geography(
    '{"country_code":"US","region_code":"US-MA","city":"Testopolis","city_geoname_id":9876543210}'::jsonb
  ) ->> 'region_code',
  'US-MA',
  'production geography normalization preserves a valid ISO subdivision code'
);
select throws_ok(
  $$ select app_private.normalize_portfolio_geography(
    '{"country_code":"US","region_code":"US-NY","city":"Testopolis","city_geoname_id":9876543210}'::jsonb
  ) $$,
  '22023',
  'geography_city_hierarchy_invalid',
  'ISO subdivision normalization rejects a city bound to another state'
);
select ok(
  not app_private.reference_city_matches_subdivision(
    9876543210, 'US', 'US-NY', 'Testopolis'
  ),
  'interest geography rejects a valid city identifier attached to the wrong subdivision'
);

insert into public.candidates(
  id, display_name, current_country_code, current_region_code,
  current_subdivision_code, current_city_geoname_id,
  current_postal_code, location_source
) values (
  '98765432-1000-4000-8000-000000000001', 'Location clearing fixture',
  'US', 'US-MA', 'US-MA', 9876543210, '02108', 'zippopotam'
);

update public.candidates
set current_country_code = null,
    current_region_code = null,
    current_subdivision_code = null,
    current_city_geoname_id = null,
    current_country = null,
    current_region = null,
    current_city = null
where id = '98765432-1000-4000-8000-000000000001';

select ok(
  (
    select current_country_code is null
      and current_region_code is null
      and current_subdivision_code is null
      and current_city_geoname_id is null
      and current_postal_code is null
      and location_source is null
      and current_country is null
      and current_region is null
      and current_city is null
    from public.candidates
    where id = '98765432-1000-4000-8000-000000000001'
  ),
  'clearing a candidate location removes both ISO and legacy GeoNames hierarchy values'
);

update public.candidates
set current_country_code = 'US', current_region_code = 'US-MA',
    current_subdivision_code = 'US-MA', current_city_geoname_id = 9876543210,
    current_postal_code = '02108', location_source = 'zippopotam'
where id = '98765432-1000-4000-8000-000000000001';
update public.candidates
set current_country_code = null, current_country = 'Manual Country'
where id = '98765432-1000-4000-8000-000000000001';
select ok((
  select current_country = 'Manual Country' and current_region is null and current_city is null
    and current_subdivision_code is null and current_postal_code is null and location_source is null
  from public.candidates where id = '98765432-1000-4000-8000-000000000001'
), 'partial manual replacement clears stale lower-level labels and canonical fields');

select ok(app_private.public_snapshot_has_forbidden_key('{"personal":{"address_line_1":"100 Main Street"}}'::jsonb), 'public snapshots reject exact street addresses');
select ok(app_private.approved_snapshot_has_forbidden_key('{"personal":{"address_line_2":"Unit 12"}}'::jsonb), 'approved snapshots reject exact street addresses');
select ok(app_private.broker_standard_profile_has_forbidden_key('{"personal":{"address_line_1":"100 Main Street"}}'::jsonb), 'Broker Standard snapshots reject exact street addresses');
select ok(app_private.public_snapshot_has_forbidden_key('{"personal":{"subdivision_code":"US-MA","pin_zip":"02108"}}'::jsonb), 'public snapshots reject canonical subdivision and postal aliases');
select ok(app_private.approved_snapshot_has_forbidden_key('{"personal":{"subdivision_code":"US-MA","pin_zip":"02108"}}'::jsonb), 'approved snapshots reject canonical subdivision and postal aliases');
select ok(app_private.broker_standard_profile_has_forbidden_key('{"personal":{"subdivision_code":"US-MA","pin_zip":"02108"}}'::jsonb), 'Broker Standard snapshots reject canonical subdivision and postal aliases');
select ok(
  array['structured_location','private_address']::text[] <@ app_private.portfolio_missing_required_details(
    extensions.gen_random_uuid(),
    '{"personal":{"first_name":"Aditi","last_name":"Rao","dob":"1996-08-12"},"career":{"title":"Engineer"}}'::jsonb
  ),
  'publication readiness requires the hierarchy and both private address lines'
);
select ok(
  not ('structured_location' = any(app_private.portfolio_missing_required_details(
    extensions.gen_random_uuid(),
    '{"personal":{"first_name":"Aditi","last_name":"Rao","dob":"1996-08-12","country":"United States","country_code":"US","region":"Massachusetts","region_code":"US-MA","city":"Boston","postal_code":"02108","location_source":"zippopotam","address_line_1":"100 Main Street","address_line_2":"Not applicable","short_bio":"A thoughtful introduction."},"career":{"title":"Engineer"}}'::jsonb
  ))),
  'publication readiness accepts normalized Zippopotam provenance'
);
select ok(
  'structured_location' = any(app_private.portfolio_missing_required_details(
    extensions.gen_random_uuid(),
    '{"personal":{"first_name":"Aditi","last_name":"Rao","dob":"1996-08-12","country":"United States","country_code":"US","region":"Massachusetts","region_code":"US-MA","city":"Boston","postal_code":"02108-1234","location_source":"manual","address_line_1":"100 Main Street","address_line_2":"Not applicable","short_bio":"A thoughtful introduction."},"career":{"title":"Engineer"}}'::jsonb
  )),
  'publication readiness requires the normalized five-digit US ZIP boundary'
);

select ok(
  array['marital_status','primary_photo']::text[] <@ app_private.portfolio_missing_required_details(
    extensions.gen_random_uuid(),
    '{"personal":{"first_name":"Aditi","last_name":"Rao","dob":"1996-08-12","gender":"female","country":"United States","country_code":"US","region":"Massachusetts","region_code":"US-MA","city":"Boston","postal_code":"02108","location_source":"zippopotam","current_location":"Boston, Massachusetts, United States","address_line_1":"100 Main Street","address_line_2":"Not applicable","short_bio":"A thoughtful introduction."},"vitals":{"height":"5''6\""},"career":{"title":"Engineer"}}'::jsonb
  ),
  'the location readiness extension preserves established marital-status and primary-photo rules'
);

select pg_temp.create_auth_actor(
  '98765432-2000-4000-8000-000000000001',
  '98765432-2100-4000-8000-000000000001',
  'owner@structured-location.test'
);
select pg_temp.create_auth_actor(
  '98765432-2000-4000-8000-000000000002',
  '98765432-2100-4000-8000-000000000002',
  'viewer@structured-location.test'
);

insert into public.candidates(id, primary_owner_user_id, display_name, created_by)
values (
  '98765432-2200-4000-8000-000000000001',
  '98765432-2000-4000-8000-000000000001',
  'Structured location owner',
  '98765432-2000-4000-8000-000000000001'
);
insert into public.candidate_personal_details(candidate_id, profile_for)
values ('98765432-2200-4000-8000-000000000001', 'self');
update app_private.identity_verification_subjects
set status = 'verified', verified_at = now() - interval '1 day', expires_at = now() + interval '365 days'
where candidate_id = '98765432-2200-4000-8000-000000000001';

set local session_replication_role = replica;
insert into public.portfolios(
  id, user_id, candidate_id, share_token, draft_data, published_data,
  is_published, expires_at
) values (
  '98765432-2300-4000-8000-000000000001',
  '98765432-2000-4000-8000-000000000001',
  '98765432-2200-4000-8000-000000000001',
  'structured_location_token_01',
  '{}', '{"personal":{"profile_for":"self"}}', true,
  pg_catalog.now() + interval '30 days'
);
insert into public.public_portfolio_snapshots(
  portfolio_id, share_token, data, template_id, expires_at, is_active
) values (
  '98765432-2300-4000-8000-000000000001',
  'structured_location_token_01', '{}', 1,
  pg_catalog.now() + interval '30 days', true
);
set local session_replication_role = origin;
select pg_temp.prime_photo_identity_verification('98765432-2300-4000-8000-000000000001');

select pg_temp.set_authenticated_claims(
  '98765432-2000-4000-8000-000000000002',
  '98765432-2100-4000-8000-000000000002'
);
select ok(
  public.submit_interest_details(pg_catalog.jsonb_build_object(
    'portfolioToken','structured_location_token_01','name','Structured Viewer','profileFor','self',
    'phone','+1 617 555 0100','email','viewer@structured-location.test',
    'familyContext','Our family values kindness, honesty and mutual respect.',
    'message','I enjoyed reading your introduction and would like to connect with your family to learn more about your interests and plans.',
    'location',pg_catalog.jsonb_build_object('country','United States','countryCode','US',
      'state','Massachusetts','subdivisionCode','US-MA','city','Testopolis',
      'cityGeonameId',9876543210,'postalCode','02108','locationSource','zippopotam')
  )),
  'the guarded interest command accepts and persists a valid structured hierarchy'
);
select is(
  (
    select pg_catalog.concat_ws('|', country_code, subdivision_code, city, postal_code, location_source)
    from public.interest_requests
    where requester_user_id = '98765432-2000-4000-8000-000000000002'
  ),
  'US|US-MA|Testopolis|02108|zippopotam',
  'the expanded interest command writes every relational location field'
);
select throws_ok(
  $$ select app_private.structured_interest_location(pg_catalog.jsonb_build_object(
    'country','United States','countryCode','US','state','New York','subdivisionCode','US-NY',
    'city','Testopolis','cityGeonameId',9876543210,'postalCode','10001','locationSource','manual'
  )) $$,
  '22023',
  'invalid interest location',
  'structured interest validation rejects a city identifier attached to another subdivision'
);

select * from finish();
rollback;
