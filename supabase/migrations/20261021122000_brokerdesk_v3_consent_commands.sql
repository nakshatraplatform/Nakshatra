-- Consent commands preserve the version already chosen by the customer.

create or replace function public.manage_customer_broker_consent(
  p_relationship_ref text,
  p_action text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  relationship_record public.broker_clients%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  request_hash text;
  result jsonb;
  mandate_end timestamptz;
  renewal_consent_version text;
  revoked_introduction_count integer := 0;
  revoked_pass_count integer := 0;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or p_action not in ('pause', 'renew', 'terminate')
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then
    raise exception 'broker relationship action unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':customer-broker-consent:' || p_relationship_ref, 0
  ));

  select relationship.* into relationship_record
  from public.broker_clients relationship
  join public.candidates candidate on candidate.id = relationship.candidate_id
  where relationship.relationship_ref = p_relationship_ref
    and candidate.primary_owner_user_id = actor_id
  for update of relationship;

  if relationship_record.id is null then
    return '{"available":false}'::jsonb;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'broker-relationship:' || relationship_record.id::text, 0
  ));

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'relationshipRef', p_relationship_ref,
      'action', p_action
    )::text, 'UTF8'
  ), 'sha256'), 'hex');

  select * into existing
  from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'manage_customer_broker_consent'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();

  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request'
        using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  if p_action = 'pause' then
    if relationship_record.relationship_status = 'paused' then
      return pg_catalog.jsonb_build_object(
        'available', true, 'relationshipRef', p_relationship_ref,
        'relationshipStatus', 'paused', 'endsAt', relationship_record.ends_at
      );
    end if;
    if relationship_record.relationship_status <> 'active'
      or (relationship_record.ends_at is not null
        and relationship_record.ends_at <= pg_catalog.now())
    then
      return '{"available":false}'::jsonb;
    end if;
  elsif p_action = 'renew' then
    if relationship_record.relationship_status not in ('active', 'paused', 'expired')
      or (
        relationship_record.relationship_status = 'active'
        and (relationship_record.ends_at is null
          or relationship_record.ends_at > pg_catalog.now() + interval '30 days')
      )
    then
      return '{"available":false}'::jsonb;
    end if;

    select mandate.consent_version into renewal_consent_version
    from app_private.broker_client_mandates mandate
    where mandate.organization_id = relationship_record.organization_id
      and mandate.broker_client_id = relationship_record.id
    order by mandate.created_at desc, mandate.id desc
    limit 1;

    if renewal_consent_version not in (
      'broker-representation-v1',
      'broker-representation-v2',
      'broker-representation-v3'
    ) then
      return '{"available":false}'::jsonb;
    end if;
  else
    if relationship_record.relationship_status = 'terminated' then
      return pg_catalog.jsonb_build_object(
        'available', true, 'relationshipRef', p_relationship_ref,
        'relationshipStatus', 'terminated', 'endsAt', relationship_record.ends_at
      );
    end if;
  end if;

  if p_action in ('pause', 'terminate') then
    update app_private.broker_client_mandates
    set revoked_at = pg_catalog.now(), revoked_by = actor_id,
        updated_at = pg_catalog.now()
    where organization_id = relationship_record.organization_id
      and broker_client_id = relationship_record.id
      and revoked_at is null;

    with affected as (
      select introduction.id
      from app_private.broker_introductions introduction
      where introduction.organization_id = relationship_record.organization_id
        and introduction.broker_client_id = relationship_record.id
        and introduction.expires_at > pg_catalog.now()
        and introduction.status in ('created', 'shared', 'responded')
    ), revoked_passes as (
      update app_private.broker_introduction_passes pass
      set revoked_at = pg_catalog.now(), claim_token_hash = null
      where pass.introduction_id in (select id from affected)
        and pass.revoked_at is null
      returning pass.introduction_id
    )
    select pg_catalog.count(*)::integer into revoked_pass_count from revoked_passes;

    with revoked_introductions as (
      update app_private.broker_introductions introduction
      set status = case when introduction.status = 'responded'
            then 'responded' else 'revoked' end,
          revoked_at = pg_catalog.now(), row_version = row_version + 1,
          updated_at = pg_catalog.now()
      where introduction.organization_id = relationship_record.organization_id
        and introduction.broker_client_id = relationship_record.id
        and introduction.expires_at > pg_catalog.now()
        and introduction.status in ('created', 'shared', 'responded')
      returning introduction.id
    ), recorded_events as (
      insert into app_private.broker_introduction_events (
        organization_id, introduction_id, event_type, actor_kind,
        actor_user_id, safe_details
      )
      select relationship_record.organization_id, revoked.id, 'revoked',
        'system', actor_id,
        pg_catalog.jsonb_build_object('reason', 'customer_' || p_action)
      from revoked_introductions revoked
      returning introduction_id
    )
    select pg_catalog.count(*)::integer into revoked_introduction_count
    from recorded_events;

    update public.broker_clients
    set relationship_status = case when p_action = 'pause'
          then 'paused' else 'terminated' end,
        ends_at = case when p_action = 'terminate'
          then greatest(pg_catalog.now(), starts_at + interval '1 microsecond')
          else ends_at end,
        row_version = row_version + 1,
        updated_at = pg_catalog.now()
    where id = relationship_record.id
    returning * into relationship_record;
  else
    mandate_end := pg_catalog.now() + interval '1 year';
    update app_private.broker_client_mandates
    set revoked_at = pg_catalog.now(), revoked_by = actor_id,
        updated_at = pg_catalog.now()
    where organization_id = relationship_record.organization_id
      and broker_client_id = relationship_record.id
      and revoked_at is null;

    insert into app_private.broker_client_mandates (
      organization_id, broker_client_id, purpose, permitted_capabilities,
      evidence_reference, consent_version, customer_approved_by, starts_at, ends_at
    ) values (
      relationship_record.organization_id, relationship_record.id,
      'Matrimonial matchmaking representation',
      app_private.broker_mandate_capabilities(renewal_consent_version),
      p_relationship_ref || ':' || renewal_consent_version || ':renewal:' ||
        pg_catalog.left(p_idempotency_key, 96),
      renewal_consent_version, actor_id, pg_catalog.now(), mandate_end
    );

    update public.broker_clients
    set relationship_status = 'active', consented_at = pg_catalog.now(),
        ends_at = mandate_end, row_version = row_version + 1,
        updated_at = pg_catalog.now()
    where id = relationship_record.id
    returning * into relationship_record;
  end if;

  result := pg_catalog.jsonb_build_object(
    'available', true,
    'relationshipRef', relationship_record.relationship_ref,
    'relationshipStatus', relationship_record.relationship_status,
    'endsAt', relationship_record.ends_at
  );

  insert into app_private.brokerdesk_audit_events (
    organization_id, actor_user_id, event_name, resource_type, outcome, safe_details
  ) values (
    relationship_record.organization_id, actor_id,
    'customer.broker_consent.' || p_action, 'broker_client', 'succeeded',
    pg_catalog.jsonb_build_object(
      'relationshipRef', relationship_record.relationship_ref,
      'consentVersion', renewal_consent_version,
      'revokedIntroductionCount', revoked_introduction_count,
      'revokedPassCount', revoked_pass_count
    )
  );

  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash,
    organization_id, safe_result
  ) values (
    actor_id, 'manage_customer_broker_consent', p_idempotency_key,
    request_hash, relationship_record.organization_id, result
  );

  return result;
