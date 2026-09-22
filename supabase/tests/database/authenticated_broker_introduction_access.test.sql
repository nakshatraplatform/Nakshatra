begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(27);

select has_column('app_private','broker_introductions','recipient_broker_client_id','an Introduction pins its second customer relationship');
select has_column('app_private','broker_introductions','recipient_portfolio_version_id','an Introduction pins the second customer portfolio version');
select has_column('app_private','broker_introductions','source_response','the first customer has an independent response');
select has_function('public','resolve_broker_introduction_recipients',array['text','text'],'eligible customer discovery is server-authorized');
select has_function('public','create_identity_bound_broker_introduction',array['text','text','text','text'],'bilateral Introduction creation exists');
select has_function('public','resolve_received_broker_introductions',array[]::text[],'the customer dashboard projection exists');
select ok(not has_function_privilege('authenticated','public.create_broker_introduction(text,text,text,jsonb,text,text,text,text,text)','execute'),'authenticated callers cannot create legacy device-pass introductions');
select ok(not has_function_privilege('anon','public.resolve_broker_introduction(text,text)','execute'),'anonymous URL possession grants no broker profile access');

select pg_temp.create_auth_actor('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001','broker@nak78.test');
select pg_temp.create_auth_actor('78000000-0000-4000-8000-000000000002','78100000-0000-4000-8000-000000000002','customer-a@nak78.test');
select pg_temp.create_auth_actor('78000000-0000-4000-8000-000000000003','78100000-0000-4000-8000-000000000003','customer-b@nak78.test');
select pg_temp.create_auth_actor('78000000-0000-4000-8000-000000000004','78100000-0000-4000-8000-000000000004','unrelated@nak78.test');

insert into public.organizations(id,type,name,slug,status,created_by) values
  ('78200000-0000-4000-8000-000000000001','matchmaker_agency','NAK-78 Agency','nak-78-agency','active','78000000-0000-4000-8000-000000000001'),
  ('78200000-0000-4000-8000-000000000002','matchmaker_agency','Other Agency','nak-78-other-agency','active','78000000-0000-4000-8000-000000000001');
insert into public.organization_members(id,organization_id,user_id,role,status) values
  ('78300000-0000-4000-8000-000000000001','78200000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000001','owner','active');
insert into public.entitlements(id,organization_id,feature_key,feature_value,source) values
  ('78400000-0000-4000-8000-000000000001','78200000-0000-4000-8000-000000000001','brokerdesk.enabled','true'::jsonb,'nak-78-test');

insert into public.candidates(id,primary_owner_user_id,display_name,gender,created_by) values
  ('78500000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000002','Customer A','male','78000000-0000-4000-8000-000000000002'),
  ('78500000-0000-4000-8000-000000000002','78000000-0000-4000-8000-000000000003','Customer B','female','78000000-0000-4000-8000-000000000003'),
  ('78500000-0000-4000-8000-000000000003','78000000-0000-4000-8000-000000000004','Other Customer','female','78000000-0000-4000-8000-000000000004');
update app_private.identity_verification_subjects
set status='verified',verified_at=pg_catalog.now()-interval '1 day',expires_at=pg_catalog.now()+interval '1 year'
where candidate_id in ('78500000-0000-4000-8000-000000000001','78500000-0000-4000-8000-000000000002');

