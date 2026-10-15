begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(24);

select pg_temp.create_auth_actor('e6100000-0000-4000-8000-000000000001', 'e6200000-0000-4000-8000-000000000001', 'published-owner@example.test');
select pg_temp.create_auth_actor('e6100000-0000-4000-8000-000000000002', 'e6200000-0000-4000-8000-000000000002', 'published-viewer@example.test');
insert into public.candidates(id, primary_owner_user_id, display_name, created_by)
values ('e6300000-0000-4000-8000-000000000001', 'e6100000-0000-4000-8000-000000000001', 'Test Person', 'e6100000-0000-4000-8000-000000000001');
update app_private.identity_verification_subjects
set status='verified', verified_at=now()-interval '1 day', expires_at=now()+interval '365 days'
where candidate_id='e6300000-0000-4000-8000-000000000001';
insert into public.portfolios(id, user_id, candidate_id, draft_data)
values ('e6400000-0000-4000-8000-000000000001', 'e6100000-0000-4000-8000-000000000001', 'e6300000-0000-4000-8000-000000000001', pg_temp.complete_portfolio_draft());
insert into public.portfolio_media(portfolio_id, candidate_id, media_type, storage_path, visibility)
values ('e6400000-0000-4000-8000-000000000001', 'e6300000-0000-4000-8000-000000000001', 'hero', 'e6100000-0000-4000-8000-000000000001/published/hero.webp', 'public');
insert into storage.buckets(id,name,public) values('photos','photos',false) on conflict(id) do update set public=false;
insert into storage.objects(bucket_id,name) values('photos','e6100000-0000-4000-8000-000000000001/published/hero.webp');
select pg_temp.prime_paid_publication('e6400000-0000-4000-8000-000000000001', pg_temp.complete_portfolio_draft());
set local role authenticated;
select pg_temp.set_authenticated_claims('e6100000-0000-4000-8000-000000000001', 'e6200000-0000-4000-8000-000000000001');
select is(pg_temp.publish_portfolio_as_owner('e6400000-0000-4000-8000-000000000001', pg_temp.complete_portfolio_draft(), '{}'::jsonb, '{}'::jsonb, 'published_snapshot_test', now()+interval '90 days', 1, '#f7f5ef', null)->>'status', 'ok', 'a complete reviewed snapshot publishes');
reset role;
select ok(not has_function_privilege('anon', 'app_private.published_portfolio_complete(uuid)', 'EXECUTE'), 'anonymous clients cannot inspect canonical completeness');
select ok(not has_function_privilege('authenticated', 'app_private.published_portfolio_complete(uuid)', 'EXECUTE'), 'authenticated clients cannot call the private helper');
set local role anon;
select pg_temp.set_anon_claims();
select ok(public.resolve_public_portfolio('published_snapshot_test') is not null, 'complete publication resolves anonymously');
select ok(public.resolve_public_portfolio_identity_verified('published_snapshot_test'), 'complete verified publication has a badge');
select is((select count(*)::integer from storage.objects where name='e6100000-0000-4000-8000-000000000001/published/hero.webp'), 1, 'complete publication allows its public photo');
reset role;

-- Draft edits do not revoke an intact, previously reviewed published snapshot.
update public.portfolios set draft_data = jsonb_set(draft_data, '{personal,address_line_1}', '""')
where id='e6400000-0000-4000-8000-000000000001';
select ok(app_private.pilot_public_portfolio_allowed('published_snapshot_test'), 'incomplete draft does not invalidate the complete published snapshot');
update public.portfolios set draft_data=pg_temp.complete_portfolio_draft()
where id='e6400000-0000-4000-8000-000000000001';

-- Test-only fixture construction: represent historical snapshots that predate
-- mandatory fields. Runtime roles cannot disable triggers or rewrite publication.
create function pg_temp.legacy_published_fixture(p_data jsonb)
returns void language plpgsql as $$
begin
  alter table public.portfolios disable trigger user;
  update public.portfolios set published_data=p_data where id='e6400000-0000-4000-8000-000000000001';
  alter table public.portfolios enable trigger user;
