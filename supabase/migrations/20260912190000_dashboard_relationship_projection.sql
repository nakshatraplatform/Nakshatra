-- Present interest requests and Full View grants as one trustworthy relationship
-- lifecycle. Requester portfolio links are resolved from authenticated ownership;
-- caller-supplied URLs are never returned to the owner dashboard.

update public.interest_requests
set metadata = metadata - 'portfolio_url'
where metadata ? 'portfolio_url';

create or replace function app_private.list_dashboard_interests(p_limit integer default 12)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(row_data.payload order by row_data.created_at desc), '[]'::jsonb)
  from (
    select
      request_record.created_at,
      pg_catalog.jsonb_build_object(
        'id', request_record.id,
        'viewer_name', request_record.viewer_name,
        'viewer_phone', request_record.viewer_phone,
        'viewer_email', request_record.viewer_email,
        'viewer_family_context', request_record.viewer_family_context,
        'message', request_record.message,
        'status', request_record.status,
        'requester_user_id', request_record.requester_user_id,
        'metadata', request_record.metadata - 'portfolio_url',
        'created_at', request_record.created_at,
        'email_verified', request_record.email_verified_at is not null
          and request_record.verification_channel = 'email',
        'source_type', case
          when request_record.referring_organization_id is not null then 'broker'
          else 'direct'
        end,
        'broker_name', organization_record.name,
        'broker_representative_name', matchmaker_record.display_name,
        'requester_portfolio_token', requester_portfolio.share_token
      ) as payload
    from public.interest_requests request_record
    left join public.organizations organization_record
      on organization_record.id = request_record.referring_organization_id
    left join public.matchmaker_profiles matchmaker_record
      on matchmaker_record.id = request_record.referring_matchmaker_profile_id
    left join lateral (
      select requester_record.share_token
      from public.portfolios requester_record
      join public.public_portfolio_snapshots snapshot_record
        on snapshot_record.portfolio_id = requester_record.id
       and snapshot_record.share_token = requester_record.share_token
       and snapshot_record.is_active = true
       and (snapshot_record.expires_at is null or snapshot_record.expires_at > pg_catalog.now())
      where requester_record.user_id = request_record.requester_user_id
        and requester_record.is_published = true
        and requester_record.share_token is not null
        and (requester_record.expires_at is null or requester_record.expires_at > pg_catalog.now())
      limit 1
    ) requester_portfolio on true
    where public.can_manage_portfolio(request_record.portfolio_id)
    order by request_record.created_at desc
    limit least(greatest(coalesce(p_limit, 12), 1), 50)
  ) row_data;
$$;

revoke all on function app_private.list_dashboard_interests(integer)
  from public, anon, authenticated;

create or replace function public.list_dashboard_interests(p_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_current_session();
  return app_private.list_dashboard_interests(p_limit);
end;
$$;

revoke all on function public.list_dashboard_interests(integer)
  from public, anon, authenticated;
grant execute on function public.list_dashboard_interests(integer)
  to authenticated;

comment on function public.list_dashboard_interests(integer) is
  'Owner-only relationship projection with verified contact state, broker attribution, and authenticated requester portfolio identity.';

create or replace function app_private.list_portfolio_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'grants', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', grant_record.id,
        'interestRequestId', grant_record.interest_request_id,
        'viewerName', request_record.viewer_name,
        'viewerEmail', request_record.viewer_email,
        'sourceType', case
          when request_record.referring_organization_id is not null then 'broker'
          else 'direct'
        end,
        'brokerName', organization_record.name,
        'status', case
          when grant_record.revoked_at is not null then 'revoked'
          when grant_record.expires_at <= pg_catalog.now() then 'expired'
          else 'active'
        end,
        'expiresAt', grant_record.expires_at,
        'renewedAt', grant_record.renewed_at,
        'revokedAt', grant_record.revoked_at,
        'lastAccessedAt', grant_record.last_accessed_at
      ) order by grant_record.created_at desc)
      from lateral (
        select * from public.reveal_grants
        where portfolio_id = portfolio.id
        order by created_at desc
        limit 50
      ) grant_record
      join public.interest_requests request_record
        on request_record.id = grant_record.interest_request_id
      left join public.organizations organization_record
        on organization_record.id = request_record.referring_organization_id
    ), '[]'::jsonb),
    'events', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', event_record.id,
        'eventType', event_record.event_type,
        'viewerName', request_record.viewer_name,
        'createdAt', event_record.created_at,
        'metadata', event_record.metadata
      ) order by event_record.created_at desc)
      from lateral (
        select * from public.access_audit_events
        where portfolio_id = portfolio.id
        order by created_at desc
        limit 50
      ) event_record
      left join public.interest_requests request_record
        on request_record.id = event_record.interest_request_id
    ), '[]'::jsonb)
  )
  from public.portfolios portfolio
  where portfolio.user_id = auth.uid()
  limit 1;
$$;

revoke all on function app_private.list_portfolio_access()
  from public, anon, authenticated;
