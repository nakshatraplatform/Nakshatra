begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(32);

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
insert into app_private.broker_client_mandates(id,organization_id,broker_client_id,purpose,permitted_capabilities,evidence_reference,consent_version,customer_approved_by,starts_at,ends_at) values
  ('78900000-0000-4000-8000-000000000001','78200000-0000-4000-8000-000000000001','78800000-0000-4000-8000-000000000001','NAK-78 source',array['customers.read','introductions.create','introductions.send']::app_private.brokerdesk_capability[],'nak78-a','broker-representation-v2','78000000-0000-4000-8000-000000000002',pg_catalog.now()-interval '1 day',pg_catalog.now()+interval '1 year'),
  ('78900000-0000-4000-8000-000000000002','78200000-0000-4000-8000-000000000001','78800000-0000-4000-8000-000000000002','NAK-78 recipient',array['customers.read','introductions.create','introductions.send']::app_private.brokerdesk_capability[],'nak78-b','broker-representation-v2','78000000-0000-4000-8000-000000000003',pg_catalog.now()-interval '1 day',pg_catalog.now()+interval '1 year');


update app_private.broker_client_mandates
set consent_version='broker-representation-v3',
permitted_capabilities=app_private.broker_mandate_capabilities('broker-representation-v3');
select pg_temp.create_auth_actor('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001','parent@family-dashboard.test');
insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at)
values(gen_random_uuid(),'family-dashboard-parent','f0300000-0000-4000-8000-000000000001',
'{"email":"parent@family-dashboard.test","email_verified":true}','google',now(),now());
insert into app_private.candidate_family_viewers(
candidate_id,intended_email_hash,intended_email_hint,verified_user_id,display_name,
relationship_kind,status,candidate_approved_by,candidate_approved_at,verified_at)
values('78500000-0000-4000-8000-000000000001',
app_private.normalized_email_hash('parent@family-dashboard.test'),'pa***@family-dashboard.test',
'f0300000-0000-4000-8000-000000000001','Private parent','parent','active',
'78000000-0000-4000-8000-000000000002',now(),now());

-- Equal timestamps exercise the opaque-reference tie-break. Fifty-four
-- historic rows and one active row obey the one-active-pair constraint.
insert into app_private.broker_introductions(
introduction_ref,organization_id,broker_client_id,recipient_broker_client_id,
portfolio_version_id,recipient_portfolio_version_id,detailed_snapshot,
recipient_label,created_by,status,access_model,created_at,shared_at,expires_at)
select 'bir_'||lpad(n::text,32,'0'),
'78200000-0000-4000-8000-000000000001',
'78800000-0000-4000-8000-000000000001','78800000-0000-4000-8000-000000000002',
'78700000-0000-4000-8000-000000000001','78700000-0000-4000-8000-000000000002',
'{}'::jsonb,'Private recipient label','78000000-0000-4000-8000-000000000001',
case when n=55 then 'shared' else 'expired' end,'identity_bound',
case when n=55 then now()-interval '5 minutes' else now()-interval '20 days' end,
case when n=55 then now()-interval '4 minutes' else now()-interval '19 days' end,
case when n=55 then now()+interval '1 day' else now()-interval '5 days' end
from generate_series(1,55) n;

