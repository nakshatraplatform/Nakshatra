begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(26);

select pg_temp.create_auth_actor(
  'd1000000-0000-4000-8000-000000000001',
  'd1100000-0000-4000-8000-000000000001','guest-owner@fixture.test');
select pg_temp.create_auth_actor(
  'd1000000-0000-4000-8000-000000000002',
  'd1100000-0000-4000-8000-000000000002','legacy-viewer@fixture.test');
insert into app_private.b2c_creator_entitlements(email_hash)
values(app_private.normalized_email_hash('guest-owner@fixture.test'));
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values('d2000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001','Guest Owner',
  'd1000000-0000-4000-8000-000000000001');
update app_private.identity_verification_subjects
  set status='verified',verified_at=now(),expires_at=now()+interval '365 days'
  where candidate_id='d2000000-0000-4000-8000-000000000001';
insert into public.portfolios(
  id,user_id,candidate_id,share_token,draft_data,is_published,expires_at
) values(
  'd3000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'guest_owner_fixture_01',pg_temp.complete_portfolio_draft(),false,
  now()+interval '30 days');
insert into public.portfolio_media(
  id,portfolio_id,candidate_id,media_type,storage_path,visibility,sort_order
) values(
  'd4000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'hero',
  'd1000000-0000-4000-8000-000000000001/d3000000-0000-4000-8000-000000000001/hero.webp',
  'public',0);
select pg_temp.prime_paid_publication(
  'd3000000-0000-4000-8000-000000000001',
  pg_temp.complete_portfolio_draft());
update public.portfolios set is_published=true,published_data=draft_data
  where id='d3000000-0000-4000-8000-000000000001';
insert into public.approved_portfolio_snapshots(portfolio_id,data,template_id,published_at)
values('d3000000-0000-4000-8000-000000000001',
  '{"personal":{"name":"Guest Owner","dob":"1990-01-01","gender":"female"},
    "contact":{"contact_person":"Chosen contact","email":"chosen@fixture.test"}}'::jsonb,3,now());

insert into public.interest_requests(
  id,portfolio_id,requester_user_id,viewer_name,viewer_email,viewer_phone,
  email_verified_at,verification_channel,status
) values(
  'd5000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  'Legacy Viewer','legacy-viewer@fixture.test','+1 617 555 0123',
  now(),'email','approved');
insert into public.reveal_grants(
  interest_request_id,portfolio_id,viewer_user_id,access_level,
  granted_sections,granted_by,expires_at
) values(
  'd5000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002','full',
  array['full']::text[],
  'd1000000-0000-4000-8000-000000000001',now()+interval '5 days');

create function pg_temp.guest_input() returns jsonb language sql as $$
  select jsonb_build_object(
    'portfolioToken','guest_owner_fixture_01','name','Mira Rao',
    'profileFor','self','phone','+1 617 555 0199',
    'email','new-guest@fixture.test',
    'familyContext','Our family values kindness, honesty and mutual respect.',
    'message','I enjoyed your introduction and would like to learn more about your family, interests and plans for the future.',
    'country','United States','countryCode','US',
    'state','Massachusetts','subdivisionCode','US-MA',
    'city','Boston','postalCode','02108','locationSource','manual',
    'location',jsonb_build_object('country','United States','countryCode','US',
      'state','Massachusetts','subdivisionCode','US-MA','city','Boston',
      'postalCode','02108','locationSource','manual'));
$$;

select ok(not has_function_privilege('anon',
  'public.begin_guest_interest_verification(jsonb,text,text,text)','EXECUTE'),
  'anonymous clients cannot start a service-only challenge');
select ok(not has_function_privilege('authenticated',
  'public.complete_guest_interest_verification(uuid,text,text)','EXECUTE'),
  'signed-in clients cannot complete a guest challenge directly');
select ok(not has_function_privilege('anon',
  'public.decide_interest_contact_reviewed(uuid,text)','EXECUTE'),
  'anonymous clients cannot approve contacts');
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select public.begin_guest_interest_verification(
  pg_temp.guest_input(),repeat('a',64),repeat('b',64),repeat('c',64)) as challenge_id \gset
select ok(:'challenge_id'::uuid is not null,'service can start a guest challenge');
select is(public.complete_guest_interest_verification(
  :'challenge_id'::uuid,repeat('d',64),repeat('c',64)),
  'invalid_code','incorrect code is rejected');
