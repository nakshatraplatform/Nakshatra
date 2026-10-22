-- VivIntroDesk V3 consent and least-privilege RBAC foundation.
-- This migration does not create family viewers or broaden any V1/V2 mandate.

alter table app_private.broker_client_mandates
  add column if not exists consent_version text;

create or replace function app_private.broker_mandate_evidence_consent_version(
  p_evidence_reference text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when p_evidence_reference ~ '(^|:)broker-representation-v1(:|$)'
      and p_evidence_reference !~ '(^|:)broker-representation-v2(:|$)'
      and p_evidence_reference !~ '(^|:)broker-representation-v3(:|$)'
      then 'broker-representation-v1'
    when p_evidence_reference ~ '(^|:)broker-representation-v2(:|$)'
      and p_evidence_reference !~ '(^|:)broker-representation-v1(:|$)'
      and p_evidence_reference !~ '(^|:)broker-representation-v3(:|$)'
      then 'broker-representation-v2'
    when p_evidence_reference ~ '(^|:)broker-representation-v3(:|$)'
      and p_evidence_reference !~ '(^|:)broker-representation-v1(:|$)'
      and p_evidence_reference !~ '(^|:)broker-representation-v2(:|$)'
      then 'broker-representation-v3'
    else null
  end;
$$;

revoke all on function app_private.broker_mandate_evidence_consent_version(text)
  from public, anon, authenticated;

-- Classify each mandate from its own evidence first. This preserves mixed V1 →
-- V2 history on a relationship instead of relabeling every historical mandate
-- from the relationship's latest intake.
update app_private.broker_client_mandates mandate
set consent_version = app_private.broker_mandate_evidence_consent_version(
  mandate.evidence_reference
)
where mandate.consent_version is null
  and app_private.broker_mandate_evidence_consent_version(
    mandate.evidence_reference
  ) is not null;

-- For genuinely unversioned legacy evidence, accept intake inference only when
-- exactly one consent version is linked to the same relationship and the same
-- consent/start timestamp. Ambiguous history remains unclassified and fails
-- closed below if it is active.
with classified as (
  select mandate.id, (
    select case when pg_catalog.count(distinct intake.consent_version) = 1
      then pg_catalog.min(intake.consent_version)
      else null
    end
    from app_private.broker_client_intakes intake
    where intake.organization_id = mandate.organization_id
      and intake.relationship_id = mandate.broker_client_id
      and intake.activated_at is not null
      and intake.consented_at = mandate.starts_at
  ) as consent_version
  from app_private.broker_client_mandates mandate
  where mandate.consent_version is null
)
update app_private.broker_client_mandates mandate
set consent_version = classified.consent_version
from classified
where mandate.id = classified.id
  and classified.consent_version in (
    'broker-representation-v1', 'broker-representation-v2'
  );

-- Evidence that names an exact version is authoritative for that mandate. A
-- disagreement here means the backfill has corrupted historical consent
-- lineage and must stop before the column becomes mandatory.
do $$
begin
  if exists (
    select 1
    from app_private.broker_client_mandates mandate
    where app_private.broker_mandate_evidence_consent_version(
      mandate.evidence_reference
    ) is not null
      and mandate.consent_version is distinct from
        app_private.broker_mandate_evidence_consent_version(
          mandate.evidence_reference
        )
  ) then
    raise exception 'broker mandate consent version conflicts with its evidence'
      using errcode = '23514';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from app_private.broker_client_mandates mandate
    where mandate.consent_version is null
      and mandate.revoked_at is null
      and mandate.starts_at <= pg_catalog.now()
      and mandate.ends_at > pg_catalog.now()
  ) then
    raise exception 'active broker mandate consent version requires operator review'
      using errcode = '23514';
  end if;
end;
$$;

-- Revoked, unclassified history cannot authorize anything. Preserve it at the
-- least-capable historical version so the new invariant can be mandatory.
update app_private.broker_client_mandates
set consent_version = 'broker-representation-v1'
where consent_version is null;

