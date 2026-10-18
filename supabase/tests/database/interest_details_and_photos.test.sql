begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(54);

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
select is(app_private.trim_interest_text(E' \t\n' || chr(160) || 'hello' || chr(65279) || E'\r\n'), 'hello', 'SQL trim matches authoring whitespace normalization');
select ok(not has_function_privilege('anon','public.get_interest_details(uuid)','EXECUTE'),'anonymous users cannot inspect owner details');
select ok(not has_function_privilege('anon','public.submit_interest_details(jsonb)','EXECUTE'),'anonymous users cannot submit unverified data');
select ok(not has_function_privilege('authenticated','public.submit_public_interest(text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE'),'legacy client command cannot bypass new visitor validation');
select ok(not has_function_privilege('authenticated','app_private.interest_location(jsonb)','EXECUTE'),'canonical location helper stays private');
set local role anon;
select ok(jsonb_array_length(public.list_interest_location_options('countries'))<=300,'anonymous country directory is bounded');
select is(jsonb_array_length(public.list_interest_location_options('cities','ZZ','ZZ','Fixture')),1,'anonymous city directory contains only reference rows');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000003"}';
select throws_ok($$select public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object('familyContext',repeat(E'\t',40)))$$,'22023','invalid interest request','tabs cannot satisfy family-context minimum');
select throws_ok($$select public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object('message','short'))$$,'22023','invalid interest request','a supplied nonblank message must satisfy its minimum');
select throws_ok($$select public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object('familyContext',jsonb_build_object('details',repeat('x',40))))$$,'22023','invalid interest request','object payload cannot be coerced into family context');
select throws_ok($$select public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object('location',jsonb_build_object('country','United States','countryCode','US','state','Massachusetts','subdivisionCode','US-MA','city','Fixture city','cityGeonameId',999000002,'postalCode','02108','locationSource','manual')))$$,'22023','invalid interest location','city must belong to selected country and state');
select throws_ok($$select public.submit_interest_details(pg_temp.interest_input() || '{"profileFor":"son"}'::jsonb)$$,'22023','invalid candidate details','someone-else branch requires candidate details');
select throws_ok($$select public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object('profileFor','son','candidate',jsonb_build_object('name','Arun Rao','email','invalid','phone','+1 617 555 0123','relationship',E'\t\n','location',pg_temp.legacy_candidate_location())))$$,'22023','invalid candidate details','optional candidate email must be valid when supplied');
select ok(public.submit_interest_details(pg_temp.interest_input()),'complete verified new visitor request is accepted');
reset role;
-- Capture the real submitted ID outside requester RLS. A lookup performed by the
-- viewer could return NULL and make the owner-only assertion pass vacuously.
select id as submitted_request_id from public.interest_requests
where requester_user_id='a1000000-0000-4000-8000-000000000003' \gset
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000003"}';
select is(public.get_interest_details(:'submitted_request_id'::uuid),null::jsonb,'viewer cannot read their own owner-only detail projection');
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select is(public.get_interest_details(:'submitted_request_id'::uuid),null::jsonb,'foreign signed-in viewer cannot read retained interest details');
reset role;
select is((select metadata#>>'{location_details,city}' from public.interest_requests where requester_user_id='a1000000-0000-4000-8000-000000000003'),'Fixture city','stored location comes from canonical reference rows');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000001"}';
select is(public.get_interest_details((select id from public.interest_requests where requester_user_id='a1000000-0000-4000-8000-000000000003')) ->> 'name','Mira Rao','owner can reopen all submitted details');
select is(public.get_interest_details((select id from public.interest_requests where requester_user_id='a1000000-0000-4000-8000-000000000003')) ->> 'accessStatus','not_granted','initial access status is accurate');
select is(jsonb_array_length(public.list_interest_history(0,25)),1,'retained interest history is owner scoped');
select throws_ok($$select public.list_interest_history(0,null)$$,'22023','invalid history page','null page size cannot remove history bounds');
select lives_ok($$select public.decide_interest_request((select id from public.interest_requests where requester_user_id='a1000000-0000-4000-8000-000000000003'),'approved')$$,'owner grants full access through existing decision command');
select is(public.get_interest_details((select id from public.interest_requests where requester_user_id='a1000000-0000-4000-8000-000000000003')) ->> 'accessStatus','active','approval preserves submission and exposes active lineage');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000003"}';
reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.portfolio_horoscopes(portfolio_id,storage_path,mime_type,file_extension,byte_size,published_at) values('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002/private-victim-horoscope.webp','image/webp','webp',10,now())$$,'42501','permission denied for table portfolio_horoscopes','owner cannot attach another account file');
select throws_ok($$insert into public.portfolio_media(portfolio_id,storage_path,visibility,media_type) values('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001/../a1000000-0000-4000-8000-000000000002/private.webp','approved_only','gallery')$$,'23514','media_storage_path_invalid','owner cannot store a photo path that changes identity during URL parsing');
select throws_ok($$update public.portfolio_media set thumbnail_path='a1000000-0000-4000-8000-000000000001/%2e%2e/foreign/file.webp' where id='a4000000-0000-4000-8000-000000000001'$$,'23514','media_storage_path_invalid','encoded normalization is rejected for derived paths');
select throws_ok($$update public.portfolio_media set metadata=jsonb_build_object('blurPath','a1000000-0000-4000-8000-000000000001/./file.webp') where id='a4000000-0000-4000-8000-000000000001'$$,'23514','media_storage_path_invalid','blur derivatives also require canonical paths');
select throws_ok($$insert into public.portfolio_horoscopes(portfolio_id,storage_path,mime_type,file_extension,byte_size,published_at) values('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/%2e%2e/foreign.webp','image/webp','webp',10,now())$$,'42501','permission denied for table portfolio_horoscopes','horoscope cannot store an encoded normalization path');
select public.reserve_horoscope_upload('a3000000-0000-4000-8000-000000000001') as reserved_path \gset
select lives_ok(format('select public.replace_horoscope(%L,null,%L::jsonb)',
  'a3000000-0000-4000-8000-000000000001',jsonb_build_object('storage_path',:'reserved_path',
  'mime_type','image/webp','file_extension','webp','byte_size',10,'page_count',1)::text),'owner can attach through reserved CAS command');
select throws_ok($$update public.portfolio_horoscopes set storage_path='a1000000-0000-4000-8000-000000000002/private-victim-horoscope.webp' where portfolio_id='a3000000-0000-4000-8000-000000000001'$$,'42501','permission denied for table portfolio_horoscopes','owner cannot replace an attachment with a foreign path');
reset role;
-- Simulate an invalid row predating this migration; the resolver must fail closed.
alter table public.portfolio_horoscopes disable trigger enforce_horoscope_storage_namespace;
update public.portfolio_horoscopes set storage_path='a1000000-0000-4000-8000-000000000002/private-victim-horoscope.webp' where portfolio_id='a3000000-0000-4000-8000-000000000001';
alter table public.portfolio_horoscopes enable trigger enforce_horoscope_storage_namespace;
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000003','a1100000-0000-4000-8000-000000000003');
select is(public.resolve_approved_horoscope('phase2_secure_token_1'),null::jsonb,'approved viewer cannot resolve preexisting foreign descriptor');
reset role;
update public.portfolio_horoscopes set published_at=now(),storage_path='a1000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/chart.webp' where portfolio_id='a3000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000003','a1100000-0000-4000-8000-000000000003');
select is(public.resolve_approved_horoscope('phase2_secure_token_1')->>'accessPath','a1000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/chart.webp','valid approved horoscope still resolves');
select ok(public.can_read_approved_photo('a1000000-0000-4000-8000-000000000001/interest-fixture/approved_only.webp'),'approved viewer can read protected originals despite descriptor RLS');
select ok(public.can_read_approved_photo('a1000000-0000-4000-8000-000000000001/interest-fixture/interest_required.webp'),'full approval includes interest-required originals');
select ok(not public.can_read_approved_photo('a1000000-0000-4000-8000-000000000001/interest-fixture/hidden.webp'),'hidden originals are excluded');
select ok(not public.can_read_approved_photo('a1000000-0000-4000-8000-000000000001/interest-fixture/owner_only.webp'),'owner-only originals are excluded');
select is((select count(*)::integer from storage.objects where bucket_id='photos' and name like 'a1000000-0000-4000-8000-000000000001/interest-fixture/%'),0,'approved viewers resolve protected photos only through the trusted signer');
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select ok(not public.can_read_approved_photo('a1000000-0000-4000-8000-000000000001/interest-fixture/approved_only.webp'),'foreign viewer cannot read approved originals');

