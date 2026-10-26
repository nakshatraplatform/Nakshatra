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
  if tg_op='DELETE' then
    perform 1 from public.portfolios where id=old.portfolio_id for update;
  else
    if tg_op='UPDATE' then
      perform 1 from public.portfolios where id in (old.portfolio_id,new.portfolio_id) order by id for update;
    end if;
    select candidate_id,user_id into expected_candidate_id,expected_user_id
    from public.portfolios where id=new.portfolio_id for update;
  end if;
  -- Retirement and attachment share ordered path locks, including legacy paths.
  perform pg_catalog.pg_advisory_xact_lock(path_key) from (
    select distinct pg_catalog.hashtextextended(path,284) as path_key
    from unnest(case when tg_op='INSERT' then array[new.storage_path,new.thumbnail_path,new.metadata->>'blurPath']
      when tg_op='DELETE' then array[old.storage_path,old.thumbnail_path,old.metadata->>'blurPath']
      else array[old.storage_path,old.thumbnail_path,old.metadata->>'blurPath',new.storage_path,new.thumbnail_path,new.metadata->>'blurPath'] end) path
    where path is not null order by path_key
  ) paths;
  if tg_op='DELETE' then return old; end if;
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

create trigger lock_photo_retirement before delete on public.portfolio_media
for each row execute function app_private.enforce_portfolio_media_contract();

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