alter table app_private.broker_client_mandates
  alter column consent_version set not null,
  drop constraint if exists broker_client_mandates_consent_version_check,
  add constraint broker_client_mandates_consent_version_check check (
    consent_version in (
      'broker-representation-v1',
      'broker-representation-v2',
      'broker-representation-v3'
    )
  );

drop index if exists app_private.broker_client_mandates_relationship_active_idx;
create index broker_client_mandates_relationship_active_idx
  on app_private.broker_client_mandates (
    organization_id, broker_client_id, consent_version, starts_at, ends_at
  )
  where revoked_at is null;

alter table app_private.broker_client_intakes
  drop constraint if exists broker_client_intakes_consent_version_check;

alter table app_private.broker_client_intakes
  alter column consent_version set default 'broker-representation-v3',
  add constraint broker_client_intakes_consent_version_check check (
    consent_version in (
      'broker-representation-v1',
      'broker-representation-v2',
      'broker-representation-v3'
    )
  );

create or replace function app_private.prevent_broker_intake_consent_version_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consent_version is distinct from old.consent_version then
    raise exception 'invitation consent version is immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function app_private.prevent_broker_intake_consent_version_change()
  from public, anon, authenticated;

drop trigger if exists prevent_broker_intake_consent_version_change
  on app_private.broker_client_intakes;
create trigger prevent_broker_intake_consent_version_change
  before update of consent_version on app_private.broker_client_intakes
  for each row execute function app_private.prevent_broker_intake_consent_version_change();

create or replace function app_private.broker_mandate_capabilities(p_consent_version text)
returns app_private.brokerdesk_capability[]
language sql
immutable
security definer
set search_path = ''
as $$
  select case p_consent_version
    when 'broker-representation-v3' then array[
      'customers.read', 'customers.edit_relationship', 'portfolio.review',
      'introductions.create', 'introductions.send',
      'introductions.record_response', 'introductions.close',
      'tasks.manage', 'renewals.manage',
      'family_viewers.propose', 'introductions.manage_sharing',
      'introductions.record_family_update'
    ]::app_private.brokerdesk_capability[]
    when 'broker-representation-v2' then array[
      'customers.read', 'customers.edit_relationship', 'portfolio.review',
      'introductions.create', 'introductions.send',
      'introductions.record_response', 'introductions.close',
      'tasks.manage', 'renewals.manage'
    ]::app_private.brokerdesk_capability[]
    when 'broker-representation-v1' then array[
      'customers.read', 'customers.edit_relationship', 'portfolio.review',
      'introductions.create', 'introductions.send',
      'introductions.record_response', 'introductions.close',
      'tasks.manage', 'renewals.manage'
    ]::app_private.brokerdesk_capability[]
    else null
  end;
$$;

revoke all on function app_private.broker_mandate_capabilities(text)
  from public, anon, authenticated;

insert into app_private.brokerdesk_role_capabilities (
  role_preset, capability, resource_scope
)
select role_preset::app_private.brokerdesk_role_preset,
       capability::app_private.brokerdesk_capability,
       resource_scope::app_private.brokerdesk_resource_scope
from (values
  ('owner', 'family_viewers.propose', 'organization'),
  ('owner', 'introductions.manage_sharing', 'organization'),
  ('owner', 'introductions.record_family_update', 'organization'),
  ('admin', 'family_viewers.propose', 'organization'),
  ('admin', 'introductions.manage_sharing', 'organization'),
  ('admin', 'introductions.record_family_update', 'organization'),
  ('advisor', 'family_viewers.propose', 'assigned_customers'),
  ('advisor', 'introductions.manage_sharing', 'assigned_customers'),
  ('advisor', 'introductions.record_family_update', 'assigned_customers'),
  ('coordinator', 'family_viewers.propose', 'assigned_customers'),
  ('coordinator', 'introductions.manage_sharing', 'assigned_customers'),
  ('coordinator', 'introductions.record_family_update', 'assigned_customers')
) as preset(role_preset, capability, resource_scope)
on conflict (role_preset, capability) do update
set resource_scope = excluded.resource_scope;

