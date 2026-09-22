-- Customer-owned BrokerDesk consent controls.
-- An opaque relationship reference locates a possible relationship; authority
-- always comes from the authenticated user's canonical candidate ownership.

create or replace function app_private.enforce_broker_introduction_active_mandate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare relationship_record public.broker_clients%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'broker-relationship:' || new.broker_client_id::text, 0
  ));
  select relationship.* into relationship_record
  from public.broker_clients relationship
  where relationship.id = new.broker_client_id
    and relationship.organization_id = new.organization_id;
  if relationship_record.id is null
    or relationship_record.relationship_status <> 'active'
    or (relationship_record.ends_at is not null and relationship_record.ends_at <= pg_catalog.now())
    or not exists (
      select 1
      from app_private.broker_client_mandates mandate
      where mandate.organization_id = relationship_record.organization_id
        and mandate.broker_client_id = relationship_record.id
        and mandate.revoked_at is null
        and mandate.starts_at <= pg_catalog.now()
        and mandate.ends_at > pg_catalog.now()
        and mandate.permitted_capabilities @> array[
          'introductions.create','introductions.send'
        ]::app_private.brokerdesk_capability[]
    )
  then
    raise exception 'active customer mandate required' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_broker_introduction_active_mandate
  on app_private.broker_introductions;
create trigger enforce_broker_introduction_active_mandate
  before insert on app_private.broker_introductions
  for each row execute function app_private.enforce_broker_introduction_active_mandate();

revoke all on function app_private.enforce_broker_introduction_active_mandate()
  from public, anon, authenticated;

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
      raise exception 'idempotency key was already used for a different request' using errcode = '22023';
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
      or (relationship_record.ends_at is not null and relationship_record.ends_at <= pg_catalog.now())
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
    set revoked_at = pg_catalog.now(), revoked_by = actor_id, updated_at = pg_catalog.now()
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
      set status = case when introduction.status = 'responded' then 'responded' else 'revoked' end,
          revoked_at = pg_catalog.now(),
          row_version = row_version + 1, updated_at = pg_catalog.now()
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
    set relationship_status = case when p_action = 'pause' then 'paused' else 'terminated' end,
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
    set revoked_at = pg_catalog.now(), revoked_by = actor_id, updated_at = pg_catalog.now()
    where organization_id = relationship_record.organization_id
      and broker_client_id = relationship_record.id
      and revoked_at is null;

    insert into app_private.broker_client_mandates (
      organization_id, broker_client_id, purpose, permitted_capabilities,
      evidence_reference, customer_approved_by, starts_at, ends_at
    ) values (
      relationship_record.organization_id, relationship_record.id,
      'Matrimonial matchmaking representation',
      array[
        'customers.read', 'customers.edit_relationship', 'portfolio.review',
        'introductions.create', 'introductions.send',
        'introductions.record_response', 'introductions.close',
        'tasks.manage', 'renewals.manage'
      ]::app_private.brokerdesk_capability[],
      p_relationship_ref || ':broker-representation-v2:renewal:' ||
        pg_catalog.left(p_idempotency_key, 96),
      actor_id, pg_catalog.now(), mandate_end
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

create or replace function public.resolve_customer_broker_relationships()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor_id uuid := auth.uid();
begin
  perform app_private.require_current_session();
  return pg_catalog.jsonb_build_object('available', true, 'relationships', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'relationshipRef', relationship.relationship_ref,
      'workspaceName', organization.name,
      'relationshipStatus', case
        when relationship.relationship_status <> 'terminated'
          and relationship.ends_at is not null
          and relationship.ends_at <= pg_catalog.now() then 'expired'
        else relationship.relationship_status end,
      'startsAt', relationship.starts_at,
      'endsAt', relationship.ends_at,
      'actions', pg_catalog.jsonb_build_object(
        'canPause', relationship.relationship_status = 'active'
          and (relationship.ends_at is null or relationship.ends_at > pg_catalog.now()),
        'canRenew', relationship.relationship_status in ('paused', 'expired')
          or (relationship.relationship_status = 'active'
            and relationship.ends_at is not null
            and relationship.ends_at <= pg_catalog.now() + interval '30 days'),
        'canTerminate', relationship.relationship_status <> 'terminated'
      )
    ) order by relationship.updated_at desc)
    from public.broker_clients relationship
    join public.organizations organization on organization.id = relationship.organization_id
    join public.candidates candidate on candidate.id = relationship.candidate_id
    where candidate.primary_owner_user_id = actor_id
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.manage_customer_broker_consent(text,text,text) from public, anon, authenticated;
revoke all on function public.resolve_customer_broker_relationships() from public, anon, authenticated;
grant execute on function public.manage_customer_broker_consent(text,text,text) to authenticated;
grant execute on function public.resolve_customer_broker_relationships() to authenticated;

