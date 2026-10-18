-- Provider idempotency lasts 24h; the durable queue must stop uncertain retries
-- before that horizon. Old unattempted events need a deliberate delivery review.
alter table app_private.notification_outbox add column first_attempt_at timestamptz,
  add column delivery_reviewed_at timestamptz;
update app_private.notification_outbox set first_attempt_at=created_at where attempt_count>0;
create or replace function public.claim_relationship_notification_outbox(
  p_limit integer default 10
)
returns table (
  notification_ref text,
  recipient_user_id uuid,
  notification_type text,
  attempt_count integer,
  interest_request_id uuid,
  grant_id uuid,
  broker_introduction_id uuid,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role'
    or p_limit is null or p_limit not between 1 and 50 then
    raise exception 'notification work unavailable' using errcode='42501';
  end if;
  -- Quarantine old events and uncertain sends rather than release stale mail.
  update app_private.notification_outbox o set status='failed',lease_expires_at=null,
    last_error_code=case when o.first_attempt_at<=now()-interval '23 hours'
      then 'EMAIL_RETRY_WINDOW_EXPIRED' else 'STALE_NOTIFICATION_REVIEW_REQUIRED' end,updated_at=now()
  where o.notification_type in ('new_introduction','full_view_approved','introduction_declined','full_view_renewed',
      'full_view_revoked','full_view_expiring','full_view_access_expiring','broker_introduction_ready',
      'broker_introduction_response','broker_mutual_interest','broker_introduction_revoked',
      'broker_introduction_expired','broker_complete_access_expired') and o.status in ('queued','processing') and (o.lease_expires_at is null or o.lease_expires_at<=now())
    and (o.first_attempt_at<=now()-interval '23 hours'
      or coalesce(o.delivery_reviewed_at,o.created_at)<=now()-interval '24 hours');
  return query
  with selected as (
    select outbox.id from app_private.notification_outbox outbox
    where outbox.notification_type in (
      'new_introduction','full_view_approved','introduction_declined',
      'full_view_renewed','full_view_revoked','full_view_expiring',
      'full_view_access_expiring','broker_introduction_ready',
      'broker_introduction_response','broker_mutual_interest',
      'broker_introduction_revoked','broker_introduction_expired',
      'broker_complete_access_expired'
    )
      and (outbox.first_attempt_at is null or outbox.first_attempt_at>now()-interval '23 hours')
      and coalesce(outbox.delivery_reviewed_at,outbox.created_at)>now()-interval '24 hours'
      and outbox.attempt_count<5
      and outbox.available_at<=pg_catalog.now()
      and (outbox.status='queued'
        or (outbox.status='processing' and outbox.lease_expires_at<=pg_catalog.now()))
    order by outbox.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update app_private.notification_outbox outbox set
      status='processing',attempt_count=outbox.attempt_count+1,
      first_attempt_at=coalesce(outbox.first_attempt_at,now()),
      lease_expires_at=pg_catalog.now()+interval '5 minutes',
      updated_at=pg_catalog.now()
    from selected where outbox.id=selected.id
    returning outbox.notification_ref,outbox.recipient_user_id,
      outbox.notification_type,outbox.attempt_count,
      outbox.interest_request_id,outbox.grant_id,
      outbox.broker_introduction_id,outbox.payload
  )
  select * from claimed;
end;
$$;

create or replace function public.complete_relationship_notification_outbox(
  p_notification_ref text,
  p_attempt_count integer,
  p_succeeded boolean,
  p_error_code text default null,
  p_retryable boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare outbox app_private.notification_outbox%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role'
    or p_notification_ref is null or p_notification_ref!~'^ntf_[0-9a-f]{32}$'
    or p_attempt_count is null or p_attempt_count not between 1 and 5
    or p_succeeded is null or p_retryable is null
    or (p_error_code is not null and p_error_code!~'^[A-Z0-9_]{3,80}$')
    or (p_succeeded and (p_error_code is not null or p_retryable))
    or (not p_succeeded and p_error_code is null) then
    raise exception 'notification completion unavailable' using errcode='42501';
  end if;
  select * into outbox from app_private.notification_outbox
  where notification_ref=p_notification_ref and status='processing'
    and attempt_count=p_attempt_count and lease_expires_at>pg_catalog.now()
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

  if p_succeeded then
    update app_private.notification_outbox set
      status='sent',delivered_at=pg_catalog.now(),lease_expires_at=null,
      last_error_code=null,payload='{}'::jsonb,updated_at=pg_catalog.now()
    where id=outbox.id;
    return 'sent';
  end if;

  update app_private.notification_outbox set
    status=case when p_retryable and attempt_count<5 and first_attempt_at>now()-interval '23 hours' then 'queued' else 'failed' end,
    available_at=case when p_retryable and attempt_count<5 and first_attempt_at>now()-interval '23 hours'
      then pg_catalog.now()+(interval '5 minutes'*greatest(1,attempt_count))
      else available_at end,
    lease_expires_at=null,last_error_code=case when outbox.first_attempt_at<=now()-interval '23 hours' then 'EMAIL_RETRY_WINDOW_EXPIRED' else coalesce(p_error_code,'DELIVERY_FAILED') end,
    updated_at=pg_catalog.now()
  where id=outbox.id;
  return case when p_retryable and outbox.attempt_count<5 and outbox.first_attempt_at>now()-interval '23 hours' then 'queued' else 'failed' end;
end;
$$;

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
    'EMAIL_PROVIDER_UNAVAILABLE','EMAIL_TIMEOUT',
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
    'RECIPIENT_UNAVAILABLE','RECIPIENT_LOOKUP_FAILED',
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

create or replace function public.requeue_failed_relationship_notifications(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role'
    or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'notification recovery unavailable' using errcode='42501';
  end if;
  with selected as (
    select outbox.id from app_private.notification_outbox outbox
    where outbox.status='failed'
      and (outbox.first_attempt_at is null or outbox.first_attempt_at>now()-interval '23 hours')
      and coalesce(outbox.delivery_reviewed_at,outbox.created_at)>now()-interval '24 hours'
      -- Do not bulk-retry uncertain transport outcomes after Resend's 24-hour
      -- idempotency window; those require case-by-case operator disposition.
      and outbox.last_error_code in (
        'EMAIL_INPUT_INVALID','EMAIL_NOT_CONFIGURED',
        'EMAIL_CREDENTIALS_REJECTED','EMAIL_REJECTED','EMAIL_RATE_LIMITED',
        'RECIPIENT_UNAVAILABLE','RECIPIENT_LOOKUP_FAILED',
        'GRANT_UNAVAILABLE','GRANT_LOOKUP_FAILED',
        'BROKER_INTRODUCTION_UNAVAILABLE','BROKER_NOTIFICATION_PAYLOAD_INVALID',
        'BROKER_RECIPIENT_STALE','BROKER_RECIPIENT_CHECK_FAILED'
      )
      and outbox.notification_type in (
        'new_introduction','full_view_approved','introduction_declined',
        'full_view_renewed','full_view_revoked','full_view_expiring',
        'full_view_access_expiring','broker_introduction_ready',
        'broker_introduction_response','broker_mutual_interest',
        'broker_introduction_revoked','broker_introduction_expired',
        'broker_complete_access_expired'
      )
    order by outbox.updated_at
    for update skip locked
    limit p_limit
  )
  update app_private.notification_outbox outbox set
    status='queued',attempt_count=0,available_at=pg_catalog.now(),
    lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
  from selected where outbox.id=selected.id;
  get diagnostics affected=row_count;
  return affected;
end;
$$;

-- Review can intentionally retire obsolete mail without sending it. Keep a
-- durable disposition; never disguise it as provider acceptance.
create function public.suppress_failed_relationship_notification(p_notification_ref text) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role'
    or p_notification_ref is null or p_notification_ref!~'^ntf_[0-9a-f]{32}$' then
    raise exception 'notification disposition unavailable' using errcode='42501';
  end if;
  update app_private.notification_outbox set last_error_code='OPERATOR_SUPPRESSED',
    delivery_reviewed_at=now(),updated_at=now()
  where notification_ref=p_notification_ref and status='failed' and notification_type in (
    'new_introduction','full_view_approved','introduction_declined','full_view_renewed',
    'full_view_revoked','full_view_expiring','full_view_access_expiring','broker_introduction_ready',
    'broker_introduction_response','broker_mutual_interest','broker_introduction_revoked',
    'broker_introduction_expired','broker_complete_access_expired');
  get diagnostics affected=row_count;
  return affected=1;
end; $$;
revoke all on function public.suppress_failed_relationship_notification(text) from public,anon,authenticated;
grant execute on function public.suppress_failed_relationship_notification(text) to service_role;
