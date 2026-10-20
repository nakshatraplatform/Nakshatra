begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(31);

select ok(not has_table_privilege('anon', 'app_private.portfolio_share_path_reservations', 'SELECT'), 'issued paths are not exposed to anonymous users');
select ok(not has_table_privilege('authenticated', 'app_private.portfolio_share_path_reservations', 'SELECT'), 'issued paths are not exposed to signed-in users');
select ok(not has_function_privilege('authenticated', 'app_private.reserve_portfolio_share_path(jsonb)', 'EXECUTE'), 'clients cannot reserve arbitrary names');
select ok(not has_function_privilege('service_role', 'app_private.reserve_portfolio_share_path(jsonb)', 'EXECUTE'), 'service clients must use guarded publication');
select is(app_private.reserve_portfolio_share_path('{"personal":{"first_name":" Aditi ","last_name":"Sharma"}}'), 'aditi-sharma', 'canonical first and last name');
select is(app_private.reserve_portfolio_share_path('{"personal":{"first_name":"ADITI","middle_name":"Private","last_name":"SHARMA"}}'), 'aditi-sharma-2', 'same normalized name receives a number and excludes middle name');
select is(app_private.reserve_portfolio_share_path('{"personal":{"first_name":"Anne--Marie","last_name":"O''Brien"}}'), 'anne-marie-obrien', 'punctuation and repeated hyphens normalize');
select is(app_private.reserve_portfolio_share_path('{"personal":{"name":"Aditi Middle Rao"}}'), 'aditi-rao', 'legacy full-name fallback uses first and last words');
select is(app_private.reserve_portfolio_share_path('{"personal":{"first_name":"A","last_name":"B"}}'), 'a-b', 'one-letter names are supported');
select throws_ok($$select app_private.reserve_portfolio_share_path('{"personal":{"first_name":"---","last_name":"Sharma"}}')$$, '22023', 'invalid portfolio link name', 'empty normalized names fail closed');
select throws_ok($$select app_private.reserve_portfolio_share_path('{"personal":{"first_name":"Aditi","last_name":"../../etc"}}')$$, '22023', 'invalid portfolio link name', 'path injection is rejected');
select throws_ok($$select app_private.reserve_portfolio_share_path('{}')$$, '22023', 'invalid portfolio link name', 'missing identity does not generate a generic slug');

create function pg_temp.readable_owner(p_index integer, p_first text, p_last text)
returns uuid language plpgsql as $$
declare
  owner_id uuid := ('87010000-0000-4000-8000-' || lpad(p_index::text,12,'0'))::uuid;
  session_id uuid := ('87020000-0000-4000-8000-' || lpad(p_index::text,12,'0'))::uuid;
  candidate_key uuid := ('87030000-0000-4000-8000-' || lpad(p_index::text,12,'0'))::uuid;
  portfolio_id uuid := ('87040000-0000-4000-8000-' || lpad(p_index::text,12,'0'))::uuid;
  draft jsonb := pg_temp.complete_portfolio_draft(jsonb_build_object('personal',jsonb_build_object('first_name',p_first,'last_name',p_last,'name',p_first||' '||p_last)));
begin
  perform pg_temp.create_auth_actor(owner_id, session_id, 'readable-'||p_index||'@example.test');
  insert into public.candidates(id,primary_owner_user_id,display_name,created_by) values(candidate_key,owner_id,p_first||' '||p_last,owner_id);
  update app_private.identity_verification_subjects set status='verified',verified_at=now(),expires_at=now()+interval '365 days' where identity_verification_subjects.candidate_id=candidate_key;
  insert into public.portfolios(id,user_id,candidate_id,draft_data) values(portfolio_id,owner_id,candidate_key,draft);
  insert into public.portfolio_media(portfolio_id,candidate_id,media_type,storage_path,visibility) values(portfolio_id,candidate_key,'hero',owner_id::text||'/readable/hero.webp','public');
  perform pg_temp.prime_paid_publication(portfolio_id,draft);
  return portfolio_id;
end;
$$;
select pg_temp.readable_owner(1,'Li','Xu');
select pg_temp.readable_owner(2,'Li','Xu');
select pg_temp.readable_owner(3,'Li','Xu');
select pg_temp.readable_owner(4,'Legacy','Owner');
-- Pre-existing opaque path: migration and ordinary publication preserve it.
update public.portfolios set share_token='legacy_opaque_path_001' where id='87040000-0000-4000-8000-000000000004';

