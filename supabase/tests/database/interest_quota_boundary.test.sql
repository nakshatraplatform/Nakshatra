begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(12);

select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000001', 'owner@access.test');
select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000002', 'a1100000-0000-4000-8000-000000000002', 'viewer@access.test');
select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000003', 'a1100000-0000-4000-8000-000000000003', 'stranger@access.test');
select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000004', 'a1100000-0000-4000-8000-000000000004', 'family@access.test');
select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000005', 'a1100000-0000-4000-8000-000000000005', 'optional@access.test');

insert into app_private.b2c_creator_entitlements (email_hash)
values (app_private.normalized_email_hash('owner@access.test'));

insert into public.candidates (id, primary_owner_user_id, display_name, created_by)
values (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Aditi Rao',
  'a1000000-0000-4000-8000-000000000001'
);

insert into public.candidates (id, primary_owner_user_id, display_name, created_by)
values (
  'a2000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000002',
  'Rohan Mehta',
  'a1000000-0000-4000-8000-000000000002'
);

update app_private.identity_verification_subjects
set status = 'verified', verified_at = now() - interval '1 day', expires_at = now() + interval '365 days'
where candidate_id = 'a2000000-0000-4000-8000-000000000001';

insert into public.portfolios (
  id, user_id, candidate_id, share_token, draft_data, published_data,
  is_published, expires_at, template_id, theme_color, sun_sign
) values (
  'a3000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'phase2_secure_token_1',
  '{"personal":{"name":"Original Draft"}}'::jsonb,
  '{"personal":{"name":"Original Draft"}}'::jsonb,
  false,
  now() + interval '90 days',
  3,
  '#17151c',
  'kanya'
);

insert into public.portfolios (
  id, user_id, candidate_id, share_token, draft_data, published_data,
  is_published, expires_at, template_id, theme_color, sun_sign
) values (
  'a3000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000002',
  'viewer_private_token_1',
  '{"personal":{"name":"Rohan Mehta","profile_for":"self"}}'::jsonb,
  null,
  false,
  null,
  3,
  '#17151c',
  'kanya'
);

insert into public.portfolio_media (
  id, portfolio_id, candidate_id, media_type, storage_path, visibility, sort_order, metadata
) values (
  'a4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'hero',
  'a1000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/hero.webp',
  'public',
  0,
  '{"width":800,"height":1200}'::jsonb
);

select pg_temp.prime_paid_publication(
  'a3000000-0000-4000-8000-000000000001',
  pg_temp.complete_portfolio_draft('{"personal":{"name":"Aditi Draft"},"contact":{"phone":"private"}}'::jsonb)
);

set local role service_role;
select pg_temp.set_service_role_claims();

select is(
  public.service_publish_portfolio_transaction(
    'a1000000-0000-4000-8000-000000000001',
    'a1100000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    pg_temp.complete_portfolio_draft('{"personal":{"name":"Aditi Draft"},"contact":{"phone":"private"}}'::jsonb),
    '{"personal":{"name":"Aditi Public"}}'::jsonb,
    '{"personal":{"name":"Aditi Full"},"family":{"father":{"name":"Private Parent"}}}'::jsonb,
    'phase2_secure_token_1', now() + interval '90 days', 3, '#17151c', 'kanya'
  ) ->> 'status',
  'ok',
  'owner publication commits the public and approved projections together'
);
reset role;
insert into public.reference_countries(country_code,name) values ('ZZ','Fixture country') on conflict(country_code) do update set is_active=true;
insert into public.reference_regions(geoname_id,country_code,region_code,name) values (999000001,'ZZ','ZZ','Fixture state');
insert into public.reference_cities(geoname_id,country_code,region_code,name) values (999000002,'ZZ','ZZ','Fixture city');
insert into public.reference_regions(geoname_id,country_code,region_code,name)
values (999000004,'US','MA','Massachusetts')
on conflict(country_code,region_code) do update set name=excluded.name,is_active=true;
insert into public.reference_cities(geoname_id,country_code,region_code,name)
values (999000003,'US','MA','Fixture city');
insert into public.portfolio_media(portfolio_id,candidate_id,media_type,storage_path,visibility,sort_order)
select 'a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','gallery',
  'a1000000-0000-4000-8000-000000000001/interest-fixture/' || visibility || '.webp',visibility::public.visibility_level,row_number() over()::integer
from unnest(array['approved_only','interest_required','hidden','owner_only']) visibility;
insert into storage.objects(bucket_id,name) select 'photos',storage_path from public.portfolio_media where storage_path like 'a1000000-0000-4000-8000-000000000001/interest-fixture/%';