end;
$$;

create or replace function public.reconsent_customer_broker_relationship(
  p_relationship_ref text,
  p_consent_version text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  relationship_record public.broker_clients%rowtype;
  mandate_record app_private.broker_client_mandates%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  request_hash text;
  result jsonb;
  preserved_end timestamptz;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or p_consent_version <> 'broker-representation-v3'
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then
    raise exception 'broker relationship consent unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':customer-broker-reconsent:' || p_relationship_ref, 0
  ));

  select relationship.* into relationship_record
  from public.broker_clients relationship
  join public.candidates candidate on candidate.id = relationship.candidate_id
  where relationship.relationship_ref = p_relationship_ref
    and candidate.primary_owner_user_id = actor_id
  for update of relationship;

  if relationship_record.id is null then
    return '{"available":false}'::jsonb;
  end if;

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'relationshipRef', p_relationship_ref,
      'consentVersion', p_consent_version
    )::text, 'UTF8'
  ), 'sha256'), 'hex');

  select * into existing
  from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'reconsent_customer_broker_relationship'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();

  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request'
        using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  if relationship_record.relationship_status <> 'active'
    or relationship_record.ends_at is null
    or relationship_record.ends_at <= pg_catalog.now()
  then
    return '{"available":false}'::jsonb;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'broker-relationship:' || relationship_record.id::text, 0
  ));

  select mandate.* into mandate_record
  from app_private.broker_client_mandates mandate
  where mandate.organization_id = relationship_record.organization_id
    and mandate.broker_client_id = relationship_record.id
    and mandate.revoked_at is null
    and mandate.starts_at <= pg_catalog.now()
    and mandate.ends_at > pg_catalog.now()
  order by mandate.created_at desc, mandate.id desc
  limit 1
  for update;

  if mandate_record.id is null then
    return '{"available":false}'::jsonb;
  end if;

  preserved_end := least(relationship_record.ends_at, mandate_record.ends_at);
  if preserved_end <= pg_catalog.now() then
    return '{"available":false}'::jsonb;
  end if;

  if mandate_record.consent_version <> 'broker-representation-v3' then
    update app_private.broker_client_mandates
    set revoked_at = pg_catalog.now(), revoked_by = actor_id,
        updated_at = pg_catalog.now()
    where id = mandate_record.id;

    insert into app_private.broker_client_mandates (
      organization_id, broker_client_id, purpose, permitted_capabilities,
      evidence_reference, consent_version, customer_approved_by, starts_at, ends_at
    ) values (
      relationship_record.organization_id, relationship_record.id,
      'Matrimonial matchmaking representation',
      app_private.broker_mandate_capabilities('broker-representation-v3'),
      p_relationship_ref || ':broker-representation-v3:reconsent:' ||
        pg_catalog.left(p_idempotency_key, 96),
      'broker-representation-v3', actor_id, pg_catalog.now(), preserved_end
    );

    update public.broker_clients
    set consented_at = pg_catalog.now(), row_version = row_version + 1,
        updated_at = pg_catalog.now()
    where id = relationship_record.id
    returning * into relationship_record;
  end if;

  result := pg_catalog.jsonb_build_object(
    'available', true,
    'relationshipRef', relationship_record.relationship_ref,
    'relationshipStatus', relationship_record.relationship_status,
    'consentVersion', 'broker-representation-v3',
    'endsAt', preserved_end
  );

  insert into app_private.brokerdesk_audit_events (
    organization_id, actor_user_id, event_name, resource_type, outcome, safe_details
  ) values (
    relationship_record.organization_id, actor_id,
    'customer.broker_consent.reconsented_v3', 'broker_client', 'succeeded',
    pg_catalog.jsonb_build_object(
      'relationshipRef', relationship_record.relationship_ref,
      'previousConsentVersion', mandate_record.consent_version,
      'consentVersion', 'broker-representation-v3',
      'endsAt', preserved_end
    )
  );

  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash,
    organization_id, safe_result
  ) values (
    actor_id, 'reconsent_customer_broker_relationship', p_idempotency_key,
    request_hash, relationship_record.organization_id, result
  );

  return result;
end;
$$;

revoke all on function public.reconsent_customer_broker_relationship(text,text,text)
  from public, anon, authenticated;
grant execute on function public.reconsent_customer_broker_relationship(text,text,text)
  to authenticated;

comment on function public.reconsent_customer_broker_relationship(text,text,text) is
  'Owner-only V3 reconsent for an active broker relationship. It preserves the existing term and does not revive or modify Introductions.';