insert into public.portfolios(id,user_id,candidate_id,draft_data,published_data,is_published,expires_at) values
  ('78600000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000002','78500000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft('{"personal":{"name":"Customer A"},"contact":{"phone":"+91 9000000001"}}'::jsonb),'{"personal":{"name":"Customer A"},"contact":{"phone":"+91 9000000001"}}',false,pg_catalog.now()+interval '90 days'),
  ('78600000-0000-4000-8000-000000000002','78000000-0000-4000-8000-000000000003','78500000-0000-4000-8000-000000000002',pg_temp.complete_portfolio_draft('{"personal":{"name":"Customer B"},"contact":{"phone":"+91 9000000002"}}'::jsonb),'{"personal":{"name":"Customer B"},"contact":{"phone":"+91 9000000002"}}',false,pg_catalog.now()+interval '90 days'),
  ('78600000-0000-4000-8000-000000000003','78000000-0000-4000-8000-000000000004','78500000-0000-4000-8000-000000000003',pg_temp.complete_portfolio_draft('{"personal":{"name":"Other Customer"}}'::jsonb),'{"personal":{"name":"Other Customer"}}',false,pg_catalog.now()+interval '90 days');
insert into public.portfolio_media (
  portfolio_id,candidate_id,media_type,storage_path,visibility,sort_order
) values
  ('78600000-0000-4000-8000-000000000001','78500000-0000-4000-8000-000000000001','hero','78000000-0000-4000-8000-000000000002/78600000-0000-4000-8000-000000000001/hero.webp','public',0),
  ('78600000-0000-4000-8000-000000000002','78500000-0000-4000-8000-000000000002','hero','78000000-0000-4000-8000-000000000003/78600000-0000-4000-8000-000000000002/hero.webp','public',0);
select pg_temp.prime_paid_publication(
  '78600000-0000-4000-8000-000000000001',
  (select draft_data from public.portfolios where id='78600000-0000-4000-8000-000000000001')
);
select pg_temp.prime_paid_publication(
  '78600000-0000-4000-8000-000000000002',
  (select draft_data from public.portfolios where id='78600000-0000-4000-8000-000000000002')
);
update public.portfolios
set is_published=true
where id in (
  '78600000-0000-4000-8000-000000000001',
  '78600000-0000-4000-8000-000000000002'
);
insert into app_private.portfolio_disclosure_versions(id,portfolio_id,candidate_id,version_number,public_data,complete_data,template_id,published_at) values
  ('78700000-0000-4000-8000-000000000001','78600000-0000-4000-8000-000000000001','78500000-0000-4000-8000-000000000001',1,'{"personal":{"name":"Public A"}}','{"personal":{"name":"Customer A"},"contact":{"phone":"+91 9000000001"}}',1,pg_catalog.now()),
  ('78700000-0000-4000-8000-000000000002','78600000-0000-4000-8000-000000000002','78500000-0000-4000-8000-000000000002',1,'{"personal":{"name":"Public B"}}','{"personal":{"name":"Customer B"},"contact":{"phone":"+91 9000000002"}}',1,pg_catalog.now()),
  ('78700000-0000-4000-8000-000000000003','78600000-0000-4000-8000-000000000003','78500000-0000-4000-8000-000000000003',1,'{"personal":{"name":"Other Customer"}}','{"personal":{"name":"Other Customer"}}',1,pg_catalog.now());

insert into public.broker_clients(id,organization_id,candidate_id,introduced_by,starts_at,relationship_status) values
  ('78800000-0000-4000-8000-000000000001','78200000-0000-4000-8000-000000000001','78500000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000001',pg_catalog.now()-interval '1 day','active'),
  ('78800000-0000-4000-8000-000000000002','78200000-0000-4000-8000-000000000001','78500000-0000-4000-8000-000000000002','78000000-0000-4000-8000-000000000001',pg_catalog.now()-interval '1 day','active'),
  ('78800000-0000-4000-8000-000000000003','78200000-0000-4000-8000-000000000002','78500000-0000-4000-8000-000000000003','78000000-0000-4000-8000-000000000001',pg_catalog.now()-interval '1 day','active');
insert into app_private.broker_client_mandates(id,organization_id,broker_client_id,purpose,permitted_capabilities,evidence_reference,customer_approved_by,starts_at,ends_at) values
  ('78900000-0000-4000-8000-000000000001','78200000-0000-4000-8000-000000000001','78800000-0000-4000-8000-000000000001','NAK-78 source',array['customers.read','introductions.create','introductions.send']::app_private.brokerdesk_capability[],'nak78-a','78000000-0000-4000-8000-000000000002',pg_catalog.now()-interval '1 day',pg_catalog.now()+interval '1 year'),
  ('78900000-0000-4000-8000-000000000002','78200000-0000-4000-8000-000000000001','78800000-0000-4000-8000-000000000002','NAK-78 recipient',array['customers.read','introductions.create','introductions.send']::app_private.brokerdesk_capability[],'nak78-b','78000000-0000-4000-8000-000000000003',pg_catalog.now()-interval '1 day',pg_catalog.now()+interval '1 year');

create temporary table nak78_refs as
select organization.workspace_ref,
  (select relationship_ref from public.broker_clients where id='78800000-0000-4000-8000-000000000001') source_ref,
  (select relationship_ref from public.broker_clients where id='78800000-0000-4000-8000-000000000002') recipient_ref,
  (select relationship_ref from public.broker_clients where id='78800000-0000-4000-8000-000000000003') other_agency_ref
from public.organizations organization where organization.id='78200000-0000-4000-8000-000000000001';
create temporary table nak78_created(data jsonb);
grant select on nak78_refs to authenticated;
grant select,insert on nak78_created to authenticated;

set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(public.resolve_broker_introduction_recipients((select workspace_ref from nak78_refs),(select source_ref from nak78_refs))->'recipients'->0->>'relationshipRef',(select recipient_ref from nak78_refs),'the broker sees the other eligible verified customer dynamically');
reset role;
update public.candidates
set primary_owner_user_id='78000000-0000-4000-8000-000000000002'
where id='78500000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(pg_catalog.jsonb_array_length(public.resolve_broker_introduction_recipients((select workspace_ref from nak78_refs),(select source_ref from nak78_refs))->'recipients'),0,'candidate records controlled by the same account are not offered as independent recipients');
select is(public.create_identity_bound_broker_introduction((select workspace_ref from nak78_refs),(select source_ref from nak78_refs),(select recipient_ref from nak78_refs),'nak78-shared-owner-0001'),'{"available":false}'::jsonb,'one account cannot control both sides of an Introduction');
reset role;
update public.candidates
set primary_owner_user_id='78000000-0000-4000-8000-000000000003'
where id='78500000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(public.create_identity_bound_broker_introduction((select workspace_ref from nak78_refs),(select source_ref from nak78_refs),(select other_agency_ref from nak78_refs),'nak78-cross-agency-0001'),'{}'::jsonb || '{"available":false}'::jsonb,'a relationship from another agency cannot become a participant');
insert into nak78_created(data) select public.create_identity_bound_broker_introduction((select workspace_ref from nak78_refs),(select source_ref from nak78_refs),(select recipient_ref from nak78_refs),'nak78-create-pair-0001');
select is((select data->>'status' from nak78_created),'created','the broker creates one bilateral Introduction');
select is(public.create_identity_bound_broker_introduction((select workspace_ref from nak78_refs),(select recipient_ref from nak78_refs),(select source_ref from nak78_refs),'nak78-reversed-pair-0001'),'{"available":false}'::jsonb,'the same agency cannot create a reversed duplicate while the pair is active');
reset role;
select ok((select access_model='identity_bound' and recipient_portfolio_version_id is not null from app_private.broker_introductions where introduction_ref=(select data->>'introductionRef' from nak78_created)),'both participant identities and portfolio versions are pinned');
update public.candidates
set primary_owner_user_id='78000000-0000-4000-8000-000000000002'
where id='78500000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(public.mark_broker_introduction_shared((select workspace_ref from nak78_refs),(select data->>'introductionRef' from nak78_created),1),'{"available":false}'::jsonb,'the broker cannot activate an Introduction after both participants collapse onto one owner account');
reset role;
update public.candidates
set primary_owner_user_id='78000000-0000-4000-8000-000000000003'
where id='78500000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(public.mark_broker_introduction_shared((select workspace_ref from nak78_refs),(select data->>'introductionRef' from nak78_created),1)->>'status','shared','the broker activates the Introduction');

reset role;
update public.candidates
set primary_owner_user_id='78000000-0000-4000-8000-000000000002'
where id='78500000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000002','78100000-0000-4000-8000-000000000002');
select is(public.resolve_broker_introduction((select data->>'introductionRef' from nak78_created),null),'{"available":false}'::jsonb,'an ownership change that collapses both participants onto one account fails closed');
select is(public.respond_to_broker_introduction((select data->>'introductionRef' from nak78_created),'','accepted','Interested'),'{"available":false}'::jsonb,'collapsed ownership cannot submit either participant response');
select is(pg_catalog.jsonb_array_length(public.resolve_received_broker_introductions()->'introductions'),0,'collapsed ownership hides the Introduction from the customer dashboard');
reset role;
update public.candidates
set primary_owner_user_id='78000000-0000-4000-8000-000000000003'
where id='78500000-0000-4000-8000-000000000002';
set local role authenticated;

