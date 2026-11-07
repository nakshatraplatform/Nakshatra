begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(19);

select has_function(
  'public','resolve_brokerdesk_family_setup',array['text','text'],
  'BrokerDesk family setup projection exists'
);
select ok(
  not has_function_privilege(
    'anon','public.resolve_brokerdesk_family_setup(text,text)','execute'
  ),
  'anonymous callers cannot resolve family setup'
);
select ok(
  has_function_privilege(
    'authenticated','public.resolve_brokerdesk_family_setup(text,text)','execute'
  ),
  'authenticated callers may invoke the guarded projection'
);
select pg_temp.create_auth_actor(
  'b1010000-0000-4000-8000-000000000001',
  'b2010000-0000-4000-8000-000000000001',
  'broker-one@family-setup.test'
);
select pg_temp.create_auth_actor(
  'b1010000-0000-4000-8000-000000000002',
  'b2010000-0000-4000-8000-000000000002',
  'broker-two@family-setup.test'
);
select pg_temp.create_auth_actor(
  'b1010000-0000-4000-8000-000000000003',
  'b2010000-0000-4000-8000-000000000003',
  'candidate@family-setup.test'
);
select pg_temp.create_auth_actor(
  'b1010000-0000-4000-8000-000000000004',
  'b2010000-0000-4000-8000-000000000004',
  'family@family-setup.test'
);
select pg_temp.create_auth_actor(
  'b1010000-0000-4000-8000-000000000005',
  'b2010000-0000-4000-8000-000000000005',
  'legacy@family-setup.test'
);

insert into public.organizations (id,type,name,slug,status,created_by)
values
  ('b4010000-0000-4000-8000-000000000001','matchmaker_agency','First Agency','family-setup-first','active','b1010000-0000-4000-8000-000000000001'),
  ('b4010000-0000-4000-8000-000000000002','matchmaker_agency','Second Agency','family-setup-second','active','b1010000-0000-4000-8000-000000000002');

insert into public.organization_members (id,organization_id,user_id,role,status)
values
  ('b5010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000001','b1010000-0000-4000-8000-000000000001','owner','active'),
  ('b5010000-0000-4000-8000-000000000002','b4010000-0000-4000-8000-000000000002','b1010000-0000-4000-8000-000000000002','owner','active');

insert into public.entitlements (id,organization_id,feature_key,feature_value,source)
values
  ('b6010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000001','brokerdesk.enabled','true'::jsonb,'test'),
  ('b6010000-0000-4000-8000-000000000002','b4010000-0000-4000-8000-000000000002','brokerdesk.enabled','true'::jsonb,'test');

insert into public.candidates (id,primary_owner_user_id,display_name,created_by)
values
  ('b7010000-0000-4000-8000-000000000001','b1010000-0000-4000-8000-000000000003','Candidate','b1010000-0000-4000-8000-000000000003'),
  ('b7010000-0000-4000-8000-000000000002','b1010000-0000-4000-8000-000000000005','Legacy','b1010000-0000-4000-8000-000000000005');

insert into public.broker_clients (
  id,organization_id,candidate_id,relationship_status,relationship_source,
  claimed_at,consented_at,starts_at,ends_at
) values
  ('b8010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000001','b7010000-0000-4000-8000-000000000001','active','customer_invitation',now(),now(),now()-interval '1 day',now()+interval '90 days'),
  ('b8010000-0000-4000-8000-000000000002','b4010000-0000-4000-8000-000000000002','b7010000-0000-4000-8000-000000000001','active','customer_invitation',now(),now(),now()-interval '1 day',now()+interval '90 days'),
  ('b8010000-0000-4000-8000-000000000003','b4010000-0000-4000-8000-000000000001','b7010000-0000-4000-8000-000000000002','active','customer_invitation',now(),now(),now()-interval '1 day',now()+interval '90 days');

