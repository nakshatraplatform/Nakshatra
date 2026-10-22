begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(77);

select has_table('app_private','candidate_family_viewers','Family Viewer roster is private');
select has_table('app_private','candidate_family_viewer_invitations','family invitations are private');
select has_function('public','propose_candidate_family_viewer',array['text','text','text','text','text','text','text','text','text'],'broker proposal command exists');
select has_function('public','create_candidate_family_viewer',array['text','text','text','text','text','text','text','text'],'candidate invitation command exists');
select has_function('public','decide_family_viewer_proposal',array['text','text','text','text','text'],'candidate proposal decision exists');
select has_function('public','accept_family_viewer_invitation',array['text','text'],'exact-account activation exists');
select has_function('public','set_primary_family_viewer',array['text','bigint','text'],'primary viewer command exists');
select has_function('public','revoke_family_viewer',array['text','bigint','text'],'candidate revocation command exists');
select has_function('public','resolve_candidate_family_roster',array[]::text[],'candidate roster projection exists');
select ok(not has_table_privilege('authenticated','app_private.candidate_family_viewers','select'),'authenticated clients cannot read roster rows directly');
select ok(not has_table_privilege('authenticated','app_private.candidate_family_viewer_invitations','select'),'authenticated clients cannot read invitation secrets directly');
select ok(not has_function_privilege('anon','public.accept_family_viewer_invitation(text,text)','execute'),'anonymous callers cannot activate viewers');
select ok(has_function_privilege('authenticated','public.accept_family_viewer_invitation(text,text)','execute'),'authenticated users may invoke the guarded activation command');
select ok(
  pg_catalog.lower(pg_catalog.pg_get_functiondef('public.accept_family_viewer_invitation(text,text)'::regprocedure)) like '%for update%',
  'activation takes a database row lock before enforcing the three-viewer limit'
);
select ok(app_private.generate_public_reference('fvw') ~ '^fvw_[0-9a-f]{32}$','viewer references use the closed opaque prefix');
select ok(app_private.generate_public_reference('fvi') ~ '^fvi_[0-9a-f]{32}$','invitation references use the closed opaque prefix');
select has_index('app_private','candidate_family_viewers','candidate_family_viewers_one_primary_idx','database enforces one active primary viewer');
select has_index('app_private','candidate_family_viewer_invitations','candidate_family_viewer_invitations_live_viewer_idx','database enforces one live invitation per viewer');

select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000001','broker@family-viewer.test');
select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002','candidate@family-viewer.test');
select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000003','a2010000-0000-4000-8000-000000000003','legacy@family-viewer.test');
select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000004','a2010000-0000-4000-8000-000000000004','family1@family-viewer.test');
select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000005','a2010000-0000-4000-8000-000000000005','family2@family-viewer.test');
select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000006','a2010000-0000-4000-8000-000000000006','family3@family-viewer.test');
select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000007','a2010000-0000-4000-8000-000000000007','family4@family-viewer.test');
select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000008','a2010000-0000-4000-8000-000000000008','wrong@family-viewer.test');
select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000009','a2010000-0000-4000-8000-000000000009','family5@family-viewer.test');
select pg_temp.create_auth_actor('a1010000-0000-4000-8000-000000000010','a2010000-0000-4000-8000-000000000010','broker-two@family-viewer.test');

insert into auth.identities (
  id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at
) values
  ('a3010000-0000-4000-8000-000000000004','a1010000-0000-4000-8000-000000000004','google-family-1','{"sub":"google-family-1","email":"family1@family-viewer.test","email_verified":true}'::jsonb,'google',now(),now(),now()),
  ('a3010000-0000-4000-8000-000000000006','a1010000-0000-4000-8000-000000000006','google-family-3','{"sub":"google-family-3","email":"family3@family-viewer.test","email_verified":true}'::jsonb,'google',now(),now(),now()),
  ('a3010000-0000-4000-8000-000000000007','a1010000-0000-4000-8000-000000000007','google-family-4','{"sub":"google-family-4","email":"family4@family-viewer.test","email_verified":true}'::jsonb,'google',now(),now(),now()),
  ('a3010000-0000-4000-8000-000000000009','a1010000-0000-4000-8000-000000000009','google-family-5','{"sub":"google-family-5","email":"family5@family-viewer.test","email_verified":true}'::jsonb,'google',now(),now(),now());