select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000004','78100000-0000-4000-8000-000000000004');
select is(public.resolve_broker_introduction((select data->>'introductionRef' from nak78_created),null),'{"available":false}'::jsonb,'an unrelated signed-in customer learns nothing from the URL');
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000002','78100000-0000-4000-8000-000000000002');
select ok(public.resolve_broker_introduction((select data->>'introductionRef' from nak78_created),null)#>>'{data,personal,name}'='Customer B' and not (public.resolve_broker_introduction((select data->>'introductionRef' from nak78_created),null)->'data'?'contact'),'Customer A sees Customer B Broker Standard Profile without Protected Contact');
select is(public.respond_to_broker_introduction((select data->>'introductionRef' from nak78_created),'','accepted','Interested')->>'response','accepted','Customer A records an independent response');
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000003','78100000-0000-4000-8000-000000000003');
select ok(public.resolve_broker_introduction((select data->>'introductionRef' from nak78_created),null)#>>'{data,personal,name}'='Customer A' and not (public.resolve_broker_introduction((select data->>'introductionRef' from nak78_created),null)->'data'?'contact'),'Customer B sees Customer A Broker Standard Profile without Protected Contact');
select is(public.respond_to_broker_introduction((select data->>'introductionRef' from nak78_created),'','declined','Not proceeding')->>'response','declined','Customer B records a separate response');
reset role;
select ok((select source_response='accepted' and response='declined' from app_private.broker_introductions where introduction_ref=(select data->>'introductionRef' from nak78_created)),'the two responses remain independently auditable');

update public.broker_clients set relationship_status='paused' where id='78800000-0000-4000-8000-000000000002';
select ok((select revoked_at is not null from app_private.broker_introductions where introduction_ref=(select data->>'introductionRef' from nak78_created)),'pausing either participant relationship revokes the disclosure');

select * from finish();
rollback;
