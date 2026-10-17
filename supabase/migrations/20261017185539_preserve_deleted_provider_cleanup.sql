-- Cleanup must survive every candidate/subject/Auth FK cascade. This queue has
-- no subject foreign key and holds only minimum provider correlation until purge.
create table app_private.deleted_provider_cleanup (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique,
  provider_session_ref text,
  provider_vendor_data text,
  provider_workflow_id uuid,
  provider_workflow_version integer,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  claim_token uuid,
  lease_expires_at timestamptz,
  last_error_code text
);
alter table app_private.deleted_provider_cleanup enable row level security;
revoke all on app_private.deleted_provider_cleanup from public,anon,authenticated,service_role;
create index deleted_provider_cleanup_due on app_private.deleted_provider_cleanup(run_after);

create function app_private.preserve_deleted_provider_cleanup()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.provider_redacted_at is null and (old.provider_session_ref is not null
      or old.provider_create_registered_at is not null) then
    insert into app_private.deleted_provider_cleanup(attempt_id,provider_session_ref,
      provider_vendor_data,provider_workflow_id,provider_workflow_version)
    values(old.id,old.provider_session_ref,old.provider_vendor_data,
      old.provider_workflow_id,old.provider_workflow_version)
    on conflict(attempt_id) do nothing;
  end if;
  return old;
end $$;
revoke all on function app_private.preserve_deleted_provider_cleanup() from public,anon,authenticated,service_role;
create trigger preserve_deleted_provider_cleanup before delete on app_private.identity_verification_attempts
for each row execute function app_private.preserve_deleted_provider_cleanup();

create function public.claim_deleted_provider_cleanup(p_limit integer default 2)
returns table(id uuid,claim_token uuid,provider_session_ref text,provider_vendor_data text,
  provider_workflow_id uuid,provider_workflow_version integer)
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_identity_verification_worker();
  if p_limit is null or p_limit not between 1 and 10 then raise exception 'invalid cleanup batch' using errcode='22023'; end if;
  return query with due as (
    select q.id from app_private.deleted_provider_cleanup q where q.run_after<=now()
      and (q.lease_expires_at is null or q.lease_expires_at<=now())
    order by q.run_after,q.id for update skip locked limit p_limit
  ) update app_private.deleted_provider_cleanup q set attempts=q.attempts+1,
      claim_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes'
    from due where q.id=due.id returning q.id,q.claim_token,q.provider_session_ref,
      q.provider_vendor_data,q.provider_workflow_id,q.provider_workflow_version;
end $$;

create function public.finish_deleted_provider_cleanup(p_id uuid,p_claim_token uuid,p_error_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  perform app_private.require_identity_verification_worker();
  if p_error_code is not null and p_error_code!~'^[A-Z_]{3,80}$' then raise exception 'invalid cleanup result' using errcode='22023'; end if;
  if p_error_code is null then
    -- A confirmed purge removes the now-unneeded provider correlation entirely.
    delete from app_private.deleted_provider_cleanup q where q.id=p_id
      and q.claim_token=p_claim_token and q.lease_expires_at>now();
  else
    update app_private.deleted_provider_cleanup q set run_after=now()+interval '5 minutes'*least(q.attempts,12),
      claim_token=null,lease_expires_at=null,last_error_code=p_error_code
    where q.id=p_id and q.claim_token=p_claim_token and q.lease_expires_at>now();
  end if;
  get diagnostics affected=row_count;
  return affected=1;
end $$;
revoke all on function public.claim_deleted_provider_cleanup(integer),
  public.finish_deleted_provider_cleanup(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_deleted_provider_cleanup(integer),
  public.finish_deleted_provider_cleanup(uuid,uuid,text) to service_role;
