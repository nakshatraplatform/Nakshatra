begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(23);
select pg_temp.create_auth_actor('b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'rahulgollapalliranganatha@gmail.com');
select pg_temp.create_auth_actor('b1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'another@example.test');
insert into app_private.b2c_creator_entitlements(email_hash)
values (app_private.normalized_email_hash('rahulgollapalliranganatha@gmail.com'));
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values ('b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Rahul Test','b1000000-0000-4000-8000-000000000001');
insert into public.candidate_personal_details(candidate_id,profile_for)
values ('b3000000-0000-4000-8000-000000000001','self');
insert into public.portfolios(id,user_id,candidate_id,draft_data,is_published)
values ('b4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft(),false);
insert into public.portfolio_media(portfolio_id,candidate_id,media_type,storage_path,visibility)
values ('b4000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',
  'hero','b1000000-0000-4000-8000-000000000001/hero.webp','public');
insert into storage.buckets(id,name,public) values ('photos','photos',false)
on conflict(id) do update set public=false;
insert into storage.objects(bucket_id,name)
values ('photos','b1000000-0000-4000-8000-000000000001/hero.webp');

select has_table('app_private','pilot_test_publication_exemptions','exemption grant is private and durable');
select ok(not has_table_privilege('authenticated','app_private.pilot_test_publication_exemptions','INSERT'),
  'browser roles cannot grant themselves test publishing access');
select ok(not app_private.pilot_test_publication_exempt('b3000000-0000-4000-8000-000000000001'),
  'exact account is denied without an explicit grant');
insert into app_private.pilot_test_publication_exemptions(user_id)
values ('b1000000-0000-4000-8000-000000000002');
select ok(not app_private.pilot_test_publication_exempt('b3000000-0000-4000-8000-000000000001'),
  'a grant to a different account cannot unlock Rahul');
insert into app_private.pilot_test_publication_exemptions(user_id)
values ('b1000000-0000-4000-8000-000000000001');
select ok(app_private.pilot_test_publication_exempt('b3000000-0000-4000-8000-000000000001'),
  'the exact confirmed, self-owned Rahul account may use the grant');
update auth.users set email='renamed@example.test' where id='b1000000-0000-4000-8000-000000000001';
select ok(not app_private.pilot_test_publication_exempt('b3000000-0000-4000-8000-000000000001'),
  'changing the account email invalidates the named exception');
update auth.users set email='rahulgollapalliranganatha@gmail.com', email_confirmed_at=null
where id='b1000000-0000-4000-8000-000000000001';
select ok(not app_private.pilot_test_publication_exempt('b3000000-0000-4000-8000-000000000001'),
  'an unconfirmed matching email cannot use the exception');
update auth.users set email_confirmed_at=pg_catalog.now()
where id='b1000000-0000-4000-8000-000000000001';
select ok(not exists(select 1 from app_private.current_identity_verification('b3000000-0000-4000-8000-000000000001')),
  'test publishing never creates a Didit proof');
select ok(not app_private.pilot_test_publication_exempt('00000000-0000-4000-8000-000000000001'),
  'an unrelated candidate cannot reuse the grant');

set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001');
select is(public.get_portfolio_publication_readiness() ->> 'verificationStatus','test_exempt',
  'the owner sees a distinct test status rather than verified');
select is(public.update_portfolio_onboarding_progress('confirm_disclosure','publication-disclosure-v2') ->> 'status','ok',
  'the owner can confirm the exact draft disclosure');
select is(pg_temp.publish_portfolio_as_owner('b4000000-0000-4000-8000-000000000001',
  pg_temp.complete_portfolio_draft(),'{}'::jsonb,'{}'::jsonb,repeat('r',21),null,1,'#f7f5ef',null) ->> 'status','ok',
  'the server-owned transaction publishes the exempt self-portfolio');
reset role;

select ok(app_private.pilot_public_portfolio_allowed(repeat('r',21)),
  'the personal public link is available during the grant');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select ok(public.resolve_public_portfolio(repeat('r',21)) is not null,
  'anonymous portfolio resolution works during the grant');
select ok(not public.resolve_public_portfolio_identity_verified(repeat('r',21)),
  'the public viewer does not show a verified-identity claim');
select is((select count(*)::integer from storage.objects
  where bucket_id='photos' and name='b1000000-0000-4000-8000-000000000001/hero.webp'),1,
  'anonymous Storage can read the published test hero photo');
reset role;
select ok(not app_private.candidate_is_introduction_ready('b3000000-0000-4000-8000-000000000001'),
  'a published test portfolio remains ineligible for BrokerDesk Introductions');
select is((select identity_verification_badge from public.public_portfolio_snapshots
  where portfolio_id='b4000000-0000-4000-8000-000000000001'),null,
  'the snapshot does not receive a verified badge');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002');
select ok(public.is_published_portfolio('b4000000-0000-4000-8000-000000000001'),
  'the authenticated approved-data predicate recognizes the active test publication');
reset role;
update app_private.pilot_test_publication_exemptions set revoked_at=pg_catalog.now()
where user_id='b1000000-0000-4000-8000-000000000001';
select ok(not app_private.pilot_public_portfolio_allowed(repeat('r',21)),
  'revocation immediately closes the share token');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select ok(public.resolve_public_portfolio(repeat('r',21)) is null,
  'revocation also closes anonymous resolution');
select is((select count(*)::integer from storage.objects
  where bucket_id='photos' and name='b1000000-0000-4000-8000-000000000001/hero.webp'),0,
  'revocation closes anonymous Storage reads');
reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002');
select ok(not public.is_published_portfolio('b4000000-0000-4000-8000-000000000001'),
  'revocation closes approved-snapshot and media publication predicates');
reset role;

select * from finish();
rollback;
