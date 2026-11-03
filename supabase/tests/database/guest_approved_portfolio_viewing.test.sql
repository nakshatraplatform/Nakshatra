begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(44);
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
insert into public.candidate_personal_details(candidate_id,profile_for)
values('d2000000-0000-4000-8000-000000000001','self');
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
insert into public.public_portfolio_snapshots(
  portfolio_id,share_token,data,template_id,expires_at,is_active
) values(
  'd3000000-0000-4000-8000-000000000001',
  'guest_owner_fixture_01',
  '{"privacy_mode":"balanced","personal":{"name":"Guest Owner","age":36,"marital_status":"Never Married"}}'::jsonb,
  3,now()+interval '30 days',true);
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


select ok(not has_function_privilege('anon','public.resolve_guest_approved_portfolio(text,text,boolean)','EXECUTE'),'public clients cannot resolve guest private data');
select ok(not has_function_privilege('authenticated','public.complete_guest_interest_and_remember(uuid,text,text,text)','EXECUTE'),'signed-in clients cannot mint guest proofs');
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
create temp table remembered_challenge as select public.begin_guest_interest_verification(pg_temp.guest_input(),repeat('a',64),repeat('b',64),repeat('c',64)) id;
select is(public.complete_guest_interest_and_remember((select id from remembered_challenge),repeat('d',64),repeat('c',64),repeat('1',64))->>'status','invalid_code','wrong code creates no viewing proof');
select is(public.complete_guest_interest_and_remember((select id from remembered_challenge),repeat('a',64),repeat('c',64),repeat('1',64))->>'status','submitted','valid code submits and remembers the verified browser atomically');
select is(public.complete_guest_interest_and_remember((select id from remembered_challenge),repeat('a',64),repeat('c',64),repeat('2',64))->>'status','expired','consumed code cannot mint another proof');
select is(public.resolve_guest_approved_portfolio('guest_owner_fixture_01',repeat('1',64)),null::jsonb,'verification alone grants no private access');
reset role;
select is((select count(*)::integer from auth.users where email='new-guest@fixture.test'),0,'remembered viewing creates no Auth user');
select is((select count(*)::integer from app_private.guest_portfolio_proofs),1,'only successful verification created a proof');
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.decide_interest_portfolio_reviewed('d5000000-0000-4000-8000-000000000001',public.get_owner_relationship_page()#>>'{disclosure,revision}'),'already_approved','active legacy Auth grant is not duplicated or converted');
reset role;
update public.reveal_grants set created_at=now()-interval '10 days',expires_at=now()-interval '1 day' where interest_request_id='d5000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.decide_interest_portfolio_reviewed('d5000000-0000-4000-8000-000000000001',public.get_owner_relationship_page()#>>'{disclosure,revision}'),'invalid_transition','expired unrevoked legacy grant cannot cause a duplicate-key failure or renewal');
reset role;
update public.reveal_grants set created_at=now(),expires_at=now()+interval '5 days' where interest_request_id='d5000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.decide_interest_portfolio_reviewed((select id from public.interest_requests where viewer_email='new-guest@fixture.test'),repeat('0',32)),'review_changed','stale review cannot create viewing access');
select is(public.decide_interest_portfolio_reviewed((select id from public.interest_requests where viewer_email='new-guest@fixture.test'),public.get_owner_relationship_page()#>>'{disclosure,revision}'),'approved','reviewed owner approval grants portfolio viewing');
select is(public.decide_interest_portfolio_reviewed((select id from public.interest_requests where viewer_email='new-guest@fixture.test'),public.get_owner_relationship_page()#>>'{disclosure,revision}'),'already_approved','approval retry does not create another grant');
reset role;
select is((select count(*)::integer from public.reveal_grants),2,'one new grant and the original legacy grant exist');
select is((select count(*)::integer from app_private.guest_interest_mail_outbox where kind='approved_access'),1,'approval queues exactly one access-link email');
select ok(not exists(select 1 from app_private.guest_interest_mail_outbox where kind='approved_access' and contact_payload ? 'email'),'approval email stores no private contact values');
select ok((select bool_and(g.expires_at=g.created_at+interval '15 days') from public.reveal_grants g join app_private.guest_portfolio_grant_recipients b on b.grant_id=g.id),'new grant has exactly fifteen days from approval');
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select is(public.resolve_guest_approved_portfolio('guest_owner_fixture_01',repeat('1',64))#>>'{data,personal,dob}','1990-01-01','approved verified browser receives the approved private snapshot');
select is(public.resolve_guest_approved_portfolio('guest_owner_fixture_01',repeat('9',64)),null::jsonb,'unknown browser proof cannot open private data');
select is(public.resolve_guest_approved_portfolio('different_portfolio_link',repeat('1',64)),null::jsonb,'proof cannot transfer to another portfolio');
create temp table viewing_challenge as select public.begin_guest_portfolio_access_verification('guest_owner_fixture_01','new-guest@fixture.test',repeat('f',64),repeat('b',64),repeat('c',64)) data;
select is((select data->>'eligible' from viewing_challenge),'true','approved email can verify a new browser');
select is(public.complete_guest_portfolio_access_verification((select (data->>'challengeId')::uuid from viewing_challenge),repeat('f',64),repeat('3',64))->>'status','verified','new browser can verify approved email without login');
select is(public.complete_guest_portfolio_access_verification((select (data->>'challengeId')::uuid from viewing_challenge),repeat('f',64),repeat('4',64))->>'status','expired','access verification is one-use');
select ok(public.resolve_guest_approved_portfolio('guest_owner_fixture_01',repeat('3',64)) is not null,'verified new browser can read its approved portfolio');
create temp table exhausted_challenge as select public.begin_guest_portfolio_access_verification('guest_owner_fixture_01','new-guest@fixture.test',repeat('e',64),repeat('4',64),repeat('5',64)) data;
do $$ begin for attempt in 1..5 loop
  perform public.complete_guest_portfolio_access_verification((select (data->>'challengeId')::uuid from exhausted_challenge),repeat('0',64),repeat('7',64));
end loop; end $$;
select is(public.complete_guest_portfolio_access_verification((select (data->>'challengeId')::uuid from exhausted_challenge),repeat('e',64),repeat('7',64))->>'status','expired','five wrong codes lock the challenge even with the right code later');
create temp table replaced_challenge as select public.begin_guest_portfolio_access_verification('guest_owner_fixture_01','new-guest@fixture.test',repeat('e',64),repeat('6',64),repeat('7',64)) data;
create temp table replacement_challenge as select public.begin_guest_portfolio_access_verification('guest_owner_fixture_01','new-guest@fixture.test',repeat('e',64),repeat('8',64),repeat('9',64)) data;
select is(public.complete_guest_portfolio_access_verification((select (data->>'challengeId')::uuid from replaced_challenge),repeat('e',64),repeat('8',64))->>'status','expired','requesting a fresh code invalidates the previous challenge');
create temp table claimed_access_mail as select * from public.claim_guest_interest_mail(10);
select ok((select public.guest_interest_mail_is_current(id,lease_token) from claimed_access_mail where kind='approved_access'),'queued approval is current while grant and publication are eligible');
reset role;
update app_private.identity_verification_subjects set status='revoked',revoked_at=now() where candidate_id='d2000000-0000-4000-8000-000000000001';
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select is(public.resolve_guest_approved_portfolio('guest_owner_fixture_01',repeat('1',64)),null::jsonb,'verification withdrawal blocks private viewing immediately');
select ok(not (select public.guest_interest_mail_is_current(id,lease_token) from claimed_access_mail where kind='approved_access'),'verification withdrawal blocks queued approval email');
reset role;
update app_private.identity_verification_subjects set status='verified',revoked_at=null,expires_at=now()+interval '365 days' where candidate_id='d2000000-0000-4000-8000-000000000001';
update public.portfolios set is_published=false where id='d3000000-0000-4000-8000-000000000001';
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select is(public.resolve_guest_approved_portfolio('guest_owner_fixture_01',repeat('1',64)),null::jsonb,'unpublishing blocks remembered viewing');
reset role;
update public.portfolios set is_published=true where id='d3000000-0000-4000-8000-000000000001';
update app_private.guest_portfolio_proofs set created_at=now()-interval '16 days',expires_at=now()-interval '1 day' where proof_hash=repeat('3',64);
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select is(public.resolve_guest_approved_portfolio('guest_owner_fixture_01',repeat('3',64)),null::jsonb,'expired browser proof cannot view an otherwise active grant');
reset role;
update public.reveal_grants set created_at=now()-interval '16 days',expires_at=now()-interval '1 day' where id in (select grant_id from app_private.guest_portfolio_grant_recipients);
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select is(public.resolve_guest_approved_portfolio('guest_owner_fixture_01',repeat('1',64)),null::jsonb,'expired approval blocks an unexpired browser proof');
select ok(not (select public.guest_interest_mail_is_current(id,lease_token) from claimed_access_mail where kind='approved_access'),'expired grant suppresses its queued approval email');
reset role;
update public.reveal_grants set created_at=now(),expires_at=now()+interval '15 days' where id in (select grant_id from app_private.guest_portfolio_grant_recipients);
create temp table guest_grant_id as select grant_id from app_private.guest_portfolio_grant_recipients;
grant select on guest_grant_id to authenticated;
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.manage_reveal_grant((select grant_id from guest_grant_id),'revoke')->>'status','revoked','owner can revoke a guest grant using existing management command');
reset role;
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select is(public.resolve_guest_approved_portfolio('guest_owner_fixture_01',repeat('1',64)),null::jsonb,'revocation blocks the original verified browser');
reset role;
select is((select count(*)::integer from public.reveal_grants where viewer_user_id='d1000000-0000-4000-8000-000000000002' and revoked_at is null),1,'legacy grant remains active with original expiry');

insert into public.interest_requests(portfolio_id,viewer_name,viewer_email,viewer_phone,status)
 values('d3000000-0000-4000-8000-000000000001','Unverified old name','recover-guest@fixture.test','+1 617 555 0188','new');
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
create temp table recovery_challenge as select public.begin_guest_interest_verification(jsonb_set(pg_temp.guest_input(),'{email}','"recover-guest@fixture.test"'),repeat('e',64),repeat('8',64),repeat('7',64)) id;
select is(public.complete_guest_interest_and_remember((select id from recovery_challenge),repeat('e',64),repeat('7',64),repeat('6',64))->>'status','submitted','valid email verification recovers from historical unverified pending request');
reset role;
select is((select count(*)::integer from public.interest_requests where viewer_email='recover-guest@fixture.test' and status='closed'),1,'unverified old submission is retained closed');
select is((select count(*)::integer from public.interest_requests where viewer_email='recover-guest@fixture.test' and email_verified_at is not null and viewer_name='Mira Rao'),1,'recovery uses the newly validated form and verified email');
insert into public.interest_requests(portfolio_id,viewer_name,viewer_email,viewer_phone,email_verified_at,verification_channel,status)
 values('d3000000-0000-4000-8000-000000000001','Contact-only guest','contact-only@fixture.test','+1 617 555 0187',now(),'email','approved');
select is((select count(*)::integer from public.reveal_grants g join public.interest_requests r on r.id=g.interest_request_id where r.viewer_email='contact-only@fixture.test'),0,'previous contact approval is not automatically converted');
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.decide_interest_portfolio_reviewed((select id from public.interest_requests where viewer_email='contact-only@fixture.test'),public.get_owner_relationship_page()#>>'{disclosure,revision}'),'approved','previous contact approval requires fresh full-disclosure approval');
reset role;
select is((select count(*)::integer from auth.users where email in ('contact-only@fixture.test','recover-guest@fixture.test','new-guest@fixture.test')),0,'all guest verification and approval paths remain accountless');
-- Readable paths may contain as few as three characters.
update public.portfolios set share_token='abc' where id='d3000000-0000-4000-8000-000000000001';
select ok(strpos(pg_get_functiondef('public.resolve_guest_approved_portfolio(text,text,boolean)'::regprocedure),'{3,160}')>0,'guest resolver retains short readable path guard');
select ok(strpos(pg_get_functiondef('public.begin_guest_interest_verification(jsonb,text,text,text)'::regprocedure),'between 3 and 160')>0,'guest verifier retains the same readable path contract');
select * from finish();
rollback;
