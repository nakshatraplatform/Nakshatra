-- NAK-66: atomic, privacy-minimal receipts using the existing delivery pipeline.
alter table app_private.notification_outbox
  drop constraint notification_outbox_notification_type_check;
alter table app_private.notification_outbox
  add constraint notification_outbox_notification_type_check check (notification_type in (
    'pilot_access_approved','pilot_access_declined','pilot_access_revoked',
    'vivara_published','interest_received','new_introduction','full_view_approved',
    'introduction_declined','full_view_renewed','full_view_revoked','full_view_expiring',
    'full_view_access_expiring','broker_introduction_ready','broker_introduction_response',
    'broker_mutual_interest','broker_introduction_revoked','broker_introduction_expired',
    'broker_complete_access_expired'
  ));

-- Keep the first-publication marker after mail retention, but not after erasure.
create table app_private.portfolio_publication_receipts (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade
);
alter table app_private.portfolio_publication_receipts enable row level security;
revoke all on app_private.portfolio_publication_receipts from public,anon,authenticated,service_role;
insert into app_private.portfolio_publication_receipts(portfolio_id)
select id from public.portfolios where published_at is not null or share_token is not null or is_published;

create function app_private.enqueue_publication_receipt() returns trigger
language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
  if not new.is_published or new.owner_organization_id is not null then return new; end if;
  insert into app_private.portfolio_publication_receipts(portfolio_id)
  values(new.id) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then
    insert into app_private.notification_outbox(recipient_user_id,notification_type,deduplication_key,payload)
    values(new.user_id,'vivara_published','publication:'||new.id::text,'{}'::jsonb);
  end if;
  return new;
end; $$;
revoke all on function app_private.enqueue_publication_receipt() from public,anon,authenticated,service_role;
create trigger enqueue_publication_receipt after insert or update of is_published on public.portfolios
for each row when (new.is_published) execute function app_private.enqueue_publication_receipt();

create function app_private.enqueue_interest_receipt() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- The guarded submission RPC resolves subject_user_id from the live actor.
  if new.event_type='request_submitted' and new.subject_user_id is not null then
    insert into app_private.notification_outbox(
      recipient_user_id,notification_type,interest_request_id,deduplication_key,payload
    ) values(new.subject_user_id,'interest_received',new.interest_request_id,
      'relationship:'||new.id::text||':interest_received','{}'::jsonb)
    on conflict(deduplication_key) do nothing;
  end if;
  return new;
end; $$;
revoke all on function app_private.enqueue_interest_receipt() from public,anon,authenticated,service_role;
create trigger enqueue_interest_receipt after insert on public.access_audit_events
for each row when (new.event_type='request_submitted') execute function app_private.enqueue_interest_receipt();

-- Extend only the established type lists. Fail migration on contract drift;
-- preserve all existing leasing, recovery, quota, reminder and ACL semantics.
do $$
declare target record; definition text; occurrences integer;
begin
  for target in select * from (values
    ('public.claim_relationship_notification_outbox(integer)',2),
    ('public.complete_relationship_notification_outbox(text,integer,boolean,text,boolean)',1),
    ('public.requeue_failed_relationship_notification(text,boolean)',1),
    ('public.requeue_failed_relationship_notifications(integer)',1),
    ('public.suppress_failed_relationship_notification(text)',1),
    ('public.production_worker_health()',1)
  ) as signatures(signature,expected) loop
    definition:=pg_catalog.pg_get_functiondef(target.signature::regprocedure);
    occurrences:=(length(definition)-length(replace(definition,'''new_introduction''','')))/length('''new_introduction''');
    if occurrences<>target.expected then
      raise exception 'relationship notification allowlist drift: %',target.signature;
    end if;
    execute replace(definition,'''new_introduction''','''vivara_published'',''interest_received'',''new_introduction''');
  end loop;
end; $$;