insert into public.organizations (id,type,name,slug,status,created_by)
values
  ('a4010000-0000-4000-8000-000000000001','matchmaker_agency','Family Agency','family-viewer-agency','active','a1010000-0000-4000-8000-000000000001'),
  ('a4010000-0000-4000-8000-000000000002','matchmaker_agency','Second Family Agency','second-family-viewer-agency','active','a1010000-0000-4000-8000-000000000010');
insert into public.organization_members (id,organization_id,user_id,role,status)
values
  ('a5010000-0000-4000-8000-000000000001','a4010000-0000-4000-8000-000000000001','a1010000-0000-4000-8000-000000000001','owner','active'),
  ('a5010000-0000-4000-8000-000000000002','a4010000-0000-4000-8000-000000000002','a1010000-0000-4000-8000-000000000010','owner','active');
insert into public.entitlements (id,organization_id,feature_key,feature_value,source)
values
  ('a6010000-0000-4000-8000-000000000001','a4010000-0000-4000-8000-000000000001','brokerdesk.enabled','true'::jsonb,'test'),
  ('a6010000-0000-4000-8000-000000000002','a4010000-0000-4000-8000-000000000002','brokerdesk.enabled','true'::jsonb,'test');
insert into public.candidates (id,primary_owner_user_id,display_name,created_by)
values
  ('a7010000-0000-4000-8000-000000000001','a1010000-0000-4000-8000-000000000002','Candidate','a1010000-0000-4000-8000-000000000002'),
  ('a7010000-0000-4000-8000-000000000002','a1010000-0000-4000-8000-000000000003','Legacy Candidate','a1010000-0000-4000-8000-000000000003');
insert into public.broker_clients (
  id,organization_id,candidate_id,relationship_status,relationship_source,
  claimed_at,consented_at,starts_at,ends_at
) values
  ('a8010000-0000-4000-8000-000000000001','a4010000-0000-4000-8000-000000000001','a7010000-0000-4000-8000-000000000001','active','customer_invitation',now()-interval '2 days',now()-interval '2 days',now()-interval '2 days',now()+interval '100 days'),
  ('a8010000-0000-4000-8000-000000000002','a4010000-0000-4000-8000-000000000001','a7010000-0000-4000-8000-000000000002','active','customer_invitation',now()-interval '2 days',now()-interval '2 days',now()-interval '2 days',now()+interval '100 days'),
  ('a8010000-0000-4000-8000-000000000003','a4010000-0000-4000-8000-000000000002','a7010000-0000-4000-8000-000000000001','active','customer_invitation',now()-interval '2 days',now()-interval '2 days',now()-interval '2 days',now()+interval '100 days');
insert into app_private.broker_client_mandates (
  id,organization_id,broker_client_id,purpose,permitted_capabilities,
  evidence_reference,consent_version,customer_approved_by,starts_at,ends_at
) values
  ('a9010000-0000-4000-8000-000000000001','a4010000-0000-4000-8000-000000000001','a8010000-0000-4000-8000-000000000001','Family-assisted representation',app_private.broker_mandate_capabilities('broker-representation-v3'),'fixture:broker-representation-v3','broker-representation-v3','a1010000-0000-4000-8000-000000000002',now()-interval '2 days',now()+interval '90 days'),
  ('a9010000-0000-4000-8000-000000000002','a4010000-0000-4000-8000-000000000001','a8010000-0000-4000-8000-000000000002','Legacy representation',app_private.broker_mandate_capabilities('broker-representation-v2'),'fixture:broker-representation-v2','broker-representation-v2','a1010000-0000-4000-8000-000000000003',now()-interval '2 days',now()+interval '90 days'),
  ('a9010000-0000-4000-8000-000000000003','a4010000-0000-4000-8000-000000000002','a8010000-0000-4000-8000-000000000003','Second family-assisted representation',app_private.broker_mandate_capabilities('broker-representation-v3'),'fixture:broker-representation-v3:second','broker-representation-v3','a1010000-0000-4000-8000-000000000002',now()-interval '2 days',now()+interval '90 days');

