begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(41);
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

insert into app_private.b2c_creator_entitlements(email_hash)
values(app_private.normalized_email_hash('legacy-viewer@fixture.test'));
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values('d2000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000002','Member Recipient',
  'd1000000-0000-4000-8000-000000000002');
insert into public.candidate_personal_details(candidate_id,profile_for)
values('d2000000-0000-4000-8000-000000000002','self');
update app_private.identity_verification_subjects
  set status='verified',verified_at=now(),expires_at=now()+interval '365 days'
  where candidate_id='d2000000-0000-4000-8000-000000000002';
insert into public.portfolios(
  id,user_id,candidate_id,share_token,draft_data,is_published,expires_at
) values(
  'd3000000-0000-4000-8000-000000000002',
  'd1000000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000002',
  'member_recipient_fixture_02',pg_temp.complete_portfolio_draft(),false,
  now()+interval '30 days');
insert into public.portfolio_media(
  id,portfolio_id,candidate_id,media_type,storage_path,visibility,sort_order
) values(
  'd4000000-0000-4000-8000-000000000002',
  'd3000000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000002',
  'hero',
  'd1000000-0000-4000-8000-000000000002/d3000000-0000-4000-8000-000000000002/hero.webp',
  'public',0);
select pg_temp.prime_paid_publication(
  'd3000000-0000-4000-8000-000000000002',
  pg_temp.complete_portfolio_draft());
update public.portfolios set is_published=true,published_data=draft_data
  where id='d3000000-0000-4000-8000-000000000002';
insert into public.public_portfolio_snapshots(
  portfolio_id,share_token,data,template_id,expires_at,is_active
) values(
  'd3000000-0000-4000-8000-000000000002',
  'member_recipient_fixture_02',
  '{"privacy_mode":"balanced","personal":{"name":"Member Recipient","age":36,"marital_status":"Never Married"}}'::jsonb,
  3,now()+interval '30 days',true);
insert into public.approved_portfolio_snapshots(portfolio_id,data,template_id,published_at)
values('d3000000-0000-4000-8000-000000000002',
  '{"personal":{"name":"Member Recipient","dob":"1990-01-01","gender":"female"},
    "contact":{"contact_person":"Chosen contact","email":"recipient-contact@fixture.test"}}'::jsonb,3,now());