insert into app_private.broker_client_mandates (
  id,organization_id,broker_client_id,purpose,permitted_capabilities,
  evidence_reference,consent_version,customer_approved_by,starts_at,ends_at
) values
  ('b9010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000001','b8010000-0000-4000-8000-000000000001','Family assistance',app_private.broker_mandate_capabilities('broker-representation-v3'),'fixture:v3:first','broker-representation-v3','b1010000-0000-4000-8000-000000000003',now()-interval '1 day',now()+interval '90 days'),
  ('b9010000-0000-4000-8000-000000000002','b4010000-0000-4000-8000-000000000002','b8010000-0000-4000-8000-000000000002','Family assistance',app_private.broker_mandate_capabilities('broker-representation-v3'),'fixture:v3:second','broker-representation-v3','b1010000-0000-4000-8000-000000000003',now()-interval '1 day',now()+interval '90 days'),
  ('b9010000-0000-4000-8000-000000000003','b4010000-0000-4000-8000-000000000001','b8010000-0000-4000-8000-000000000003','Legacy representation',app_private.broker_mandate_capabilities('broker-representation-v2'),'fixture:v2','broker-representation-v2','b1010000-0000-4000-8000-000000000005',now()-interval '1 day',now()+interval '90 days');

insert into app_private.candidate_family_viewers (
  candidate_id,intended_email_hash,intended_email_hint,verified_user_id,
  display_name,relationship_kind,role,status,proposed_by_organization_id,
  proposed_by_user_id,candidate_approved_by,candidate_approved_at,verified_at
) values (
  'b7010000-0000-4000-8000-000000000001',repeat('1',64),'fa***@family-setup.test',
  'b1010000-0000-4000-8000-000000000004','Second Agency Parent','parent','viewer','active',
  'b4010000-0000-4000-8000-000000000002','b1010000-0000-4000-8000-000000000002',
  'b1010000-0000-4000-8000-000000000003',now(),now()
), (
  'b7010000-0000-4000-8000-000000000001',repeat('2',64),'fi***@family-setup.test',
  null,'First Agency Parent','parent','viewer','pending_candidate_approval',
  'b4010000-0000-4000-8000-000000000001','b1010000-0000-4000-8000-000000000001',
  null,null,null
);

create temporary table family_setup_refs as
select
  (select workspace_ref from public.organizations where id='b4010000-0000-4000-8000-000000000001') first_workspace_ref,
  (select workspace_ref from public.organizations where id='b4010000-0000-4000-8000-000000000002') second_workspace_ref,
  (select relationship_ref from public.broker_clients where id='b8010000-0000-4000-8000-000000000001') first_relationship_ref,
  (select relationship_ref from public.broker_clients where id='b8010000-0000-4000-8000-000000000002') second_relationship_ref,
  (select relationship_ref from public.broker_clients where id='b8010000-0000-4000-8000-000000000003') legacy_relationship_ref;
grant select on family_setup_refs to authenticated;

set local role authenticated;
select pg_temp.set_authenticated_claims('b1010000-0000-4000-8000-000000000001','b2010000-0000-4000-8000-000000000001');
create temporary table first_setup as select public.resolve_brokerdesk_family_setup(
  (select first_workspace_ref from family_setup_refs),
  (select first_relationship_ref from family_setup_refs)
) result;
grant select on first_setup to authenticated;
select is((select result->>'available' from first_setup),'true','authorized V3 broker can resolve family setup');
select is((select result->>'activeViewerCount' from first_setup),'1','broker sees the candidate-level active viewer count');
select is((select result->>'maximumActiveViewers' from first_setup),'3','projection reports the fixed V1 maximum');
select is(pg_catalog.jsonb_array_length((select result->'ownProposals' from first_setup)),0,'broker cannot observe proposal insertion after roster deduplication');
select ok((select result::text from first_setup) !~ 'First Agency Parent','own proposal identity is withheld to prevent membership probing');
select ok((select result::text from first_setup) !~ 'Second Agency Parent|family@family-setup.test|emailHash|verifiedUser|organization','projection reveals no other-agency, raw identity, hash, or organization data');
select is(public.resolve_brokerdesk_family_setup(
  (select second_workspace_ref from family_setup_refs),
  (select first_relationship_ref from family_setup_refs)
),'{"available":false}'::jsonb,'mixed workspace and relationship references fail neutrally');
select is(public.resolve_brokerdesk_family_setup(
  (select first_workspace_ref from family_setup_refs),
  (select legacy_relationship_ref from family_setup_refs)
),'{"available":false}'::jsonb,'V2 consent cannot expose the family setup projection');
reset role;

