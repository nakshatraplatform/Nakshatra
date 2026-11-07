begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(89);

select pg_temp.create_auth_actor('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001','broker@nak78.test');
select pg_temp.create_auth_actor('78000000-0000-4000-8000-000000000002','78100000-0000-4000-8000-000000000002','customer-a@nak78.test');
select pg_temp.create_auth_actor('78000000-0000-4000-8000-000000000003','78100000-0000-4000-8000-000000000003','customer-b@nak78.test');
select pg_temp.create_auth_actor('78000000-0000-4000-8000-000000000004','78100000-0000-4000-8000-000000000004','unrelated@nak78.test');

insert into public.organizations(id,type,name,slug,status,created_by) values
  ('78200000-0000-4000-8000-000000000001','matchmaker_agency','NAK-78 Agency','nak-78-agency','active','78000000-0000-4000-8000-000000000001'),
  ('78200000-0000-4000-8000-000000000002','matchmaker_agency','Other Agency','nak-78-other-agency','active','78000000-0000-4000-8000-000000000001');
insert into public.organization_members(id,organization_id,user_id,role,status) values
  ('78300000-0000-4000-8000-000000000001','78200000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000001','owner','active');
insert into app_private.organization_member_access(organization_id,member_id,role_preset)
values('78200000-0000-4000-8000-000000000001','78300000-0000-4000-8000-000000000001','owner')
on conflict(member_id) do update set role_preset='owner';
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

insert into app_private.broker_introductions(
introduction_ref,organization_id,broker_client_id,recipient_broker_client_id,portfolio_version_id,
recipient_portfolio_version_id,detailed_snapshot,recipient_label,created_by,status,access_model,created_at,expires_at)
select 'bir_'||lpad(n::text,32,'0'),'78200000-0000-4000-8000-000000000001',
'78800000-0000-4000-8000-000000000001','78800000-0000-4000-8000-000000000002',
'78700000-0000-4000-8000-000000000001','78700000-0000-4000-8000-000000000002',
'{}','Private recipient','78000000-0000-4000-8000-000000000001',
case when n=55 then 'created' else 'expired' end,'identity_bound',
case when n=55 then now()-interval '5 minutes' else now()-interval '20 days' end,
now()+interval '15 days' from generate_series(1,55) n;
create function pg_temp.workspace(n integer) returns text language sql security definer set search_path='' as $$
select workspace_ref from public.organizations where id=case n when 1 then '78200000-0000-4000-8000-000000000001'::uuid else '78200000-0000-4000-8000-000000000002'::uuid end;
$$;
create function pg_temp.action() returns jsonb language sql as $$
select public.resolve_brokerdesk_introduction_action(pg_temp.workspace(1),'bir_'||lpad('55',32,'0'));
$$;
create function pg_temp.share(s text,a text,v bigint,k text) returns jsonb language sql as $$
select public.record_introduction_share_action(pg_temp.workspace(1),'bir_'||lpad('55',32,'0'),s,a,v,k);
$$;
-- END NAK-204 CONCURRENCY FIXTURE: the guarded local harness reuses this setup.
select is((select count(*)::integer from app_private.broker_introduction_share_states),110,'both sides created atomically including historical rows');
select ok(not has_table_privilege('authenticated','app_private.broker_introduction_share_states','select'),'no direct authenticated table reads');
select ok(not has_table_privilege('service_role','app_private.broker_introduction_share_states','update'),'service key cannot mutate side state directly');
select ok(not has_function_privilege('anon','public.record_introduction_share_action(text,text,text,text,bigint,text)','execute'),'anonymous share calls denied');
select ok(not has_function_privilege('authenticated','app_private.initialize_introduction_share_states()','execute'),'trigger helper is not callable by clients');