select is(public.complete_guest_interest_verification(
  :'challenge_id'::uuid,repeat('a',64),repeat('c',64)),
  'submitted','correct code atomically submits the interest');
select is(public.complete_guest_interest_verification(
  :'challenge_id'::uuid,repeat('a',64),repeat('c',64)),
  'expired','consumed code cannot replay');
reset role;
select is((select count(*)::integer from public.interest_requests
  where viewer_email='new-guest@fixture.test'),1,'one guest request exists');
select is((select requester_user_id from public.interest_requests
  where viewer_email='new-guest@fixture.test'),null::uuid,
  'guest interest has no Auth user');
select is((select count(*)::integer from auth.users
  where email='new-guest@fixture.test'),0,'verification created no Auth account');
select is((select count(*)::integer from app_private.guest_interest_mail_outbox
  where kind='receipt'),1,'guest receipt queued with submission');
select is((select count(*)::integer from public.reveal_grants
  where revoked_at is null),1,'legacy grant remains active');

set local role authenticated;
select pg_temp.set_authenticated_claims(
  'd1000000-0000-4000-8000-000000000001',
  'd1100000-0000-4000-8000-000000000001');
select is(public.decide_interest_request(
  (select id from public.interest_requests
    where viewer_email='new-guest@fixture.test'),'approved'),
  'signin_required','old approval command cannot grant a guest');
select is(public.decide_interest_contact_reviewed(
  (select id from public.interest_requests
    where viewer_email='new-guest@fixture.test'),repeat('0',32)),
  'review_changed','stale published review cannot share contacts');
select is(public.decide_interest_contact_reviewed(
  (select id from public.interest_requests
    where viewer_email='new-guest@fixture.test'),
  public.get_owner_relationship_page()#>>'{disclosure,revision}'),
  'approved','current published review approves contacts');
reset role;
select is((select count(*)::integer from public.reveal_grants),1,
  'contact approval creates no new private-detail grant');
select is((select contact_payload->>'email'
  from app_private.guest_interest_mail_outbox
  where kind='approved_contact'),'chosen@fixture.test',
  'queued email contains only the published chosen contact');
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select is((select count(*)::integer from public.claim_guest_interest_mail(10)),2,
  'worker claims receipt and contact email');
select ok((select bool_and(public.guest_interest_mail_is_current(id,lease_token))
  from app_private.guest_interest_mail_outbox
  where status='processing'),'claimed messages are current');
select public.begin_guest_interest_verification(
  pg_temp.guest_input(),repeat('e',64),repeat('b',64),repeat('c',64)) as retry_challenge_id \gset
select ok(:'retry_challenge_id'::uuid is not null,
  'another visitor challenge can begin on a shared network');
select public.begin_guest_interest_verification(
  pg_temp.guest_input(),repeat('f',64),repeat('b',64),repeat('c',64)) as latest_challenge_id \gset
select is(public.complete_guest_interest_verification(
  :'retry_challenge_id'::uuid,repeat('e',64),repeat('c',64)),
  'expired','new code invalidates the previous code for this address and link');
select ok(:'latest_challenge_id'::uuid is not null,
  'latest challenge remains available after replacement');
select set_config('app.test_retry_challenge', :'latest_challenge_id', true);
do $$ begin
  for i in 1..4 loop
    perform public.complete_guest_interest_verification(
      current_setting('app.test_retry_challenge')::uuid,repeat('d',64),repeat('c',64));
  end loop;
end $$;
select is(public.complete_guest_interest_verification(
  :'latest_challenge_id'::uuid,repeat('d',64),repeat('c',64)),
  'invalid_code','fifth wrong code consumes the final challenge attempt');
select is(public.complete_guest_interest_verification(
  :'latest_challenge_id'::uuid,repeat('f',64),repeat('c',64)),
  'expired','correct code cannot pass after five wrong attempts');
reset role;
update public.interest_requests set status='rejected'
  where viewer_email='new-guest@fixture.test';
select is((select status from app_private.guest_interest_mail_outbox
  where kind='approved_contact'),'suppressed',
  'closing a decision suppresses even an already claimed contact email');
select is((select contact_payload from app_private.guest_interest_mail_outbox
  where kind='approved_contact'),'{}'::jsonb,
  'suppressed contact email no longer retains chosen private contacts');
select * from finish();
rollback;
