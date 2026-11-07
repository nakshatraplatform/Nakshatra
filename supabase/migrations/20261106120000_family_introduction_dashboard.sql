-- NAK-203 grants bounded list metadata only. Portfolio grants remain separate.
create function public.resolve_family_introductions(
  p_limit integer default 25,
  p_before_created_at timestamptz default null,
  p_before_ref text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_email_hash text;
  result jsonb;
begin
  perform app_private.require_current_session();
  if p_limit is null or p_limit < 1 or p_limit > 50
    or (p_before_created_at is null) <> (p_before_ref is null)
    or (p_before_ref is not null and p_before_ref !~ '^bir_[0-9a-f]{32}$')
    or (p_before_created_at is not null and not pg_catalog.isfinite(p_before_created_at))
  then
    raise exception 'invalid family dashboard page' using errcode='22023';
  end if;

  select app_private.normalized_email_hash(account.email) into actor_email_hash
  from auth.users account
  where account.id = actor_id and account.email_confirmed_at is not null;
  if actor_email_hash is null
    or not app_private.user_has_google_identity(actor_id, actor_email_hash)
    or not exists (
      select 1 from app_private.candidate_family_viewers viewer
      where viewer.verified_user_id=actor_id
        and viewer.intended_email_hash=actor_email_hash
        and viewer.status='active' and viewer.revoked_at is null
        and app_private.candidate_has_active_v3_relationship(viewer.candidate_id)
    )
  then return '{"available":false}'::jsonb;
  end if;

  with memberships as materialized (
    select viewer.candidate_id, candidate.display_name
    from app_private.candidate_family_viewers viewer
    join public.candidates candidate on candidate.id=viewer.candidate_id
    where viewer.verified_user_id=actor_id
      and viewer.intended_email_hash=actor_email_hash
      and viewer.status='active' and viewer.revoked_at is null
      and candidate.primary_owner_user_id is not null
      and candidate.primary_owner_user_id<>actor_id
  ), scoped as materialized (
    -- Resolve only the viewer's source/recipient relationship histories before
    -- evaluating participant policy. Keep profile snapshots out of this list.
    select item.id,item.organization_id,item.broker_client_id,item.recipient_broker_client_id,
      item.introduction_ref,item.created_at,item.expires_at,item.revoked_at,item.status,
      item.source_response,item.response,item.complete_access_expires_at,item.access_model,item.shared_at,
      member.display_name
    from memberships member
    join public.broker_clients relationship on relationship.candidate_id=member.candidate_id
    join app_private.broker_introductions item
      on item.organization_id=relationship.organization_id and item.broker_client_id=relationship.id
    where p_before_created_at is null
      or (item.created_at,item.introduction_ref)<(p_before_created_at,p_before_ref)
    union all
    select item.id,item.organization_id,item.broker_client_id,item.recipient_broker_client_id,
      item.introduction_ref,item.created_at,item.expires_at,item.revoked_at,item.status,
      item.source_response,item.response,item.complete_access_expires_at,item.access_model,item.shared_at,
      member.display_name
    from memberships member
    join public.broker_clients relationship on relationship.candidate_id=member.candidate_id
    join app_private.broker_introductions item
      on item.organization_id=relationship.organization_id and item.recipient_broker_client_id=relationship.id
    where p_before_created_at is null
      or (item.created_at,item.introduction_ref)<(p_before_created_at,p_before_ref)
  ), relationship_ids as (
    select organization_id,broker_client_id as id from scoped
    union
    select organization_id,recipient_broker_client_id as id from scoped
  ), authorized_relationships as materialized (
    -- Evaluate publication and mandate policy once per scoped relationship,
    -- instead of repeating those checks for every historical Introduction.
    select relationship.id,relationship.organization_id,candidate.primary_owner_user_id,
      app_private.relationship_has_active_mandate(
        organization.workspace_ref,relationship.relationship_ref,'customers.read'
      ) as can_read,
      app_private.relationship_has_active_mandate(
        organization.workspace_ref,relationship.relationship_ref,'introductions.send'
      ) as can_send
    from relationship_ids requested
    join public.broker_clients relationship on relationship.id=requested.id
      and relationship.organization_id=requested.organization_id
    join public.organizations organization on organization.id=relationship.organization_id
    join public.candidates candidate on candidate.id=relationship.candidate_id
    where organization.type='matchmaker_agency' and organization.status='active'
      and app_private.brokerdesk_entitlement_enabled(organization.id)
      and relationship.relationship_status='active'
      and relationship.starts_at<=pg_catalog.now()
      and (relationship.ends_at is null or relationship.ends_at>pg_catalog.now())
      and app_private.relationship_has_active_mandate_version(
        organization.workspace_ref,relationship.relationship_ref,'broker-representation-v3'
      )
      and app_private.candidate_is_introduction_ready(relationship.candidate_id)
  ), eligible as (
    select item.introduction_ref, item.created_at, item.expires_at,
      case
        when item.revoked_at is not null or item.status='revoked'
          or item.source_response='declined' or item.response='declined' then 'closed'
        when item.source_response='accepted' and item.response='accepted'
          and item.complete_access_expires_at>pg_catalog.now() then 'mutual'
        when item.expires_at<=pg_catalog.now() or item.status='expired' then 'expired'
        when item.source_response='accepted' or item.response='accepted' then 'awaiting'
        else 'active'
      end as lifecycle,
      pg_catalog.jsonb_agg(distinct item.display_name order by item.display_name) as candidate_names
    from scoped item
    join authorized_relationships source on source.id=item.broker_client_id and source.organization_id=item.organization_id
    join authorized_relationships recipient on recipient.id=item.recipient_broker_client_id and recipient.organization_id=item.organization_id
    where item.access_model='identity_bound' and item.status<>'created'
      and item.shared_at is not null
      and source.primary_owner_user_id<>recipient.primary_owner_user_id
      and source.can_send and recipient.can_read
    group by item.id,item.introduction_ref,item.created_at,item.expires_at,item.revoked_at,
      item.status,item.source_response,item.response,item.complete_access_expires_at
  ), page as materialized (
    select * from eligible order by created_at desc,introduction_ref desc limit p_limit+1
  ), visible as materialized (
    select * from page order by created_at desc,introduction_ref desc limit p_limit
  )
  select pg_catalog.jsonb_build_object(
    'available',true,
    'introductions',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'introductionRef',introduction_ref,'candidateNames',candidate_names,
        'status',lifecycle,'createdAt',created_at,'responseDueAt',expires_at
      ) order by created_at desc,introduction_ref desc) from visible
    ),'[]'::jsonb),
    'nextCursor',case when (select count(*) from page)>p_limit then (
      select pg_catalog.jsonb_build_object('createdAt',created_at,'introductionRef',introduction_ref)
      from visible order by created_at asc,introduction_ref asc limit 1
    ) else null end
  ) into result;
  return result;
end;
$$;

revoke all on function public.resolve_family_introductions(integer,timestamptz,text) from public,anon,authenticated;
grant execute on function public.resolve_family_introductions(integer,timestamptz,text) to authenticated;