-- The same candidate is the recipient in a different agency. Family listing
-- may span their mandates, while broker identities remain outside the payload.
insert into public.entitlements(organization_id,feature_key,feature_value,source)
values('78200000-0000-4000-8000-000000000002','brokerdesk.enabled','true'::jsonb,'family-dashboard-test');
insert into public.broker_clients(id,organization_id,candidate_id,starts_at,relationship_status)
values
('78800000-0000-4000-8000-000000000004','78200000-0000-4000-8000-000000000002','78500000-0000-4000-8000-000000000001',now()-interval '1 day','active'),
('78800000-0000-4000-8000-000000000005','78200000-0000-4000-8000-000000000002','78500000-0000-4000-8000-000000000002',now()-interval '1 day','active');
insert into app_private.broker_client_mandates(
organization_id,broker_client_id,purpose,permitted_capabilities,evidence_reference,consent_version,customer_approved_by,starts_at,ends_at)
select organization_id,id,'Family dashboard',app_private.broker_mandate_capabilities('broker-representation-v3'),
'fixture:family-dashboard','broker-representation-v3',
case when candidate_id='78500000-0000-4000-8000-000000000001' then '78000000-0000-4000-8000-000000000002'::uuid
else '78000000-0000-4000-8000-000000000003'::uuid end,now()-interval '1 day',now()+interval '90 days'
from public.broker_clients where id in ('78800000-0000-4000-8000-000000000004','78800000-0000-4000-8000-000000000005');
insert into app_private.broker_introductions(
introduction_ref,organization_id,broker_client_id,recipient_broker_client_id,
portfolio_version_id,recipient_portfolio_version_id,detailed_snapshot,
recipient_label,created_by,status,access_model,created_at,shared_at,expires_at)
values('bir_'||lpad('99',32,'0'),'78200000-0000-4000-8000-000000000002',
'78800000-0000-4000-8000-000000000005','78800000-0000-4000-8000-000000000004',
'78700000-0000-4000-8000-000000000002','78700000-0000-4000-8000-000000000001',
'{}'::jsonb,'Private label','78000000-0000-4000-8000-000000000001','expired','identity_bound',
now()-interval '20 days',now()-interval '19 days',now()-interval '5 days');

