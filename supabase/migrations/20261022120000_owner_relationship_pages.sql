-- Additive owner read contract; existing commands, legacy reads, RLS and grants
-- are intentionally unchanged. Filter/page IDs before building private payloads.
create function public.get_owner_relationship_page(
  p_queue text default 'overview', p_offset integer default 0,
  p_query text default '', p_filter text default 'all'
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  owner_id uuid;
  result jsonb;
begin
  perform app_private.require_current_session();
  if p_queue is null or p_queue not in ('overview','awaiting','set-aside','access','history')
    or p_offset is null or p_offset not between 0 and 100000
    or p_query is null or length(p_query) > 80
    or p_filter is null or p_filter not in ('all','direct','broker','verified','pending','active','ended') then
    raise exception 'invalid relationship page' using errcode = '22023';
  end if;
  select id into owner_id from public.portfolios where user_id = auth.uid();

  with candidates as (
    select 'interest'::text kind, r.id, r.created_at, r.status::text status,
      r.viewer_name name, r.viewer_email email, r.referring_organization_id is not null broker,
      r.email_verified_at is not null and r.verification_channel = 'email' verified
    from public.interest_requests r where r.portfolio_id = owner_id
    union all
    select 'grant', g.id, g.created_at,
      case when g.revoked_at is not null then 'revoked' when g.expires_at <= now() then 'expired' else 'active' end,
      r.viewer_name, r.viewer_email, r.referring_organization_id is not null, true
    from public.reveal_grants g join public.interest_requests r on r.id = g.interest_request_id
    where g.portfolio_id = owner_id
  ), matched as (
    select * from candidates c where
      (p_queue = 'overview'
        or p_queue = 'awaiting' and c.kind = 'interest' and c.status in ('new','pending_review')
        or p_queue = 'set-aside' and c.kind = 'interest' and c.status = 'rejected'
        or p_queue = 'access' and c.kind = 'grant' and c.status = 'active'
        or p_queue = 'history' and (c.kind = 'grant' and c.status <> 'active'
          or c.kind = 'interest' and c.status not in ('new','pending_review','rejected')))
      and (btrim(p_query) = '' or strpos(lower(coalesce(c.name,'') || ' ' || coalesce(c.email,'')), lower(btrim(p_query))) > 0)
      and (p_filter = 'all' or p_filter = 'direct' and not c.broker or p_filter = 'broker' and c.broker
        or p_filter = 'verified' and c.kind = 'interest' and c.verified
        or p_filter = 'pending' and c.kind = 'interest' and c.status in ('new','pending_review')
        or p_filter = 'active' and c.kind = 'grant' and c.status = 'active'
        or p_filter = 'ended' and c.kind = 'grant' and c.status <> 'active')
  ), ranked as (
    select *, row_number() over (partition by case
      when kind='interest' and status in ('new','pending_review') then 'awaiting'
      when kind='interest' and status='rejected' then 'set-aside'
      when kind='grant' and status='active' then 'access' else 'history' end
      order by created_at desc,id desc,kind) queue_rank from matched
  ), page as (
    select * from ranked where p_queue <> 'overview' or queue_rank <= 3 order by
      created_at desc, id desc, kind
    limit case when p_queue = 'overview' then 50 else 8 end offset p_offset
  ), projected as (
    select p.kind, p.created_at, p.id, jsonb_build_object('kind',p.kind,'item',
      case when p.kind = 'interest' then jsonb_build_object(
        'id',r.id,'viewer_name',r.viewer_name,'viewer_phone',r.viewer_phone,'viewer_email',r.viewer_email,
        'viewer_family_context',r.viewer_family_context,'message',r.message,'status',r.status,
        'requester_user_id',r.requester_user_id,'metadata',r.metadata - 'portfolio_url','created_at',r.created_at,
        'email_verified',p.verified,'source_type',case when p.broker then 'broker' else 'direct' end,
        'broker_name',o.name,'broker_representative_name',m.display_name,
        'requester_portfolio_token', (select v.share_token from public.portfolios v
          join public.public_portfolio_snapshots s on s.portfolio_id=v.id and s.share_token=v.share_token
          where v.user_id=r.requester_user_id and v.is_published and s.is_active
            and (v.expires_at is null or v.expires_at > now()) and (s.expires_at is null or s.expires_at > now()) limit 1))
      else jsonb_build_object(
        'id',g.id,'interestRequestId',g.interest_request_id,'viewerName',r.viewer_name,'viewerEmail',r.viewer_email,
        'sourceType',case when p.broker then 'broker' else 'direct' end,'brokerName',o.name,'status',p.status,
        'expiresAt',g.expires_at,'renewedAt',g.renewed_at,'revokedAt',g.revoked_at,'lastAccessedAt',g.last_accessed_at)
      end) payload
    from page p left join public.reveal_grants g on p.kind='grant' and g.id=p.id
    join public.interest_requests r on r.id=case when p.kind='interest' then p.id else g.interest_request_id end
    left join public.organizations o on o.id=r.referring_organization_id
    left join public.matchmaker_profiles m on m.id=r.referring_matchmaker_profile_id
  ) select jsonb_build_object(
    'records',coalesce((select jsonb_agg(payload order by created_at desc,id desc,kind) from projected),'[]'::jsonb),
    'total',(select count(*) from matched),
    'counts',jsonb_build_object(
      'interests',(select count(*) from candidates where kind='interest'),
      'awaiting',(select count(*) from candidates where kind='interest' and status in ('new','pending_review')),
      'setAside',(select count(*) from candidates where kind='interest' and status='rejected'),
      'active',(select count(*) from candidates where kind='grant' and status='active')),
    'disclosure',(select jsonb_build_object('data',a.data,
      'revision',md5(a.data::text || coalesce((select string_agg(to_jsonb(m)::text, ',' order by id)
        from public.portfolio_media m where portfolio_id=owner_id and media_type in ('hero','gallery')
        and visibility in ('public','blurred','interest_required','approved_only')),'')
        || coalesce((select to_jsonb(h)::text from public.portfolio_horoscopes h where portfolio_id=owner_id
          and published_at is not null and file_extension='webp'),'')),
      'photoCount',(select count(*) from public.portfolio_media where portfolio_id=owner_id
        and media_type in ('hero','gallery') and visibility in ('public','blurred','interest_required','approved_only')),
      'privatePhotoCount',(select count(*) from public.portfolio_media where portfolio_id=owner_id
        and media_type in ('hero','gallery') and visibility in ('blurred','interest_required','approved_only')),
      'hasHoroscope',exists(select 1 from public.portfolio_horoscopes where portfolio_id=owner_id
        and published_at is not null and file_extension='webp'))
      from public.approved_portfolio_snapshots a join public.portfolios v on v.id=a.portfolio_id
      where a.portfolio_id=owner_id and v.is_published)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_owner_relationship_page(text,integer,text,text) from public, anon, authenticated;
grant execute on function public.get_owner_relationship_page(text,integer,text,text) to authenticated;
comment on function public.get_owner_relationship_page(text,integer,text,text) is
  'Bounded owner/session-only relationship queues, counts and current published disclosure. No grant mutations.';

-- Review a concrete published revision, not a possibly changed draft. Keep the
-- established decision command responsible for identity, transitions and outbox.
create function public.decide_interest_request_reviewed(p_interest_request_id uuid, p_revision text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare owner_id uuid; review jsonb;
begin
  perform app_private.require_current_session();
  -- Match the submission engine's portfolio -> request lock order. A viewer
  -- retry can update this same request while the owner is reviewing it.
  select r.portfolio_id into owner_id from public.interest_requests r
    where r.id=p_interest_request_id and public.can_manage_portfolio(r.portfolio_id);
  if owner_id is null then return 'not_found'; end if;
  perform 1 from public.portfolios where id=owner_id and user_id=auth.uid() for update;
  if not found then return 'unauthorized'; end if;
  perform 1 from public.interest_requests where id=p_interest_request_id
    and portfolio_id=owner_id for update;
  if not found then return 'not_found'; end if;
  review := public.get_owner_relationship_page() -> 'disclosure';
  if p_revision is null or review is null or review = 'null'::jsonb
    or review ->> 'revision' is distinct from p_revision then return 'review_changed'; end if;
  return app_private.decide_interest_request(p_interest_request_id, 'approved');
end;
$$;
revoke all on function public.decide_interest_request_reviewed(uuid,text) from public, anon, authenticated;
grant execute on function public.decide_interest_request_reviewed(uuid,text) to authenticated;
