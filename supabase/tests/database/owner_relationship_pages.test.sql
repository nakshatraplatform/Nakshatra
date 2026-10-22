begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(27);

-- Static lock-order regression complements the required two-session release
-- check: submissions lock portfolio first, then update the request.
select ok(strpos(pg_get_functiondef('public.decide_interest_request_reviewed(uuid,text)'::regprocedure),
  'from public.portfolios where id=owner_id and user_id=auth.uid() for update')
  < strpos(pg_get_functiondef('public.decide_interest_request_reviewed(uuid,text)'::regprocedure),
  'from public.interest_requests where id=p_interest_request_id'), 'reviewed approval locks portfolio before request');

select pg_temp.create_auth_actor('b1000000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001','sharing-owner@fixture.test');
select pg_temp.create_auth_actor('b1000000-0000-4000-8000-000000000002','b1100000-0000-4000-8000-000000000002','sharing-other@fixture.test');
select pg_temp.create_auth_actor(('c1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  ('c1100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'sharing-viewer-'||n||'@fixture.test') from generate_series(1,51) n;
insert into app_private.b2c_creator_entitlements(email_hash) values(app_private.normalized_email_hash('sharing-owner@fixture.test'));
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Sharing Owner','b1000000-0000-4000-8000-000000000001');
insert into public.candidate_personal_details(candidate_id,profile_for) values('b2000000-0000-4000-8000-000000000001','self');
update app_private.identity_verification_subjects set status='verified',verified_at=now(),expires_at=now()+interval '365 days'
where candidate_id='b2000000-0000-4000-8000-000000000001';
insert into public.portfolios(id,user_id,candidate_id,share_token,draft_data,is_published,expires_at)
values('b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001',
  'sharing_owner_fixture_01',pg_temp.complete_portfolio_draft(),false,now()+interval '30 days');
insert into public.portfolio_media(id,portfolio_id,candidate_id,media_type,storage_path,visibility,sort_order)
values('b4000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','hero',
  'b1000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001/hero.webp','public',0),
('b4000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','gallery',
  'b1000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001/hidden.webp','hidden',1);
select pg_temp.prime_paid_publication('b3000000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft());
update public.portfolios set is_published=true,published_data=draft_data where id='b3000000-0000-4000-8000-000000000001';
insert into public.approved_portfolio_snapshots(portfolio_id,data,template_id,published_at)
-- Approved snapshots use the viewer projection, never the owner draft's
-- internal canonical-location IDs/codes or other owner-only fields.
values('b3000000-0000-4000-8000-000000000001',jsonb_build_object('personal',
  jsonb_build_object('name','Sharing Owner','dob','1990-01-01','gender','female'),
  'contact',jsonb_build_object('contact_person','Published contact','email','published@fixture.test')),3,now());
select throws_ok($$update public.approved_portfolio_snapshots
  set data=jsonb_set(data,'{personal,country_code}','"US"'::jsonb)
  where portfolio_id='b3000000-0000-4000-8000-000000000001'$$,
  '23514','approved snapshot contains an owner-only field','approved snapshot still rejects owner-only location codes');
insert into public.interest_requests(id,portfolio_id,requester_user_id,viewer_name,viewer_email,viewer_phone,email_verified_at,verification_channel,status,metadata,created_at)
select ('c2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b3000000-0000-4000-8000-000000000001',
  ('c1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Viewer '||n,'sharing-viewer-'||n||'@fixture.test','+1 617 555 0123',
  now(),'email','new','{"portfolio_url":"https://untrusted.example/claim"}'::jsonb,now()-make_interval(mins=>52-n) from generate_series(1,51)n;

select ok(not has_function_privilege('anon','public.get_owner_relationship_page(text,integer,text,text)','EXECUTE'),'anonymous visitors cannot read relationship pages');
select ok(not has_function_privilege('anon','public.decide_interest_request_reviewed(uuid,text)','EXECUTE'),'anonymous visitors cannot approve reviewed sharing');
set local role authenticated;
select pg_temp.set_authenticated_claims('b1000000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001');
select is(public.get_owner_relationship_page('awaiting')->>'total','51','queue totals include old pending requests');
select is(jsonb_array_length(public.get_owner_relationship_page('awaiting')->'records'),8,'pages are bounded to eight records');
select is(public.get_owner_relationship_page('awaiting',48)#>>'{records,2,item,viewer_name}','Viewer 1','oldest request is reachable beyond fifty');
select is(public.get_owner_relationship_page('awaiting',0,'Viewer 1')->>'total','11','search runs over all owner requests');
select is(public.get_owner_relationship_page('overview')#>>'{counts,awaiting}','51','overview count is not the returned subset');
select is(public.get_owner_relationship_page()#>>'{disclosure,data,contact,contact_person}','Published contact','review uses stored approved contact');
select is(public.get_owner_relationship_page()#>>'{disclosure,photoCount}','1','hidden owner photo is excluded');
select is(public.get_owner_relationship_page()#>>'{disclosure,privatePhotoCount}','0','hidden does not mean approved private photo');
select is(public.get_owner_relationship_page()#>>'{disclosure,hasHoroscope}','false','absent horoscope is not advertised');
select ok(not ((public.get_owner_relationship_page('awaiting')#>'{records,0,item,metadata}') ? 'portfolio_url'),'untrusted profile URL is removed');
select throws_ok($$select public.get_owner_relationship_page('awaiting',-1)$$,'22023','invalid relationship page','negative pages rejected at SQL boundary');
select throws_ok($$select public.get_owner_relationship_page('access',0,repeat('x',81))$$,'22023','invalid relationship page','oversized searches rejected at SQL boundary');
select is(public.decide_interest_request_reviewed('c2000000-0000-4000-8000-000000000001',repeat('0',32)),'review_changed','stale confirmation cannot create a grant');
select is(public.get_owner_relationship_page()#>>'{counts,active}','0','stale approval has no grant side effect');
select is(public.decide_interest_request_reviewed('c2000000-0000-4000-8000-000000000001',public.get_owner_relationship_page()#>>'{disclosure,revision}'),'approved','current review uses canonical atomic approval');
select is(public.get_owner_relationship_page()#>>'{counts,active}','1','successful approval creates access');

reset role;
update public.interest_requests set status='approved' where portfolio_id='b3000000-0000-4000-8000-000000000001';
update public.reveal_grants set created_at=now()-interval '1 hour' where portfolio_id='b3000000-0000-4000-8000-000000000001';
insert into public.reveal_grants(interest_request_id,portfolio_id,viewer_user_id,access_level,granted_sections,granted_by,expires_at)
select id,portfolio_id,requester_user_id,'full',array['full']::text[],'b1000000-0000-4000-8000-000000000001',now()+interval '15 days'
from public.interest_requests where portfolio_id='b3000000-0000-4000-8000-000000000001' and id<>'c2000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.get_owner_relationship_page('access')->>'total','51','all active grants counted beyond fifty');
select is(public.get_owner_relationship_page('access',48)#>>'{records,2,item,viewerName}','Viewer 1','old active grant remains manageable');
select is(public.manage_reveal_grant((public.get_owner_relationship_page('access',48)#>>'{records,2,item,id}')::uuid,'revoke')->>'status','revoked','owner can stop the oldest grant');
select is(public.get_owner_relationship_page()#>>'{counts,active}','50','revocation updates full count');
select pg_temp.set_authenticated_claims('b1000000-0000-4000-8000-000000000002','b1100000-0000-4000-8000-000000000002');
select is(public.get_owner_relationship_page()->'records','[]'::jsonb,'foreign owner cannot list relationships');
select is(public.get_owner_relationship_page()->'disclosure','null'::jsonb,'foreign owner cannot see approved details');
reset role;
select pg_temp.set_authenticated_claims('b1000000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001');
delete from auth.sessions where id='b1100000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok('select public.get_owner_relationship_page()','42501','authentication session is no longer active','ended session cannot read owner data');
reset role;
select * from finish();
rollback;
