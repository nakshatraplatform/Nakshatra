begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(17);

insert into public.reference_countries(country_code,name) values ('ZZ','Test Country'),('YY','Other Country');
insert into public.reference_regions(geoname_id,country_code,region_code,name) values
  (990001001,'ZZ','01','Test Region'),(990001002,'ZZ','02','Other Region'),(990001003,'YY','01','Foreign Region');
insert into public.reference_cities(geoname_id,country_code,region_code,name) values
  (990002001,'ZZ','01','Twin Town'),(990002002,'ZZ','02','Twin Town'),(990002003,'YY','01','Foreign Town');

select is(app_private.normalize_portfolio_geography('{"country_code":"zz","region_code":"01","city_geoname_id":990002001,"country":"spoof","region":"spoof","city":"spoof"}')#>>'{city}', 'Twin Town','selected IDs resolve canonical labels');
select is(app_private.normalize_portfolio_geography('{"country_code":"ZZ","city_geoname_id":990002002}')#>>'{region_code}','02','city without a chosen region derives its parent');
select is(app_private.normalize_portfolio_geography('{"country":"Legacy Country","city":"Unlisted Town"}'),' {"country":"Legacy Country","city":"Unlisted Town"}'::jsonb,'manual labels survive without inferred IDs');
select throws_ok($$select app_private.normalize_portfolio_geography('{"country_code":"ZZ","region_code":"01","city_geoname_id":990002002}')$$,'22023','geography_city_hierarchy_invalid','same-name city from another region is not substituted');
select throws_ok($$select app_private.normalize_portfolio_geography('{"country_code":"ZZ","city_geoname_id":990002003}')$$,'22023','geography_city_hierarchy_invalid','cross-country city is rejected');
select throws_ok($$select app_private.normalize_portfolio_geography('{"country_code":"XX"}')$$,'22023','geography_country_invalid','unknown country is rejected');
select throws_ok($$select app_private.normalize_portfolio_geography('{"region_code":"01"}')$$,'22023','geography_parent_required','identifiers require a country parent');
select ok(not has_function_privilege('authenticated','app_private.normalize_portfolio_geography(jsonb)','EXECUTE'),'browser cannot directly execute private normalizer');
select throws_ok($$insert into public.reference_cities(geoname_id,country_code,region_code,name) values(990002004,'YY','02','Bad parent')$$,'23503',null,'reference imports cannot create an orphan region');

select pg_temp.create_auth_actor('71000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','geo@fixture.test');
insert into app_private.b2c_creator_entitlements(email_hash) values(app_private.normalized_email_hash('geo@fixture.test'));
create function pg_temp.geography_payload(p_personal jsonb) returns jsonb language sql as $$
  select jsonb_build_object('portfolio',jsonb_build_object('draft_data',pg_temp.complete_portfolio_draft(jsonb_build_object('personal',p_personal)), 'template_id',1,'privacy_mode','balanced','visibility_settings','{}'::jsonb),
    'candidate',jsonb_build_object('display_name','Test Person','current_country',p_personal->>'country','current_region',p_personal->>'region','current_city',p_personal->>'city'),
    'details',jsonb_build_object('personal',jsonb_build_object('profile_for','self'),'astrology','{}'::jsonb,'lifestyle','{}'::jsonb,'preferences','{}'::jsonb),'visibilityRules','[]'::jsonb,'familyMembers','[]'::jsonb)
$$;
set local role authenticated;
select pg_temp.set_authenticated_claims('71000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001');
select is(public.save_dashboard_draft_transaction(pg_temp.geography_payload('{"country_code":"ZZ","region_code":"01","city_geoname_id":990002001,"country":"spoof","region":"spoof","city":"spoof"}'))->>'status','saved','canonical save succeeds through the guarded atomic command');
select is((select current_city_geoname_id from public.candidates where primary_owner_user_id=auth.uid()),990002001::bigint,'candidate projects canonical city ID');
select is((select current_region from public.candidates where primary_owner_user_id=auth.uid()),'Test Region','candidate projects canonical region name');
select is(public.save_dashboard_draft_transaction(pg_temp.geography_payload('{"country_code":"ZZ","region_code":"02","city_geoname_id":990002002}'))#>>'{draftData,personal,city}','Twin Town','saved draft response carries canonical labels');
select throws_ok($$select public.save_dashboard_draft_transaction(pg_temp.geography_payload('{"country_code":"ZZ","region_code":"01","city_geoname_id":990002003}'))$$,'22023','geography_city_hierarchy_invalid','invalid update fails atomically');
select is((select current_city_geoname_id from public.candidates where primary_owner_user_id=auth.uid()),990002002::bigint,'failed save leaves prior candidate projection intact');
select is(public.save_dashboard_draft_transaction(pg_temp.geography_payload('{"country":"Unlisted Country","region":"Manual Region","city":"Manual City"}'))->>'status','saved','owner can replace canonical selection with manual labels');
select is((select current_city_geoname_id from public.candidates where primary_owner_user_id=auth.uid()),null::bigint,'manual update clears stale reference IDs');
reset role;
select * from finish();
rollback;