reset role;
update public.reveal_grants
set created_at=now()-interval '2 days', expires_at=now()-interval '1 day'
where viewer_user_id='a1000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000003"}';
select ok(not public.can_read_approved_photo('a1000000-0000-4000-8000-000000000001/interest-fixture/approved_only.webp'),'expired grant cannot read protected originals');
reset role;
update public.reveal_grants
set created_at=now(), expires_at=now()+interval '15 days'
where viewer_user_id='a1000000-0000-4000-8000-000000000003';

reset role;
update public.portfolios set draft_data=draft_data || '{"career":{"title":"Engineer"},"lifestyle":{"values_statement":"Kindness and mutual respect"}}'::jsonb where user_id='a1000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.submit_existing_interest('phase2_secure_token_1',null,null,pg_temp.interest_input()->'location')$$,'22023','invalid interest context','existing-profile path also requires family context');
select ok(public.submit_existing_interest('phase2_secure_token_1','Our family values kindness, honesty and mutual respect.',null,pg_temp.interest_input()->'location'),'existing signed-in profile keeps optional message with required context and location');
reset role;
select is((select metadata->>'profession' from public.interest_requests where requester_user_id='a1000000-0000-4000-8000-000000000002'),'Engineer','reused profession snapshot is owned-account derived');
update public.reveal_grants set revoked_at=now() where viewer_user_id='a1000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000003"}';
select ok(not public.can_read_approved_photo('a1000000-0000-4000-8000-000000000001/interest-fixture/approved_only.webp'),'revoked viewer loses protected-photo capability');
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000001"}';
select is(public.get_interest_details((select id from public.interest_requests where requester_user_id='a1000000-0000-4000-8000-000000000003')) ->> 'accessStatus','revoked','owner retains full submission after ending access');
reset role;

