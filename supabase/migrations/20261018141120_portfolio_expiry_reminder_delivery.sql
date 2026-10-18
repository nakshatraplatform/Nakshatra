-- Personal expiry reminders reuse the existing outbox, scheduler and provider.
-- Skip is truthful retirement of obsolete reminder work, never provider acceptance.
alter table app_private.notification_outbox drop constraint notification_outbox_status_check;
alter table app_private.notification_outbox add constraint notification_outbox_status_check
  check(status in ('queued','processing','sent','failed','skipped'));
alter table app_private.notification_outbox add constraint expiry_only_notification_skip
  check(status<>'skipped' or notification_type in ('full_view_expiring','full_view_access_expiring'));
create index reveal_grants_expiry_reminder_due on public.reveal_grants(expires_at,id)
  where revoked_at is null and access_level='full';

create function app_private.expiry_reminder_key(p_grant uuid,p_recipient uuid,p_type text,p_expiry timestamptz)
returns text language sql immutable set search_path='' as $$
  select 'expiry-v1:'||p_type||':'||p_grant::text||':'||p_recipient::text||':'||
    to_char(p_expiry at time zone 'UTC','YYYYMMDDHH24MISSUS');
$$;

create function app_private.expiry_reminder_exists(p_grant uuid,p_recipient uuid,p_type text,p_expiry timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from app_private.notification_outbox o
    where o.grant_id=p_grant and o.recipient_user_id=p_recipient and o.notification_type=p_type
      and (o.deduplication_key=app_private.expiry_reminder_key(p_grant,p_recipient,p_type,p_expiry)
        -- Old sent rows scrubbed their payload. Honor a matching old date key;
        -- +/- one day accommodates the prior session-time-zone-dependent cast.
        or o.deduplication_key in (
          'full-view-expiring:'||case when p_type='full_view_expiring' then 'viewer' else 'owner' end||':'||p_grant::text||':'||((p_expiry at time zone 'UTC')::date-1)::text,
          'full-view-expiring:'||case when p_type='full_view_expiring' then 'viewer' else 'owner' end||':'||p_grant::text||':'||(p_expiry at time zone 'UTC')::date::text,
          'full-view-expiring:'||case when p_type='full_view_expiring' then 'viewer' else 'owner' end||':'||p_grant::text||':'||((p_expiry at time zone 'UTC')::date+1)::text)));
$$;