create temporary table family_refs as
select
  (select workspace_ref from public.organizations where id='a4010000-0000-4000-8000-000000000001') workspace_ref,
  (select relationship_ref from public.broker_clients where id='a8010000-0000-4000-8000-000000000001') relationship_ref,
  (select relationship_ref from public.broker_clients where id='a8010000-0000-4000-8000-000000000002') legacy_relationship_ref,
  (select workspace_ref from public.organizations where id='a4010000-0000-4000-8000-000000000002') second_workspace_ref,
  (select relationship_ref from public.broker_clients where id='a8010000-0000-4000-8000-000000000003') second_relationship_ref,
  app_private.normalized_email_hash('candidate@family-viewer.test') candidate_hash,
  app_private.normalized_email_hash('family1@family-viewer.test') family1_hash,
  app_private.normalized_email_hash('family2@family-viewer.test') family2_hash,
  app_private.normalized_email_hash('family3@family-viewer.test') family3_hash,
  app_private.normalized_email_hash('family4@family-viewer.test') family4_hash,
  app_private.normalized_email_hash('family5@family-viewer.test') family5_hash;
grant select on family_refs to authenticated;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000001');
select throws_ok(
  $$select public.propose_candidate_family_viewer(
    (select workspace_ref from family_refs),(select relationship_ref from family_refs),
    (select family1_hash from family_refs),'family1@family-viewer.test',
    'Unmasked Broker Hint','parent',null,'en-IN','proposal-raw-hint-0001'
  )$$,
  '22023','family viewer proposal unavailable',
  'broker proposal rejects a raw email in the masked hint field'
);
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.create_candidate_family_viewer(
    (select family1_hash from family_refs),'family1@family-viewer.test',
    'Unmasked Candidate Hint','parent',null,null,repeat('0',64),
    'candidate-raw-hint-0001'
  )$$,
  '22023','family viewer invitation unavailable',
  'candidate invitation rejects a raw email in the masked hint field'
);
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000001');
select is(
  public.propose_candidate_family_viewer((select workspace_ref from family_refs),(select legacy_relationship_ref from family_refs),(select family1_hash from family_refs),'fa***@family-viewer.test','Family One','parent',null,'en-IN','proposal-legacy-0001'),
  '{"available": false}'::jsonb,
  'V2 consent cannot authorize a family proposal'
);
reset role;
select is((select count(*)::integer from app_private.candidate_family_viewers where candidate_id='a7010000-0000-4000-8000-000000000002'),0,'denied V2 proposal writes no roster row');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000001');
create temporary table proposal_one as select public.propose_candidate_family_viewer(
  (select workspace_ref from family_refs),(select relationship_ref from family_refs),(select family1_hash from family_refs),'fa***@family-viewer.test','Family One','parent',null,'en-IN','proposal-family-0001'
) result;
grant select on proposal_one to authenticated;
select is((select result from proposal_one),'{"accepted":true}'::jsonb,'authorized broker receives only a generic proposal acknowledgement');
select is(
  public.propose_candidate_family_viewer((select workspace_ref from family_refs),(select relationship_ref from family_refs),(select family1_hash from family_refs),'fa***@family-viewer.test','Family One','parent',null,'en-IN','proposal-family-0001'),
  (select result from proposal_one),
  'identical broker proposal retry is idempotent'
);
reset role;
create temporary table proposal_one_row as
select viewer_ref, status
from app_private.candidate_family_viewers
where candidate_id='a7010000-0000-4000-8000-000000000001'
  and intended_email_hash=(select family1_hash from family_refs);
