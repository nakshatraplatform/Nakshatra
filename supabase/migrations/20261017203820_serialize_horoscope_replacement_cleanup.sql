-- Upload intents cover process/response loss; retired objects are durably purged.
-- No parent FK: an account cascade cannot erase its cleanup obligation.
create table app_private.horoscope_object_cleanup (
  storage_path text primary key,
  portfolio_id uuid not null,
  state text not null check(state in ('uploading','retired')),
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  claim_token uuid,
  lease_expires_at timestamptz,
  last_error_code text
);
alter table app_private.horoscope_object_cleanup enable row level security;
revoke all on app_private.horoscope_object_cleanup from public,anon,authenticated,service_role;
create index horoscope_object_cleanup_due on app_private.horoscope_object_cleanup(run_after);

-- Browser clients must not reattach retired objects while a worker deletes them.
-- Trusted publication functions keep their existing definer privileges.
revoke insert,update,delete on public.portfolio_horoscopes from anon,authenticated;

create function app_private.queue_retired_horoscope() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' or new.storage_path is distinct from old.storage_path then
    insert into app_private.horoscope_object_cleanup(storage_path,portfolio_id,state)
    values(old.storage_path,old.portfolio_id,'retired') on conflict(storage_path) do nothing;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app_private.queue_retired_horoscope() from public,anon,authenticated,service_role;
create trigger queue_retired_horoscope after update of storage_path or delete on public.portfolio_horoscopes
for each row execute function app_private.queue_retired_horoscope();

