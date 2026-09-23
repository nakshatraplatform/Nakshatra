-- NAK-80: durable, provider-neutral notifications for bilateral Broker Introductions.

alter table app_private.notification_outbox
  add column broker_introduction_id uuid
    references app_private.broker_introductions(id) on delete cascade;

alter table app_private.notification_outbox
  drop constraint notification_outbox_notification_type_check;
alter table app_private.notification_outbox
  add constraint notification_outbox_notification_type_check check (
    notification_type in (
      'pilot_access_approved','pilot_access_declined','pilot_access_revoked',
      'new_introduction','full_view_approved','introduction_declined',
      'full_view_renewed','full_view_revoked','full_view_expiring',
      'full_view_access_expiring','broker_introduction_ready',
      'broker_introduction_response','broker_mutual_interest',
      'broker_introduction_revoked','broker_introduction_expired',
      'broker_complete_access_expired'
    )
  );

create function app_private.enqueue_broker_introduction_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  introduction app_private.broker_introductions%rowtype;
  workspace_ref text;
  source_owner_id uuid;
  recipient_owner_id uuid;
  notification text;
begin
  select item.* into introduction
  from app_private.broker_introductions item
  where item.id=new.introduction_id and item.access_model='identity_bound';
  if introduction.id is null then return new; end if;

  select organization.workspace_ref,
    source_candidate.primary_owner_user_id,
    recipient_candidate.primary_owner_user_id
  into workspace_ref,source_owner_id,recipient_owner_id
  from app_private.broker_introductions item
  join public.organizations organization on organization.id=item.organization_id
  join public.broker_clients source on source.id=item.broker_client_id
    and source.organization_id=item.organization_id
  join public.broker_clients recipient on recipient.id=item.recipient_broker_client_id
    and recipient.organization_id=item.organization_id
  join public.candidates source_candidate on source_candidate.id=source.candidate_id
  join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
  where item.id=new.introduction_id and item.access_model='identity_bound';

  if source_owner_id is null or recipient_owner_id is null
    or source_owner_id=recipient_owner_id then
    return new;
  end if;

  if new.event_type='response_submitted' then
    insert into app_private.notification_outbox(
      recipient_user_id,notification_type,broker_introduction_id,
      deduplication_key,payload
    ) values (
      introduction.created_by,'broker_introduction_response',introduction.id,
      'broker-introduction:'||new.id::text||':broker:response',
      pg_catalog.jsonb_build_object(
        'introductionRef',introduction.introduction_ref,
        'workspaceRef',workspace_ref,
        'audience','broker'
      )
    ) on conflict (deduplication_key) do nothing;
    return new;
  end if;

  notification:=case new.event_type
    when 'shared' then 'broker_introduction_ready'
    when 'mutual_access_granted' then 'broker_mutual_interest'
    when 'revoked' then 'broker_introduction_revoked'
    when 'expired' then 'broker_introduction_expired'
    else null
  end;
  if notification is null then return new; end if;

  insert into app_private.notification_outbox(
    recipient_user_id,notification_type,broker_introduction_id,
    deduplication_key,payload
  )
  select recipient.user_id,notification,introduction.id,
    'broker-introduction:'||new.id::text||':'||recipient.audience||':'||notification,
    pg_catalog.jsonb_build_object(
      'introductionRef',introduction.introduction_ref,
      'audience',recipient.audience
    )
  from (values
    (source_owner_id,'source'::text),
    (recipient_owner_id,'recipient'::text)
  ) as recipient(user_id,audience)
  on conflict (deduplication_key) do nothing;
  return new;
end;
$$;

create trigger enqueue_broker_introduction_notification
after insert on app_private.broker_introduction_events
for each row execute function app_private.enqueue_broker_introduction_notification();

create unique index broker_introduction_one_expired_event_idx
  on app_private.broker_introduction_events(introduction_id,event_type)
  where event_type='expired';