set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(pg_temp.action()->>'available','true','owner sees a scoped Introduction');
select is(pg_temp.action()#>>'{sides,0,shareState}','not_started','no historical delivery inferred');
select is(pg_temp.action()->>'canActivate','true','created Introduction can be activated');
select is(pg_temp.share('source','initiate',1,'nak204:beforeactivate')->>'available','false','attempt cannot bypass canonical activation');
select is(public.mark_broker_introduction_shared(pg_temp.workspace(1),'bir_'||lpad('55',32,'0'),1)->>'available','true','existing activation workflow reused');
select is(pg_temp.action()#>>'{sides,0,shareState}','not_started','legacy activation does not mark either side shared');
create temporary table first_attempt as select pg_temp.share('source','initiate',1,'nak204:firstattempt') result;
select is((select result->>'shareState' from first_attempt),'initiated','copy or share action records attempt');
select is((select result->>'rowVersion' from first_attempt),'2','selected side version advances');
select is(pg_temp.share('source','initiate',1,'nak204:firstattempt'),(select result from first_attempt),'same payload retry returns original result');
select throws_ok($$select pg_temp.share('recipient','initiate',1,'nak204:firstattempt')$$,'22023','share action key conflict','same key cannot change side');
select throws_ok($$select pg_temp.share('source','confirm',1,'nak204:staleversion')$$,'40001','share state changed; refresh and retry','stale tab cannot overwrite');
select is(pg_temp.action()#>>'{sides,1,shareState}','not_started','other side remains untouched');
select is(pg_temp.share('source','confirm',2,'nak204:confirmshared')->>'shareState','broker_confirmed','explicit confirmation distinguished from attempt');
select throws_ok($$select pg_temp.share('recipient','remind',1,'nak204:noshareyet00')$$,'54000','reminder unavailable','no reminder before a share attempt');
select is(pg_temp.share('source','remind',3,'nak204:firstreminder')->>'rowVersion','4','waiting side can start reminder');
select throws_ok($$select pg_temp.share('source','remind',4,'nak204:cooldown0000')$$,'54000','reminder unavailable','24 hour cooldown prevents repeated reminder');
select is(pg_temp.action()#>>'{sides,0,reminderCount}','1','reminder count increments once');
select is(pg_temp.action()#>>'{sides,0,canRemind}','false','server exposes cooldown to UI');
select is(pg_temp.share('recipient','confirm',1,'nak204:manualconfirm')->>'shareState','broker_confirmed','manual confirmation may record an earlier offline share');
select is(pg_temp.action()#>>'{sides,1,initiatedAt}',null,'offline confirmation does not invent an app attempt');
select throws_ok($$select pg_temp.share('source','delete',4,'nak204:badaction000')$$,'22023','invalid share action','closed command vocabulary enforced');
select throws_ok($$select pg_temp.share(null,'initiate',4,'nak204:badside00000')$$,'22023','invalid share action','null side rejected');
select throws_ok($$select pg_temp.share('source','initiate',0,'nak204:badversion00')$$,'22023','invalid share action','nonpositive version rejected');
select is(public.resolve_brokerdesk_introduction_action(pg_temp.workspace(2),'bir_'||lpad('55',32,'0'))->>'available','false','workspace substitution cannot cross tenants');
select is(public.resolve_brokerdesk_introduction_action(pg_temp.workspace(1),'bir_'||repeat('f',32))->>'available','false','unknown reference gives neutral denial');
select ok(pg_temp.action()::text not like '%900000000%' and pg_temp.action()::text not like '%actor_user_id%','projection excludes contacts and actor identity');
select is(jsonb_array_length(public.resolve_brokerdesk_introduction_actions(pg_temp.workspace(1))->'introductions'),25,'list defaults to 25');
create temporary table action_page as select public.resolve_brokerdesk_introduction_actions(pg_temp.workspace(1),50) result;
select is(jsonb_array_length((select result->'introductions' from action_page)),50,'maximum list bound is 50');
select is(jsonb_array_length(public.resolve_brokerdesk_introduction_actions(pg_temp.workspace(1),50,
(select (result#>>'{nextCursor,createdAt}')::timestamptz from action_page),
(select result#>>'{nextCursor,introductionRef}' from action_page))->'introductions'),5,'keyset cursor terminates without duplicate rows');
select throws_ok($$select public.resolve_brokerdesk_introduction_actions(pg_temp.workspace(1),51)$$,'22023','invalid Introduction page','oversize pages denied');
select throws_ok($$select public.resolve_brokerdesk_introduction_actions(pg_temp.workspace(1),25,now(),null)$$,'22023','invalid Introduction page','half cursor denied');
reset role;
select is((select count(*)::integer from app_private.broker_introduction_events where event_type='share_initiated'),1,'replay and denied attempts create no extra events');
select is((select count(*)::integer from app_private.brokerdesk_audit_events where event_name='introduction.share_initiated'),1,'attempt audit written exactly once');
select ok((select source_response is null and response is null and complete_access_expires_at is null from app_private.broker_introductions where introduction_ref='bir_'||lpad('55',32,'0')),'broker actions do not change responses or grants');
insert into app_private.broker_introduction_events(organization_id,introduction_id,event_type,actor_kind,safe_details)
select organization_id,id,'created','broker','{"privateComment":"hidden","contact":"900000000","side":"forged"}'
from app_private.broker_introductions where introduction_ref='bir_'||lpad('55',32,'0');
set local role authenticated;
select ok(pg_temp.action()::text not like '%hidden%' and pg_temp.action()::text not like '%forged%','timeline discards arbitrary event details');
reset role;
insert into app_private.broker_introduction_events(organization_id,introduction_id,event_type,actor_kind)
select organization_id,id,'created','broker' from app_private.broker_introductions
cross join generate_series(1,110) where introduction_ref='bir_'||lpad('55',32,'0');
set local role authenticated;
select is(jsonb_array_length(pg_temp.action()->'timeline'),100,'history is bounded to latest 100 events');
select is(public.record_introduction_share_action(pg_temp.workspace(1),'bir_'||lpad('1',32,'0'),'source','initiate',1,'nak204:expiredintro')->>'available','false','expired Introduction cannot be shared');
reset role;
update app_private.broker_introduction_share_states set reminder_count=30,last_reminded_at=now()-interval '2 days'
where introduction_id=(select id from app_private.broker_introductions where introduction_ref='bir_'||lpad('55',32,'0')) and participant_side='source';
set local role authenticated;
select throws_ok($$select pg_temp.share('source','remind',4,'nak204:remindercap0')$$,'54000','reminder unavailable','database enforces total reminder cap');
reset role;
update app_private.broker_introduction_share_states set reminder_count=1 where participant_side='source'
and introduction_id=(select id from app_private.broker_introductions where introduction_ref='bir_'||lpad('55',32,'0'));
insert into public.organization_members(id,organization_id,user_id,role,status)
values('78300000-0000-4000-8000-000000000004','78200000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000004','broker_agent','active');
insert into app_private.organization_member_access(organization_id,member_id,role_preset)
values('78200000-0000-4000-8000-000000000001','78300000-0000-4000-8000-000000000004','advisor')
on conflict(member_id) do update set role_preset='advisor';
insert into app_private.broker_client_assignments(organization_id,broker_client_id,member_id)
values('78200000-0000-4000-8000-000000000001','78800000-0000-4000-8000-000000000001','78300000-0000-4000-8000-000000000004');
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000004','78100000-0000-4000-8000-000000000004');
select is(pg_temp.action()->>'available','false','one assigned side cannot expose the other participant');
select is(pg_temp.share('source','initiate',4,'nak204:oneassigned')->>'available','false','one assigned side cannot mutate sharing');
reset role;
insert into app_private.broker_client_assignments(organization_id,broker_client_id,member_id)
values('78200000-0000-4000-8000-000000000001','78800000-0000-4000-8000-000000000002','78300000-0000-4000-8000-000000000004');
set local role authenticated;
select is(pg_temp.action()#>>'{sides,0,canShare}','true','advisor assigned to both sides can share');
reset role;
update app_private.organization_member_access set role_preset='coordinator' where member_id='78300000-0000-4000-8000-000000000004';
set local role authenticated;
select is(pg_temp.action()#>>'{sides,0,canShare}','true','coordinator assigned to both sides can share');
reset role;
update app_private.organization_member_access set role_preset='viewer' where member_id='78300000-0000-4000-8000-000000000004';
set local role authenticated;
select is(pg_temp.action()#>>'{sides,0,canShare}','false','read-only viewer has no sharing controls');
select is(pg_temp.share('source','initiate',4,'nak204:viewerdenied')->>'available','false','viewer cannot call sharing RPC directly');
reset role;
update public.organization_members set status='suspended' where id='78300000-0000-4000-8000-000000000004';
set local role authenticated;
select is(pg_temp.action()->>'available','false','suspended member cannot retain read authority');
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
reset role;
update app_private.brokerdesk_command_idempotency set expires_at=now()-interval '1 second'
where command_name='record_introduction_share_action' and idempotency_key='nak204:manualconfirm';
set local role authenticated;
select is(pg_temp.share('recipient','confirm',2,'nak204:manualconfirm')->>'rowVersion','3','expired idempotency key is safely reusable');
reset role;
update app_private.broker_introductions set revoked_at=now(),status='revoked' where introduction_ref='bir_'||lpad('55',32,'0');
set local role authenticated;
select is(pg_temp.share('source','initiate',4,'nak204:revokedintro')->>'available','false','revoked Introduction cannot be shared');
reset role;
update app_private.broker_introductions set revoked_at=null,status='shared' where introduction_ref='bir_'||lpad('55',32,'0');
set local role authenticated;
select is(pg_temp.action()->>'available','true','historical workspace remains readable under current mandates');
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000002','78100000-0000-4000-8000-000000000002');
select is(pg_temp.action()->>'available','false','candidate cannot read broker operations');
select is(pg_temp.share('source','initiate',4,'nak204:candidate00')->>'available','false','candidate cannot spoof broker share');
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000004','78100000-0000-4000-8000-000000000004');
select is(public.resolve_brokerdesk_introduction_actions(pg_temp.workspace(1))->>'available','false','unrelated account cannot list workspace');
reset role;
update app_private.broker_client_mandates set consent_version='broker-representation-v2',
permitted_capabilities=app_private.broker_mandate_capabilities('broker-representation-v2');
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(pg_temp.action()->>'available','true','V2 read compatibility preserved');
select is(pg_temp.action()#>>'{sides,0,canShare}','false','V2 cannot use V3 sharing');
select is(pg_temp.share('source','initiate',4,'nak204:v2denied000')->>'available','false','V2 mutation rejected');
reset role;
update app_private.broker_client_mandates set consent_version='broker-representation-v3',
permitted_capabilities=app_private.broker_mandate_capabilities('broker-representation-v3');
update public.portfolios set is_published=false where id='78600000-0000-4000-8000-000000000002';
set local role authenticated;
select is(pg_temp.share('source','initiate',4,'nak204:unpublished')->>'available','false','unpublished opposite candidate disables sharing');
reset role;
update public.portfolios set is_published=true where id='78600000-0000-4000-8000-000000000002';
update app_private.broker_introductions set source_response='accepted',source_responded_at=now(),status='responded'
where introduction_ref='bir_'||lpad('55',32,'0');
update app_private.broker_introduction_share_states set last_reminded_at=now()-interval '2 days',reminder_count=1
where introduction_id=(select id from app_private.broker_introductions where introduction_ref='bir_'||lpad('55',32,'0')) and participant_side='source';
set local role authenticated;
select throws_ok($$select pg_temp.share('source','remind',4,'nak204:responded00')$$,'54000','reminder unavailable','responded side cannot be reminded');
reset role;
update app_private.broker_client_mandates set revoked_at=now() where broker_client_id='78800000-0000-4000-8000-000000000002';
set local role authenticated;
select is(pg_temp.action()->>'available','false','opposite mandate revocation removes read authority');
select is(pg_temp.share('source','initiate',1,'nak204:firstattempt')->>'available','false','idempotent replay rechecks current authority');
reset role;
-- NAK-205 uses the same verified candidates, scoped workspace and V3 mandates.
update app_private.broker_client_mandates set revoked_at=null
where broker_client_id='78800000-0000-4000-8000-000000000002';
update app_private.broker_introductions set source_response=null,source_responded_at=null,status='shared',row_version=20
where introduction_ref='bir_'||lpad('55',32,'0');

create function pg_temp.family_update(s text, outcome text, speaker text, attested boolean, v bigint, k text, org integer default 1)
returns jsonb language sql as $$
select public.record_introduction_family_update(pg_temp.workspace(org),'bir_'||lpad('55',32,'0'),
  s,outcome,speaker,'phone','Agency-only fixture note',attested,v,k);
$$;
select ok(not has_table_privilege('authenticated','app_private.broker_introduction_family_updates','select'),'agency notes cannot be read directly');
select ok(not has_function_privilege('authenticated','app_private.start_broker_complete_access(uuid,uuid,text)','execute'),'private transition cannot be called by an authenticated client');
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(pg_temp.family_update('source','accepted','candidate',true,20,'nak205:wrongagency',2)->>'available','false','wrong agency cannot record consent');
select throws_ok($$select pg_temp.family_update('source','accepted','candidate',false,20,'nak205:noattestation')$$,
  '22023','candidate or authorized parent consent is required','interest without disclosure attestation is rejected');
select throws_ok($$select pg_temp.family_update('source','accepted','family',true,20,'nak205:familydenied')$$,
  '22023','candidate or authorized parent consent is required','ordinary family feedback does not authorize disclosure');
select is(pg_temp.family_update('source','needs_time','family',false,20,'nak205:needs-time00')->>'rowVersion','21','family feedback is saved without confirming interest');
select is(pg_temp.action()#>>'{sides,0,response}',null,'family feedback leaves the candidate response open');
select throws_ok($$select pg_temp.family_update('source','accepted','candidate',true,20,'nak205:staleversion')$$,
  '40001','response state changed; refresh and retry','stale response command is rejected');
select is(pg_temp.family_update('source','accepted','candidate',true,21,'nak205:firstinterest')->>'completeAccessExpiresAt',null,
  'one side cannot open Complete access');
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000002','78100000-0000-4000-8000-000000000002');
select is(public.resolve_broker_introduction('bir_'||lpad('55',32,'0'),null)->>'disclosureLevel','broker_standard','candidate can still see only Broker Standard after one interest');
select is(pg_temp.family_update('recipient','accepted','candidate',true,22,'nak205:customerdeny')->>'available','false','candidate cannot impersonate a broker recorder');
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
create temporary table recorded_mutual as select pg_temp.family_update('recipient','accepted','authorized_parent',true,22,'nak205:mutualinterest') result;
select ok((select result->>'completeAccessExpiresAt' is not null from recorded_mutual),'authorized parent consent opens mutual access without another response');
select is(pg_temp.family_update('recipient','accepted','authorized_parent',true,22,'nak205:mutualinterest'),
  (select result from recorded_mutual),'retry returns the original result');
select throws_ok($$select pg_temp.family_update('recipient','declined','authorized_parent',true,22,'nak205:mutualinterest')$$,
  '22023','response record key conflict','retry key cannot be reused to change the outcome');
select is(public.resolve_brokerdesk_introduction_action_with_responses(pg_temp.workspace(1),'bir_'||lpad('55',32,'0'))
  #>>'{sides,1,latestUpdate,reportedBy}','authorized_parent','workspace shows the source of the recorded decision');
select ok(pg_temp.action()::text not like '%Agency-only fixture note%','legacy workspace DTO excludes private report text');
select is(public.resolve_broker_introduction('bir_'||lpad('55',32,'0'),null)->>'available','false','recording decisions gives no portfolio access to the broker');
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000002','78100000-0000-4000-8000-000000000002');
select is(public.resolve_broker_introduction('bir_'||lpad('55',32,'0'),null)->>'disclosureLevel','complete','candidate sees the pinned Complete Portfolio after mutual interest');
select ok(public.resolve_broker_introduction('bir_'||lpad('55',32,'0'),null)->'data'?'contact','Complete access includes Protected Contact for the candidate');
select ok(public.resolve_broker_introduction('bir_'||lpad('55',32,'0'),null)::text not like '%Agency-only fixture note%','candidate never sees private agency notes');
reset role;
select is((select count(*)::integer from app_private.broker_introduction_events where event_type='mutual_access_granted'),1,
  'broker consent starts exactly one mutual transition');
select is((select count(*)::integer from app_private.broker_introduction_family_updates),3,'successful records are append-only and retry adds no duplicate');
select ok((select complete_access_expires_at=mutual_interest_confirmed_at+interval '30 days'
  from app_private.broker_introductions where introduction_ref='bir_'||lpad('55',32,'0')),'broker transition uses the canonical 30-day window');
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000003','78100000-0000-4000-8000-000000000003');
select is(public.resolve_broker_introduction('bir_'||lpad('55',32,'0'),null)->>'disclosureLevel','complete','the other candidate also receives Complete access');
select ok(public.resolve_broker_introduction('bir_'||lpad('55',32,'0'),null)->'data'?'contact','the other candidate receives Protected Contact');
reset role;
update app_private.broker_introductions set revoked_at=now()
where introduction_ref='bir_'||lpad('55',32,'0');
set local role authenticated;
select pg_temp.set_authenticated_claims('78000000-0000-4000-8000-000000000001','78100000-0000-4000-8000-000000000001');
select is(public.resolve_brokerdesk_introduction_action_with_responses(pg_temp.workspace(1),'bir_'||lpad('55',32,'0'))->>'completeAccessExpiresAt',
  null,'revoked Introduction no longer advertises active Complete access');
reset role;
select * from finish();
rollback;