create function public.reserve_horoscope_upload(p_portfolio_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare object_path text;
begin
  perform app_private.require_current_session();
  perform 1 from public.portfolios where id=p_portfolio_id and user_id=auth.uid() for update;
  if not found then raise exception 'portfolio unavailable' using errcode='42501'; end if;
  if (select count(*) from app_private.horoscope_object_cleanup where portfolio_id=p_portfolio_id and state='uploading' and run_after>now())>=6 then
    raise exception 'too many unfinished uploads' using errcode='54000'; end if;
  object_path:=auth.uid()::text||'/'||p_portfolio_id::text||'/'||gen_random_uuid()::text||'.webp';
  insert into app_private.horoscope_object_cleanup(storage_path,portfolio_id,state,run_after)
  values(object_path,p_portfolio_id,'uploading',now()+interval '1 hour');
  return object_path;
end $$;

create function public.replace_horoscope(p_portfolio_id uuid,p_expected_path text,p_attachment jsonb)
returns public.portfolio_horoscopes language plpgsql security definer set search_path='' as $$
declare current_row public.portfolio_horoscopes%rowtype; reservation app_private.horoscope_object_cleanup%rowtype;
begin
  perform app_private.require_current_session();
  perform 1 from public.portfolios where id=p_portfolio_id and user_id=auth.uid() for update;
  if not found then raise exception 'portfolio unavailable' using errcode='42501'; end if;
  select * into current_row from public.portfolio_horoscopes where portfolio_id=p_portfolio_id for update;
  -- A lost response can be retried safely without deleting the committed object.
  if current_row.storage_path=p_attachment->>'storage_path' then return current_row; end if;
  if current_row.storage_path is distinct from p_expected_path then
    raise exception 'horoscope changed; refresh and try again' using errcode='PT409';
  end if;
  select * into reservation from app_private.horoscope_object_cleanup
    where storage_path=p_attachment->>'storage_path' and portfolio_id=p_portfolio_id for update;
  if not found or reservation.state<>'uploading' or reservation.claim_token is not null or reservation.run_after<=now() then
    raise exception 'upload reservation unavailable' using errcode='22023';
  end if;
  if p_attachment is null or jsonb_typeof(p_attachment)<>'object'
    or (p_attachment->>'mime_type') is distinct from 'image/webp' or (p_attachment->>'file_extension') is distinct from 'webp'
    or p_attachment->>'byte_size' is null or p_attachment->>'page_count' is null
    or (p_attachment->>'byte_size')::bigint not between 1 and 20971520
    or (p_attachment->>'page_count')::integer<>1
    or length(coalesce(p_attachment->>'language_label',''))>80 then
    raise exception 'invalid attachment' using errcode='22023';
  end if;
  insert into public.portfolio_horoscopes(portfolio_id,storage_path,mime_type,file_extension,byte_size,language_label,page_count,published_at)
  values(p_portfolio_id,reservation.storage_path,'image/webp','webp',(p_attachment->>'byte_size')::bigint,
    nullif(p_attachment->>'language_label',''),1,null)
  on conflict(portfolio_id) do update set storage_path=excluded.storage_path,mime_type=excluded.mime_type,
    file_extension=excluded.file_extension,byte_size=excluded.byte_size,language_label=excluded.language_label,
    page_count=1,published_at=null
  returning * into current_row;
  delete from app_private.horoscope_object_cleanup where storage_path=reservation.storage_path;
  return current_row;
end $$;

create function public.delete_owned_horoscope(p_id uuid) returns public.portfolio_horoscopes
language plpgsql security definer set search_path='' as $$
declare attachment public.portfolio_horoscopes%rowtype; owned_id uuid;
begin
  perform app_private.require_current_session();
  select p.id into owned_id from public.portfolios p join public.portfolio_horoscopes h on h.portfolio_id=p.id
    where h.id=p_id and p.user_id=auth.uid() for update of p;
  if owned_id is null then raise exception 'attachment unavailable' using errcode='42501'; end if;
  delete from public.portfolio_horoscopes where id=p_id returning * into attachment;
  return attachment;
end $$;
create function public.publish_owned_horoscope(p_portfolio_id uuid,p_published_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_current_session();
  if not exists(select 1 from public.portfolios where id=p_portfolio_id and user_id=auth.uid()) then
    raise exception 'portfolio unavailable' using errcode='42501'; end if;
  update public.portfolio_horoscopes set published_at=p_published_at where portfolio_id=p_portfolio_id;
end $$;
revoke all on function public.reserve_horoscope_upload(uuid),public.replace_horoscope(uuid,text,jsonb),
  public.delete_owned_horoscope(uuid),public.publish_owned_horoscope(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.reserve_horoscope_upload(uuid),public.replace_horoscope(uuid,text,jsonb),
  public.delete_owned_horoscope(uuid),public.publish_owned_horoscope(uuid,timestamptz) to authenticated;

create function public.claim_horoscope_cleanup(p_limit integer default 5)
returns table(storage_path text,claim_token uuid) language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_identity_verification_worker();
  if p_limit is null or p_limit not between 1 and 10 then raise exception 'invalid cleanup batch' using errcode='22023'; end if;
  return query with due as (
    select q.storage_path from app_private.horoscope_object_cleanup q where q.run_after<=now()
      and (q.lease_expires_at is null or q.lease_expires_at<=now())
      and app_private.storage_path_is_canonical(q.storage_path)
      and split_part(q.storage_path,'/',2)=q.portfolio_id::text
      and split_part(q.storage_path,'/',1)~'^[0-9a-f-]{36}$'
      and not exists(select 1 from public.portfolio_horoscopes h where h.storage_path=q.storage_path)
      -- Historical BrokerDesk snapshots have their own disclosure lifecycle: hold those objects.
      and not exists(select 1 from app_private.portfolio_disclosure_versions v where v.horoscope->>'accessPath'=q.storage_path)
    order by q.run_after,q.storage_path for update skip locked limit p_limit
  ) update app_private.horoscope_object_cleanup q set state='retired',attempts=q.attempts+1,
      claim_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes'
    from due where q.storage_path=due.storage_path returning q.storage_path,q.claim_token;
end $$;
create function public.finish_horoscope_cleanup(p_storage_path text,p_claim_token uuid,p_error_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  perform app_private.require_identity_verification_worker();
  if p_error_code is not null and p_error_code<>'STORAGE_CLEANUP_FAILED' then raise exception 'invalid cleanup result' using errcode='22023'; end if;
  if p_error_code is null then
    delete from app_private.horoscope_object_cleanup where storage_path=p_storage_path
      and claim_token=p_claim_token and lease_expires_at>now();
  else
    update app_private.horoscope_object_cleanup set run_after=now()+interval '5 minutes'*least(attempts,12),
      claim_token=null,lease_expires_at=null,last_error_code=p_error_code
    where storage_path=p_storage_path and claim_token=p_claim_token and lease_expires_at>now();
  end if;
  get diagnostics affected=row_count;
  return affected=1;
end $$;
revoke all on function public.claim_horoscope_cleanup(integer),public.finish_horoscope_cleanup(text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_horoscope_cleanup(integer),public.finish_horoscope_cleanup(text,uuid,text) to service_role;