set local role authenticated;
select pg_temp.set_authenticated_claims('b1010000-0000-4000-8000-000000000002','b2010000-0000-4000-8000-000000000002');
create temporary table second_setup as select public.resolve_brokerdesk_family_setup(
  (select second_workspace_ref from family_setup_refs),
  (select second_relationship_ref from family_setup_refs)
) result;
reset role;
select is(pg_catalog.jsonb_array_length((select result->'ownProposals' from second_setup)),0,'second agency also receives no insertion-sensitive proposal history');
select is(
  (select result from first_setup),
  (select result from second_setup),
  'different agency proposal histories produce the same broker-safe projection'
);

set local role authenticated;
select pg_temp.set_authenticated_claims('b1010000-0000-4000-8000-000000000003','b2010000-0000-4000-8000-000000000003');
select is(public.resolve_brokerdesk_family_setup(
  (select first_workspace_ref from family_setup_refs),
  (select first_relationship_ref from family_setup_refs)
),'{"available":false}'::jsonb,'candidate account cannot use the broker projection');
reset role;

-- Recheck live authority on each read, including references and post-creation
-- mandate/entitlement changes. All fixture mutations roll back with this suite.
set local role authenticated;
select pg_temp.set_authenticated_claims('b1010000-0000-4000-8000-000000000001','b2010000-0000-4000-8000-000000000001');
select is(public.resolve_brokerdesk_family_setup(
  null, (select first_relationship_ref from family_setup_refs)
),'{"available":false}'::jsonb,'null workspace reference fails closed');
reset role;

update app_private.broker_client_mandates set ends_at=now()-interval '1 hour'
where id='b9010000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('b1010000-0000-4000-8000-000000000001','b2010000-0000-4000-8000-000000000001');
select is(public.resolve_brokerdesk_family_setup(
  (select first_workspace_ref from family_setup_refs), (select first_relationship_ref from family_setup_refs)
),'{"available":false}'::jsonb,'expired V3 mandate removes broker family read authority');
reset role;
update app_private.broker_client_mandates set ends_at=now()+interval '90 days',revoked_at=now()
where id='b9010000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('b1010000-0000-4000-8000-000000000001','b2010000-0000-4000-8000-000000000001');
select is(public.resolve_brokerdesk_family_setup(
  (select first_workspace_ref from family_setup_refs), (select first_relationship_ref from family_setup_refs)
),'{"available":false}'::jsonb,'revoked V3 mandate removes broker family read authority');
reset role;
update app_private.broker_client_mandates set revoked_at=null
where id='b9010000-0000-4000-8000-000000000001';
update public.entitlements set feature_value='false'::jsonb
where id='b6010000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('b1010000-0000-4000-8000-000000000001','b2010000-0000-4000-8000-000000000001');
select is(public.resolve_brokerdesk_family_setup(
  (select first_workspace_ref from family_setup_refs), (select first_relationship_ref from family_setup_refs)
),'{"available":false}'::jsonb,'disabled BrokerDesk entitlement removes family read authority');
reset role;
update public.entitlements set feature_value='true'::jsonb
where id='b6010000-0000-4000-8000-000000000001';
update public.broker_clients set ends_at=now()-interval '1 hour'
where id='b8010000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('b1010000-0000-4000-8000-000000000001','b2010000-0000-4000-8000-000000000001');
select is(public.resolve_brokerdesk_family_setup(
  (select first_workspace_ref from family_setup_refs), (select first_relationship_ref from family_setup_refs)
),'{"available":false}'::jsonb,'ended customer relationship removes family read authority');
reset role;

select * from finish();
rollback;
