begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(38);

select has_column(
  'app_private', 'portfolio_disclosure_versions', 'broker_standard_data',
  'publication versions pin a Broker Standard projection'
);
select ok(
  (select is_nullable = 'NO'
   from information_schema.columns
   where table_schema = 'app_private'
     and table_name = 'portfolio_disclosure_versions'
     and column_name = 'broker_standard_data'),
  'every disclosure version has a Broker Standard projection'
);
select has_function(
  'app_private', 'build_broker_standard_profile', array['jsonb'],
  'the database owns the Broker Standard projection'
);
select has_function(
  'app_private', 'broker_standard_profile_has_forbidden_key', array['jsonb'],
  'the database can enforce the Broker Standard denylist'
);
select has_trigger(
  'app_private', 'portfolio_disclosure_versions', 'derive_broker_standard_profile',
  'new publication versions derive Broker Standard data automatically'
);
select ok(
  (select pg_catalog.pg_get_triggerdef(oid)
   from pg_catalog.pg_trigger
   where tgrelid = 'app_private.portfolio_disclosure_versions'::regclass
     and tgname = 'derive_broker_standard_profile')
    like '%UPDATE OF complete_data, broker_standard_data%',
  'direct Broker Standard updates are re-derived from Complete data'
);
select ok(
  (select pg_catalog.pg_get_functiondef('public.resolve_broker_introduction(text,text)'::regprocedure))
    like '%relationship_has_active_mandate%'
  and (select pg_catalog.pg_get_functiondef('public.resolve_broker_introduction(text,text)'::regprocedure))
    like '%portfolio.is_published=true%',
  'resolution fails closed after mandate termination or portfolio unpublishing'
);
select has_trigger(
  'app_private', 'broker_introductions', 'derive_broker_introduction_detailed_snapshot',
  'introduction fallback data is derived from the pinned version'
);
select has_trigger(
  'app_private', 'broker_introductions', 'set_broker_introduction_expiry',
  'new broker introductions use the approved 15-day term'
);

select ok(
  not has_function_privilege('anon', 'app_private.build_broker_standard_profile(jsonb)', 'execute'),
  'anonymous callers cannot execute the private projector'
);
select ok(
  not has_function_privilege('authenticated', 'app_private.build_broker_standard_profile(jsonb)', 'execute'),
  'authenticated callers cannot execute the private projector'
);
select ok(
  not has_function_privilege('authenticated', 'app_private.pick_jsonb_keys(jsonb,text[])', 'execute'),
  'authenticated callers cannot execute the projection allowlist helper'
);
select ok(
  not has_function_privilege('authenticated', 'app_private.broker_standard_profile_has_forbidden_key(jsonb)', 'execute'),
  'authenticated callers cannot probe the private safety predicate'
);

create temporary table broker_standard_example as
select app_private.build_broker_standard_profile($json$
{
  "privacy_mode":"balanced",
  "personal":{"name":"Asha Rao","dob":"1995-05-06","country_code":"IN"},
  "vitals":{"height":"5 ft 5 in","complexion":"fair"},
  "astrology":{"nakshatra":"Rohini","time_of_birth":"08:30"},
  "career":{"title":"Architect","company":"Example Studio","annual_income":"2500000","income_currency":"INR","wealth_stage":"high"},
  "family":{"father":{"name":"Ravi Rao"},"current_country_code":"IN"},
  "lifestyle":{"diet":"Vegetarian","credit_score_band":"excellent"},
  "preferences":{"narrative":"Kind partner","private_notes":"Broker only","location_preferences":"USA","gift_expectations":"None"},
  "contact":{"contact_person":"Ravi Rao","phone":"+91 9999999999","email":"family@example.com"},
  "style":{"appearance":"light"},
  "access":{"contact":"approved"}
}
$json$::jsonb) as data;

