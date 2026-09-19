-- BrokerDesk pilot operations (phases 9-12).
-- Adds a tenant-scoped action queue, lightweight acknowledgement commands,
-- and credential scrubbing for closed introduction passes.

alter table app_private.broker_introductions
  add column response_seen_at timestamptz;

create index broker_introductions_unseen_response_idx
  on app_private.broker_introductions (organization_id, responded_at desc)
  where status = 'responded' and response_seen_at is null;

create index broker_portfolio_notices_attention_idx
  on app_private.broker_portfolio_update_notices (organization_id, status, created_at desc)
  where status in ('unread', 'clarification');

create or replace function app_private.scrub_closed_broker_introduction_pass()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('revoked', 'expired') and old.status is distinct from new.status then
    update app_private.broker_introduction_passes
    set claim_token_hash = null,
        session_token_hash = null,
        claimed_at = null,
        last_seen_at = null,
        revoked_at = coalesce(revoked_at, pg_catalog.now())
    where introduction_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function app_private.scrub_closed_broker_introduction_pass() from public, anon, authenticated;

create trigger scrub_closed_broker_introduction_pass
after update of status on app_private.broker_introductions
for each row execute function app_private.scrub_closed_broker_introduction_pass();

create or replace function public.resolve_brokerdesk_dashboard(p_workspace_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  organization_record public.organizations%rowtype;
  result jsonb;
begin
  perform app_private.require_current_session();
  perform app_private.expire_broker_introductions();

  select organization.* into organization_record
  from public.organizations organization
  where organization.workspace_ref = p_workspace_ref
    and organization.type = 'matchmaker_agency'
    and organization.status = 'active'
    and app_private.brokerdesk_entitlement_enabled(organization.id);

  if organization_record.id is null or (
    not app_private.member_has_brokerdesk_capability(actor_id, p_workspace_ref, 'customers.read', null)
    and not exists (
      select 1
      from public.broker_clients relationship
      where relationship.organization_id = organization_record.id
        and app_private.member_has_brokerdesk_capability(
          actor_id, p_workspace_ref, 'customers.read', relationship.relationship_ref
        )
        and app_private.relationship_has_active_mandate(
          p_workspace_ref, relationship.relationship_ref, 'customers.read'
        )
    )
  ) then
    return '{"available":false}'::jsonb;
  end if;

  with accessible_relationships as (
    select relationship.id, relationship.relationship_ref, relationship.candidate_id
    from public.broker_clients relationship
    where relationship.organization_id = organization_record.id
      and app_private.member_has_brokerdesk_capability(
        actor_id, p_workspace_ref, 'customers.read', relationship.relationship_ref
      )
      and app_private.relationship_has_active_mandate(
        p_workspace_ref, relationship.relationship_ref, 'customers.read'
      )
  ), named_relationships as (
    select relationship.*,
      case when portfolio.is_published and portfolio.published_data is not null then
        coalesce(nullif(pg_catalog.btrim(portfolio.published_data #>> '{personal,name}'), ''), 'Customer')
      else 'Customer' end as customer_name
    from accessible_relationships relationship
    left join public.portfolios portfolio on portfolio.candidate_id = relationship.candidate_id
  ), action_rows as (
    select 'response'::text as action_type,
      introduction.responded_at as occurred_at,
      relationship.relationship_ref,
      relationship.customer_name,
      introduction.introduction_ref,
      null::text as notice_ref,
      introduction.recipient_label,
      introduction.response,
      introduction.response_comment,
      introduction.expires_at,
      null::bigint as version_number
    from named_relationships relationship
    join app_private.broker_introductions introduction
      on introduction.organization_id = organization_record.id
      and introduction.broker_client_id = relationship.id
    where introduction.status = 'responded' and introduction.response_seen_at is null
    union all
    select case when notice.status = 'clarification' then 'clarification' else 'portfolio_update' end,
      notice.created_at, relationship.relationship_ref, relationship.customer_name,
      null, notice.notice_ref, null, null, null, null, version.version_number
    from named_relationships relationship
    join app_private.broker_portfolio_update_notices notice
      on notice.organization_id = organization_record.id
      and notice.broker_client_id = relationship.id
    join app_private.portfolio_disclosure_versions version on version.id = notice.version_id
    where notice.status in ('unread', 'clarification')
    union all
    select 'expiring', introduction.expires_at, relationship.relationship_ref,
      relationship.customer_name, introduction.introduction_ref, null,
      introduction.recipient_label, null, null, introduction.expires_at, null
    from named_relationships relationship
    join app_private.broker_introductions introduction
      on introduction.organization_id = organization_record.id
      and introduction.broker_client_id = relationship.id
    where introduction.status = 'shared'
      and introduction.expires_at > pg_catalog.now()
      and introduction.expires_at <= pg_catalog.now() + interval '72 hours'
  )
  select pg_catalog.jsonb_build_object(
    'available', true,
    'workspaceRef', p_workspace_ref,
    'workspaceName', organization_record.name,
    'metrics', pg_catalog.jsonb_build_object(
      'activeCustomers', (select pg_catalog.count(*) from accessible_relationships),
      'openIntroductions', (select pg_catalog.count(*) from app_private.broker_introductions introduction
        join accessible_relationships relationship on relationship.id = introduction.broker_client_id
        where introduction.organization_id = organization_record.id and introduction.status in ('created','shared')),
      'responsesAwaitingReview', (select pg_catalog.count(*) from app_private.broker_introductions introduction
        join accessible_relationships relationship on relationship.id = introduction.broker_client_id
        where introduction.organization_id = organization_record.id and introduction.status = 'responded'
          and introduction.response_seen_at is null),
      'portfolioUpdates', (select pg_catalog.count(*) from app_private.broker_portfolio_update_notices notice
        join accessible_relationships relationship on relationship.id = notice.broker_client_id
        where notice.organization_id = organization_record.id and notice.status in ('unread','clarification'))
    ),
    'actions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_strip_nulls(
      pg_catalog.jsonb_build_object(
        'type', action_type, 'occurredAt', occurred_at,
        'relationshipRef', relationship_ref, 'customerName', customer_name,
        'introductionRef', introduction_ref, 'noticeRef', notice_ref,
        'recipientLabel', recipient_label, 'response', response,
        'responseComment', response_comment, 'expiresAt', expires_at,
        'versionNumber', version_number
      )) order by occurred_at desc) from (select * from action_rows order by occurred_at desc limit 100) limited), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.mark_broker_introduction_response_reviewed(
  p_workspace_ref text,
  p_introduction_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid := auth.uid(); affected integer;
begin
  perform app_private.require_current_session();
  update app_private.broker_introductions introduction
  set response_seen_at = coalesce(response_seen_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  from public.organizations organization, public.broker_clients relationship
  where organization.workspace_ref = p_workspace_ref
    and organization.type = 'matchmaker_agency'
    and organization.status = 'active'
    and relationship.organization_id = organization.id
    and introduction.organization_id = organization.id
    and introduction.broker_client_id = relationship.id
    and introduction.introduction_ref = p_introduction_ref
    and introduction.status = 'responded'
    and app_private.member_has_brokerdesk_capability(
      actor_id, p_workspace_ref, 'introductions.record_response', relationship.relationship_ref
    )
    and app_private.relationship_has_active_mandate(
      p_workspace_ref, relationship.relationship_ref, 'introductions.record_response'
    );
  get diagnostics affected = ROW_COUNT;
  return pg_catalog.jsonb_build_object('available', affected = 1, 'status',
    case when affected = 1 then 'reviewed' else null end);
end;
$$;

create or replace function public.acknowledge_broker_portfolio_update(
  p_workspace_ref text,
  p_relationship_ref text,
  p_notice_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid := auth.uid(); affected integer;
begin
  perform app_private.require_current_session();
  if not app_private.member_has_brokerdesk_capability(
    actor_id, p_workspace_ref, 'portfolio.review', p_relationship_ref
  ) or not app_private.relationship_has_active_mandate(
    p_workspace_ref, p_relationship_ref, 'portfolio.review'
  ) then return '{"available":false}'::jsonb; end if;

  update app_private.broker_portfolio_update_notices notice
  set status = 'acknowledged', acknowledged_at = coalesce(acknowledged_at, pg_catalog.now()),
      flagged_by = null, flagged_at = null, updated_at = pg_catalog.now()
  from public.organizations organization, public.broker_clients relationship
  where organization.workspace_ref = p_workspace_ref
    and relationship.organization_id = organization.id
    and relationship.relationship_ref = p_relationship_ref
    and notice.organization_id = organization.id
    and notice.broker_client_id = relationship.id
    and notice.notice_ref = p_notice_ref
    and notice.status in ('unread', 'clarification', 'acknowledged');
  get diagnostics affected = ROW_COUNT;
  return pg_catalog.jsonb_build_object('available', affected = 1, 'status',
    case when affected = 1 then 'acknowledged' else null end);
end;
$$;

create or replace function public.run_broker_introduction_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare before_count bigint; after_count bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select pg_catalog.count(*) into before_count from app_private.broker_introductions
  where status in ('created','shared') and expires_at <= pg_catalog.now();
  perform app_private.expire_broker_introductions();
  select pg_catalog.count(*) into after_count from app_private.broker_introductions
  where status in ('created','shared') and expires_at <= pg_catalog.now();
  return pg_catalog.jsonb_build_object('processed', before_count - after_count);
end;
$$;

revoke all on function public.resolve_brokerdesk_dashboard(text) from public, anon, authenticated;
revoke all on function public.mark_broker_introduction_response_reviewed(text,text) from public, anon, authenticated;
revoke all on function public.acknowledge_broker_portfolio_update(text,text,text) from public, anon, authenticated;
revoke all on function public.run_broker_introduction_maintenance() from public, anon, authenticated;
grant execute on function public.resolve_brokerdesk_dashboard(text) to authenticated;
grant execute on function public.mark_broker_introduction_response_reviewed(text,text) to authenticated;
grant execute on function public.acknowledge_broker_portfolio_update(text,text,text) to authenticated;
grant execute on function public.run_broker_introduction_maintenance() to service_role;

comment on function public.resolve_brokerdesk_dashboard(text) is
  'Returns only tenant- and assignment-scoped BrokerDesk pilot metrics and actionable follow-ups.';
comment on function public.run_broker_introduction_maintenance() is
  'Service-role-only expiry maintenance. Closed passes are scrubbed by trigger.';
