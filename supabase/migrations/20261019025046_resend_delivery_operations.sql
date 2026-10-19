-- NAK-68: metadata registry around existing dispatch queues, not a new queue.
create table app_private.email_deliveries (
  delivery_id uuid primary key,
  recipient_hash text not null check(recipient_hash ~ '^[0-9a-f]{64}$'),
  message_digest text not null check(message_digest ~ '^[0-9a-f]{64}$'),
  provider_message_id uuid unique,
  status text not null default 'pending' check(status in ('pending','sent','delivered','bounced','complained','suppressed','failed')),
  claim_token uuid,
  lease_expires_at timestamptz,
  first_attempt_at timestamptz not null default now(),
  last_event_at timestamptz,
  last_error_code text check(last_error_code ~ '^[A-Z0-9_]{3,80}$'),
  deferrals integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_deliveries_recipient on app_private.email_deliveries(recipient_hash);
create index email_deliveries_created on app_private.email_deliveries(created_at);
create table app_private.email_recipient_suppressions (
  recipient_hash text primary key check(recipient_hash ~ '^[0-9a-f]{64}$'),
  reason text not null check(reason in ('bounced','complained','suppressed')),
  created_at timestamptz not null default now()
);
create table app_private.resend_webhook_receipts (
  event_id text primary key check(event_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  event_digest text not null check(event_digest ~ '^[0-9a-f]{64}$'),
  provider_message_id uuid not null,
  status text not null check(status in ('sent','delivered','bounced','complained','suppressed','failed','delayed')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index resend_webhook_receipts_received on app_private.resend_webhook_receipts(received_at);
alter table app_private.email_deliveries enable row level security;
alter table app_private.email_recipient_suppressions enable row level security;
alter table app_private.resend_webhook_receipts enable row level security;
revoke all on app_private.email_deliveries,app_private.email_recipient_suppressions,app_private.resend_webhook_receipts from public,anon,authenticated,service_role;

create function app_private.require_email_operator() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'email operation unavailable' using errcode='42501';
  end if;
end; $$;
revoke all on function app_private.require_email_operator() from public,anon,authenticated,service_role;

-- Recipient lock orders preparation and suppression. External HTTP is outside
-- this transaction; events cannot recall a request already in flight.
create function public.prepare_application_email(p_delivery_id uuid,p_recipient_hash text,p_message_digest text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d app_private.email_deliveries%rowtype;
begin
  perform app_private.require_email_operator();
  if p_delivery_id is null or p_recipient_hash is null or p_recipient_hash!~'^[0-9a-f]{64}$'
    or p_message_digest is null or p_message_digest!~'^[0-9a-f]{64}$' then
    raise exception 'invalid delivery metadata' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_recipient_hash,68));
  if exists(select 1 from app_private.email_recipient_suppressions where recipient_hash=p_recipient_hash) then
    return jsonb_build_object('status','suppressed'); end if;
  insert into app_private.email_deliveries(delivery_id,recipient_hash,message_digest)
    values(p_delivery_id,p_recipient_hash,p_message_digest) on conflict(delivery_id) do nothing;
  select * into d from app_private.email_deliveries where delivery_id=p_delivery_id for update;
  if d.recipient_hash<>p_recipient_hash or d.message_digest<>p_message_digest then
    return jsonb_build_object('status','conflict'); end if;
  if d.provider_message_id is not null then
    return jsonb_build_object('status','accepted','providerMessageId',d.provider_message_id); end if;
  if d.first_attempt_at<=now()-interval '23 hours' then
    return jsonb_build_object('status','expired'); end if;
  if d.lease_expires_at>now() then return jsonb_build_object('status','busy'); end if;
  update app_private.email_deliveries set status='pending',claim_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',updated_at=now()
    where delivery_id=d.delivery_id returning * into d;
  return jsonb_build_object('status','ready','claimToken',d.claim_token);
end; $$;

create function public.finish_application_email(p_delivery_id uuid,p_claim_token uuid,p_provider_message_id uuid default null,p_error_code text default null,p_retryable boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare d app_private.email_deliveries%rowtype;
begin
  perform app_private.require_email_operator();
  if p_retryable is null or (p_provider_message_id is null)=(p_error_code is null)
    or (p_provider_message_id is not null and p_retryable)
    or (p_error_code is not null and p_error_code!~'^EMAIL_[A-Z0-9_]{1,74}$') then
    raise exception 'invalid delivery completion' using errcode='22023'; end if;
  select * into d from app_private.email_deliveries where delivery_id=p_delivery_id;
  if not found then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(d.recipient_hash,68));
  select * into d from app_private.email_deliveries where delivery_id=p_delivery_id for update;
  if d.claim_token is distinct from p_claim_token or p_claim_token is null or d.lease_expires_at<=now() then return false; end if;
  if d.provider_message_id is not null and p_provider_message_id is not null and d.provider_message_id<>p_provider_message_id then return false; end if;
  update app_private.email_deliveries set
    provider_message_id=coalesce(d.provider_message_id,p_provider_message_id),
    status=case when d.status<>'pending' then d.status when p_provider_message_id is not null then 'sent'
      when p_retryable then 'pending' else 'failed' end,
    last_error_code=case when d.provider_message_id is not null or p_provider_message_id is not null then null else p_error_code end,
    deferrals=deferrals+case when p_retryable then 1 else 0 end,
    claim_token=null,lease_expires_at=null,updated_at=now()
    where delivery_id=p_delivery_id;
  return true;
end; $$;

create function app_private.email_status_rank(p_status text) returns integer
language sql immutable set search_path = '' as $$
  select case p_status when 'complained' then 60 when 'bounced' then 50 when 'suppressed' then 40
    when 'delivered' then 30 when 'failed' then 20 when 'sent' then 10 else 0 end;
$$;
revoke all on function app_private.email_status_rank(text) from public,anon,authenticated,service_role;

create function public.record_resend_delivery_event(p_event_id text,p_event_digest text,p_provider_message_id uuid,p_status text,p_occurred_at timestamptz,p_delivery_id uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare d app_private.email_deliveries%rowtype; inserted integer;
begin
  perform app_private.require_email_operator();
  if p_event_id is null or p_event_id!~'^[A-Za-z0-9_-]{1,128}$'
    or p_event_digest is null or p_event_digest!~'^[0-9a-f]{64}$' or p_provider_message_id is null
    or p_status is null or p_status not in ('sent','delivered','bounced','complained','suppressed','failed','delayed')
    or p_occurred_at is null or not isfinite(p_occurred_at) or p_occurred_at>now()+interval '5 minutes' then
    raise exception 'invalid delivery event' using errcode='22023'; end if;
  insert into app_private.resend_webhook_receipts(event_id,event_digest,provider_message_id,status,occurred_at)
    values(p_event_id,p_event_digest,p_provider_message_id,p_status,p_occurred_at) on conflict(event_id) do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return false; end if;
  select * into d from app_private.email_deliveries where provider_message_id=p_provider_message_id;
  if not found and p_delivery_id is not null then
    select * into d from app_private.email_deliveries where delivery_id=p_delivery_id and provider_message_id is null;
  end if;
  -- A signed Auth SMTP or other sender event cannot create a recipient mapping.
  if d.delivery_id is null then return true; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(d.recipient_hash,68));
  select * into d from app_private.email_deliveries where delivery_id=d.delivery_id for update;
  if d.provider_message_id is not null and d.provider_message_id<>p_provider_message_id then return true; end if;
  update app_private.email_deliveries set provider_message_id=p_provider_message_id,
    status=case when app_private.email_status_rank(p_status)>app_private.email_status_rank(d.status) then p_status else d.status end,
    last_event_at=greatest(d.last_event_at,p_occurred_at),
    last_error_code=case when p_status='delayed' and d.status in ('pending','sent') then 'EMAIL_DELIVERY_DELAYED'
      when p_status='failed' and d.status in ('pending','sent','failed') then 'EMAIL_DELIVERY_FAILED'
      when p_status in ('bounced','complained','suppressed') then 'EMAIL_RECIPIENT_SUPPRESSED'
      when p_status in ('sent','delivered') and app_private.email_status_rank(p_status)>=app_private.email_status_rank(d.status) then null
      else d.last_error_code end,
    updated_at=now() where delivery_id=d.delivery_id;
  if p_status in ('bounced','complained','suppressed') then
    insert into app_private.email_recipient_suppressions(recipient_hash,reason) values(d.recipient_hash,p_status)
      on conflict(recipient_hash) do update set reason=case
        when app_private.email_status_rank(excluded.reason)>app_private.email_status_rank(email_recipient_suppressions.reason)
        then excluded.reason else email_recipient_suppressions.reason end;
  end if;
  return true;
end; $$;

-- Existing idempotent requests did not contain a delivery tag. Do not retry a
-- changed provider body or silently create a fresh send after an uncertain one.
update app_private.notification_outbox set status='failed',lease_expires_at=null,
  last_error_code='EMAIL_TRACKING_UPGRADE_REVIEW_REQUIRED',updated_at=now()
  where status in ('queued','processing') and attempt_count>0
    and notification_type not like 'pilot_access_%';
update app_private.candidate_liveness_email_outbox set status='failed',claim_token=null,lease_expires_at=null,
  last_error_code='EMAIL_TRACKING_UPGRADE_REVIEW_REQUIRED',updated_at=now()
  where status in ('queued','processing') and attempts>0;

create table app_private.email_retention_state (
  singleton boolean primary key default true check(singleton),last_succeeded_at timestamptz
);
alter table app_private.email_retention_state enable row level security;
revoke all on app_private.email_retention_state from public,anon,authenticated,service_role;
insert into app_private.email_retention_state(singleton) values(true);
alter table app_private.candidate_liveness_email_outbox alter column recipient_email drop not null;

create function public.run_email_delivery_retention(p_limit integer default 500) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_email_operator();
  if p_limit is null or p_limit not between 1 and 1000 then raise exception 'invalid email retention batch' using errcode='22023'; end if;
  delete from app_private.resend_webhook_receipts where event_id in (
    select event_id from app_private.resend_webhook_receipts where received_at<now()-interval '30 days' order by received_at limit p_limit for update skip locked);
  delete from app_private.email_deliveries where delivery_id in (
    select delivery_id from app_private.email_deliveries where created_at<now()-interval '90 days' and (lease_expires_at is null or lease_expires_at<=now()) order by created_at limit p_limit for update skip locked);
  update app_private.notification_outbox set payload='{}'::jsonb where id in (
    select id from app_private.notification_outbox where status in ('sent','failed','skipped') and updated_at<now()-interval '30 days' and payload<>'{}'::jsonb limit p_limit for update skip locked);
  update app_private.candidate_liveness_email_outbox set recipient_email=null where id in (
    select id from app_private.candidate_liveness_email_outbox where status in ('accepted','failed','skipped') and updated_at<now()-interval '30 days' and recipient_email is not null limit p_limit for update skip locked);
  delete from app_private.notification_outbox where id in (
    select id from app_private.notification_outbox where status in ('sent','failed','skipped') and updated_at<now()-interval '90 days' limit p_limit for update skip locked);
  delete from app_private.candidate_liveness_email_outbox where id in (
    select id from app_private.candidate_liveness_email_outbox where status in ('accepted','failed','skipped') and updated_at<now()-interval '90 days' limit p_limit for update skip locked);
  update app_private.email_retention_state set last_succeeded_at=now() where singleton;
  return true;
end; $$;

create function public.email_delivery_health(p_daily_limit integer default 100,p_monthly_limit integer default 3000) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare daily bigint; monthly bigint; total bigint; bounces bigint; complaints bigint; failures bigint; overdue bigint; deferred bigint; missing bigint; retention_ok boolean;
begin
  perform app_private.require_email_operator();
  if p_daily_limit is null or p_daily_limit<1 or p_monthly_limit is null or p_monthly_limit<1 then
    raise exception 'invalid email limits' using errcode='22023'; end if;
  select count(*) filter(where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),count(*)
    into daily,monthly from app_private.email_deliveries where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  select count(*) into total from app_private.email_deliveries where created_at>=now()-interval '24 hours';
  -- Complaints can arrive weeks after sending. Alert by receipt time, not the
  -- original send date, and ignore unrelated Auth/provider messages.
  select count(distinct r.provider_message_id) filter(where r.status='bounced'),
    count(distinct r.provider_message_id) filter(where r.status='complained'),
    count(distinct r.provider_message_id) filter(where r.status='failed' and d.status='failed') into bounces,complaints,failures
    from app_private.resend_webhook_receipts r join app_private.email_deliveries d using(provider_message_id)
    where r.received_at>=now()-interval '24 hours';
  select count(*) into missing from app_private.email_deliveries where status in ('pending','sent') and created_at<now()-interval '1 hour';
  select count(*) into deferred from app_private.email_deliveries where deferrals>=3 and status in ('pending','failed');
  select (select count(*) from app_private.notification_outbox where status in ('queued','processing') and created_at<now()-interval '10 minutes')
    +(select count(*) from app_private.candidate_liveness_email_outbox where status in ('queued','processing') and created_at<now()-interval '10 minutes') into overdue;
  select coalesce(last_succeeded_at>now()-interval '20 minutes',false) into retention_ok from app_private.email_retention_state where singleton;
  retention_ok:=retention_ok and not exists(select 1 from app_private.resend_webhook_receipts where received_at<now()-interval '30 days')
    and not exists(select 1 from app_private.email_deliveries where created_at<now()-interval '90 days')
    and not exists(select 1 from app_private.notification_outbox where status in ('sent','failed','skipped') and updated_at<now()-interval '30 days' and (payload<>'{}'::jsonb or updated_at<now()-interval '90 days'))
    and not exists(select 1 from app_private.candidate_liveness_email_outbox where status in ('accepted','failed','skipped') and updated_at<now()-interval '30 days' and (recipient_email is not null or updated_at<now()-interval '90 days'));
  return jsonb_build_object('healthy',retention_ok and overdue=0 and deferred=0 and missing=0
      and daily<p_daily_limit*0.8 and monthly<p_monthly_limit*0.8 and complaints=0 and failures=0 and (bounces=0 or (total>0 and bounces::numeric/nullif(total,0)<0.05)),
    'dailyRegistered',daily,'monthlyRegistered',monthly,'dailyLimit',p_daily_limit,'monthlyLimit',p_monthly_limit,
    'last24hRegistered',total,'bounces',bounces,'complaints',complaints,'failedDelivery',failures,'unresolvedDelivery',missing,
    'overdueQueued',overdue,'repeatedDeferrals',deferred,'retentionHealthy',retention_ok);
end; $$;

revoke all on function public.prepare_application_email(uuid,text,text),
  public.finish_application_email(uuid,uuid,uuid,text,boolean),
  public.record_resend_delivery_event(text,text,uuid,text,timestamptz,uuid),
  public.run_email_delivery_retention(integer),public.email_delivery_health(integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.prepare_application_email(uuid,text,text),
  public.finish_application_email(uuid,uuid,uuid,text,boolean),
  public.record_resend_delivery_event(text,text,uuid,text,timestamptz,uuid),
  public.run_email_delivery_retention(integer),public.email_delivery_health(integer,integer) to service_role;

-- Manual retention retains its existing class counters and includes mail cleanup.
create or replace function public.run_data_retention() returns jsonb
language plpgsql security definer set search_path='' as $$
declare item record; result jsonb:='{}'::jsonb; outcome jsonb;
begin
  perform app_private.require_identity_verification_worker();
  for item in select class from app_private.retention_run_state order by class loop
    outcome:=public.run_retention_class(item.class,500);
    result:=result||jsonb_build_object(item.class,(outcome->>'affected')::integer);
  end loop;
  perform public.run_email_delivery_retention(500);
  return result;
end $$;

-- A guard completion outage may follow provider acceptance; never bulk release.
create or replace function public.requeue_failed_relationship_notification(
  p_notification_ref text,
  p_acknowledge_duplicate_risk boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare outbox app_private.notification_outbox%rowtype;
declare uncertain_delivery boolean;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role'
    or p_notification_ref is null or p_notification_ref!~'^ntf_[0-9a-f]{32}$'
    or p_acknowledge_duplicate_risk is null then
    raise exception 'notification recovery unavailable' using errcode='42501';
  end if;

  select * into outbox from app_private.notification_outbox
  where notification_ref=p_notification_ref and status='failed'
    and notification_type in (
      'new_introduction','full_view_approved','introduction_declined',
      'full_view_renewed','full_view_revoked','full_view_expiring',
      'full_view_access_expiring','broker_introduction_ready',
      'broker_introduction_response','broker_mutual_interest',
      'broker_introduction_revoked','broker_introduction_expired',
      'broker_complete_access_expired'
    )
  for update;
  if not found then return 'unavailable'; end if;

  uncertain_delivery:=coalesce(outbox.last_error_code,'') in (
    'EMAIL_PROVIDER_UNAVAILABLE','EMAIL_TIMEOUT','EMAIL_DELIVERY_GUARD_UNAVAILABLE',
    'EMAIL_RESPONSE_INVALID','EMAIL_IDEMPOTENCY_CONFLICT',
    'EMAIL_RETRY_WINDOW_EXPIRED','STALE_NOTIFICATION_REVIEW_REQUIRED'
  );
  if (uncertain_delivery or outbox.first_attempt_at<=now()-interval '23 hours'
    or coalesce(outbox.delivery_reviewed_at,outbox.created_at)<=now()-interval '24 hours') and not p_acknowledge_duplicate_risk then
    return 'manual_review_required';
  end if;
  if not uncertain_delivery and coalesce(outbox.last_error_code,'') not in (
    'EMAIL_INPUT_INVALID','EMAIL_NOT_CONFIGURED',
    'EMAIL_CREDENTIALS_REJECTED','EMAIL_REJECTED','EMAIL_RATE_LIMITED',
    'RECIPIENT_UNAVAILABLE','RECIPIENT_LOOKUP_FAILED','REMINDER_PREPARE_FAILED',
    'GRANT_UNAVAILABLE','GRANT_LOOKUP_FAILED',
    'BROKER_INTRODUCTION_UNAVAILABLE','BROKER_NOTIFICATION_PAYLOAD_INVALID',
    'BROKER_RECIPIENT_STALE','BROKER_RECIPIENT_CHECK_FAILED'
  ) then
    return 'unavailable';
  end if;

  update app_private.notification_outbox set
    status='queued',attempt_count=0,available_at=pg_catalog.now(),
    first_attempt_at=case when p_acknowledge_duplicate_risk then null else first_attempt_at end,
    delivery_reviewed_at=now(),
    lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
  where id=outbox.id;
  return 'queued';
end;
$$;