select is(
  (select pg_catalog.jsonb_typeof(data) from broker_standard_example), 'object',
  'the projection is an object'
);
select ok(
  not (select data ? 'contact' from broker_standard_example),
  'contact is absent at the top level'
);
select ok(
  not (select app_private.broker_standard_profile_has_forbidden_key(data) from broker_standard_example),
  'no forbidden key survives anywhere in the projection'
);
select is(
  (select data #>> '{personal,name}' from broker_standard_example), 'Asha Rao',
  'the customer name remains visible'
);
select is(
  (select data #>> '{career,company}' from broker_standard_example), 'Example Studio',
  'non-financial professional information remains visible'
);
select is(
  (select data #>> '{astrology,nakshatra}' from broker_standard_example), 'Rohini',
  'astrology remains visible'
);
select is(
  (select data #>> '{family,father,name}' from broker_standard_example), 'Ravi Rao',
  'family information remains visible'
);
select is(
  (select data #>> '{preferences,narrative}' from broker_standard_example), 'Kind partner',
  'non-private preferences remain visible'
);
select ok(
  (select data #> '{career,annual_income}' is null from broker_standard_example)
  and (select data #> '{preferences,private_notes}' is null from broker_standard_example)
  and (select data #> '{lifestyle,credit_score_band}' is null from broker_standard_example),
  'financial and owner-private questionnaire fields are removed'
);

-- Behavioral fixtures exercise the triggers and public RPCs, not only their
-- definitions. These identities exist only inside this rolled-back test.
select pg_temp.create_auth_actor(
  '76000000-0000-4000-8000-000000000001',
  '76100000-0000-4000-8000-000000000001',
  'nak76-broker@example.test'
);
select pg_temp.create_auth_actor(
  '76000000-0000-4000-8000-000000000002',
  '76100000-0000-4000-8000-000000000002',
  'nak76-customer@example.test'
);

insert into public.organizations (id, type, name, slug, status, created_by)
values (
  '76200000-0000-4000-8000-000000000001', 'matchmaker_agency',
  'NAK-76 Test Agency', 'nak-76-broker-standard-test', 'active',
  '76000000-0000-4000-8000-000000000001'
);
insert into public.organization_members (id, organization_id, user_id, role, status)
values (
  '76300000-0000-4000-8000-000000000001',
  '76200000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001', 'owner', 'active'
);
insert into public.entitlements (id, organization_id, feature_key, feature_value, source)
values (
  '76400000-0000-4000-8000-000000000001',
  '76200000-0000-4000-8000-000000000001',
  'brokerdesk.enabled', 'true'::jsonb, 'nak-76-test'
);
insert into public.candidates (id, primary_owner_user_id, display_name, created_by)
values (
  '76500000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000002', 'Asha Rao',
  '76000000-0000-4000-8000-000000000002'
);
insert into app_private.b2c_creator_entitlements (email_hash)
values (app_private.normalized_email_hash('nak76-customer@example.test'));
update app_private.identity_verification_subjects
set status = 'verified', verified_at = pg_catalog.now() - interval '1 day',
    expires_at = pg_catalog.now() + interval '365 days'
where candidate_id = '76500000-0000-4000-8000-000000000001';
insert into public.broker_clients (
  id, organization_id, candidate_id, introduced_by, starts_at, relationship_status
) values (
  '76600000-0000-4000-8000-000000000001',
  '76200000-0000-4000-8000-000000000001',
  '76500000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001', pg_catalog.now() - interval '1 day', 'active'
);
insert into app_private.broker_client_mandates (
  id, organization_id, broker_client_id, purpose, permitted_capabilities,
  evidence_reference, customer_approved_by, starts_at, ends_at
) values (
  '76700000-0000-4000-8000-000000000001',
  '76200000-0000-4000-8000-000000000001',
  '76600000-0000-4000-8000-000000000001',
  'NAK-76 introduction disclosure test',
  array['introductions.create','introductions.send']::app_private.brokerdesk_capability[],
  'consent:nak-76-test', '76000000-0000-4000-8000-000000000002',
  pg_catalog.now() - interval '1 day', pg_catalog.now() + interval '30 days'
);
insert into public.portfolios (
  id, user_id, candidate_id, share_token, draft_data, published_data, is_published
) values (
  '76800000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000002',
  '76500000-0000-4000-8000-000000000001',
  'nak76_public_token_0001',
  pg_temp.complete_portfolio_draft('{"personal":{"name":"Asha Rao","dob":"1995-05-06"},"career":{"title":"Architect","company":"Example Studio","annual_income":"2500000","income_currency":"INR"},"family":{"father":{"name":"Ravi Rao"}},"astrology":{"nakshatra":"Rohini"},"contact":{"phone":"+91 9999999999","email":"family@example.com"}}'::jsonb),
  '{}'::jsonb, false
);
insert into public.portfolio_media (
  id, portfolio_id, candidate_id, media_type, storage_path, visibility, sort_order, metadata
) values (
  '76900000-0000-4000-8000-000000000001',
  '76800000-0000-4000-8000-000000000001',
  '76500000-0000-4000-8000-000000000001', 'hero',
  '76000000-0000-4000-8000-000000000002/76800000-0000-4000-8000-000000000001/hero.webp',
  'public', 0, '{}'
);
insert into public.portfolio_horoscopes (
  id, portfolio_id, storage_path, mime_type, file_extension, byte_size,
  language_label, page_count
) values (
  '76a00000-0000-4000-8000-000000000001',
  '76800000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000002/76800000-0000-4000-8000-000000000001/asha-horoscope.pdf',
  'application/pdf', 'pdf', 1024, 'English', 2
);
select pg_temp.prime_paid_publication(
  '76800000-0000-4000-8000-000000000001',
  pg_temp.complete_portfolio_draft('{"personal":{"name":"Asha Rao","dob":"1995-05-06"},"career":{"title":"Architect","company":"Example Studio","annual_income":"2500000","income_currency":"INR"},"family":{"father":{"name":"Ravi Rao"}},"astrology":{"nakshatra":"Rohini"},"contact":{"phone":"+91 9999999999","email":"family@example.com"}}'::jsonb)
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '76000000-0000-4000-8000-000000000002',
  '76100000-0000-4000-8000-000000000002'
);
select is(
  public.publish_portfolio_transaction(
    '76800000-0000-4000-8000-000000000001',
    pg_temp.complete_portfolio_draft('{"personal":{"name":"Asha Rao","dob":"1995-05-06"},"career":{"title":"Architect","company":"Example Studio","annual_income":"2500000","income_currency":"INR"},"family":{"father":{"name":"Ravi Rao"}},"astrology":{"nakshatra":"Rohini"},"contact":{"phone":"+91 9999999999","email":"family@example.com"}}'::jsonb),
    '{"personal":{"name":"Public Asha"},"career":{"title":"Architect"}}'::jsonb,
    '{"personal":{"name":"Asha Rao","dob":"1995-05-06"},"career":{"title":"Architect","company":"Example Studio","annual_income":"2500000","income_currency":"INR"},"family":{"father":{"name":"Ravi Rao"}},"astrology":{"nakshatra":"Rohini"},"contact":{"phone":"+91 9999999999","email":"family@example.com"}}'::jsonb,
    'nak76_public_token_0001', pg_catalog.now() + interval '90 days', 1, null, null
  ) ->> 'status', 'ok',
  'the fixture passes the real identity, media, payment and disclosure publication gates'
);
reset role;
set constraints capture_portfolio_disclosure_version immediate;

select ok(
  not (select broker_standard_data ? 'contact'
       from app_private.portfolio_disclosure_versions
       where portfolio_id = '76800000-0000-4000-8000-000000000001')
  and (select broker_standard_data #>> '{personal,name}'
       from app_private.portfolio_disclosure_versions
       where portfolio_id = '76800000-0000-4000-8000-000000000001') = 'Asha Rao',
  'publication automatically derives the safe Broker Standard payload'
);

update app_private.portfolio_disclosure_versions
set broker_standard_data = '{"contact":{"email":"tampered@example.test"}}'::jsonb
where portfolio_id = '76800000-0000-4000-8000-000000000001';
select ok(
  not (select broker_standard_data ? 'contact'
       from app_private.portfolio_disclosure_versions
       where portfolio_id = '76800000-0000-4000-8000-000000000001')
  and (select broker_standard_data #>> '{career,company}'
       from app_private.portfolio_disclosure_versions
       where portfolio_id = '76800000-0000-4000-8000-000000000001') = 'Example Studio',
  'direct mutation is overwritten from the canonical Complete data'
);

create temporary table broker_standard_refs as
select organization.workspace_ref, relationship.relationship_ref, version.version_ref
from public.organizations organization
join public.broker_clients relationship on relationship.organization_id = organization.id
join app_private.portfolio_disclosure_versions version
  on version.portfolio_id = '76800000-0000-4000-8000-000000000001'
where organization.id = '76200000-0000-4000-8000-000000000001'
  and relationship.id = '76600000-0000-4000-8000-000000000001';
create temporary table broker_standard_created (data jsonb);
grant select on broker_standard_refs to authenticated;
grant select, insert on broker_standard_created to authenticated;
grant select on broker_standard_created to anon;

set local role authenticated;
select pg_temp.set_authenticated_claims(
  '76000000-0000-4000-8000-000000000001',
  '76100000-0000-4000-8000-000000000001'
);

select is(
  public.prepare_broker_introduction(
    (select workspace_ref from broker_standard_refs),
    (select relationship_ref from broker_standard_refs)
  ) ->> 'available', 'true',
  'an authorized broker can prepare an introduction'
);
select ok(
  not (public.prepare_broker_introduction(
    (select workspace_ref from broker_standard_refs),
    (select relationship_ref from broker_standard_refs)
  ) -> 'completeData' ? 'contact')
  and public.prepare_broker_introduction(
    (select workspace_ref from broker_standard_refs),
    (select relationship_ref from broker_standard_refs)
  ) #>> '{completeData,family,father,name}' = 'Ravi Rao'
  and public.prepare_broker_introduction(
    (select workspace_ref from broker_standard_refs),
    (select relationship_ref from broker_standard_refs)
  ) #> '{completeData,career,annual_income}' is null,
  'preparation returns family detail but no contact or financial data'
);

insert into broker_standard_created(data)
select public.create_broker_introduction(
  (select workspace_ref from broker_standard_refs),
  (select relationship_ref from broker_standard_refs),
  (select version_ref from broker_standard_refs),
  '{"personal":{"name":"Caller-tampered fallback"}}'::jsonb,
  'Recipient family', null, null, repeat('c',64),
  'broker-introduction:nak-76-behavior'
);
select is((select data ->> 'status' from broker_standard_created), 'created',
  'the broker creates one version-pinned introduction');
select ok(
  ((select data ->> 'expiresAt' from broker_standard_created)::timestamptz)
    between pg_catalog.now() + interval '14 days 23 hours'
        and pg_catalog.now() + interval '15 days 1 minute',
  'new broker introductions receive the approved 15-day expiry'
);
select is(
  public.mark_broker_introduction_shared(
    (select workspace_ref from broker_standard_refs),
    (select data ->> 'introductionRef' from broker_standard_created), 1
  ) ->> 'status', 'shared',
  'the introduction enters the shareable state'
);
select is(
  public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), null
  ) ->> 'accessMode', 'detailed',
  'a missing pass resolves only the Detailed fallback'
);
select ok(
  public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), null
  ) #>> '{data,personal,name}' = 'Public Asha'
  and not (public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), null
  ) -> 'data' ? 'contact'),
  'the Detailed fallback comes from the pinned public version, not caller JSON'
);
select is(
  public.claim_broker_introduction_pass(
    (select data ->> 'introductionRef' from broker_standard_created),
    repeat('c',64), repeat('d',64)
  ) ->> 'available', 'true',
  'the recipient can exchange the single-use pass'
);
select is(
  public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), repeat('d',64)
  ) ->> 'accessMode', 'complete',
  'the active pass resolves the rollout-compatible Broker Standard mode'
);
select ok(
  public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), repeat('d',64)
  ) #>> '{data,personal,name}' = 'Asha Rao'
  and public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), repeat('d',64)
  ) #>> '{data,astrology,nakshatra}' = 'Rohini'
  and not (public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), repeat('d',64)
  ) -> 'data' ? 'contact'),
  'the authorized view retains profile detail while contact stays absent'
);
select is(
  public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), repeat('d',64)
  ) #>> '{horoscope,fileExtension}', 'pdf',
  'the authorized Broker Standard view includes the pinned horoscope descriptor'
);

reset role;
update app_private.broker_client_mandates
set revoked_at = pg_catalog.now(), revoked_by = '76000000-0000-4000-8000-000000000001'
where id = '76700000-0000-4000-8000-000000000001';
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(
  public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), repeat('d',64)
  ), '{"available":false}'::jsonb,
  'mandate termination immediately makes an active link unavailable'
);

reset role;
update app_private.broker_client_mandates
set revoked_at = null, revoked_by = null
where id = '76700000-0000-4000-8000-000000000001';
update public.portfolios set is_published = false
where id = '76800000-0000-4000-8000-000000000001';
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(
  public.resolve_broker_introduction(
    (select data ->> 'introductionRef' from broker_standard_created), repeat('d',64)
  ), '{"available":false}'::jsonb,
  'unpublishing immediately makes an active link unavailable'
);

reset role;

select * from finish();
rollback;
