begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(31);

select has_column(
  'app_private','broker_client_mandates','consent_version',
  'mandates store structured consent versions'
);
select has_function(
  'public','resolve_brokerdesk_customer_invitation_consent_version',array['text'],
  'invitation exchange can resolve its pinned consent contract'
);
select has_function(
  'public','reconsent_customer_broker_relationship',array['text','text','text'],
  'existing customers have a separate V3 reconsent command'
);
select ok(
  not has_function_privilege(
    'anon','public.reconsent_customer_broker_relationship(text,text,text)','execute'
  ),
  'anonymous callers cannot reconsent a relationship'
);
select ok(
  has_function_privilege(
    'authenticated','public.reconsent_customer_broker_relationship(text,text,text)','execute'
  ),
  'authenticated customers may invoke the owner-checked reconsent command'
);

select is((
  select count(*)::integer
  from app_private.brokerdesk_role_capabilities
  where role_preset in ('owner','admin')
    and capability in (
      'family_viewers.propose',
      'introductions.manage_sharing',
      'introductions.record_family_update'
    )
    and resource_scope = 'organization'
),6,'owner and admin receive all V3 operations at organization scope');

select is((
  select count(*)::integer
  from app_private.brokerdesk_role_capabilities
  where role_preset in ('advisor','coordinator')
    and capability in (
      'family_viewers.propose',
      'introductions.manage_sharing',
      'introductions.record_family_update'
    )
    and resource_scope = 'assigned_customers'
),6,'advisor and coordinator receive V3 operations only for assigned customers');

select is((
  select count(*)::integer
  from app_private.brokerdesk_role_capabilities
  where role_preset = 'viewer'
    and capability in (
      'family_viewers.propose',
      'introductions.manage_sharing',
      'introductions.record_family_update'
    )
),0,'viewer receives no V3 mutation capability');

select ok(
  app_private.broker_mandate_capabilities('broker-representation-v3') @> array[
    'family_viewers.propose',
    'introductions.manage_sharing',
    'introductions.record_family_update'
  ]::app_private.brokerdesk_capability[],
  'V3 mandate capabilities contain all explicit family-assisted operations'
);
select ok(
  not app_private.broker_mandate_capabilities('broker-representation-v2') @> array[
    'family_viewers.propose'
  ]::app_private.brokerdesk_capability[],
  'V2 mandate capabilities remain candidate-only'
);
select results_eq(
  $$select app_private.broker_mandate_evidence_consent_version(evidence)
    from (values
      ('inv_old:broker-representation-v1'),
      ('inv_new:broker-representation-v2')
    ) history(evidence)
    order by evidence$$,
  $$values ('broker-representation-v2'::text),
           ('broker-representation-v1'::text)$$,
  'mixed V1 to V2 history is classified from each mandate''s own evidence'
);
select is(
  app_private.broker_mandate_evidence_consent_version(
    'ambiguous:broker-representation-v1:broker-representation-v2'
  ),
  null,
  'ambiguous evidence is never guessed'
);

select pg_temp.create_auth_actor(
  'f1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'owner@v3-consent.test'
);
select pg_temp.create_auth_actor(
  'f1000000-0000-4000-8000-000000000002',
  'f2000000-0000-4000-8000-000000000002',
  'other@v3-consent.test'
);
select pg_temp.create_auth_actor(
  'f1000000-0000-4000-8000-000000000003',
  'f2000000-0000-4000-8000-000000000003',
  'broker@v3-consent.test'
);

insert into public.organizations (id,type,name,slug,status,created_by)
values
  ('f3000000-0000-4000-8000-000000000001','matchmaker_agency','V3 Agency','v3-consent-agency','active','f1000000-0000-4000-8000-000000000003'),
  ('f3000000-0000-4000-8000-000000000002','matchmaker_agency','Legacy Agency','v2-compat-agency','active','f1000000-0000-4000-8000-000000000003');

