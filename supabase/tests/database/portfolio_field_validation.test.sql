begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(15);

select ok((select bool_and(app_private.portfolio_valid_person_name(name))
  from (values ('ಅನನ್ಯ'), ('अनन्या'), ('தமிழ்'), ('José'), (U&'Jose\0301'), ('O’Neil'), ('Anne-Marie')) names(name)),
  'Unicode letters and combining marks are accepted in person names');
select ok((select bool_and(not app_private.portfolio_valid_person_name(name))
  from (values ('12345'), ('१२३'), ('Parent2'), ('नाम३'), ('---'), ('💐'), ('<script>'), (E'Ana\nMarie'), (null)) names(name)),
  'names reject digits, punctuation-only answers, controls and symbols');
select ok(app_private.portfolio_text_has_letter('3D artist') and app_private.portfolio_text_has_letter('Sector 7'),
  'valid mixed descriptive text remains supported');
select ok(not app_private.portfolio_text_has_letter('१२३') and not app_private.portfolio_text_has_letter('12345')
  and not app_private.portfolio_text_has_letter('💐'), 'numeric-only and symbol-only text does not count as descriptive');
select is(app_private.reserve_portfolio_share_path('{"personal":{"first_name":"Field-Validation","last_name":"Fixture"}}'),
  'field-validation-fixture', 'ASCII names retain the readable-path format');
select ok(app_private.reserve_portfolio_share_path('{"personal":{"first_name":"ಅನನ್ಯ","last_name":"ರಾವ್"}}')
  ~ '^vivara-[0-9a-f]{32}$', 'Unicode names get an ASCII path supported by current resolvers');
select isnt(app_private.reserve_portfolio_share_path('{"personal":{"first_name":"ಅನನ್ಯ","last_name":"ರಾವ್"}}'),
  app_private.reserve_portfolio_share_path('{"personal":{"first_name":"ಅನನ್ಯ","last_name":"ರಾವ್"}}'),
  'separate Unicode allocations never reuse a path');
select throws_ok($$select app_private.reserve_portfolio_share_path('{"personal":{"first_name":"Name2","last_name":"Rao"}}')$$,
  '22023', 'invalid portfolio link name', 'allocation cannot bypass person-name validation');

select ok(not ('first_name' = any(app_private.portfolio_missing_required_details(null,
  pg_temp.complete_portfolio_draft('{"personal":{"first_name":"ಅನನ್ಯ"}}')))), 'publication accepts a Unicode first name');
select ok('career_title' = any(app_private.portfolio_missing_required_details(null,
  pg_temp.complete_portfolio_draft('{"career":{"title":"12345"}}'))), 'publication rejects a numeric-only profession');
select ok('introduction' = any(app_private.portfolio_missing_required_details(null,
  pg_temp.complete_portfolio_draft('{"personal":{"short_bio":"१२३"}}'))), 'publication rejects a numeric-only description');
select ok('structured_location' = any(app_private.portfolio_missing_required_details(null,
  pg_temp.complete_portfolio_draft('{"personal":{"city":"12345","current_location":"12345, Massachusetts, United States"}}'))),
  'publication rejects a numeric-only manual city');
select ok(array['family.father.name','family.mother.name','family.siblings.0.name','contact.contact_person','contact.contacts.0.name']::text[]
  <@ app_private.portfolio_missing_required_details(null, pg_temp.complete_portfolio_draft('{
    "family":{"father":{"name":"12345"},"mother":{"name":"Parent2"},"siblings":[{"name":"१२३"}]},
    "contact":{"contact_person":"12345","contacts":[{"name":"12345"}]}
  }')), 'all optional person-name paths have the same database guard');
select ok(not has_function_privilege('authenticated', 'app_private.portfolio_valid_person_name(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'app_private.portfolio_text_has_letter(text)', 'EXECUTE'),
  'validation helpers expose no new client RPC capability');

-- The invoker wrapper checks the real runtime role without private-state inspection.
create function pg_temp.try_reserve_validation_path()
returns text language sql security invoker as $$
  select app_private.reserve_portfolio_share_path('{"personal":{"first_name":"Test","last_name":"Owner"}}');
$$;
set local role authenticated;
select throws_ok($$select pg_temp.try_reserve_validation_path()$$,
  '42501', null, 'runtime authenticated role still cannot allocate a share path');
reset role;
select * from finish();
rollback;