grant select on proposal_one_row to authenticated;
select ok((select viewer_ref from proposal_one_row) ~ '^fvw_[0-9a-f]{32}$','the accepted proposal creates an opaque private roster reference');
select is((select status from proposal_one_row),'pending_candidate_approval','broker proposal grants no authority');
select is((select count(*)::integer from app_private.candidate_family_viewer_invitations),0,'proposal alone creates no invitation');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000010','a2010000-0000-4000-8000-000000000010');
create temporary table duplicate_agency_proposal as
select public.propose_candidate_family_viewer(
  (select second_workspace_ref from family_refs),
  (select second_relationship_ref from family_refs),
  (select family1_hash from family_refs),
  'fa***@family-viewer.test','Family One','parent',null,'en-IN',
  'proposal-family-second-agency-0001'
) result;
reset role;
select is((select result from duplicate_agency_proposal),(select result from proposal_one),'a second agency receives the same generic acknowledgement for a duplicate email');
select is((select count(*)::integer from app_private.candidate_family_viewers where candidate_id='a7010000-0000-4000-8000-000000000001' and intended_email_hash=(select family1_hash from family_refs)),1,'cross-agency duplicate proposal does not duplicate candidate-owned authority');
select is((select count(*)::integer from app_private.brokerdesk_audit_events where organization_id='a4010000-0000-4000-8000-000000000002' and event_name='family_viewer.proposed'),0,'duplicate proposal creates no second-agency roster audit linkage');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000003','a2010000-0000-4000-8000-000000000003');
select is(public.decide_family_viewer_proposal((select viewer_ref from proposal_one_row),'approve',(select family1_hash from family_refs),repeat('1',64),'wrong-owner-decision-0001'),'{"available":false}'::jsonb,'another candidate cannot approve a proposal');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
select is(public.decide_family_viewer_proposal((select viewer_ref from proposal_one_row),'approve',repeat('f',64),repeat('0',64),'candidate-wrong-proposal-email-0001'),'{"available":false}'::jsonb,'candidate approval fails neutrally when the re-entered email does not match the broker proposal');
reset role;
select is((select count(*)::integer from app_private.candidate_family_viewer_invitations),0,'an email mismatch creates no invitation');
set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
create temporary table approved_one as select public.decide_family_viewer_proposal((select viewer_ref from proposal_one_row),'approve',(select family1_hash from family_refs),repeat('1',64),'candidate-approve-0001') result;
grant select on approved_one to authenticated;
select ok((select result->>'invitationRef' from approved_one) ~ '^fvi_[0-9a-f]{32}$','candidate approval creates an opaque invitation');
reset role;
select is((select count(*)::integer from app_private.candidate_family_viewer_invitations),1,'approval creates exactly one seven-day invitation');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
select is(public.create_candidate_family_viewer((select candidate_hash from family_refs),'ca***@family-viewer.test','Self','relative',null,null,repeat('9',64),'candidate-self-add-0001'),'{"available":false}'::jsonb,'candidate cannot invite their own account as a Family Viewer');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000008','a2010000-0000-4000-8000-000000000008');
select is(public.accept_family_viewer_invitation(repeat('1',64),'wrong-email-accept-0001'),'{"available":false}'::jsonb,'a different confirmed email receives a neutral result');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000004','a2010000-0000-4000-8000-000000000004');
create temporary table accepted_one as select public.accept_family_viewer_invitation(repeat('1',64),'family-one-accept-0001') result;
grant select on accepted_one to authenticated;
select is((select result->>'status' from accepted_one),'active','exact confirmed Google account activates the viewer');
select is(public.accept_family_viewer_invitation(repeat('1',64),'family-one-accept-0001'),(select result from accepted_one),'activation retry is idempotent');
reset role;
select ok((select token_hash is null and accepted_at is not null from app_private.candidate_family_viewer_invitations where invitation_ref=(select result->>'invitationRef' from approved_one)),'activation consumes and clears the token hash');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
create temporary table created_two as select public.create_candidate_family_viewer((select family2_hash from family_refs),'fa***@family-viewer.test','Family Two','sibling',null,null,repeat('2',64),'candidate-family-two-0001') result;
grant select on created_two to authenticated;
select ok((select result->>'viewerRef' from created_two) ~ '^fvw_[0-9a-f]{32}$','candidate may directly invite a second viewer');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000005','a2010000-0000-4000-8000-000000000005');
select is(public.accept_family_viewer_invitation(repeat('2',64),'family-two-no-google-0001'),'{"available":false}'::jsonb,'confirmed email without a Google identity cannot activate');
reset role;
insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values ('a3010000-0000-4000-8000-000000000005','a1010000-0000-4000-8000-000000000005','google-family-2','{"sub":"google-family-2","email":"family2@family-viewer.test","email_verified":true}'::jsonb,'google',now(),now(),now());
set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000005','a2010000-0000-4000-8000-000000000005');
create temporary table accepted_two as select public.accept_family_viewer_invitation(repeat('2',64),'family-two-google-0001') result;
grant select on accepted_two to authenticated;
select is((select result->>'status' from accepted_two),'active','adding a Google identity enables exact-email activation');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
create temporary table created_three as select public.create_candidate_family_viewer((select family3_hash from family_refs),'fa***@family-viewer.test','Family Three','guardian',null,null,repeat('3',64),'candidate-family-three-0001') result;
create temporary table created_four as select public.create_candidate_family_viewer((select family4_hash from family_refs),'fa***@family-viewer.test','Family Four','relative',null,null,repeat('4',64),'candidate-family-four-0001') result;
grant select on created_three, created_four to authenticated;
reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000006','a2010000-0000-4000-8000-000000000006');
select is(public.accept_family_viewer_invitation(repeat('3',64),'family-three-accept-0001')->>'status','active','third Family Viewer activates');
reset role;
select is((select count(*)::integer from app_private.candidate_family_viewers where candidate_id='a7010000-0000-4000-8000-000000000001' and status='active'),3,'candidate has exactly three active viewers');
set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000007','a2010000-0000-4000-8000-000000000007');
select is(public.accept_family_viewer_invitation(repeat('4',64),'family-four-full-0001'),'{"available":false}'::jsonb,'a fourth activation fails closed after the three-viewer limit is reached');
reset role;