insert into public.entitlements (id,organization_id,feature_key,feature_value,source,created_at)
values
  ('f3100000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','brokerdesk.enabled','true'::jsonb,'test',pg_catalog.now()),
  ('f3100000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000002','brokerdesk.enabled','true'::jsonb,'test',pg_catalog.now());

insert into public.candidates (id,primary_owner_user_id,display_name,gender,created_by)
values (
  'f4000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'V3 Customer','female','f1000000-0000-4000-8000-000000000001'
);
insert into public.portfolios (id,user_id,candidate_id,draft_data,is_published)
values (
  'f5000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001','{}',false
);

insert into public.broker_clients (
  id,organization_id,candidate_id,relationship_status,relationship_source,
  claimed_at,consented_at,starts_at,ends_at
) values (
  'f6000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001','active','customer_invitation',
  pg_catalog.now()-interval '10 days',pg_catalog.now()-interval '9 days',
  pg_catalog.now()-interval '9 days',pg_catalog.now()+interval '120 days'
);

insert into app_private.broker_client_mandates (
  id,organization_id,broker_client_id,purpose,permitted_capabilities,
  evidence_reference,consent_version,customer_approved_by,starts_at,ends_at
) values (
  'f7000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  'f6000000-0000-4000-8000-000000000001',
  'Matrimonial matchmaking representation',
  app_private.broker_mandate_capabilities('broker-representation-v2'),
  'fixture:broker-representation-v2','broker-representation-v2',
  'f1000000-0000-4000-8000-000000000001',
  pg_catalog.now()-interval '9 days',pg_catalog.now()+interval '100 days'
);

create temporary table v3_refs as
select relationship_ref, ends_at original_relationship_end
from public.broker_clients
where id='f6000000-0000-4000-8000-000000000001';
grant select on v3_refs to authenticated;

set local role authenticated;
select pg_temp.set_authenticated_claims(
  'f1000000-0000-4000-8000-000000000002',
  'f2000000-0000-4000-8000-000000000002'
);
select is(
  public.reconsent_customer_broker_relationship(
    (select relationship_ref from v3_refs),
    'broker-representation-v3','v3-reconsent-wrong-owner-0001'
  ),
  '{"available": false}'::jsonb,
  'an opaque relationship reference grants no cross-owner authority'
);
reset role;
select is((
  select count(*)::integer from app_private.broker_client_mandates
  where broker_client_id='f6000000-0000-4000-8000-000000000001'
),1,'denied reconsent writes no mandate');

set local role authenticated;
select pg_temp.set_authenticated_claims(
  'f1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001'
);
create temporary table v3_reconsent_result as
select public.reconsent_customer_broker_relationship(
  (select relationship_ref from v3_refs),
  'broker-representation-v3','v3-reconsent-owner-00000001'
) result;
grant select on v3_reconsent_result to authenticated;
select is(
  (select result->>'consentVersion' from v3_reconsent_result),
  'broker-representation-v3',
  'owner explicitly upgrades the active relationship to V3'
);
select is(
  public.reconsent_customer_broker_relationship(
    (select relationship_ref from v3_refs),
    'broker-representation-v3','v3-reconsent-owner-00000001'
  ),
  (select result from v3_reconsent_result),
  'identical V3 reconsent retry is idempotent'
);
reset role;

select is((
  select count(*)::integer from app_private.broker_client_mandates
  where broker_client_id='f6000000-0000-4000-8000-000000000001'
    and revoked_at is null
),1,'V3 reconsent leaves one current mandate');
select is((
  select consent_version from app_private.broker_client_mandates
  where broker_client_id='f6000000-0000-4000-8000-000000000001'
    and revoked_at is null
),'broker-representation-v3','the current mandate stores V3 structurally');
select ok((
  select permitted_capabilities @> array[
    'family_viewers.propose',
    'introductions.manage_sharing',
    'introductions.record_family_update'
  ]::app_private.brokerdesk_capability[]
  from app_private.broker_client_mandates
  where broker_client_id='f6000000-0000-4000-8000-000000000001'
    and revoked_at is null
),'V3 reconsent grants the explicit V3 capability set');
select is((
  select ends_at from public.broker_clients
  where id='f6000000-0000-4000-8000-000000000001'
),(select original_relationship_end from v3_refs),
  'V3 reconsent does not extend the commercial relationship term');
