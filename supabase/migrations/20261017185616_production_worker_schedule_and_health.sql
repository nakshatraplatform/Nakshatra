-- Installed dormant: deployment plus explicit protected activation is required.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
-- Provider-owned pg_net grants can expose queued headers to SQL roles. Never
-- place the permanent Vault secret there: dispatch uses an expiring one-use MAC.
create table app_private.production_worker_dispatches(id uuid primary key,created_at timestamptz not null default now());
alter table app_private.production_worker_dispatches enable row level security;
revoke all on app_private.production_worker_dispatches from public,anon,authenticated,service_role;

create table app_private.production_worker_state (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  claim_token uuid,
  lease_expires_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed boolean not null default false
);
insert into app_private.production_worker_state(singleton) values(true);
alter table app_private.production_worker_state enable row level security;
revoke all on app_private.production_worker_state from public,anon,authenticated,service_role;

create function public.begin_production_maintenance(p_dispatch_id uuid default gen_random_uuid()) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid; inserted uuid;
begin
  perform app_private.require_identity_verification_worker();
  if p_dispatch_id is null then raise exception 'dispatch unavailable' using errcode='22023'; end if;
  if not exists(select 1 from app_private.production_worker_state where enabled) then return null; end if;
  delete from app_private.production_worker_dispatches where created_at<now()-interval '10 minutes';
  insert into app_private.production_worker_dispatches(id) values(p_dispatch_id)
    on conflict(id) do nothing returning id into inserted;
  if inserted is null then return null; end if;
  update app_private.production_worker_state set claim_token=gen_random_uuid(),
    lease_expires_at=now()+interval '4 minutes',last_started_at=now()
  where singleton and enabled and (lease_expires_at is null or lease_expires_at<=now())
  returning claim_token into token;
  return token;
end; $$;
create function public.finish_production_maintenance(p_claim_token uuid,p_succeeded boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  perform app_private.require_identity_verification_worker();
  if p_succeeded is null then raise exception 'completion unavailable' using errcode='22023'; end if;
  update app_private.production_worker_state set last_completed_at=now(),last_failed=not p_succeeded,
    last_succeeded_at=case when p_succeeded then now() else last_succeeded_at end,
    claim_token=null,lease_expires_at=null
  where singleton and claim_token=p_claim_token and lease_expires_at>now();
  get diagnostics affected=row_count;
  return affected=1;
end; $$;

create function public.production_worker_health() returns jsonb
language plpgsql security definer set search_path='' as $$
declare state app_private.production_worker_state%rowtype; oldest timestamptz; held integer; cleanup_oldest timestamptz; identity_oldest timestamptz;
begin
  perform app_private.require_identity_verification_worker();
  select * into state from app_private.production_worker_state where singleton;
  select min(available_at) filter(where status in ('queued','processing')),
    count(*) filter(where status='failed' and last_error_code is distinct from 'OPERATOR_SUPPRESSED')::integer into oldest,held
  from app_private.notification_outbox where notification_type in (
    'new_introduction','full_view_approved','introduction_declined','full_view_renewed',
    'full_view_revoked','full_view_expiring','full_view_access_expiring','broker_introduction_ready',
    'broker_introduction_response','broker_mutual_interest','broker_introduction_revoked',
    'broker_introduction_expired','broker_complete_access_expired');
  select min(run_after) into cleanup_oldest from app_private.deleted_provider_cleanup;
  select min(run_after) into identity_oldest from app_private.identity_verification_worker_state where completed_at is null and candidate_id is not null;
  return jsonb_build_object(
    'healthy',state.enabled and not state.last_failed
      and coalesce(state.last_succeeded_at>now()-interval '15 minutes',false)
      and coalesce(oldest>now()-interval '15 minutes',true)
      and coalesce(cleanup_oldest>now()-interval '15 minutes',true) and coalesce(identity_oldest>now()-interval '15 minutes',true) and held=0,
    'enabled',state.enabled,'lastStartedAt',state.last_started_at,
    'lastCompletedAt',state.last_completed_at,'lastSucceededAt',state.last_succeeded_at,
    'lastFailed',state.last_failed,'oldestRelationshipDueAt',oldest,
    'heldRelationshipNotifications',held,'oldestDeletedProviderCleanupDueAt',cleanup_oldest,'oldestIdentityDueAt',identity_oldest);
end; $$;

-- Short-lived MAC is scoped to this action and consumed once by begin().
create function app_private.production_dispatch_headers(p_dispatch_id uuid,p_timestamp text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare secret text; signature text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='vivintro_production_worker';
  if secret is null or length(secret)<32 then raise exception 'worker secret unavailable'; end if;
  signature:=encode(extensions.hmac('vivintro-maintenance'||chr(10)||p_dispatch_id::text||chr(10)||p_timestamp,secret,'sha256'),'hex');
  return jsonb_build_object('Content-Type','application/json','X-Worker-Dispatch',p_dispatch_id,
    'X-Worker-Timestamp',p_timestamp,'X-Worker-Signature',signature);
end; $$;
revoke all on function app_private.production_dispatch_headers(uuid,text) from public,anon,authenticated,service_role;

-- Fixed destination avoids a general HTTP proxy; no bearer credential is queued.
create function app_private.dispatch_production_maintenance() returns bigint
language plpgsql security definer set search_path='' as $$
declare request_id bigint;
begin
  if not exists(select 1 from app_private.production_worker_state where enabled) then return null; end if;
  select net.http_post(url:='https://www.vivintro.com/api/internal/production-maintenance',
    headers:=app_private.production_dispatch_headers(gen_random_uuid(),floor(extract(epoch from clock_timestamp()))::bigint::text),
    body:='{}'::jsonb,timeout_milliseconds:=180000) into request_id;
  return request_id;
end; $$;
revoke all on function app_private.dispatch_production_maintenance() from public,anon,authenticated,service_role;

-- Only operators with the service credential can activate/rotate the scheduler.
create function public.configure_production_worker_schedule(p_secret text,p_enabled boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
  perform app_private.require_identity_verification_worker();
  if p_enabled is null or (p_enabled and (p_secret is null or length(p_secret)<32 or length(p_secret)>256)) then
    raise exception 'worker configuration unavailable' using errcode='22023';
  end if;
  if p_secret is not null then
    if length(p_secret)<32 or length(p_secret)>256 then raise exception 'invalid secret' using errcode='22023'; end if;
    select id into secret_id from vault.secrets where name='vivintro_production_worker';
    if secret_id is null then perform vault.create_secret(p_secret,'vivintro_production_worker');
    else perform vault.update_secret(secret_id,p_secret); end if;
  end if;
  update app_private.production_worker_state set enabled=p_enabled where singleton;
end; $$;
revoke all on function public.begin_production_maintenance(uuid),public.finish_production_maintenance(uuid,boolean),
  public.production_worker_health(),public.configure_production_worker_schedule(text,boolean) from public,anon,authenticated;
grant execute on function public.begin_production_maintenance(uuid),public.finish_production_maintenance(uuid,boolean),
  public.production_worker_health(),public.configure_production_worker_schedule(text,boolean) to service_role;
select cron.schedule('vivintro-production-maintenance','*/5 * * * *','select app_private.dispatch_production_maintenance()');