-- Viewer has no family or sharing mutation capability, even if a stale row was
-- introduced manually before this migration.
delete from app_private.brokerdesk_role_capabilities
where role_preset = 'viewer'
  and capability in (
    'family_viewers.propose',
    'introductions.manage_sharing',
    'introductions.record_family_update'
  );

create or replace function app_private.relationship_has_active_mandate_version(
  p_workspace_ref text,
  p_relationship_ref text,
  p_consent_version text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations organization
    join public.broker_clients relationship
      on relationship.organization_id = organization.id
    join app_private.broker_client_mandates mandate
      on mandate.organization_id = relationship.organization_id
     and mandate.broker_client_id = relationship.id
    where organization.workspace_ref = p_workspace_ref
      and relationship.relationship_ref = p_relationship_ref
      and relationship.relationship_status = 'active'
      and (relationship.ends_at is null or relationship.ends_at > pg_catalog.now())
      and mandate.consent_version = p_consent_version
      and mandate.revoked_at is null
      and mandate.starts_at <= pg_catalog.now()
      and mandate.ends_at > pg_catalog.now()
  );
$$;

revoke all on function app_private.relationship_has_active_mandate_version(text,text,text)
  from public, anon, authenticated;

create or replace function app_private.activate_broker_client_intake(
  p_intake_id uuid,
  p_actor_user_id uuid,
  p_candidate_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  intake app_private.broker_client_intakes%rowtype;
  relationship public.broker_clients%rowtype;
  mandate_end timestamptz;
  mandate_capabilities app_private.brokerdesk_capability[];
begin
  select * into intake from app_private.broker_client_intakes
  where id = p_intake_id for update;

  if not found or intake.claimed_by is distinct from p_actor_user_id
    or intake.claimed_at is null or intake.consented_at is null
    or intake.revoked_at is not null
    or intake.consented_at + interval '1 year' <= pg_catalog.now()
    or intake.consent_version not in (
      'broker-representation-v1',
      'broker-representation-v2',
      'broker-representation-v3'
    )
    or not exists (
      select 1 from public.organizations organization
      where organization.id = intake.organization_id
        and organization.type = 'matchmaker_agency'
        and organization.status = 'active'
        and app_private.brokerdesk_entitlement_enabled(organization.id)
    ) then
    return null;
  end if;
  if not exists (
    select 1 from public.candidates candidate
    where candidate.id = p_candidate_id
      and candidate.primary_owner_user_id = p_actor_user_id
  ) then
    return null;
  end if;

  mandate_capabilities := app_private.broker_mandate_capabilities(intake.consent_version);
  if mandate_capabilities is null then return null; end if;

  mandate_end := intake.consented_at + interval '1 year';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    intake.organization_id::text || ':customer:' || p_candidate_id::text, 0
  ));

  select * into relationship from public.broker_clients
  where organization_id = intake.organization_id and candidate_id = p_candidate_id
  for update;

  if not found then
    insert into public.broker_clients (
      organization_id, candidate_id, relationship_status, relationship_source,
      introduced_by, invited_at, claimed_at, consented_at, starts_at, ends_at
    ) values (
      intake.organization_id, p_candidate_id, 'active', 'customer_invitation',
      intake.invited_by, intake.invited_at, intake.claimed_at, intake.consented_at,
      intake.consented_at, mandate_end
    ) returning * into relationship;
  else
    update public.broker_clients
    set relationship_status = 'active', relationship_source = 'customer_invitation',
        introduced_by = intake.invited_by, invited_at = intake.invited_at,
        claimed_at = intake.claimed_at, consented_at = intake.consented_at,
        starts_at = intake.consented_at, ends_at = mandate_end,
        row_version = row_version + 1, updated_at = pg_catalog.now()
    where id = relationship.id returning * into relationship;
  end if;

  update app_private.broker_client_mandates
  set revoked_at = pg_catalog.now(), revoked_by = p_actor_user_id,
      updated_at = pg_catalog.now()
  where organization_id = intake.organization_id
    and broker_client_id = relationship.id
    and revoked_at is null;

  insert into app_private.broker_client_mandates (
    organization_id, broker_client_id, purpose, permitted_capabilities,
    evidence_reference, consent_version, customer_approved_by, starts_at, ends_at
  ) values (
    intake.organization_id, relationship.id,
    'Matrimonial matchmaking representation', mandate_capabilities,
    intake.invitation_ref || ':' || intake.consent_version,
    intake.consent_version, p_actor_user_id, intake.consented_at, mandate_end
  );

  update app_private.broker_client_intakes
  set relationship_id = relationship.id, activated_at = pg_catalog.now(),
      token_hash = null, updated_at = pg_catalog.now()
  where id = intake.id;

  insert into app_private.brokerdesk_audit_events
    (organization_id, actor_user_id, event_name, resource_type, outcome, safe_details)
  values (
    intake.organization_id, p_actor_user_id, 'customer.relationship.activated',
    'broker_client', 'succeeded',
    pg_catalog.jsonb_build_object(
      'invitationRef', intake.invitation_ref,
      'relationshipRef', relationship.relationship_ref,
      'consentVersion', intake.consent_version
    )
  );
  return relationship.id;