select ok((
  select ends_at <= (select original_relationship_end from v3_refs)
  from app_private.broker_client_mandates
  where broker_client_id='f6000000-0000-4000-8000-000000000001'
    and revoked_at is null
),'V3 reconsent preserves the earlier active mandate boundary');
select ok(app_private.relationship_has_active_mandate_version(
  (select workspace_ref from public.organizations where id='f3000000-0000-4000-8000-000000000001'),
  (select relationship_ref from v3_refs),
  'broker-representation-v3'
),'version helper recognizes only the current active V3 mandate');
select ok(not app_private.relationship_has_active_mandate_version(
  (select workspace_ref from public.organizations where id='f3000000-0000-4000-8000-000000000001'),
  (select relationship_ref from v3_refs),
  'broker-representation-v2'
),'version helper rejects the revoked V2 mandate');

insert into app_private.broker_client_intakes (
  id,invitation_ref,organization_id,email_hash,email_hint,token_hash,
  invited_by,expires_at,consent_version
) values (
  'f8000000-0000-4000-8000-000000000001',
  'inv_f8000000000040008000000000000001',
  'f3000000-0000-4000-8000-000000000002',
  pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    'owner@v3-consent.test','UTF8'
  ),'sha256'),'hex'),
  'ow***@v3-consent.test',repeat('a',64),
  'f1000000-0000-4000-8000-000000000003',
  pg_catalog.now()+interval '7 days','broker-representation-v2'
);

select is(
  public.resolve_brokerdesk_customer_invitation_consent_version(repeat('a',64)),
  'broker-representation-v2',
  'a live V2 invitation resolves to its original contract'
);
select is(
  public.resolve_brokerdesk_customer_invitation_consent_version(repeat('f',64)),
  'broker-representation-v3',
  'an invalid token receives the same safe default as a new V3 invitation'
);

set local role authenticated;
select pg_temp.set_authenticated_claims(
  'f1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001'
);
select is(
  public.claim_brokerdesk_customer_invitation(
    repeat('a',64),'broker-representation-v3'
  ),
  '{"available": false}'::jsonb,
  'claim cannot upgrade an invitation by changing the request body'
);
reset role;
select is((
  select consent_version from app_private.broker_client_intakes
  where id='f8000000-0000-4000-8000-000000000001'
),'broker-representation-v2','a mismatched claim leaves pinned consent unchanged');

set local role authenticated;
select pg_temp.set_authenticated_claims(
  'f1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001'
);
select is(
  public.claim_brokerdesk_customer_invitation(
    repeat('a',64),'broker-representation-v2'
  )->>'status',
  'active','a live V2 invitation remains claimable under V2'
);
reset role;
select is((
  select consent_version from app_private.broker_client_mandates
  where organization_id='f3000000-0000-4000-8000-000000000002'
    and revoked_at is null
),'broker-representation-v2','V2 activation creates only a V2 mandate');
select ok(not (
  select permitted_capabilities @> array['family_viewers.propose']::app_private.brokerdesk_capability[]
  from app_private.broker_client_mandates
  where organization_id='f3000000-0000-4000-8000-000000000002'
    and revoked_at is null
),'V2 activation never grants family-assisted authority');
select throws_ok(
  $$update app_private.broker_client_intakes
    set consent_version='broker-representation-v3'
    where id='f8000000-0000-4000-8000-000000000001'$$,
  '22023','invitation consent version is immutable',
  'pinned invitation consent cannot be mutated after creation'
);

select * from finish();
rollback;
