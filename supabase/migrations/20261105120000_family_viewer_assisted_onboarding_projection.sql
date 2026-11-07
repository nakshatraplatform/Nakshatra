-- NAK-202: safe BrokerDesk read projection for assisted family onboarding.
-- Version follows the merged B2C migrations; no existing migration is rewritten.
--
-- Family viewers remain candidate-owned across every broker relationship. A
-- broker may see only a bounded aggregate. Proposal history is withheld.
-- No raw email, email hash, verified user id, invitation token,
-- other organization, or candidate-internal identifier leaves this function.

create function public.resolve_brokerdesk_family_setup(
  p_workspace_ref text,
  p_relationship_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  relationship_record record;
begin
  perform app_private.require_current_session();

  if actor_id is null
    or p_workspace_ref !~ '^wrk_[0-9a-f]{32}$'
    or p_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or not app_private.member_has_brokerdesk_capability(
      actor_id, p_workspace_ref, 'family_viewers.propose', p_relationship_ref
    )
    or not app_private.relationship_has_active_mandate(
      p_workspace_ref, p_relationship_ref, 'family_viewers.propose'
    )
  then
    return '{"available":false}'::jsonb;
  end if;

  select organization.id as organization_id,
         relationship.candidate_id as candidate_id
    into relationship_record
  from public.organizations organization
  join public.broker_clients relationship
    on relationship.organization_id = organization.id
   and relationship.relationship_ref = p_relationship_ref
   and relationship.relationship_status = 'active'
   and relationship.starts_at <= pg_catalog.now()
   and (relationship.ends_at is null or relationship.ends_at > pg_catalog.now())
  join app_private.broker_client_mandates mandate
    on mandate.organization_id = organization.id
   and mandate.broker_client_id = relationship.id
   and mandate.consent_version = 'broker-representation-v3'
   and mandate.starts_at <= pg_catalog.now()
   and mandate.ends_at > pg_catalog.now()
   and mandate.revoked_at is null
  where organization.workspace_ref = p_workspace_ref
    and organization.type = 'matchmaker_agency'
    and organization.status = 'active'
    and app_private.brokerdesk_entitlement_enabled(organization.id)
  limit 1;

  if relationship_record.candidate_id is null then
    return '{"available":false}'::jsonb;
  end if;

  return pg_catalog.jsonb_build_object(
    'available', true,
    'activeViewerCount', (
      select pg_catalog.count(*)
      from app_private.candidate_family_viewers viewer
      where viewer.candidate_id = relationship_record.candidate_id
        and viewer.status = 'active'
        and viewer.revoked_at is null
    ),
    'maximumActiveViewers', 3,
    'canPropose', true,
    -- Do not reveal whether a proposal inserted: global email deduplication
    -- would let a broker probe the candidate's roster via before/after reads.
    'ownProposals', '[]'::jsonb
  );
end;
$$;

revoke all on function public.resolve_brokerdesk_family_setup(text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_brokerdesk_family_setup(text, text)
  to authenticated;

comment on function public.resolve_brokerdesk_family_setup(text, text) is
  'Returns only a bounded family-viewer aggregate after V3 mandate, capability, assignment and tenant checks; insertion-sensitive proposal history is withheld.';

-- Keep family onboarding quotas distinct from customer intake and Introduction
-- traffic so one workflow cannot exhaust another workflow's allowance.
create or replace function public.consume_api_rate_limit(
  p_action text,
  p_subject_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_limit integer;
  window_seconds integer;
  effective_subject text;
  limit_record app_private.api_rate_limits%rowtype;
  v_now timestamptz := pg_catalog.now();
begin
  select configured.limit_value, configured.window_value
    into action_limit, window_seconds
  from (values
    ('auth_google',10,900),('auth_email',5,900),('interest_submit',5,3600),('interest_decision',30,60),
    ('grant_manage',30,60),('dashboard_save',30,300),('photo_upload',12,3600),('photo_mutation',30,300),
    ('horoscope_upload',6,3600),('horoscope_delete',10,300),('portfolio_publish',6,3600),
    ('portfolio_renew',6,3600),('portfolio_rotate',6,3600),('portfolio_unpublish',6,3600),
    ('horoscope_view',30,300),('location_search',120,60),('account_export',3,3600),
    ('account_delete',3,86400),('account_delete_reauth',3,3600),('session_manage',10,3600),
    ('candidate_liveness_create',5,3600),('candidate_liveness_interaction',30,60),
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
    ('broker_introduction_read',120,60),('broker_introduction_respond',10,3600),
    ('brokerdesk_family_viewer_read',60,60),('brokerdesk_family_viewer_propose',10,3600),
    ('customer_family_viewer_read',60,60),('customer_family_viewer_manage',20,3600),
    ('family_viewer_invitation_exchange',20,3600),('family_viewer_invitation_accept',10,3600)
  ) as configured(action_name, limit_value, window_value)
  where configured.action_name = p_action;

  if action_limit is null then
    raise exception 'unsupported rate limit action' using errcode = '22023';
  end if;

  if auth.uid() is not null then
    effective_subject := 'user:' || auth.uid()::text;
  elsif p_subject_hash is not null and p_subject_hash ~ '^[a-f0-9]{64}$' then
    effective_subject := 'anonymous:' || p_subject_hash;
  else
    return '{"allowed":false,"retryAfter":60}'::jsonb;
  end if;

  insert into app_private.api_rate_limits(
    action, subject_key, window_started_at, request_count, updated_at
  ) values (p_action, effective_subject, v_now, 1, v_now)
  on conflict(action, subject_key) do update set
    window_started_at = case
      when app_private.api_rate_limits.window_started_at
        <= v_now - pg_catalog.make_interval(secs => window_seconds)
        then v_now
      else app_private.api_rate_limits.window_started_at
    end,
    request_count = case
      when app_private.api_rate_limits.window_started_at
        <= v_now - pg_catalog.make_interval(secs => window_seconds)
        then 1
      else app_private.api_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning * into limit_record;

  return pg_catalog.jsonb_build_object(
    'allowed', limit_record.request_count <= action_limit,
    'retryAfter', case
      when limit_record.request_count <= action_limit then 0
      else greatest(1, pg_catalog.ceil(extract(epoch from (
        limit_record.window_started_at
        + pg_catalog.make_interval(secs => window_seconds) - v_now
      )))::integer)
    end
  );
end;
$$;