create function public.broker_notification_recipient_is_current(
  p_broker_introduction_id uuid,
  p_recipient_user_id uuid,
  p_notification_type text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare introduction app_private.broker_introductions%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role'
    or p_broker_introduction_id is null or p_recipient_user_id is null
    or p_notification_type is null or p_notification_type not in (
      'broker_introduction_ready','broker_introduction_response',
      'broker_mutual_interest','broker_introduction_revoked',
      'broker_introduction_expired','broker_complete_access_expired'
    ) then
    return false;
  end if;
  select item.* into introduction
  from app_private.broker_introductions item
  where item.id=p_broker_introduction_id and item.access_model='identity_bound';
  if introduction.id is null then return false; end if;

  if p_notification_type='broker_introduction_response' then
    return introduction.created_by=p_recipient_user_id and exists (
      select 1 from public.organization_members member
      where member.organization_id=introduction.organization_id
        and member.user_id=p_recipient_user_id and member.status='active'
    );
  end if;
  return exists (
    select 1
    from public.broker_clients source
    join public.broker_clients recipient
      on recipient.id=introduction.recipient_broker_client_id
      and recipient.organization_id=introduction.organization_id
    join public.candidates source_candidate on source_candidate.id=source.candidate_id
    join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
    where source.id=introduction.broker_client_id
      and source.organization_id=introduction.organization_id
      and source_candidate.primary_owner_user_id<>recipient_candidate.primary_owner_user_id
      and p_recipient_user_id in (
        source_candidate.primary_owner_user_id,
        recipient_candidate.primary_owner_user_id
      )
  );
end;
$$;

-- Preserve responded rows for their immutable responses, but record the end of
-- an unanswered/partially answered response window exactly once. Mutual access
-- has its own independent 30-day expiry and must not be ended at day 15.
create or replace function app_private.expire_broker_introductions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare expired_record record;
begin
  for expired_record in
    update app_private.broker_introductions
    set status='expired',row_version=row_version+1,updated_at=pg_catalog.now()
    where status in ('created','shared') and expires_at<=pg_catalog.now()
    returning id,organization_id
  loop
    update app_private.broker_introduction_passes
    set revoked_at=coalesce(revoked_at,pg_catalog.now())
    where introduction_id=expired_record.id;
    insert into app_private.broker_introduction_events(
      organization_id,introduction_id,event_type,actor_kind
    ) values (expired_record.organization_id,expired_record.id,'expired','system');
  end loop;

  insert into app_private.broker_introduction_events(
    organization_id,introduction_id,event_type,actor_kind
  )
  select introduction.organization_id,introduction.id,'expired','system'
  from app_private.broker_introductions introduction
  where introduction.status='responded'
    and introduction.revoked_at is null
    and introduction.mutual_interest_confirmed_at is null
    and introduction.expires_at<=pg_catalog.now()
    and not exists (
      select 1 from app_private.broker_introduction_events event
      where event.introduction_id=introduction.id and event.event_type='expired'
    )
  on conflict do nothing;
end;
$$;

create function app_private.enqueue_expired_broker_complete_access()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare inserted_count integer;
begin
  insert into app_private.notification_outbox(
    recipient_user_id,notification_type,broker_introduction_id,
    deduplication_key,payload
  )
  select recipient.user_id,'broker_complete_access_expired',introduction.id,
    'broker-complete-expired:'||introduction.id::text||':'||recipient.audience||':'
      ||pg_catalog.extract(epoch from introduction.complete_access_expires_at)::bigint::text,
    pg_catalog.jsonb_build_object(
      'introductionRef',introduction.introduction_ref,
      'audience',recipient.audience
    )
  from app_private.broker_introductions introduction
  join public.broker_clients source on source.id=introduction.broker_client_id
    and source.organization_id=introduction.organization_id
  join public.broker_clients target on target.id=introduction.recipient_broker_client_id
    and target.organization_id=introduction.organization_id
  join public.candidates source_candidate on source_candidate.id=source.candidate_id
  join public.candidates target_candidate on target_candidate.id=target.candidate_id
  cross join lateral (values
    (source_candidate.primary_owner_user_id,'source'::text),
    (target_candidate.primary_owner_user_id,'recipient'::text)
  ) as recipient(user_id,audience)
  where introduction.access_model='identity_bound'
    and introduction.revoked_at is null
    and introduction.complete_access_expires_at is not null
    and introduction.complete_access_expires_at<=pg_catalog.now()
    and recipient.user_id is not null
    and source_candidate.primary_owner_user_id<>target_candidate.primary_owner_user_id
  on conflict (deduplication_key) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end;
$$;

create or replace function public.run_broker_introduction_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare before_count bigint; after_count bigint; queued_count integer;
begin
  if auth.role()<>'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  select pg_catalog.count(*) into before_count
  from app_private.broker_introductions introduction
  where (introduction.status in ('created','shared') and introduction.expires_at<=pg_catalog.now())
    or (introduction.status='responded' and introduction.revoked_at is null
      and introduction.mutual_interest_confirmed_at is null
      and introduction.expires_at<=pg_catalog.now()
      and not exists (
        select 1 from app_private.broker_introduction_events event
        where event.introduction_id=introduction.id and event.event_type='expired'
      ));
  perform app_private.expire_broker_introductions();
  select pg_catalog.count(*) into after_count
  from app_private.broker_introductions introduction
  where (introduction.status in ('created','shared') and introduction.expires_at<=pg_catalog.now())
    or (introduction.status='responded' and introduction.revoked_at is null
      and introduction.mutual_interest_confirmed_at is null
      and introduction.expires_at<=pg_catalog.now()
      and not exists (
        select 1 from app_private.broker_introduction_events event
        where event.introduction_id=introduction.id and event.event_type='expired'
      ));
  queued_count:=app_private.enqueue_expired_broker_complete_access();
  return pg_catalog.jsonb_build_object(
    'processed',before_count-after_count,
    'notificationsQueued',queued_count
  );
end;
$$;

-- RETURNS TABLE gains the private Introduction id; PostgreSQL requires a drop
-- rather than CREATE OR REPLACE when a function's result row type changes.
drop function public.claim_relationship_notification_outbox(integer);
create function public.claim_relationship_notification_outbox(
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

create function public.complete_relationship_notification_outbox(
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
    status=case when p_retryable and attempt_count<5 then 'queued' else 'failed' end,
    available_at=case when p_retryable and attempt_count<5
      then pg_catalog.now()+(interval '5 minutes'*greatest(1,attempt_count))
      else available_at end,
    lease_expires_at=null,last_error_code=coalesce(p_error_code,'DELIVERY_FAILED'),
    updated_at=pg_catalog.now()
  where id=outbox.id;
  return case when p_retryable and outbox.attempt_count<5 then 'queued' else 'failed' end;
end;
$$;

create function public.requeue_failed_relationship_notifications(p_limit integer default 50)
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

create function public.requeue_failed_relationship_notification(
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
    'EMAIL_RESPONSE_INVALID','EMAIL_IDEMPOTENCY_CONFLICT'
  );
  if uncertain_delivery and not p_acknowledge_duplicate_risk then
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
    lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
  where id=outbox.id;
  return 'queued';
end;
$$;

revoke all on function app_private.enqueue_broker_introduction_notification() from public,anon,authenticated;
revoke all on function app_private.enqueue_expired_broker_complete_access() from public,anon,authenticated;
revoke all on function public.broker_notification_recipient_is_current(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.claim_relationship_notification_outbox(integer) from public,anon,authenticated;
revoke all on function public.complete_relationship_notification_outbox(text,integer,boolean,text,boolean) from public,anon,authenticated;
revoke all on function public.requeue_failed_relationship_notifications(integer) from public,anon,authenticated;
revoke all on function public.requeue_failed_relationship_notification(text,boolean) from public,anon,authenticated;
grant execute on function public.claim_relationship_notification_outbox(integer) to service_role;
grant execute on function public.broker_notification_recipient_is_current(uuid,uuid,text) to service_role;
grant execute on function public.complete_relationship_notification_outbox(text,integer,boolean,text,boolean) to service_role;
grant execute on function public.requeue_failed_relationship_notifications(integer) to service_role;
grant execute on function public.requeue_failed_relationship_notification(text,boolean) to service_role;

comment on function app_private.enqueue_broker_introduction_notification() is
  'Derives minimal, deduplicated customer or creator notification jobs from canonical Broker Introduction events.';
comment on function public.broker_notification_recipient_is_current(uuid,uuid,text) is
  'Service-role delivery guard that rejects stale customer ownership or inactive creator membership before email resolution.';
comment on function public.complete_relationship_notification_outbox(text,integer,boolean,text,boolean) is
  'Fenced completion for one relationship email attempt; honors provider retryability and erases delivered transient payload.';
comment on function public.requeue_failed_relationship_notifications(integer) is
  'Service-role recovery command for terminal relationship email jobs after configuration or provider recovery.';
comment on function public.requeue_failed_relationship_notification(text,boolean) is
  'Case-by-case recovery for one terminal relationship email; uncertain provider outcomes require explicit acknowledgement of duplicate-delivery risk.';