create function pg_temp.interest_input() returns jsonb language sql as $$
select jsonb_build_object('portfolioToken','phase2_secure_token_1','name','Mira Rao','profileFor','self',
  'email','stranger@access.test','phone','+1 617 555 0123',
  'familyContext','Our family values kindness, honesty and mutual respect.',
  'message','I enjoyed reading your introduction and would like to learn more about your family, interests and plans for the future.',
  'location',jsonb_build_object('country','United States','countryCode','US',
    'state','Massachusetts','subdivisionCode','US-MA','city','Fixture city',
    'cityGeonameId',999000003,'postalCode','02108','locationSource','manual'))
$$;
create function pg_temp.legacy_candidate_location() returns jsonb language sql as $$
  select jsonb_build_object('countryCode','ZZ','regionCode','ZZ','cityId',999000002)
$$;

-- Five additional real published portfolios, each with its own synthetic owner.
do $$
<<fixture>>
declare i integer; owner_id uuid; session_id uuid; candidate_id uuid; portfolio_id uuid; draft jsonb; result jsonb;
begin
  for i in 2..6 loop
    owner_id:=('b1000000-0000-4000-8000-00000000000'||i)::uuid;
    session_id:=('b1100000-0000-4000-8000-00000000000'||i)::uuid;
    candidate_id:=('b2000000-0000-4000-8000-00000000000'||i)::uuid;
    portfolio_id:=('b3000000-0000-4000-8000-00000000000'||i)::uuid;
    perform pg_temp.create_auth_actor(owner_id,session_id,'quota-owner-'||i||'@test.local');
    insert into public.candidates(id,primary_owner_user_id,display_name,created_by) values(candidate_id,owner_id,'Quota owner',owner_id);
    insert into public.portfolios(id,user_id,candidate_id,share_token,draft_data,template_id) values(portfolio_id,owner_id,candidate_id,'quota_target_'||lpad(i::text,8,'0'),'{}',3);
    insert into public.portfolio_media(portfolio_id,candidate_id,media_type,storage_path,visibility) values(portfolio_id,candidate_id,'hero',owner_id::text||'/'||portfolio_id::text||'/hero.webp','public');
    draft:=pg_temp.complete_portfolio_draft('{"personal":{"name":"Quota owner"}}'::jsonb);
    update app_private.identity_verification_subjects set status='verified',verified_at=now(),expires_at=now()+interval '365 days' where identity_verification_subjects.candidate_id=fixture.candidate_id;
    perform pg_temp.prime_paid_publication(portfolio_id,draft);
    perform pg_temp.set_service_role_claims();
    result:=public.service_publish_portfolio_transaction(owner_id,session_id,portfolio_id,draft,
      '{"personal":{"name":"Quota owner"}}'::jsonb,'{"personal":{"name":"Quota owner"}}'::jsonb,
      'quota_target_'||lpad(i::text,8,'0'),now()+interval '90 days',3,'#17151c','kanya');
    if result->>'status'<>'ok' then raise exception 'fixture publication failed: %',result; end if;
  end loop;
end $$;
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000002');
select ok(public.submit_existing_interest('phase2_secure_token_1','Our family values kindness, honesty and mutual respect.',null,pg_temp.interest_input()->'location'),'first direct existing-profile call accepted');
select ok(public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object('portfolioToken','quota_target_00000002','email','viewer@access.test')),'second direct details call shares quota');
select ok(public.submit_existing_interest('quota_target_00000003','Our family values kindness, honesty and mutual respect.',null,pg_temp.interest_input()->'location'),'third accepted');
select ok(public.submit_existing_interest('quota_target_00000004','Our family values kindness, honesty and mutual respect.',null,pg_temp.interest_input()->'location'),'fourth accepted');
select ok(public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object('portfolioToken','quota_target_00000005','email','viewer@access.test')),'fifth accepted');
reset role;
select count(*) as requests_before from public.interest_requests \gset
select count(*) as outbox_before from app_private.notification_outbox \gset
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000002');
select throws_ok($$select public.submit_existing_interest('quota_target_00000006','Our family values kindness, honesty and mutual respect.',null,pg_temp.interest_input()->'location')$$,'P0429','interest submission quota exceeded','sixth direct request denied');
select ok(public.submit_existing_interest('phase2_secure_token_1','Our family values kindness, honesty and mutual respect.',null,pg_temp.interest_input()->'location'),'idempotent retry succeeds at exhausted quota');
reset role;
select is((select count(*) from public.interest_requests),:'requests_before'::bigint,'denial/retry add no request');
select is((select count(*) from app_private.notification_outbox),:'outbox_before'::bigint,'denial/retry add no notification');
select is((select request_count from app_private.api_rate_limits where action='interest_submit' and subject_key='user:a1000000-0000-4000-8000-000000000002'),5,'exactly five quota units consumed');
update app_private.api_rate_limits set window_started_at=now()-interval '61 minutes' where action='interest_submit';
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000002');
select ok(public.submit_existing_interest('quota_target_00000006','Our family values kindness, honesty and mutual respect.',null,pg_temp.interest_input()->'location'),'expired window permits next request');
select * from finish();
rollback;