end;
$$;

create or replace function public.resolve_brokerdesk_customer_invitation_consent_version(
  p_token_hash text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case intake.consent_version
      when 'broker-representation-v2' then 'broker-representation-v2'
      else 'broker-representation-v3'
    end
    from app_private.broker_client_intakes intake
    join public.organizations organization on organization.id = intake.organization_id
    where p_token_hash ~ '^[a-f0-9]{64}$'
      and intake.token_hash = p_token_hash
      and intake.claimed_at is null
      and intake.revoked_at is null
      and intake.expires_at > pg_catalog.now()
      and organization.type = 'matchmaker_agency'
      and organization.status = 'active'
      and app_private.brokerdesk_entitlement_enabled(organization.id)
    limit 1
  ), 'broker-representation-v3');
$$;

revoke all on function public.resolve_brokerdesk_customer_invitation_consent_version(text)
  from public, anon, authenticated;
grant execute on function public.resolve_brokerdesk_customer_invitation_consent_version(text)
  to anon, authenticated;

create or replace function public.claim_brokerdesk_customer_invitation(
  p_token_hash text,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_email_hash text;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_consent_version not in (
      'broker-representation-v2', 'broker-representation-v3'
    ) then
    return '{"available":false}'::jsonb;
  end if;

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.lower(pg_catalog.btrim(account.email)), 'UTF8'
  ), 'sha256'), 'hex')
  into actor_email_hash
  from auth.users account
  where account.id = actor_id and account.email_confirmed_at is not null;

  if actor_email_hash is null then return '{"available":false}'::jsonb; end if;

  perform 1
  from app_private.broker_client_intakes intake
  where intake.token_hash = p_token_hash
    and intake.email_hash = actor_email_hash
    and intake.consent_version = p_consent_version
    and intake.claimed_at is null
    and intake.revoked_at is null
    and intake.expires_at > pg_catalog.now();

  if not found then return '{"available":false}'::jsonb; end if;
  return public.claim_brokerdesk_customer_invitation(p_token_hash);
end;
$$;

revoke all on function public.claim_brokerdesk_customer_invitation(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_brokerdesk_customer_invitation(text, text)
  to authenticated;

comment on function public.claim_brokerdesk_customer_invitation(text, text) is
  'Claims an exact-email broker invitation only when the submitted consent version matches the immutable version pinned when that invitation was issued.';