end;
$$;
select pg_temp.legacy_published_fixture(pg_temp.complete_portfolio_draft() #- '{personal,postal_code}');
select ok(not app_private.pilot_public_portfolio_allowed('published_snapshot_test'), 'missing published ZIP blocks an old token even with a complete draft');
select ok((select is_published from public.portfolios where id='e6400000-0000-4000-8000-000000000001'), 'read enforcement does not mutate the published flag');
set local role anon;
select pg_temp.set_anon_claims();
select is(public.resolve_public_portfolio('published_snapshot_test'), null, 'old public URL fails closed');
select ok(not public.resolve_public_portfolio_identity_verified('published_snapshot_test'), 'blocked token does not disclose verification status');
select is(public.resolve_public_portfolio_status('published_snapshot_test'), 'unavailable', 'blocked link is unavailable rather than expired');
select ok(not public.record_public_portfolio_view('published_snapshot_test'), 'blocked token cannot record a public view');
select is((select count(*)::integer from storage.objects where name='e6100000-0000-4000-8000-000000000001/published/hero.webp'), 0, 'old URL cannot bypass through anonymous Storage');
reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims('e6100000-0000-4000-8000-000000000002', 'e6200000-0000-4000-8000-000000000002');
select ok(not public.is_published_portfolio('e6400000-0000-4000-8000-000000000001'), 'approved snapshot and protected media predicate closes');
select is(public.resolve_approved_portfolio('published_snapshot_test'), null, 'approved RPC does not bypass the published gate');
select is(public.resolve_approved_horoscope('published_snapshot_test'), null, 'horoscope RPC does not bypass the published gate');
reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims('e6100000-0000-4000-8000-000000000001', 'e6200000-0000-4000-8000-000000000001');
select is(public.rotate_portfolio_transaction('replacement_token_test')->>'status', 'not_published', 'rotation cannot unlock an incomplete snapshot');
select is(public.renew_portfolio_transaction(now()+interval '90 days')->>'status', 'not_published', 'renewal cannot unlock an incomplete snapshot');
reset role;
select pg_temp.legacy_published_fixture(pg_temp.complete_portfolio_draft() #- '{personal,address_line_1}');
select ok(not app_private.pilot_public_portfolio_allowed('published_snapshot_test'), 'missing private address line 1 blocks the old token');
select pg_temp.legacy_published_fixture(jsonb_set(pg_temp.complete_portfolio_draft(), '{personal,dob}', '"1990-99-99"'));
select ok(not app_private.pilot_public_portfolio_allowed('published_snapshot_test'), 'malformed legacy dates fail closed without raising');
select pg_temp.legacy_published_fixture(pg_temp.complete_portfolio_draft() #- '{personal,address_line_2}');
select ok(app_private.pilot_public_portfolio_allowed('published_snapshot_test'), 'optional address line 2 does not block publication');
update public.portfolio_media set visibility='owner_only' where portfolio_id='e6400000-0000-4000-8000-000000000001';
select ok(not app_private.pilot_public_portfolio_allowed('published_snapshot_test'), 'an owner-only hero cannot keep an old link available');
update public.portfolio_media set visibility='public' where portfolio_id='e6400000-0000-4000-8000-000000000001';
select pg_temp.prime_paid_publication('e6400000-0000-4000-8000-000000000001', pg_temp.complete_portfolio_draft());
set local role authenticated;
select pg_temp.set_authenticated_claims('e6100000-0000-4000-8000-000000000001', 'e6200000-0000-4000-8000-000000000001');
select is(pg_temp.publish_portfolio_as_owner('e6400000-0000-4000-8000-000000000001', pg_temp.complete_portfolio_draft(), '{}'::jsonb, '{}'::jsonb, 'published_snapshot_test', now()+interval '90 days', 1, '#f7f5ef', null)->>'status', 'ok', 'reviewed complete republication restores sharing without changing the token');
reset role;

select * from finish();
rollback;