set local role authenticated;
select pg_temp.set_authenticated_claims('87010000-0000-4000-8000-000000000001','87020000-0000-4000-8000-000000000001');
select is(pg_temp.publish_portfolio_as_owner('87040000-0000-4000-8000-000000000001', pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Li","last_name":"Xu","name":"Li Xu"}}'), '{"personal":{"name":"Li Xu"}}', '{}', null, null, 1, '#f7f5ef', null)->>'shareToken', 'li-xu', 'first publication returns a database-owned short name');
reset role;
select is((select share_token from public.public_portfolio_snapshots where portfolio_id='87040000-0000-4000-8000-000000000001'), 'li-xu', 'public snapshot and owner record agree');
set local role anon;
select pg_temp.set_anon_claims();
select ok(public.resolve_public_portfolio('li-xu') is not null, 'short named link resolves through the real anonymous RPC');
select ok(public.resolve_public_portfolio_identity_verified('li-xu'), 'short named link retains its liveness status');
select is(public.resolve_public_portfolio_status('li-xu'), 'unavailable', 'status RPC retains its expired-or-unavailable contract for active named paths');
select throws_ok($$select public.resolve_approved_portfolio('li-xu')$$,'42501',null,'named URLs do not grant anonymous Complete access');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('87010000-0000-4000-8000-000000000002','87020000-0000-4000-8000-000000000002');
select is(pg_temp.publish_portfolio_as_owner('87040000-0000-4000-8000-000000000002', pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Li","last_name":"Xu","name":"Li Xu"}}'), '{"personal":{"name":"Li Xu"}}', '{}', null, null, 1, '#f7f5ef', null)->>'shareToken', 'li-xu-2', 'a different person with the same name gets a numbered path');
select ok(public.submit_existing_interest('li-xu', 'Our family values kindness, honesty, and a thoughtful introduction.', null,
  '{"country":"United States","state":"Massachusetts","city":"Boston","countryCode":"US","subdivisionCode":"US-MA","postalCode":"02108","locationSource":"manual"}'), 'a verified existing viewer can request access through a short named path');
reset role;
-- Saving a reviewed name edit must not change an already shared URL.
update public.portfolios set draft_data=pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Renamed","last_name":"Person","name":"Renamed Person"}}') where id='87040000-0000-4000-8000-000000000002';
select pg_temp.prime_paid_publication('87040000-0000-4000-8000-000000000002', pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Renamed","last_name":"Person","name":"Renamed Person"}}'));
set local role authenticated;
select pg_temp.set_authenticated_claims('87010000-0000-4000-8000-000000000002','87020000-0000-4000-8000-000000000002');
select is(pg_temp.publish_portfolio_as_owner('87040000-0000-4000-8000-000000000002', pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Renamed","last_name":"Person","name":"Renamed Person"}}'), '{"personal":{"name":"Renamed Person"}}', '{}', null, null, 1, '#f7f5ef', null)->>'shareToken', 'li-xu-2', 'reviewed name edits and republication keep the existing named link stable');
reset role;

-- Link replacement reads the published names, not an unreviewed draft change.
update public.portfolios set draft_data=jsonb_set(draft_data,'{personal,first_name}','"Unreviewed"') where id='87040000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('87010000-0000-4000-8000-000000000001','87020000-0000-4000-8000-000000000001');
select throws_ok($$update public.portfolios set share_token='li-xu-2' where id='87040000-0000-4000-8000-000000000001'$$, '42501', 'use the portfolio link lifecycle command', 'owners cannot bypass path allocation with direct table writes');
select is(public.rotate_portfolio_transaction('caller-cannot-choose')->>'shareToken', 'li-xu-3', 'replacement uses published names and permanently reserves the previous path');
select is(public.resolve_public_portfolio('li-xu'), null, 'the old named link immediately stops resolving');
select is(public.resolve_approved_portfolio('li-xu-3')->>'accessMode', null, 'a link alone does not grant approved access');
reset role;
select is((select share_token from public.public_portfolio_snapshots where portfolio_id='87040000-0000-4000-8000-000000000001'), 'li-xu-3', 'replacement updates the snapshot atomically');
select ok(exists(select 1 from app_private.portfolio_share_path_reservations where path_hash=extensions.digest('li-xu','sha256')), 'retired path remains reserved');
-- Deletion does not release the path to a future account with the same name.
select pg_temp.readable_owner(5,'Deleted','Person');
update public.portfolios set share_token=app_private.reserve_portfolio_share_path(draft_data) where id='87040000-0000-4000-8000-000000000005';
delete from public.portfolios where id='87040000-0000-4000-8000-000000000005';
select is(app_private.reserve_portfolio_share_path('{"personal":{"first_name":"Deleted","last_name":"Person"}}'), 'deleted-person-2', 'deleting a portfolio does not delete its issued-path reservation');
set local role authenticated;
select pg_temp.set_authenticated_claims('87010000-0000-4000-8000-000000000003','87020000-0000-4000-8000-000000000003');
select is(pg_temp.publish_portfolio_as_owner('87040000-0000-4000-8000-000000000003', pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Li","last_name":"Xu","name":"Li Xu"}}'), '{"personal":{"name":"Li Xu"}}', '{}', null, null, 1, '#f7f5ef', null)->>'shareToken', 'li-xu-4', 'previously issued paths are never recycled');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('87010000-0000-4000-8000-000000000004','87020000-0000-4000-8000-000000000004');
select is(pg_temp.publish_portfolio_as_owner('87040000-0000-4000-8000-000000000004', pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Legacy","last_name":"Owner","name":"Legacy Owner"}}'), '{"personal":{"name":"Legacy Owner"}}', '{}', null, null, 1, '#f7f5ef', null)->>'shareToken', 'legacy_opaque_path_001', 'ordinary republication preserves an existing opaque link');
select is(public.rotate_portfolio_transaction('')->>'shareToken', 'legacy-owner', 'explicit replacement upgrades an existing opaque URL');
reset role;
select * from finish();
rollback;