create temporary table replacement_invitation as
select app_private.issue_family_viewer_invitation(
  (select id from app_private.candidate_family_viewers where viewer_ref=(select result->>'viewerRef' from created_four)),
  (select family4_hash from family_refs),'fa***@family-viewer.test','a1010000-0000-4000-8000-000000000002',repeat('e',64)
) result;
set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000007','a2010000-0000-4000-8000-000000000007');
select is(public.accept_family_viewer_invitation(repeat('4',64),'replaced-token-accept-0001'),'{"available":false}'::jsonb,'a replaced invitation token is unusable');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
create temporary table primary_one as select public.set_primary_family_viewer((select viewer_ref from proposal_one_row),(select (result->>'rowVersion')::bigint from accepted_one),'primary-family-one-0001') result;
select is((select result->>'role' from primary_one),'primary','candidate may select one active primary viewer');
create temporary table primary_two as select public.set_primary_family_viewer((select result->>'viewerRef' from created_two),(select (result->>'rowVersion')::bigint from accepted_two),'primary-family-two-0001') result;
select is((select result->>'role' from primary_two),'primary','candidate may replace the primary viewer');
reset role;
select is((select count(*)::integer from app_private.candidate_family_viewers where candidate_id='a7010000-0000-4000-8000-000000000001' and role='primary' and status='active'),1,'primary replacement leaves exactly one primary');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
select is(public.create_candidate_family_viewer((select family1_hash from family_refs),'fa***@family-viewer.test','Duplicate','parent',null,null,repeat('d',64),'duplicate-family-email-0001'),'{"available":false}'::jsonb,'duplicate live email audience is rejected');
select is(public.resolve_candidate_family_roster()->>'activeCount','3','candidate roster reports the bounded active count');
select ok((public.resolve_candidate_family_roster()::text !~ 'emailHash|tokenHash|family1@family-viewer\.test'),'candidate projection returns hints but never hashes, tokens, or raw email');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000003','a2010000-0000-4000-8000-000000000003');
select is(public.revoke_family_viewer((select result->>'viewerRef' from created_two),(select (result->>'rowVersion')::bigint from primary_two),'wrong-owner-revoke-0001'),'{"available":false}'::jsonb,'another candidate cannot revoke a Family Viewer');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
create temporary table revoked_two as select public.revoke_family_viewer((select result->>'viewerRef' from created_two),(select (result->>'rowVersion')::bigint from primary_two),'candidate-revoke-two-0001') result;
select is((select result->>'status' from revoked_two),'revoked','candidate revocation is immediate');
reset role;
select ok((select revoked_at is not null and role='viewer' from app_private.candidate_family_viewers where viewer_ref=(select result->>'viewerRef' from created_two)),'revocation clears primary authority and records time');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000007','a2010000-0000-4000-8000-000000000007');
select is(public.accept_family_viewer_invitation(repeat('e',64),'family-four-replacement-0001')->>'status','active','replacement invitation activates after roster capacity is available');
reset role;
select is((select count(*)::integer from app_private.candidate_family_viewers where candidate_id='a7010000-0000-4000-8000-000000000001' and status='active'),3,'replacement activation preserves the three-viewer maximum');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000002','a2010000-0000-4000-8000-000000000002');
create temporary table created_five as select public.create_candidate_family_viewer((select family5_hash from family_refs),'fa***@family-viewer.test','Family Five','relative',null,null,repeat('5',64),'candidate-family-five-0001') result;
reset role;
update app_private.candidate_family_viewer_invitations set expires_at=now()-interval '1 second' where token_hash=repeat('5',64);
set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000009','a2010000-0000-4000-8000-000000000009');
select is(public.accept_family_viewer_invitation(repeat('5',64),'expired-family-five-0001'),'{"available":false}'::jsonb,'expired invitation fails neutrally');
reset role;

