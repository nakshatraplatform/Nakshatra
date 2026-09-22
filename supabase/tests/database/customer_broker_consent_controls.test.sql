begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(24);

select has_function(
  'public','manage_customer_broker_consent',array['text','text','text'],
  'customer broker consent command exists'
);

select pg_temp.create_auth_actor('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','owner@consent-controls.test');
select pg_temp.create_auth_actor('e1000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002','other@consent-controls.test');
select pg_temp.create_auth_actor('e1000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000003','broker@consent-controls.test');

insert into public.organizations (id,type,name,slug,status,created_by)
values ('e3000000-0000-4000-8000-000000000001','matchmaker_agency','Consent Agency','consent-agency','active','e1000000-0000-4000-8000-000000000003');
insert into public.candidates (id,primary_owner_user_id,display_name,gender,created_by)
values ('e4000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Customer','female','e1000000-0000-4000-8000-000000000001');
insert into public.portfolios (id,user_id,candidate_id,draft_data,is_published)
values (
  'e5000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001','{}',false
);
insert into public.broker_clients (
  id,organization_id,candidate_id,relationship_status,relationship_source,
  consented_at,starts_at,ends_at
) values (
  'e6000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001','active','customer_invitation',
  pg_catalog.now()-interval '1 day',pg_catalog.now()-interval '1 day',pg_catalog.now()+interval '1 year'
);
insert into app_private.broker_client_mandates (
  organization_id,broker_client_id,purpose,permitted_capabilities,
  evidence_reference,customer_approved_by,starts_at,ends_at
) values (
  'e3000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001',
  'Matrimonial matchmaking representation',array['customers.read','introductions.create','introductions.send']::app_private.brokerdesk_capability[],
  'initial-consent','e1000000-0000-4000-8000-000000000001',
  pg_catalog.now()-interval '1 day',pg_catalog.now()+interval '1 year'
);
insert into app_private.portfolio_disclosure_versions (
  id,portfolio_id,candidate_id,version_number,public_data,complete_data,
  template_id,published_at
) values (
  'e7000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001',1,'{}','{}',1,pg_catalog.now()
);
insert into app_private.broker_introductions (
  id,organization_id,broker_client_id,portfolio_version_id,detailed_snapshot,
  recipient_label,status,response,response_comment,responded_at,created_by,shared_at,expires_at
) values
  ('e8000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','{}','Family One','shared',null,null,null,'e1000000-0000-4000-8000-000000000003',pg_catalog.now(),pg_catalog.now()+interval '14 days'),
  ('e8000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','{}','Family Two','responded','accepted','Interested',pg_catalog.now(),'e1000000-0000-4000-8000-000000000003',pg_catalog.now(),pg_catalog.now()+interval '14 days');
insert into app_private.broker_introduction_passes (introduction_id,claim_token_hash,expires_at)
values
  ('e8000000-0000-4000-8000-000000000001',repeat('a',64),pg_catalog.now()+interval '14 days'),
  ('e8000000-0000-4000-8000-000000000002',repeat('b',64),pg_catalog.now()+interval '14 days');

create temporary table consent_refs as
select relationship_ref from public.broker_clients where id='e6000000-0000-4000-8000-000000000001';
grant select on consent_refs to authenticated;

update public.broker_clients
set relationship_status='intake_pending'
where id='e6000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001');
select is(
  public.manage_customer_broker_consent((select relationship_ref from consent_refs),'renew','consent-renew-too-early-0001'),
  '{"available": false}'::jsonb,
  'renew cannot bypass the invitation and claim lifecycle'
);
reset role;
select is((select count(*)::integer from app_private.broker_client_mandates where revoked_at is null),1,'a forbidden early renewal changes no mandate');
update public.broker_clients set relationship_status='active'
where id='e6000000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_temp.set_authenticated_claims('e1000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002');
select is(
  public.manage_customer_broker_consent((select relationship_ref from consent_refs),'pause','consent-wrong-owner-0001'),
  '{"available": false}'::jsonb,
  'an opaque relationship reference does not authorize another customer'
);
reset role;
select is((select relationship_status from public.broker_clients where id='e6000000-0000-4000-8000-000000000001'),'active','a denied command writes nothing');