-- A separate verified visitor exercises the successful non-self path, rather
-- than retrying the self request and observing duplicate-request behavior.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000004"}';
select ok(public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object(
  'name','Leela Rao','email','family@access.test','profileFor','son',
  'candidate',jsonb_build_object('name','Arun Rao','email','arun@example.test',
    'phone','+1 617 555 0123','relationship','My son','location',pg_temp.legacy_candidate_location())
)),'verified family member can submit complete non-self interest');
reset role;
select is((select metadata->'candidate' from public.interest_requests
  where requester_user_id='a1000000-0000-4000-8000-000000000004'),
  jsonb_build_object('name','Arun Rao','email','arun@example.test','phone','+1 617 555 0123',
    'relationship','Parent','location',jsonb_build_object('country','Fixture country','state','Fixture state',
      'city','Fixture city','countryCode','ZZ','regionCode','ZZ','cityId',999000002)),
  'candidate details persist with canonical location for a non-self request');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000001"}';
select is(public.get_interest_details((select id from public.interest_requests
  where requester_user_id='a1000000-0000-4000-8000-000000000004'))#>>'{metadata,candidate,name}',
  'Arun Rao','owner can reopen persisted candidate details after non-self submission');
reset role;
-- Optional details may be omitted, never fabricated, while their supplied values
-- and parent hierarchy remain validated at the database boundary.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000005"}';
select throws_ok($$select public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object('email','optional@access.test','profileFor','daughter','candidate',jsonb_build_object('name','Mira Rao','phone','invalid')))$$,'22023','invalid candidate details','optional candidate phone is validated when supplied');
select throws_ok($$select public.submit_interest_details(pg_temp.interest_input() || jsonb_build_object('email','optional@access.test','profileFor','daughter','candidate',jsonb_build_object('name','Mira Rao','location',jsonb_build_object('subdivisionCode','US-MA'))))$$,'22023','invalid interest location','partly supplied optional candidate geography is rejected');
select ok(public.submit_interest_details((pg_temp.interest_input()-'message') || jsonb_build_object('email','optional@access.test','profileFor','daughter','candidate',jsonb_build_object('name','Mira Rao','relationship','Forged'))),'candidate name alone and absent message are accepted');
reset role;
select is((select metadata->'candidate' from public.interest_requests where requester_user_id='a1000000-0000-4000-8000-000000000005'),'{"name":"Mira Rao","relationship":"Parent"}'::jsonb,'relationship is derived and absent candidate data is not fabricated');
select is((select message from public.interest_requests where requester_user_id='a1000000-0000-4000-8000-000000000005'),null::text,'omitted optional message persists as null');
select ok(not has_function_privilege('authenticated','public.submit_existing_interest(text,text,text)','EXECUTE'),'weaker legacy existing-profile overload remains inaccessible');
select * from finish();
rollback;