insert into app_private.candidate_family_viewers (
  candidate_id,intended_email_hash,intended_email_hint,display_name,
  relationship_kind,status,proposed_by_organization_id,proposed_by_user_id
)
select
  'a7010000-0000-4000-8000-000000000001',
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to('bounded-' || series.value,'UTF8'),'sha256'),'hex'),
  'bo***@family-viewer.test',
  'Bounded Proposal ' || series.value,
  'relative','pending_candidate_approval',
  'a4010000-0000-4000-8000-000000000001',
  'a1010000-0000-4000-8000-000000000001'
from pg_catalog.generate_series(1,6) series(value);
select is((select count(*)::integer from app_private.candidate_family_viewers where candidate_id='a7010000-0000-4000-8000-000000000001' and status in ('pending_candidate_approval','pending_verification','active') and revoked_at is null),10,'the actionable candidate roster reaches its server-side bound');
set local role authenticated;
select pg_temp.set_authenticated_claims('a1010000-0000-4000-8000-000000000001','a2010000-0000-4000-8000-000000000001');
create temporary table full_queue_proposal as select public.propose_candidate_family_viewer(
  (select workspace_ref from family_refs),(select relationship_ref from family_refs),
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to('bounded-overflow','UTF8'),'sha256'),'hex'),
  'ov***@family-viewer.test','Overflow Proposal','relative',null,null,
  'proposal-full-queue-0001'
) result;
select is((select result from full_queue_proposal),'{"accepted":true}'::jsonb,'a full proposal queue keeps the same non-oracular broker acknowledgement');
select is(public.create_candidate_family_viewer(
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to('candidate-overflow','UTF8'),'sha256'),'hex'),
  'ca***@family-viewer.test','Candidate Overflow','relative',null,null,repeat('f',64),
  'candidate-full-queue-0001'
),'{"available":false}'::jsonb,'candidate direct creation fails closed when the actionable roster is full');
create temporary table bounded_roster as select public.resolve_candidate_family_roster() result;
reset role;
select is((select count(*)::integer from app_private.candidate_family_viewers where candidate_id='a7010000-0000-4000-8000-000000000001' and status in ('pending_candidate_approval','pending_verification','active') and revoked_at is null),10,'overflow commands cannot expand the bounded actionable roster');
select is(pg_catalog.jsonb_array_length((select result->'viewers' from bounded_roster)),10,'the owner projection includes every actionable row within the bound');

insert into public.candidates (
  id,primary_owner_user_id,current_organization_id,display_name,created_by
) values (
  'a7010000-0000-4000-8000-000000000003',
  'a1010000-0000-4000-8000-000000000009',
  'a4010000-0000-4000-8000-000000000002',
  'Surviving Legacy Candidate',
  'a1010000-0000-4000-8000-000000000009'
);
insert into app_private.candidate_family_viewers (
  id,candidate_id,intended_email_hash,intended_email_hint,display_name,
  relationship_kind,status,proposed_by_organization_id,proposed_by_user_id
) values (
  'ab010000-0000-4000-8000-000000000001',
  'a7010000-0000-4000-8000-000000000003',
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to('legacy-proposal','UTF8'),'sha256'),'hex'),
  'le***@family-viewer.test','Legacy Proposal','relative',
  'pending_candidate_approval',
  'a4010000-0000-4000-8000-000000000002',
  'a1010000-0000-4000-8000-000000000010'
);
insert into public.account_deletion_requests (
  id,user_id,subject_hash,status,scheduled_for,processing_stage,
  lease_token,lease_expires_at
) values (
  'af010000-0000-4000-8000-000000000003',
  'a1010000-0000-4000-8000-000000000009',repeat('9',64),
  'processing',pg_catalog.now()-interval '1 minute','initial_storage_cleaned',
  'af020000-0000-4000-8000-000000000003',pg_catalog.now()+interval '10 minutes'
);
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
create temporary table intended_recipient_deletion_result as
select public.prepare_account_deletion(
  'af010000-0000-4000-8000-000000000003',
  'a1010000-0000-4000-8000-000000000009',
  'af020000-0000-4000-8000-000000000003'
) result;
reset role;
select cmp_ok((select (result->>'familyViewersRevoked')::integer from intended_recipient_deletion_result),'>=',2,'account deletion revokes both email-addressed and candidate-owned pending authority');
select ok((select token_hash is null and revoked_at is not null and intended_email_hint='Removed' from app_private.candidate_family_viewer_invitations where family_viewer_id=(select id from app_private.candidate_family_viewers where viewer_ref=(select result->>'viewerRef' from created_five)) order by created_at desc limit 1),'deleting an intended recipient destroys the still-pending invitation capability');
select is((select count(*)::integer from public.candidates where id='a7010000-0000-4000-8000-000000000003'),1,'legacy candidate owned through an organization survives account-deletion preparation');
select ok((select status='revoked' and intended_email_hint='Removed' from app_private.candidate_family_viewers where id='ab010000-0000-4000-8000-000000000001'),'surviving candidate rows retain no pending family proposal authority after owner deletion');