set local role authenticated;
select pg_temp.set_authenticated_claims('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001');
create temporary table paused_result as select public.manage_customer_broker_consent(
  (select relationship_ref from consent_refs),'pause','consent-pause-owner-0001'
) result;
select is((select result->>'relationshipStatus' from paused_result),'paused','the owner can pause broker authority');
reset role;
select is((select relationship_status from public.broker_clients where id='e6000000-0000-4000-8000-000000000001'),'paused','pause updates the relationship atomically');
select is((select count(*)::integer from app_private.broker_client_mandates where revoked_at is null),0,'pause revokes the active mandate');
select is((select status from app_private.broker_introductions where id='e8000000-0000-4000-8000-000000000001'),'revoked','pause revokes an outstanding introduction');
select ok((select status='responded' and revoked_at is not null from app_private.broker_introductions where id='e8000000-0000-4000-8000-000000000002'),'pause preserves the response while revoking its disclosure');
select is((select count(*)::integer from app_private.broker_introduction_passes where revoked_at is not null),2,'pause revokes every current disclosure pass');
select is((select count(*)::integer from app_private.brokerdesk_audit_events where event_name='customer.broker_consent.pause'),1,'pause appends one safe audit event');
select throws_ok(
  $$insert into app_private.broker_introductions (
      id,organization_id,broker_client_id,portfolio_version_id,detailed_snapshot,
      recipient_label,status,created_by,expires_at
    ) values (
      'e8000000-0000-4000-8000-000000000003','e3000000-0000-4000-8000-000000000001',
      'e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',
      '{}','Racing Family','created','e1000000-0000-4000-8000-000000000003',pg_catalog.now()+interval '14 days'
    )$$,
  '42501','active customer mandate required',
  'the database prevents introduction creation after the customer pause'
);

set local role authenticated;
select pg_temp.set_authenticated_claims('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001');
select is(
  public.manage_customer_broker_consent((select relationship_ref from consent_refs),'pause','consent-pause-owner-0002')->>'relationshipStatus',
  'paused','repeated pause is a successful no-op'
);
create temporary table renewed_result as select public.manage_customer_broker_consent(
  (select relationship_ref from consent_refs),'renew','consent-renew-owner-0001'
) result;
select is((select result->>'relationshipStatus' from renewed_result),'active','renew resumes the relationship with fresh consent');
reset role;
select is((select count(*)::integer from app_private.broker_client_mandates where revoked_at is null),1,'renew creates exactly one current mandate');
select ok((select ends_at > pg_catalog.now()+interval '364 days' from app_private.broker_client_mandates where revoked_at is null),'renew grants a bounded one-year mandate');
select is((select status from app_private.broker_introductions where id='e8000000-0000-4000-8000-000000000001'),'revoked','renew never revives an old introduction');
select is((select count(*)::integer from app_private.broker_introduction_passes where revoked_at is null),0,'renew never revives an old pass');
select is(
  public.resolve_broker_introduction(
    (select introduction_ref from app_private.broker_introductions where id='e8000000-0000-4000-8000-000000000002'),
    null
  ),
  '{"available": false}'::jsonb,
  'renew never revives the Detailed fallback of a responded introduction'
);

set local role authenticated;
select pg_temp.set_authenticated_claims('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001');
select is(
  public.manage_customer_broker_consent((select relationship_ref from consent_refs),'terminate','consent-terminate-owner-0001')->>'relationshipStatus',
  'terminated','the owner can finally end the relationship'
);
select is(
  public.manage_customer_broker_consent((select relationship_ref from consent_refs),'renew','consent-renew-owner-0002'),
  '{"available": false}'::jsonb,
  'a terminated relationship cannot be renewed'
);
reset role;
select is((select count(*)::integer from app_private.broker_client_mandates where revoked_at is null),0,'termination leaves no active mandate');
select is((select count(*)::integer from app_private.brokerdesk_audit_events where event_name like 'customer.broker_consent.%'),3,'only successful state changes are audited');

select * from finish();
rollback;
