-- Retire objects in the same transaction as their metadata. No FK: account
-- deletion must not erase an outstanding storage cleanup obligation.
create table app_private.photo_object_cleanup (
  storage_path text primary key,
  portfolio_id uuid not null,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  claim_token uuid,
  lease_expires_at timestamptz,
  last_error_code text
);
alter table app_private.photo_object_cleanup enable row level security;
revoke all on app_private.photo_object_cleanup from public,anon,authenticated,service_role;
create index photo_object_cleanup_due on app_private.photo_object_cleanup(run_after);

create function app_private.queue_retired_photo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into app_private.photo_object_cleanup(storage_path,portfolio_id)
  select distinct path,old.portfolio_id
  from unnest(array[old.storage_path,old.thumbnail_path,old.metadata->>'blurPath']) path
  where path is not null and not exists(select 1 from public.portfolio_media m
    where path in (m.storage_path,m.thumbnail_path,m.metadata->>'blurPath')) and (tg_op='DELETE' or path not in (
    select value from unnest(array[new.storage_path,new.thumbnail_path,new.metadata->>'blurPath']) value where value is not null
  )) on conflict(storage_path) do nothing;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app_private.queue_retired_photo() from public,anon,authenticated,service_role;
create trigger queue_retired_photo after delete or update of storage_path,thumbnail_path,metadata on public.portfolio_media
for each row execute function app_private.queue_retired_photo();

create or replace function app_private.enforce_portfolio_media_contract() returns trigger
language plpgsql security definer set search_path='' as $$
declare expected_candidate_id uuid; expected_user_id uuid; profile_photo_count integer;
begin
  -- Serialize the count before checking it; AFTER-trigger locking is too late.
  if tg_op='UPDATE' then
    perform 1 from public.portfolios where id in (old.portfolio_id,new.portfolio_id) order by id for update;
  end if;
  select candidate_id,user_id into expected_candidate_id,expected_user_id
  from public.portfolios where id=new.portfolio_id for update;
  if expected_user_id is null then raise exception 'portfolio media requires an existing portfolio' using errcode='23503'; end if;
  if new.candidate_id is not null and new.candidate_id is distinct from expected_candidate_id then
    raise exception 'portfolio media candidate does not match portfolio' using errcode='23514';
  end if;
  if split_part(new.storage_path,'/',1)<>expected_user_id::text
    or (new.thumbnail_path is not null and split_part(new.thumbnail_path,'/',1)<>expected_user_id::text)
    or (new.metadata ? 'blurPath' and split_part(new.metadata->>'blurPath','/',1)<>expected_user_id::text) then
    raise exception 'portfolio media path is outside the owner namespace' using errcode='23514';
  end if;
  if exists(select 1 from app_private.photo_object_cleanup
    where storage_path in (new.storage_path,new.thumbnail_path,new.metadata->>'blurPath')) then
    raise exception 'retired photo cannot be reattached' using errcode='23514';
  end if;
  select count(*) into profile_photo_count from public.portfolio_media
  where portfolio_id=new.portfolio_id and media_type in ('hero','gallery') and (tg_op='INSERT' or id<>new.id);
  if new.media_type in ('hero','gallery') and profile_photo_count>=8 then
    raise exception 'a portfolio can contain at most 8 profile photos' using errcode='23514';
  end if;
  return new;
end $$;

create function public.claim_photo_cleanup(p_limit integer default 5)
returns table(storage_path text,claim_token uuid) language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_identity_verification_worker();
  if p_limit is null or p_limit not between 1 and 5 then raise exception 'invalid cleanup batch' using errcode='22023'; end if;
  return query with due as (
    select q.storage_path from app_private.photo_object_cleanup q
    where q.run_after<=now() and (q.lease_expires_at is null or q.lease_expires_at<=now())
      and app_private.storage_path_is_canonical(q.storage_path)
      and split_part(q.storage_path,'/',1)~'^[0-9a-f-]{36}$'
      -- Legacy photos may use owner/file paths; only trusted retired metadata enqueues them.
      and not exists(select 1 from public.portfolio_media m
        where q.storage_path in (m.storage_path,m.thumbnail_path,m.metadata->>'blurPath'))
      -- Immutable BrokerDesk disclosure versions retain their own access lifecycle.
      and not exists(select 1 from app_private.portfolio_disclosure_versions v
        where v.public_media @> jsonb_build_array(jsonb_build_object('accessPath',q.storage_path))
          or v.complete_media @> jsonb_build_array(jsonb_build_object('accessPath',q.storage_path)))
    order by q.run_after,q.storage_path for update skip locked limit p_limit
  ) update app_private.photo_object_cleanup q set attempts=q.attempts+1,claim_token=gen_random_uuid(),
    lease_expires_at=now()+interval '5 minutes' from due where q.storage_path=due.storage_path
    returning q.storage_path,q.claim_token;
end $$;

