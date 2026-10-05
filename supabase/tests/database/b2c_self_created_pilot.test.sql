begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(14);
select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'candidate@self.test');
insert into public.candidates(id, primary_owner_user_id, display_name, created_by)
values ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Candidate', 'a1000000-0000-4000-8000-000000000001');
insert into public.candidate_personal_details(candidate_id, profile_for)
values ('a3000000-0000-4000-8000-000000000001', 'son');
insert into public.portfolios(id, user_id, candidate_id, draft_data, published_data, is_published)
values ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001', '{"personal":{"profile_for":"son"}}', '{}', false);
insert into app_private.b2c_creator_entitlements(email_hash)
values (app_private.normalized_email_hash('candidate@self.test'));

-- Simulate a representative portfolio published before this pilot migration.
-- Only the fixture update bypasses publication triggers; the assertions below
-- exercise the actual current public and Storage authorization predicates.
insert into public.portfolio_media(portfolio_id, candidate_id, media_type, storage_path, visibility)
values ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
  'hero', 'a1000000-0000-4000-8000-000000000001/legacy-hero.webp', 'public');
alter table public.portfolios disable trigger user;
update public.portfolios set is_published = true, share_token = 'legacy_self_pilot_token',
  published_data = '{"personal":{"profile_for":"son"}}'
where id = 'a4000000-0000-4000-8000-000000000001';
alter table public.portfolios enable trigger user;
alter table public.public_portfolio_snapshots disable trigger enforce_public_snapshot_contract;
insert into public.public_portfolio_snapshots(portfolio_id, share_token, data, template_id, is_active)
values ('a4000000-0000-4000-8000-000000000001', 'legacy_self_pilot_token',
  '{"privacy_mode":"public"}', 1, true);
alter table public.public_portfolio_snapshots enable trigger enforce_public_snapshot_contract;
insert into storage.buckets(id, name, public) values ('photos', 'photos', false)
on conflict (id) do update set public = false;
insert into storage.objects(bucket_id, name)
values ('photos', 'a1000000-0000-4000-8000-000000000001/legacy-hero.webp');

select ok(not public.is_published_portfolio('a4000000-0000-4000-8000-000000000001'),
  'legacy representative portfolio is not published for direct approved-data policies');
select ok(not public.is_public_portfolio_media_path('photos',
  'a1000000-0000-4000-8000-000000000001/legacy-hero.webp'),
  'legacy representative photo is denied by the Storage allowlist');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*)::integer from storage.objects
  where bucket_id = 'photos' and name = 'a1000000-0000-4000-8000-000000000001/legacy-hero.webp'),
  0, 'anonymous Storage SELECT cannot read an old representative hero path');
reset role;
select ok(not app_private.pilot_public_portfolio_allowed('legacy_self_pilot_token'),
  'an old representative share token remains suppressed despite its active snapshot');
update public.portfolios set is_published = false
where id = 'a4000000-0000-4000-8000-000000000001';

select ok(not app_private.pilot_self_portfolio_eligible('a4000000-0000-4000-8000-000000000001'), 'representative-owned draft is ineligible');
select ok(not has_function_privilege('authenticated', 'public.create_identity_verification_invitation(uuid,text)', 'EXECUTE'), 'delegated verification invitation cannot be created by clients');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001');
select throws_ok($$select public.publish_portfolio_transaction('a4000000-0000-4000-8000-000000000001',
  '{"personal":{"profile_for":"son"}}', '{}', '{}', 'self_pilot_token_01', null, 1, '#17151c', null)$$,
  '42501', null, 'browser credentials cannot publish through the retired RPC');
select throws_ok($$select * from public.begin_candidate_photo_verification(
  null::uuid, repeat('a',64), repeat('b',64))$$, '42501', null, 'old invitation cannot start verification');
select ok(public.resolve_public_portfolio('self_pilot_token_01') is null, 'unpublished link resolves no portfolio');
select ok(not public.record_public_portfolio_view('self_pilot_token_01'), 'suppressed link cannot record a public view');
select ok(not public.submit_public_interest('self_pilot_token_01', 'Viewer', 'self', '+15555550000',
  'viewer@example.test'), 'suppressed link cannot accept an interest request');

reset role;
update public.candidate_personal_details set profile_for = 'self'
where candidate_id = 'a3000000-0000-4000-8000-000000000001';
update public.portfolios set draft_data = '{"personal":{"profile_for":"self"}}'
where id = 'a4000000-0000-4000-8000-000000000001';
select ok(app_private.pilot_self_portfolio_eligible('a4000000-0000-4000-8000-000000000001'), 'self-owned draft is eligible');
select pg_temp.prime_paid_publication(
  'a4000000-0000-4000-8000-000000000001',
  pg_temp.complete_portfolio_draft()
);
select throws_ok($$update public.portfolios set is_published = true,
  published_data = '{"personal":{"profile_for":"son"}}'
  where id = 'a4000000-0000-4000-8000-000000000001'$$,
  '23514', 'publication_self_portfolio_required', 'direct table update cannot publish representative profile');
select ok(not app_private.pilot_public_portfolio_allowed('self_pilot_token_01'), 'public access remains closed');

select * from finish();
rollback;