create function app_private.expiry_reminder_is_current(p_grant uuid,p_recipient uuid,p_type text,p_payload jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare expected_expiry timestamptz;
begin
  if p_type is null or p_type not in ('full_view_expiring','full_view_access_expiring')
    or jsonb_typeof(p_payload) is distinct from 'object'
    or (p_payload ? 'schemaVersion' and p_payload->>'schemaVersion' is distinct from '1') then return false; end if;
  begin expected_expiry:=(p_payload->>'expiresAt')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then return false; end;
  return exists(select 1 from public.reveal_grants g
    join public.portfolios p on p.id=g.portfolio_id
    join public.interest_requests r on r.id=g.interest_request_id
    join auth.users u on u.id=p_recipient
    where g.id=p_grant and g.access_level='full' and g.revoked_at is null
      and g.expires_at=expected_expiry and g.expires_at>now() and g.expires_at<=now()+interval '24 hours'
      and public.is_published_portfolio(p.id) and p.is_published and p.share_token is not null and (p.expires_at is null or p.expires_at>now())
      and r.status in ('approved','revealed') and r.email_verified_at is not null
      and r.portfolio_id=g.portfolio_id and r.requester_user_id=g.viewer_user_id
      and u.email_confirmed_at is not null and u.email is not null and u.deleted_at is null
      and p_payload->>'portfolioId'=g.portfolio_id::text
      and ((p_type='full_view_expiring' and p_payload->>'audience'='viewer' and p_recipient=g.viewer_user_id)
        or (p_type='full_view_access_expiring' and p_payload->>'audience'='owner' and p_recipient=p.user_id)));
end; $$;

create function app_private.skip_obsolete_expiry_reminders(p_limit integer)
returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  with selected as (
    select o.id from app_private.notification_outbox o
    where o.notification_type in ('full_view_expiring','full_view_access_expiring')
      and (o.status='queued' or (o.status='processing' and o.lease_expires_at<=now()))
      and not app_private.expiry_reminder_is_current(o.grant_id,o.recipient_user_id,o.notification_type,o.payload)
    order by o.id limit p_limit for update skip locked
  ) update app_private.notification_outbox o set status='skipped',lease_expires_at=null,
      payload='{}',last_error_code='REMINDER_NO_LONGER_APPLICABLE',updated_at=now()
    from selected where o.id=selected.id;
  get diagnostics affected=row_count; return affected;
end; $$;

create or replace function public.enqueue_due_full_view_expiry_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare grant_row record; audience record; snapshot jsonb; added integer; total integer:=0;
begin
  perform app_private.require_identity_verification_worker();
  perform app_private.skip_obsolete_expiry_reminders(100);
  for grant_row in
    select g.id,g.expires_at,g.portfolio_id,g.interest_request_id,g.viewer_user_id,p.user_id as owner_id
    from public.reveal_grants g join public.portfolios p on p.id=g.portfolio_id
    where g.revoked_at is null and g.access_level='full' and g.expires_at>now() and g.expires_at<=now()+interval '24 hours'
      and exists(select 1 from (values (g.viewer_user_id,'full_view_expiring','viewer'),(p.user_id,'full_view_access_expiring','owner')) a(recipient,kind,audience)
        where app_private.expiry_reminder_is_current(g.id,a.recipient,a.kind,
          jsonb_build_object('schemaVersion',1,'audience',a.audience,'expiresAt',g.expires_at,'portfolioId',g.portfolio_id))
          and not app_private.expiry_reminder_exists(g.id,a.recipient,a.kind,g.expires_at))
    order by g.expires_at,g.id limit 25 for update of g skip locked
  loop
    for audience in select * from (values (grant_row.viewer_user_id,'full_view_expiring','viewer'),(grant_row.owner_id,'full_view_access_expiring','owner')) a(recipient,kind,audience)
    loop
      snapshot:=jsonb_build_object('schemaVersion',1,'audience',audience.audience,'expiresAt',grant_row.expires_at,'portfolioId',grant_row.portfolio_id);
      if app_private.expiry_reminder_is_current(grant_row.id,audience.recipient,audience.kind,snapshot)
        and not app_private.expiry_reminder_exists(grant_row.id,audience.recipient,audience.kind,grant_row.expires_at) then
        insert into app_private.notification_outbox(recipient_user_id,notification_type,interest_request_id,grant_id,deduplication_key,payload)
          values(audience.recipient,audience.kind,grant_row.interest_request_id,grant_row.id,
            app_private.expiry_reminder_key(grant_row.id,audience.recipient,audience.kind,grant_row.expires_at),snapshot)
          on conflict(deduplication_key) do nothing;
        get diagnostics added=row_count; total:=total+added;
      end if;
    end loop;
  end loop;
  return total;
end; $$;

-- Called immediately before external dispatch. Only a live lease may bind or
-- retire this request. Store a digest, never the raw recipient or rendered body.
create function public.prepare_full_view_expiry_email(p_notification_ref text,p_attempt_count integer,
  p_recipient_email_hash text,p_message_digest text)
returns text language plpgsql security definer set search_path='' as $$
declare o app_private.notification_outbox%rowtype; email_hash text;
begin
  perform app_private.require_identity_verification_worker();
  if p_attempt_count is null or p_attempt_count not between 1 and 5
    or p_notification_ref is null or p_notification_ref!~'^ntf_[0-9a-f]{32}$'
    or p_recipient_email_hash is null or p_recipient_email_hash!~'^[0-9a-f]{64}$'
    or p_message_digest is null or p_message_digest!~'^[0-9a-f]{64}$' then
    raise exception 'reminder preparation unavailable' using errcode='22023'; end if;
  select * into o from app_private.notification_outbox where notification_ref=p_notification_ref
    and notification_type in ('full_view_expiring','full_view_access_expiring') and status='processing'
    and attempt_count=p_attempt_count and lease_expires_at>now() for update;
  if not found then return 'unavailable'; end if;
  select encode(extensions.digest(lower(btrim(u.email)),'sha256'),'hex') into email_hash from auth.users u where u.id=o.recipient_user_id;
  if not app_private.expiry_reminder_is_current(o.grant_id,o.recipient_user_id,o.notification_type,o.payload)
    or email_hash is distinct from p_recipient_email_hash
    or (o.payload ? 'deliveryDigest' and o.payload->>'deliveryDigest' is distinct from p_message_digest)
    or (not(o.payload ? 'schemaVersion') and o.attempt_count>1) then
    update app_private.notification_outbox set status='skipped',lease_expires_at=null,
      payload='{}',last_error_code='REMINDER_NO_LONGER_APPLICABLE',updated_at=now() where id=o.id;
    return 'skipped';
  end if;
  update app_private.notification_outbox set payload=payload||jsonb_build_object('schemaVersion',1,'deliveryDigest',p_message_digest),updated_at=now() where id=o.id;
  return 'ready';
end; $$;

create function public.portfolio_expiry_reminder_health()
returns jsonb language plpgsql security definer set search_path='' as $$
declare oldest timestamptz;
begin
  perform app_private.require_identity_verification_worker();
  select g.expires_at-interval '24 hours' into oldest
    from public.reveal_grants g join public.portfolios p on p.id=g.portfolio_id
    where g.revoked_at is null and g.access_level='full' and g.expires_at>now() and g.expires_at<=now()+interval '24 hours'
      and exists(select 1 from (values(g.viewer_user_id,'full_view_expiring','viewer'),(p.user_id,'full_view_access_expiring','owner')) a(recipient,kind,audience)
        where app_private.expiry_reminder_is_current(g.id,a.recipient,a.kind,
          jsonb_build_object('schemaVersion',1,'audience',a.audience,'expiresAt',g.expires_at,'portfolioId',g.portfolio_id))
          and not app_private.expiry_reminder_exists(g.id,a.recipient,a.kind,g.expires_at))
    order by g.expires_at,g.id limit 1;
  return jsonb_build_object('healthy',coalesce(oldest>now()-interval '15 minutes',true),'oldestUnqueuedAt',oldest);
end; $$;

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
  perform app_private.skip_obsolete_expiry_reminders(100);
  -- Quarantine old events and uncertain sends rather than release stale mail.
  update app_private.notification_outbox o set status='failed',lease_expires_at=null,
    last_error_code=case when o.first_attempt_at<=now()-interval '23 hours'
      then 'EMAIL_RETRY_WINDOW_EXPIRED' else 'STALE_NOTIFICATION_REVIEW_REQUIRED' end,updated_at=now()
  where o.notification_type in ('new_introduction','full_view_approved','introduction_declined','full_view_renewed',
      'full_view_revoked','full_view_expiring','full_view_access_expiring','broker_introduction_ready',
      'broker_introduction_response','broker_mutual_interest','broker_introduction_revoked',
      'broker_introduction_expired','broker_complete_access_expired') and o.status in ('queued','processing') and (o.lease_expires_at is null or o.lease_expires_at<=now())
    -- Obsolete overflow stays queued for later bounded skip sweeps.
    and (o.notification_type not in ('full_view_expiring','full_view_access_expiring')
      or app_private.expiry_reminder_is_current(o.grant_id,o.recipient_user_id,o.notification_type,o.payload))
    and (o.first_attempt_at<=now()-interval '23 hours'
      or coalesce(o.delivery_reviewed_at,o.created_at)<=now()-interval '24 hours');
  return query
  with regular as materialized (
    select o.id,o.created_at
    from app_private.notification_outbox o
    where o.notification_type in (
      'new_introduction','full_view_approved','introduction_declined','full_view_renewed',
      'full_view_revoked','broker_introduction_ready','broker_introduction_response',
      'broker_mutual_interest','broker_introduction_revoked','broker_introduction_expired',
      'broker_complete_access_expired')
      and (o.first_attempt_at is null or o.first_attempt_at>now()-interval '23 hours')
      and coalesce(o.delivery_reviewed_at,o.created_at)>now()-interval '24 hours'
      and o.attempt_count<5 and o.available_at<=now()
      and (o.status='queued' or (o.status='processing' and o.lease_expires_at<=now()))
    order by o.created_at,o.id limit p_limit for update of o skip locked
  ), reminders as materialized (
    select o.id,o.created_at,g.expires_at
    from app_private.notification_outbox o join public.reveal_grants g on g.id=o.grant_id
    where o.notification_type in ('full_view_expiring','full_view_access_expiring')
      and app_private.expiry_reminder_is_current(o.grant_id,o.recipient_user_id,o.notification_type,o.payload)
      and (o.first_attempt_at is null or o.first_attempt_at>now()-interval '23 hours')
      and coalesce(o.delivery_reviewed_at,o.created_at)>now()-interval '24 hours'
      and o.attempt_count<5 and o.available_at<=now()
      and (o.status='queued' or (o.status='processing' and o.lease_expires_at<=now()))
    order by g.expires_at,o.id limit p_limit for update of o skip locked
  ), ranked as (
    select id,created_at,0 as audience,row_number() over(order by created_at,id) as position from regular
    union all
    select id,created_at,1,row_number() over(order by expires_at,id) from reminders
  ), selected as (
    -- Reserve roughly 60% for normal events and 40% for reminders. Either pool
    -- can use spare capacity. A one-item operator batch alternates by minute.
    select id from ranked order by
      case when p_limit=1 then case when audience=(floor(extract(epoch from now())/60)::bigint%2)::integer then 0 else 1 end
        when audience=0 and position<=greatest(1,least(p_limit-1,ceil(p_limit*0.6))) then 0
        when audience=1 and position<=greatest(1,p_limit-greatest(1,least(p_limit-1,ceil(p_limit*0.6)))) then 1 else 2 end,
      position,audience,id limit p_limit
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


revoke all on function app_private.expiry_reminder_key(uuid,uuid,text,timestamptz),
  app_private.expiry_reminder_exists(uuid,uuid,text,timestamptz),
  app_private.expiry_reminder_is_current(uuid,uuid,text,jsonb),
  app_private.skip_obsolete_expiry_reminders(integer) from public,anon,authenticated,service_role;
revoke all on function public.prepare_full_view_expiry_email(text,integer,text,text),
  public.portfolio_expiry_reminder_health() from public,anon,authenticated;
grant execute on function public.prepare_full_view_expiry_email(text,integer,text,text),
  public.portfolio_expiry_reminder_health() to service_role;
-- Existing enqueue/claim signatures and their service-only grants are retained.

-- Preparation failures happen before any provider call and retain the existing
-- bounded, service-only recovery policy and original retry-window clock.
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
        'RECIPIENT_UNAVAILABLE','RECIPIENT_LOOKUP_FAILED','REMINDER_PREPARE_FAILED',
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