create temporary table family4_deletion_target as
select id, viewer_ref
from app_private.candidate_family_viewers
where viewer_ref=(select result->>'viewerRef' from created_four);
insert into public.account_deletion_requests (
  id,user_id,subject_hash,status,scheduled_for,processing_stage,
  lease_token,lease_expires_at
) values (
  'af010000-0000-4000-8000-000000000001',
  'a1010000-0000-4000-8000-000000000007',repeat('7',64),
  'processing',pg_catalog.now()-interval '1 minute','initial_storage_cleaned',
  'af020000-0000-4000-8000-000000000001',pg_catalog.now()+interval '10 minutes'
);
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
create temporary table family_deletion_result as select public.prepare_account_deletion(
  'af010000-0000-4000-8000-000000000001',
  'a1010000-0000-4000-8000-000000000007',
  'af020000-0000-4000-8000-000000000001'
) result;
reset role;
select is((select result->>'familyViewersRevoked' from family_deletion_result),'1','account deletion preparation revokes the deleting Family Viewer authority');
select ok((select status='revoked' and verified_user_id is null and candidate_approved_by is null and intended_email_hint='Removed' from app_private.candidate_family_viewers where id=(select id from family4_deletion_target)),'deletion preparation removes active identity, approval and contact references');
select ok((select accepted_by is null and token_hash is null and intended_email_hint='Removed' from app_private.candidate_family_viewer_invitations where family_viewer_id=(select id from family4_deletion_target) order by created_at desc limit 1),'deletion preparation scrubs invitation identity and secret material');
select lives_ok($$delete from auth.users where id='a1010000-0000-4000-8000-000000000007'$$,'prepared Family Viewer account deletion is no longer blocked by new foreign keys');

select is((select count(*)::integer from app_private.brokerdesk_audit_events where event_name='family_viewer.activated' and safe_details ?| array['email','emailHash','tokenHash']),0,'family audit details contain no email or token material');
select is((select count(*)::integer from app_private.brokerdesk_audit_events where event_name='family_viewer.activated' and safe_details->>'viewerRef'=(select viewer_ref from proposal_one_row)),1,'idempotent activation produces one logical audit event');

insert into public.account_deletion_requests (
  id,user_id,subject_hash,status,scheduled_for,processing_stage,
  lease_token,lease_expires_at
) values (
  'af010000-0000-4000-8000-000000000002',
  'a1010000-0000-4000-8000-000000000001',repeat('1',64),
  'processing',pg_catalog.now()-interval '1 minute','initial_storage_cleaned',
  'af020000-0000-4000-8000-000000000002',pg_catalog.now()+interval '10 minutes'
);
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
create temporary table broker_deletion_result as select public.prepare_account_deletion(
  'af010000-0000-4000-8000-000000000002',
  'a1010000-0000-4000-8000-000000000001',
  'af020000-0000-4000-8000-000000000002'
) result;
reset role;
select cmp_ok((select (result->>'familyProposalOrganizationsScrubbed')::integer from broker_deletion_result),'>',0,'sole-owner deletion scrubs Family Viewer organization provenance before deletion');
select is((select count(*)::integer from public.organizations where id='a4010000-0000-4000-8000-000000000001'),0,'sole-owner broker organization deletion is not blocked by Family Viewer provenance');
select is((select count(*)::integer from app_private.candidate_family_viewers where proposed_by_organization_id='a4010000-0000-4000-8000-000000000001' or proposed_by_user_id='a1010000-0000-4000-8000-000000000001'),0,'deleted broker and organization references are removed from every Family Viewer row');

select * from finish();
rollback;