select ok(not has_function_privilege('anon','public.send_member_interest_and_share(text,text,text)','EXECUTE'),'anonymous visitors cannot invoke member sharing');
select ok(not has_table_privilege('authenticated','app_private.member_interest_shares','SELECT'),'member share bindings remain private');
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.member_interest_context('member_recipient_fixture_02')->>'available','true','published member gets the single-action context');
select is(public.send_member_interest_and_share('member_recipient_fixture_02',repeat('0',32))->>'status','review_changed','stale disclosure cannot send or share');
select is(public.send_member_interest_and_share('member_recipient_fixture_02',public.member_interest_context('member_recipient_fixture_02')->>'revision','Hello, we would like to connect.')->>'status','submitted','one explicit send creates interest and outgoing access');
select is(public.send_member_interest_and_share('member_recipient_fixture_02',public.member_interest_context('member_recipient_fixture_02')->>'revision')->>'status','existing_request','retry does not duplicate or renew access');
reset role;
select is((select count(*)::integer from app_private.member_interest_shares),1,'one sender disclosure exists');
select is((select count(*)::integer from public.interest_requests),1,'no artificial reverse interest is created');
select ok((select expires_at=created_at+interval '15 days' from app_private.member_interest_shares),'outgoing access has a fixed fifteen-day expiry');
select is((select viewer_name from public.interest_requests),'Guest Owner','request uses the published name');
create temp table sent_request as select id from public.interest_requests;
grant select on sent_request to authenticated;
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000002','d1100000-0000-4000-8000-000000000002');
select is(public.resolve_approved_portfolio('guest_owner_fixture_01')#>>'{data,personal,dob}','1990-01-01','recipient can immediately read sender full published profile');
select is(public.get_owner_relationship_page()#>>'{records,0,item,requester_full_profile_shared}','true','incoming member request advertises only an authorized full-profile link');
select is(public.decide_interest_relationship((select id from sent_request),'set_aside'),'set_aside','set aside is private deferral');
select is(public.get_owner_relationship_page()#>>'{counts,setAside}','1','deferral appears in the set-aside queue');
select is(public.get_owner_relationship_page()#>>'{counts,awaiting}','0','deferred request is not counted as awaiting');
reset role;
select is((select status::text from public.interest_requests),'new','deferral never stores a rejection');
select is((select count(*)::integer from app_private.guest_interest_mail_outbox where kind='declined'),0,'deferral sends no guest decline email');
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000002','d1100000-0000-4000-8000-000000000002');
select is(public.decide_interest_relationship((select id from sent_request),'reopened'),'reopened','deferred interest can return to review');
select is(public.decide_interest_relationship((select id from sent_request),'approved',public.get_owner_relationship_page()#>>'{disclosure,revision}'),'approved','recipient accepts and shares back before sending a crossed interest');
reset role;
select is((select count(*)::integer from public.reveal_grants where revoked_at is null),1,'accept creates only one reverse-direction permission');
create temp table accepted_grant as select id,expires_at from public.reveal_grants;
grant select on accepted_grant to authenticated;
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000002','d1100000-0000-4000-8000-000000000002');
select is(public.send_member_interest_and_share('guest_owner_fixture_01',public.member_interest_context('guest_owner_fixture_01')->>'revision')->>'mutual','true','explicit crossed send accepts both real interests');
reset role;
select is((select count(*)::integer from app_private.member_interest_shares),1,'accept then crossed send reuses the active reverse grant');
select is((select count(*)::integer from public.interest_requests where status='approved'),2,'both actual interests show mutual acceptance');
select is((select count(*)::integer from public.reveal_grants),1,'crossed sharing does not create duplicate approval grants');
select ok((select g.expires_at=a.expires_at from public.reveal_grants g join accepted_grant a on a.id=g.id),'crossed send preserves the original approval expiry');
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.resolve_approved_portfolio('member_recipient_fixture_02')#>>'{data,contact,email}','recipient-contact@fixture.test','sender can view the reciprocated full profile');
select is(public.get_owner_relationship_page()#>>'{counts,active}','1','outgoing disclosure is visible in owner access management');
reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000002','d1100000-0000-4000-8000-000000000002');
select is(public.manage_reveal_grant((select id from accepted_grant),'revoke')->>'status','revoked','recipient can stop only their own reverse disclosure');
select ok(public.resolve_approved_portfolio('guest_owner_fixture_01') is not null,'stopping reverse sharing preserves original sender permission');
select is(public.decide_interest_portfolio_reviewed((select id from sent_request),public.get_owner_relationship_page()#>>'{disclosure,revision}'),'invalid_transition','replayed approval cannot restore revoked access');
reset role;
select is((select count(*)::integer from public.reveal_grants),1,'replayed approval cannot create a replacement grant');
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000002','d1100000-0000-4000-8000-000000000002');
reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.resolve_approved_portfolio('member_recipient_fixture_02'),null::jsonb,'one Stop sharing removes the sole reverse permission');
reset role;
select is((select count(*)::integer from public.interest_requests where status='rejected'),0,'Stop sharing never records a decline');
create temp table owner_share as select id from app_private.member_interest_shares where granted_by='d1000000-0000-4000-8000-000000000001';
grant select on owner_share to authenticated;
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.manage_reveal_grant((select id from owner_share),'revoke')->>'status','revoked','sender can stop their outgoing disclosure with existing endpoint');
reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000002','d1100000-0000-4000-8000-000000000002');
select is(public.resolve_approved_portfolio('guest_owner_fixture_01'),null::jsonb,'revocation removes recipient private access immediately');
reset role;
update public.interest_requests set status='closed';
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000001','d1100000-0000-4000-8000-000000000001');
select is(public.send_member_interest_and_share('member_recipient_fixture_02',public.member_interest_context('member_recipient_fixture_02')->>'revision')->>'status','submitted','a fresh closed exchange can start with explicit consent');
reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000002','d1100000-0000-4000-8000-000000000002');
select is(public.send_member_interest_and_share('guest_owner_fixture_01',public.member_interest_context('guest_owner_fixture_01')->>'revision')->>'mutual','true','pure crossed interests also become mutual without an approval grant');
reset role;
select is((select count(*)::integer from app_private.member_interest_shares where revoked_at is null),2,'pure crossed sharing has exactly two active directions');
update app_private.member_interest_shares set created_at=now()-interval '16 days',expires_at=now()-interval '1 day' where portfolio_id='d3000000-0000-4000-8000-000000000001' and revoked_at is null;
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000002','d1100000-0000-4000-8000-000000000002');
select is(public.resolve_approved_portfolio('guest_owner_fixture_01'),null::jsonb,'expired sender disclosure fails closed');
reset role;
update app_private.member_interest_shares set created_at=now(),expires_at=now()+interval '15 days' where portfolio_id='d3000000-0000-4000-8000-000000000001' and revoked_at is null;
update public.portfolios set is_published=false where id='d3000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('d1000000-0000-4000-8000-000000000002','d1100000-0000-4000-8000-000000000002');
select is(public.resolve_approved_portfolio('guest_owner_fixture_01'),null::jsonb,'unpublishing sender immediately stops member viewing');
select is(public.member_interest_context('guest_owner_fixture_01')->>'available','false','unpublished target cannot receive a new member disclosure');
reset role;
select * from finish();
rollback;
