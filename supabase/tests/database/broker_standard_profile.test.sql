begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(25);

select has_column('app_private','portfolio_disclosure_versions','broker_standard_data','publication versions pin a Broker Standard projection');
select ok((select is_nullable='NO' from information_schema.columns where table_schema='app_private' and table_name='portfolio_disclosure_versions' and column_name='broker_standard_data'),'every disclosure version has a Broker Standard projection');
select has_function('app_private','build_broker_standard_profile',array['jsonb'],'the database owns the Broker Standard projection');
select has_function('app_private','broker_standard_profile_has_forbidden_key',array['jsonb'],'the database can enforce the Broker Standard denylist');
select has_trigger('app_private','portfolio_disclosure_versions','derive_broker_standard_profile','new publication versions derive Broker Standard data automatically');
select ok((select pg_catalog.pg_get_triggerdef(oid) from pg_catalog.pg_trigger where tgrelid='app_private.portfolio_disclosure_versions'::regclass and tgname='derive_broker_standard_profile') like '%UPDATE OF complete_data, broker_standard_data%','direct Broker Standard updates are re-derived from Complete data');
select ok((select pg_catalog.pg_get_functiondef('public.resolve_broker_introduction(text,text)'::regprocedure)) like '%relationship_has_active_mandate%' and (select pg_catalog.pg_get_functiondef('public.resolve_broker_introduction(text,text)'::regprocedure)) like '%candidate_is_introduction_ready%','identity-bound resolution fails closed when either participant loses authority or readiness');
select has_trigger('app_private','broker_introductions','derive_broker_introduction_detailed_snapshot','legacy rows still derive bounded historical fallback data');
select has_trigger('app_private','broker_introductions','set_broker_introduction_expiry','new broker introductions use the approved 15-day term');
select ok(not has_function_privilege('anon','app_private.build_broker_standard_profile(jsonb)','execute'),'anonymous callers cannot execute the private projector');
select ok(not has_function_privilege('authenticated','app_private.build_broker_standard_profile(jsonb)','execute'),'authenticated callers cannot execute the private projector');
select ok(not has_function_privilege('authenticated','app_private.pick_jsonb_keys(jsonb,text[])','execute'),'authenticated callers cannot execute the projection allowlist helper');
select ok(not has_function_privilege('authenticated','app_private.broker_standard_profile_has_forbidden_key(jsonb)','execute'),'authenticated callers cannot probe the private safety predicate');

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
$json$::jsonb) data;

select is((select pg_catalog.jsonb_typeof(data) from broker_standard_example),'object','the projection is an object');
select ok(not (select data?'contact' from broker_standard_example),'contact is absent at the top level');
select ok(not (select app_private.broker_standard_profile_has_forbidden_key(data) from broker_standard_example),'no forbidden key survives anywhere in the projection');
select is((select data#>>'{personal,name}' from broker_standard_example),'Asha Rao','the customer name remains visible');
select is((select data#>>'{career,company}' from broker_standard_example),'Example Studio','non-financial professional information remains visible');
select is((select data#>>'{astrology,nakshatra}' from broker_standard_example),'Rohini','astrology remains visible');
select is((select data#>>'{family,father,name}' from broker_standard_example),'Ravi Rao','family information remains visible');
select is((select data#>>'{preferences,narrative}' from broker_standard_example),'Kind partner','non-private preferences remain visible');
select ok((select data#>'{career,annual_income}' is null from broker_standard_example) and (select data#>'{preferences,private_notes}' is null from broker_standard_example) and (select data#>'{lifestyle,credit_score_band}' is null from broker_standard_example),'financial and owner-private questionnaire fields are removed');
select ok((select data#>'{personal,country_code}' is null from broker_standard_example) and (select data#>'{family,current_country_code}' is null from broker_standard_example),'internal geographic reference fields are removed');
select ok((select data#>'{astrology,time_of_birth}' is null from broker_standard_example),'sensitive birth time is excluded from the standard projection');
select ok((select data#>'{preferences,gift_expectations}' is null from broker_standard_example),'sensitive package preference fields are excluded');

select * from finish();
rollback;