create function public.finish_photo_cleanup(p_storage_path text,p_claim_token uuid,p_error_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  perform app_private.require_identity_verification_worker();
  if p_error_code is not null and p_error_code<>'STORAGE_CLEANUP_FAILED' then raise exception 'invalid cleanup result' using errcode='22023'; end if;
  if p_error_code is null then
    delete from app_private.photo_object_cleanup where storage_path=p_storage_path and claim_token=p_claim_token and lease_expires_at>now();
  else
    update app_private.photo_object_cleanup set run_after=now()+interval '5 minutes'*least(attempts,12),
      claim_token=null,lease_expires_at=null,last_error_code=p_error_code
    where storage_path=p_storage_path and claim_token=p_claim_token and lease_expires_at>now();
  end if;
  get diagnostics affected=row_count;
  return affected=1;
end $$;
revoke all on function public.claim_photo_cleanup(integer),public.finish_photo_cleanup(text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_photo_cleanup(integer),public.finish_photo_cleanup(text,uuid,text) to service_role;

-- Reuse the same safe interest projection for initial cards and paged queues.
create function app_private.relationship_interest_payload(p_id uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'id',r.id,'viewer_name',r.viewer_name,'viewer_phone',r.viewer_phone,'viewer_email',r.viewer_email,
    'viewer_family_context',r.viewer_family_context,'message',r.message,'status',r.status,
    'requester_user_id',r.requester_user_id,'metadata',r.metadata-'portfolio_url','created_at',r.created_at,
    'email_verified',r.email_verified_at is not null and r.verification_channel='email',
    'source_type',case when r.referring_organization_id is null then 'direct' else 'broker' end,
    'broker_name',o.name,'broker_representative_name',m.display_name,'requester_portfolio_token',p.share_token
  ) from public.interest_requests r
  left join public.organizations o on o.id=r.referring_organization_id
  left join public.matchmaker_profiles m on m.id=r.referring_matchmaker_profile_id
  left join lateral (
    select portfolio.share_token from public.portfolios portfolio
    join public.public_portfolio_snapshots snapshot on snapshot.portfolio_id=portfolio.id
      and snapshot.share_token=portfolio.share_token and snapshot.is_active
      and (snapshot.expires_at is null or snapshot.expires_at>now())
    where portfolio.user_id=r.requester_user_id and portfolio.is_published and portfolio.share_token is not null
      and (portfolio.expires_at is null or portfolio.expires_at>now()) limit 1
  ) p on true
  where r.id=p_id and public.can_manage_portfolio(r.portfolio_id);
$$;
revoke all on function app_private.relationship_interest_payload(uuid) from public,anon,authenticated,service_role;

create or replace function app_private.list_dashboard_interests(p_limit integer default 12) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(app_private.relationship_interest_payload(r.id) order by r.created_at desc,r.id desc),'[]'::jsonb)
  from (select id,created_at from public.interest_requests where public.can_manage_portfolio(portfolio_id)
    order by created_at desc,id desc limit least(greatest(coalesce(p_limit,12),1),50)) r;
$$;

create function public.list_relationship_queue(p_stage text,p_offset integer default 0,p_search text default '',p_filter text default 'all')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.require_current_session();
  if p_stage is null or p_stage not in ('awaiting','set-aside','access','history') or p_offset is null or p_offset not between 0 and 100000
    or p_search is null or length(p_search)>100 or p_filter is null or p_filter not in ('all','direct','broker','verified','pending','active','ended') then
    raise exception 'invalid relationship page' using errcode='22023';
  end if;
  with records as (
    select 'interest'::text kind,r.id,r.created_at,
      case when r.status in ('new','pending_review') then 'awaiting' when r.status='rejected' then 'set-aside' else 'history' end stage,
      r.viewer_name name,r.viewer_email email,r.referring_organization_id is not null broker,
      r.email_verified_at is not null and r.verification_channel='email' verified
    from public.interest_requests r join public.portfolios p on p.id=r.portfolio_id where public.can_manage_portfolio(p.id)
    union all
    select 'grant',g.id,g.created_at,case when g.revoked_at is null and g.expires_at>now() then 'access' else 'history' end,
      r.viewer_name,r.viewer_email,r.referring_organization_id is not null,false
    from public.reveal_grants g join public.interest_requests r on r.id=g.interest_request_id
    join public.portfolios p on p.id=g.portfolio_id where public.can_manage_portfolio(p.id)
  ), filtered as (
    select * from records where stage=p_stage
      and strpos(lower(coalesce(name,'')||' '||coalesce(email,'')),lower(trim(p_search)))>0
      and case p_filter when 'direct' then not broker when 'broker' then broker when 'verified' then verified
        when 'pending' then stage='awaiting' when 'active' then stage='access'
        when 'ended' then kind='grant' and stage='history' else true end
  ), page as (select * from filtered order by created_at desc,kind,id desc limit 8 offset p_offset)
  select jsonb_build_object('total',(select count(*) from filtered),'records',coalesce((
    select jsonb_agg(jsonb_build_object('kind',page.kind,'item',case page.kind when 'interest' then app_private.relationship_interest_payload(page.id)
      else jsonb_build_object('id',g.id,'interestRequestId',g.interest_request_id,'viewerName',r.viewer_name,'viewerEmail',r.viewer_email,
        'sourceType',case when r.referring_organization_id is null then 'direct' else 'broker' end,'brokerName',o.name,
        'status',case when g.revoked_at is not null then 'revoked' when g.expires_at<=now() then 'expired' else 'active' end,
        'expiresAt',g.expires_at,'renewedAt',g.renewed_at,'revokedAt',g.revoked_at,'lastAccessedAt',g.last_accessed_at) end)
      order by page.created_at desc,page.kind,page.id desc)
    from page left join public.reveal_grants g on page.kind='grant' and g.id=page.id
    left join public.interest_requests r on r.id=g.interest_request_id
    left join public.organizations o on o.id=r.referring_organization_id
  ),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.list_relationship_queue(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.list_relationship_queue(text,integer,text,text) to authenticated;

create or replace function app_private.list_portfolio_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'counts', jsonb_build_object(
      'awaiting', (select count(*) from public.interest_requests r where r.portfolio_id=portfolio.id and r.status in ('new','pending_review')),
      'set-aside', (select count(*) from public.interest_requests r where r.portfolio_id=portfolio.id and r.status='rejected'),
      'access', (select count(*) from public.reveal_grants g where g.portfolio_id=portfolio.id and g.revoked_at is null and g.expires_at>now())
    ),
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