select ok(not has_function_privilege('anon','public.resolve_family_introductions(integer,timestamptz,text)','execute'),'anonymous proof cannot read the family list');
select ok(has_function_privilege('authenticated','public.resolve_family_introductions(integer,timestamptz,text)','execute'),'authenticated users invoke the guarded family list');
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
create temporary table first_page as select public.resolve_family_introductions() result;
select is((select result->>'available' from first_page),'true','activated exact Google viewer is eligible');
select is(jsonb_array_length((select result->'introductions' from first_page)),25,'default page is bounded at 25');
select is((select result #>> '{introductions,0,introductionRef}' from first_page),'bir_'||lpad('55',32,'0'),'equal timestamps use descending reference tie-break');
select is((select result #>> '{introductions,0,status}' from first_page),'active','shared unanswered row is active');
select is((select result #>> '{introductions,1,status}' from first_page),'expired','expired response period is distinct from rejection');
select is((select result #>> '{introductions,0,candidateNames,0}' from first_page),'Customer A','only supported candidate label is returned');
select ok((select result::text from first_page) !~ 'Customer B|Private parent|Private recipient|NAK-78 Agency|contact|phone|complete_data|organization','payload excludes opposite identities, agencies, contacts and portfolio data');
create temporary table second_page as select public.resolve_family_introductions(
25,(select (result #>> '{nextCursor,createdAt}')::timestamptz from first_page),
(select result #>> '{nextCursor,introductionRef}' from first_page)) result;
select is(jsonb_array_length((select result->'introductions' from second_page)),25,'next page respects page size');
select ok(not exists(select 1 from first_page a,second_page b,
jsonb_array_elements(a.result->'introductions') x,jsonb_array_elements(b.result->'introductions') y
where x->>'introductionRef'=y->>'introductionRef'),'cursor pages never duplicate equal-timestamp rows');
select ok(exists(select 1 from first_page,jsonb_array_elements(result->'introductions') item
where item->>'introductionRef'='bir_'||lpad('99',32,'0')),'family list spans agencies and recipient-side membership');
create temporary table last_page as select public.resolve_family_introductions(
25,(select (result #>> '{nextCursor,createdAt}')::timestamptz from second_page),
(select result #>> '{nextCursor,introductionRef}' from second_page)) result;
select is(jsonb_array_length((select result->'introductions' from last_page)),6,'last page contains the remaining rows');
select is((select result->'nextCursor' from last_page),'null'::jsonb,'last page has no continuation');
select is(jsonb_array_length(public.resolve_family_introductions(50)->'introductions'),50,'server page cap returns 50 of 55');
select throws_ok('select public.resolve_family_introductions(51)','22023','invalid family dashboard page','larger page is rejected');
select throws_ok('select public.resolve_family_introductions(25,now(),null)','22023','invalid family dashboard page','partial cursor is rejected');
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(public.resolve_family_introductions(),'{"available":false}'::jsonb,'broker role grants no family authority');
reset role;

update app_private.broker_client_mandates set consent_version='broker-representation-v2',
permitted_capabilities=app_private.broker_mandate_capabilities('broker-representation-v2')
where broker_client_id in ('78800000-0000-4000-8000-000000000002','78800000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
select is(jsonb_array_length(public.resolve_family_introductions()->'introductions'),0,'opposite V2 mandates cannot authorize family metadata');
reset role;
update app_private.broker_client_mandates set consent_version='broker-representation-v3',
permitted_capabilities=app_private.broker_mandate_capabilities('broker-representation-v3');

update app_private.broker_introductions set source_response='accepted',source_responded_at=now(),status='responded'
where introduction_ref='bir_'||lpad('55',32,'0');
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
select is(public.resolve_family_introductions() #>> '{introductions,0,status}','awaiting','one candidate acceptance waits for the other response');
select is(public.respond_to_broker_introduction(
  'bir_'||lpad('55',32,'0'),'','declined','Family response attempt',false
),'{"available":false}'::jsonb,'family viewer cannot submit the candidate authoritative response');
reset role;
insert into app_private.candidate_family_viewers(
candidate_id,intended_email_hash,intended_email_hint,verified_user_id,display_name,
relationship_kind,status,candidate_approved_by,candidate_approved_at,verified_at)
values('78500000-0000-4000-8000-000000000002',
app_private.normalized_email_hash('parent@family-dashboard.test'),'pa***@family-dashboard.test',
'f0300000-0000-4000-8000-000000000001','Shared family viewer','relative','active',
'78000000-0000-4000-8000-000000000003',now(),now());
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
select is(jsonb_array_length(public.resolve_family_introductions() #> '{introductions,0,candidateNames}'),2,'viewer supporting both sides receives both supported candidate labels');
select is(jsonb_array_length(public.resolve_family_introductions()->'introductions'),25,'dual-side membership does not duplicate Introduction rows');
reset role;
delete from app_private.candidate_family_viewers where candidate_id='78500000-0000-4000-8000-000000000002';
update app_private.broker_introductions set response='accepted',responded_at=now(),
source_complete_access_confirmed_at=now(),recipient_complete_access_confirmed_at=now(),
mutual_interest_confirmed_at=now(),complete_access_expires_at=now()+interval '30 days'
where introduction_ref='bir_'||lpad('55',32,'0');
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
select is(public.resolve_family_introductions() #>> '{introductions,0,status}','mutual','mutual interest is status metadata only');
select is(public.resolve_broker_introduction('bir_'||lpad('55',32,'0'),null),'{"available":false}'::jsonb,'family list authority does not grant candidate portfolio reads');
reset role;
update app_private.broker_introductions set revoked_at=now()
where introduction_ref='bir_'||lpad('55',32,'0');
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
select is(public.resolve_family_introductions() #>> '{introductions,0,status}','closed','revocation yields only safe closed history');
reset role;
update app_private.broker_client_mandates set revoked_at=now()
where broker_client_id in ('78800000-0000-4000-8000-000000000002','78800000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
select is(jsonb_array_length(public.resolve_family_introductions()->'introductions'),0,'opposite mandate revocation removes all related rows');
reset role;
update app_private.broker_client_mandates set revoked_at=null;
update app_private.candidate_family_viewers set status='revoked',revoked_at=now();
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
select is(public.resolve_family_introductions(),'{"available":false}'::jsonb,'membership removal immediately denies list access');
reset role;
update app_private.candidate_family_viewers set status='active',revoked_at=null;
update auth.users set email='changed@family-dashboard.test' where id='f0300000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
select is(public.resolve_family_introductions(),'{"available":false}'::jsonb,'changed account email cannot retain stale audience access');
reset role;
update auth.users set email='parent@family-dashboard.test' where id='f0300000-0000-4000-8000-000000000001';
delete from auth.identities where user_id='f0300000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('f0300000-0000-4000-8000-000000000001','f0310000-0000-4000-8000-000000000001');
select is(public.resolve_family_introductions(),'{"available":false}'::jsonb,'removed Google identity denies access');
reset role;
select is((select count(*) from app_private.candidate_family_viewers),1::bigint,'read operations do not create memberships');
select is((select count(*) from public.reveal_grants),0::bigint,'list reads do not create personal disclosure grants');
select * from finish();
rollback;