-- Keep the application allowlist and database quota table in lockstep.
create or replace function public.consume_api_rate_limit(p_action text, p_subject_hash text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare action_limit integer; window_seconds integer; effective_subject text;
  limit_record app_private.api_rate_limits%rowtype; v_now timestamptz:=pg_catalog.now();
begin
  select configured.limit_value,configured.window_value into action_limit,window_seconds from (values
    ('auth_google',10,900),('auth_email',5,900),('interest_submit',5,3600),('interest_decision',30,60),
    ('grant_manage',30,60),('dashboard_save',30,300),('photo_upload',12,3600),('photo_mutation',30,300),
    ('horoscope_upload',6,3600),('horoscope_delete',10,300),('portfolio_publish',6,3600),
    ('portfolio_renew',6,3600),('portfolio_rotate',6,3600),('portfolio_unpublish',6,3600),
    ('horoscope_view',30,300),('location_search',120,60),('account_export',3,3600),
    ('account_delete',3,86400),('account_delete_reauth',3,3600),('session_manage',10,3600),
    ('identity_verification_invitation',5,3600),('identity_verification_start',5,3600),
    ('identity_verification_status',30,300),('identity_verification_retry',5,3600),
    ('pilot_access_submit',5,86400),('pilot_access_review',60,300),
    ('brokerdesk_bootstrap',60,60),('brokerdesk_workspace_create',3,3600),
    ('brokerdesk_onboarding_read',60,60),('brokerdesk_onboarding_write',30,300),
    ('brokerdesk_privileged_reauth',5,3600),('brokerdesk_mfa_complete',10,900),
    ('brokerdesk_team_read',60,60),('brokerdesk_team_invite',20,3600),
    ('brokerdesk_team_invitation_exchange',20,3600),('brokerdesk_team_invitation_accept',10,3600),
    ('brokerdesk_customer_read',60,60),('brokerdesk_customer_invite',100,3600),
    ('brokerdesk_customer_invitation_exchange',20,3600),('brokerdesk_customer_invitation_claim',10,3600),
    ('customer_broker_relationships_read',60,60),('customer_broker_relationship_manage',10,3600),
    ('brokerdesk_introduction_create',30,3600),('brokerdesk_introduction_read',120,60),
    ('brokerdesk_introduction_update',60,300),('broker_introduction_claim',10,3600),
    ('broker_introduction_read',120,60),('broker_introduction_respond',10,3600)
  ) as configured(action_name,limit_value,window_value) where configured.action_name=p_action;
  if action_limit is null then raise exception 'unsupported rate limit action' using errcode='22023'; end if;
  if auth.uid() is not null then effective_subject:='user:'||auth.uid()::text;
  elsif p_subject_hash is not null and p_subject_hash~'^[a-f0-9]{64}$' then effective_subject:='anonymous:'||p_subject_hash;
  else return '{"allowed":false,"retryAfter":60}'::jsonb; end if;
  insert into app_private.api_rate_limits(action,subject_key,window_started_at,request_count,updated_at)
  values(p_action,effective_subject,v_now,1,v_now)
  on conflict(action,subject_key) do update set
    window_started_at=case when app_private.api_rate_limits.window_started_at<=v_now-pg_catalog.make_interval(secs=>window_seconds) then v_now else app_private.api_rate_limits.window_started_at end,
    request_count=case when app_private.api_rate_limits.window_started_at<=v_now-pg_catalog.make_interval(secs=>window_seconds) then 1 else app_private.api_rate_limits.request_count+1 end,
    updated_at=v_now returning * into limit_record;
  return pg_catalog.jsonb_build_object('allowed',limit_record.request_count<=action_limit,'retryAfter',
    case when limit_record.request_count<=action_limit then 0 else greatest(1,pg_catalog.ceil(extract(epoch from(
      limit_record.window_started_at+pg_catalog.make_interval(secs=>window_seconds)-v_now)))::integer) end);
end; $$;
revoke all on function public.consume_api_rate_limit(text,text) from public,anon,authenticated;
grant execute on function public.consume_api_rate_limit(text,text) to anon,authenticated;

comment on function public.manage_customer_broker_consent(text,text,text) is
  'Owner-only, idempotent consent command that atomically changes broker authority and revokes issued disclosure capabilities.';
