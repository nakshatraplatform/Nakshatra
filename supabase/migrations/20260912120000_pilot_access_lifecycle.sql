-- Private-pilot access lifecycle: verified applicants, independently
-- provisioned operators, atomic entitlement decisions, audit, and outbox.

create table app_private.pilot_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default pg_catalog.now(),
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  check ((revoked_at is null and revoked_by is null) or revoked_at is not null)
);

create table app_private.pilot_access_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  request_ref text not null unique default (
    'par_' || pg_catalog.replace(extensions.gen_random_uuid()::text, '-', '')
  ),
  applicant_user_id uuid not null unique references auth.users(id) on delete cascade,
  verified_email_hash text not null check (verified_email_hash ~ '^[a-f0-9]{64}$'),
  display_name text not null check (
    pg_catalog.length(pg_catalog.btrim(display_name)) between 2 and 120
  ),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  contact_consent_version text not null check (
    contact_consent_version ~ '^[A-Za-z0-9_.:-]{3,80}$'
  ),
  contact_consented_at timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'declined', 'revoked')
  ),
  submitted_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or pg_catalog.length(review_note) <= 500),
  check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null and reviewed_by is not null)
  )
);

create table app_private.pilot_access_audit_events (
  id bigint generated always as identity primary key,
  request_id uuid references app_private.pilot_access_requests(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (event_name ~ '^pilot\.[a-z_.]{3,80}$'),
  outcome text not null check (outcome in ('succeeded', 'denied', 'failed')),
  safe_details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default pg_catalog.now(),
  check (pg_catalog.jsonb_typeof(safe_details) = 'object')
);

create table app_private.pilot_command_idempotency (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  command_name text not null check (command_name ~ '^[a-z_]{3,80}$'),
  idempotency_key text not null check (
    idempotency_key ~ '^[A-Za-z0-9_.:-]{16,128}$'
  ),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  safe_result jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null default (pg_catalog.now() + interval '24 hours'),
  primary key (actor_user_id, command_name, idempotency_key)
);

create table app_private.notification_outbox (
  id bigint generated always as identity primary key,
  notification_ref text not null unique default (
    'ntf_' || pg_catalog.replace(extensions.gen_random_uuid()::text, '-', '')
  ),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'pilot_access_approved', 'pilot_access_declined', 'pilot_access_revoked'
    )
  ),
  request_id uuid references app_private.pilot_access_requests(id) on delete set null,
  deduplication_key text not null unique check (
    pg_catalog.length(deduplication_key) between 16 and 180
  ),
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'sent', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  available_at timestamptz not null default pg_catalog.now(),
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  last_error_code text check (
    last_error_code is null or last_error_code ~ '^[A-Z0-9_]{3,80}$'
  ),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check ((status = 'sent' and delivered_at is not null) or status <> 'sent')
);

alter table app_private.pilot_administrators enable row level security;
alter table app_private.pilot_access_requests enable row level security;
alter table app_private.pilot_access_audit_events enable row level security;
alter table app_private.pilot_command_idempotency enable row level security;
alter table app_private.notification_outbox enable row level security;

revoke all on table app_private.pilot_administrators from public, anon, authenticated;
revoke all on table app_private.pilot_access_requests from public, anon, authenticated;
revoke all on table app_private.pilot_access_audit_events from public, anon, authenticated;
revoke all on table app_private.pilot_command_idempotency from public, anon, authenticated;
revoke all on table app_private.notification_outbox from public, anon, authenticated;
grant select, insert, update, delete on table app_private.pilot_administrators to service_role;
grant select, insert, update, delete on table app_private.pilot_access_requests to service_role;
grant select, insert on table app_private.pilot_access_audit_events to service_role;
grant select, insert, update, delete on table app_private.pilot_command_idempotency to service_role;
grant select, insert, update, delete on table app_private.notification_outbox to service_role;
grant usage, select on sequence app_private.pilot_access_audit_events_id_seq to service_role;
grant usage, select on sequence app_private.notification_outbox_id_seq to service_role;

create index pilot_access_requests_status_submitted_idx
  on app_private.pilot_access_requests(status, submitted_at);
create index notification_outbox_delivery_idx
  on app_private.notification_outbox(status, available_at)
  where status in ('queued', 'processing');

create function app_private.prevent_pilot_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'pilot access audit events are append-only' using errcode = '55000';
end;
$$;

create trigger prevent_pilot_audit_mutation
before update or delete on app_private.pilot_access_audit_events
for each row execute function app_private.prevent_pilot_audit_mutation();

create function app_private.actor_is_pilot_administrator(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor_id is not null and exists (
    select 1 from app_private.pilot_administrators administrator
    where administrator.user_id = p_actor_id and administrator.revoked_at is null
  )
$$;

create function app_private.pilot_request_result(
  p_request app_private.pilot_access_requests
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'requestRef', p_request.request_ref,
    'status', p_request.status,
    'submittedAt', p_request.submitted_at,
    'reviewedAt', p_request.reviewed_at
  )
$$;

create function public.get_current_pilot_access_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  request_record app_private.pilot_access_requests%rowtype;
begin
  perform app_private.require_current_session();
  select * into request_record from app_private.pilot_access_requests
  where applicant_user_id = actor_id;

  return pg_catalog.jsonb_build_object(
    'canCreatePortfolio', app_private.actor_can_create_portfolio(actor_id),
    'isPilotAdministrator', app_private.actor_is_pilot_administrator(actor_id),
    'application', case when found
      then app_private.pilot_request_result(request_record)
      else null end
  );
end;
$$;

create function public.submit_pilot_access_request(
  p_display_name text,
  p_phone_e164 text,
  p_contact_consent_version text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  account auth.users%rowtype;
  selected_email_hash text;
  normalized_name text := pg_catalog.btrim(p_display_name);
  normalized_phone text := nullif(pg_catalog.btrim(p_phone_e164), '');
  request_hash text;
  existing_command app_private.pilot_command_idempotency%rowtype;
  request_record app_private.pilot_access_requests%rowtype;
  result jsonb;
  event_name text;
begin
  perform app_private.require_current_session();
  if actor_id is null or p_display_name is null
    or pg_catalog.length(normalized_name) not between 2 and 120
    or (normalized_phone is not null and normalized_phone !~ '^\+[1-9][0-9]{7,14}$')
    or p_contact_consent_version is null
    or p_contact_consent_version !~ '^[A-Za-z0-9_.:-]{3,80}$'
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$' then
    raise exception 'pilot access request unavailable' using errcode = '22023';
  end if;

  select * into account from auth.users where id = actor_id;
  if not found or account.email is null or account.email_confirmed_at is null then
    raise exception 'verified email required' using errcode = '42501';
  end if;
  selected_email_hash := app_private.normalized_email_hash(account.email);

  if app_private.actor_can_create_portfolio(actor_id) then
    return pg_catalog.jsonb_build_object('status', 'already_creator');
  end if;

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'displayName', normalized_name,
      'phone', normalized_phone,
      'consentVersion', p_contact_consent_version
    )::text, 'UTF8'
  ), 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':pilot-access:' || p_idempotency_key, 0
  ));
  select * into existing_command from app_private.pilot_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'submit_pilot_access_request'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();
  if found then
    if existing_command.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request' using errcode = '22023';
    end if;
    return existing_command.safe_result;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':pilot-access-request', 0
  ));
  select * into request_record from app_private.pilot_access_requests
  where applicant_user_id = actor_id for update;

  if found and request_record.status <> 'pending' then
    result := app_private.pilot_request_result(request_record);
  else
    event_name := case when found then 'pilot.application.updated' else 'pilot.application.submitted' end;
    insert into app_private.pilot_access_requests (
      applicant_user_id, verified_email_hash, display_name, phone_e164,
      contact_consent_version, contact_consented_at
    ) values (
      actor_id, selected_email_hash, normalized_name, normalized_phone,
      p_contact_consent_version, pg_catalog.now()
    ) on conflict (applicant_user_id) do update set
      verified_email_hash = excluded.verified_email_hash,
      display_name = excluded.display_name,
      phone_e164 = excluded.phone_e164,
      contact_consent_version = excluded.contact_consent_version,
      contact_consented_at = excluded.contact_consented_at,
      updated_at = pg_catalog.now()
    returning * into request_record;

    insert into app_private.pilot_access_audit_events(
      request_id, actor_user_id, event_name, outcome, safe_details
    ) values (
      request_record.id, actor_id, event_name, 'succeeded',
      pg_catalog.jsonb_build_object('status', request_record.status)
    );
    result := app_private.pilot_request_result(request_record);
  end if;

  insert into app_private.pilot_command_idempotency(
    actor_user_id, command_name, idempotency_key, request_hash, safe_result
  ) values (
    actor_id, 'submit_pilot_access_request', p_idempotency_key, request_hash, result
  );
  return result;
end;
$$;

create function public.list_pilot_access_requests(
  p_status text default 'pending',
  p_limit integer default 50
)
returns table (
  request_ref text,
  display_name text,
  verified_email text,
  phone_e164 text,
  status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_current_session();
  if not app_private.actor_is_pilot_administrator(auth.uid()) then
    raise exception 'pilot administration unavailable' using errcode = '42501';
  end if;
  if (p_status is not null and p_status not in ('pending', 'approved', 'declined', 'revoked'))
    or p_limit not between 1 and 100 then
    raise exception 'invalid pilot request filter' using errcode = '22023';
  end if;

  return query
  select request.request_ref, request.display_name, account.email::text,
    request.phone_e164, request.status, request.submitted_at,
    request.reviewed_at, request.review_note
  from app_private.pilot_access_requests request
  join auth.users account on account.id = request.applicant_user_id
  where p_status is null or request.status = p_status
  order by request.submitted_at asc
  limit p_limit;
end;
$$;

create function public.review_pilot_access_request(
  p_request_ref text,
  p_decision text,
  p_review_note text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  request_record app_private.pilot_access_requests%rowtype;
  account auth.users%rowtype;
  request_hash text;
  existing_command app_private.pilot_command_idempotency%rowtype;
  result jsonb;
  normalized_note text := nullif(pg_catalog.btrim(p_review_note), '');
begin
  perform app_private.require_current_session();
  if not app_private.actor_is_pilot_administrator(actor_id) then
    raise exception 'pilot administration unavailable' using errcode = '42501';
  end if;
  if p_request_ref is null or p_request_ref !~ '^par_[0-9a-f]{32}$'
    or p_decision is null or p_decision not in ('approve', 'decline', 'revoke')
    or pg_catalog.length(coalesce(normalized_note, '')) > 500
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$' then
    raise exception 'pilot decision unavailable' using errcode = '22023';
  end if;

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'requestRef', p_request_ref, 'decision', p_decision, 'note', normalized_note
    )::text, 'UTF8'
  ), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':pilot-review:' || p_idempotency_key, 0
  ));
  select * into existing_command from app_private.pilot_command_idempotency
  where actor_user_id = actor_id and command_name = 'review_pilot_access_request'
    and idempotency_key = p_idempotency_key and expires_at > pg_catalog.now();
  if found then
    if existing_command.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request' using errcode = '22023';
    end if;
    return existing_command.safe_result;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_request_ref || ':pilot-review', 0
  ));
  select * into request_record from app_private.pilot_access_requests
  where request_ref = p_request_ref for update;
  if not found then
    raise exception 'pilot decision unavailable' using errcode = '22023';
  end if;
  select * into account from auth.users where id = request_record.applicant_user_id;

  if p_decision = 'approve' and (
    account.email is null or account.email_confirmed_at is null
    or app_private.normalized_email_hash(account.email) <> request_record.verified_email_hash
  ) then
    raise exception 'applicant email changed; a new verified request is required' using errcode = '42501';
  end if;
  if (p_decision = 'approve' and request_record.status = 'approved')
    or (p_decision = 'decline' and request_record.status = 'declined')
    or (p_decision = 'revoke' and request_record.status = 'revoked') then
    result := app_private.pilot_request_result(request_record);
    insert into app_private.pilot_command_idempotency(
      actor_user_id, command_name, idempotency_key, request_hash, safe_result
    ) values (
      actor_id, 'review_pilot_access_request', p_idempotency_key, request_hash, result
    );
    return result;
  end if;

  if p_decision = 'approve' then
    update app_private.pilot_access_requests set
      status = 'approved', reviewed_at = pg_catalog.now(), reviewed_by = actor_id,
      review_note = normalized_note, updated_at = pg_catalog.now()
    where id = request_record.id returning * into request_record;
    insert into app_private.b2c_creator_entitlements(
      email_hash, granted_at, granted_by, revoked_at, revoked_by, updated_at
    ) values (
      request_record.verified_email_hash, pg_catalog.now(), actor_id, null, null, pg_catalog.now()
    ) on conflict (email_hash) do update set
      granted_at = excluded.granted_at, granted_by = excluded.granted_by,
      revoked_at = null, revoked_by = null, updated_at = pg_catalog.now();
  elsif p_decision = 'decline' then
    if request_record.status <> 'pending' then
      raise exception 'only pending access can be declined' using errcode = '22023';
    end if;
    update app_private.pilot_access_requests set
      status = 'declined', reviewed_at = pg_catalog.now(), reviewed_by = actor_id,
      review_note = normalized_note, updated_at = pg_catalog.now()
    where id = request_record.id returning * into request_record;
  else
    if request_record.status <> 'approved' then
      raise exception 'only approved access can be revoked' using errcode = '22023';
    end if;
    update app_private.pilot_access_requests set
      status = 'revoked', reviewed_at = pg_catalog.now(), reviewed_by = actor_id,
      review_note = normalized_note, updated_at = pg_catalog.now()
    where id = request_record.id returning * into request_record;
    update app_private.b2c_creator_entitlements set
      revoked_at = pg_catalog.now(), revoked_by = actor_id, updated_at = pg_catalog.now()
    where email_hash = request_record.verified_email_hash and revoked_at is null;
  end if;

  insert into app_private.pilot_access_audit_events(
    request_id, actor_user_id, event_name, outcome, safe_details
  ) values (
    request_record.id, actor_id, 'pilot.application.' || p_decision || 'd',
    'succeeded', pg_catalog.jsonb_build_object('status', request_record.status)
  );
  insert into app_private.notification_outbox(
    recipient_user_id, notification_type, request_id, deduplication_key
  ) values (
    request_record.applicant_user_id, 'pilot_access_' || request_record.status,
    request_record.id,
    'pilot:' || request_record.id::text || ':' || p_decision || ':' || p_idempotency_key
  );

  result := app_private.pilot_request_result(request_record);
  insert into app_private.pilot_command_idempotency(
    actor_user_id, command_name, idempotency_key, request_hash, safe_result
  ) values (
    actor_id, 'review_pilot_access_request', p_idempotency_key, request_hash, result
  );
  return result;
end;
$$;

create function public.manage_pilot_administrator(
  p_email text,
  p_action text default 'grant'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account auth.users%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_email is null or p_action is null or p_action not in ('grant', 'revoke') then
    raise exception 'invalid administrator action' using errcode = '22023';
  end if;
  select * into account from auth.users
  where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(p_email))
    and email_confirmed_at is not null;
  if not found then
    raise exception 'confirmed account required' using errcode = '22023';
  end if;

  if p_action = 'grant' then
    insert into app_private.pilot_administrators(user_id, granted_by)
    values (account.id, auth.uid())
    on conflict (user_id) do update set
      granted_at = pg_catalog.now(), granted_by = excluded.granted_by,
      revoked_at = null, revoked_by = null;
  else
    update app_private.pilot_administrators set
      revoked_at = pg_catalog.now(), revoked_by = auth.uid()
    where user_id = account.id and revoked_at is null;
  end if;
  return pg_catalog.jsonb_build_object('status', case when p_action = 'grant' then 'granted' else 'revoked' end);
end;
$$;

create function public.claim_notification_outbox(p_limit integer default 10)
returns table (
  notification_ref text,
  recipient_user_id uuid,
  notification_type text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    or p_limit is null or p_limit not between 1 and 50 then
    raise exception 'notification work unavailable' using errcode = '42501';
  end if;
  return query
  with selected as (
    select outbox.id from app_private.notification_outbox outbox
    where outbox.attempt_count < 5
      and outbox.available_at <= pg_catalog.now()
      and (outbox.status = 'queued'
        or (outbox.status = 'processing' and outbox.lease_expires_at <= pg_catalog.now()))
    order by outbox.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update app_private.notification_outbox outbox set
      status = 'processing', attempt_count = outbox.attempt_count + 1,
      lease_expires_at = pg_catalog.now() + interval '5 minutes',
      updated_at = pg_catalog.now()
    from selected where outbox.id = selected.id
    returning outbox.notification_ref, outbox.recipient_user_id,
      outbox.notification_type, outbox.attempt_count
  )
  select * from claimed;
end;
$$;

create function public.complete_notification_outbox(
  p_notification_ref text,
  p_succeeded boolean,
  p_error_code text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  outbox app_private.notification_outbox%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    or p_notification_ref is null or p_notification_ref !~ '^ntf_[0-9a-f]{32}$'
    or p_succeeded is null
    or (p_error_code is not null and p_error_code !~ '^[A-Z0-9_]{3,80}$') then
    raise exception 'notification completion unavailable' using errcode = '42501';
  end if;
  select * into outbox from app_private.notification_outbox
  where notification_ref = p_notification_ref and status = 'processing' for update;
  if not found then return 'unavailable'; end if;

  if p_succeeded then
    update app_private.notification_outbox set
      status = 'sent', delivered_at = pg_catalog.now(), lease_expires_at = null,
      last_error_code = null, updated_at = pg_catalog.now()
    where id = outbox.id;
    return 'sent';
  end if;

  update app_private.notification_outbox set
    status = case when attempt_count >= 5 then 'failed' else 'queued' end,
    available_at = pg_catalog.now() + (interval '5 minutes' * greatest(1, attempt_count)),
    lease_expires_at = null, last_error_code = coalesce(p_error_code, 'DELIVERY_FAILED'),
    updated_at = pg_catalog.now()
  where id = outbox.id;
  return case when outbox.attempt_count >= 5 then 'failed' else 'queued' end;
end;
$$;

revoke all on function app_private.prevent_pilot_audit_mutation() from public, anon, authenticated;
revoke all on function app_private.actor_is_pilot_administrator(uuid) from public, anon, authenticated;
revoke all on function app_private.pilot_request_result(app_private.pilot_access_requests) from public, anon, authenticated;
revoke all on function public.get_current_pilot_access_state() from public, anon;
revoke all on function public.submit_pilot_access_request(text, text, text, text) from public, anon;
revoke all on function public.list_pilot_access_requests(text, integer) from public, anon, authenticated;
revoke all on function public.review_pilot_access_request(text, text, text, text) from public, anon, authenticated;
revoke all on function public.manage_pilot_administrator(text, text) from public, anon, authenticated;
revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
revoke all on function public.complete_notification_outbox(text, boolean, text) from public, anon, authenticated;

grant execute on function public.get_current_pilot_access_state() to authenticated;
grant execute on function public.submit_pilot_access_request(text, text, text, text) to authenticated;
grant execute on function public.list_pilot_access_requests(text, integer) to authenticated;
grant execute on function public.review_pilot_access_request(text, text, text, text) to authenticated;
grant execute on function public.manage_pilot_administrator(text, text) to service_role;
grant execute on function public.claim_notification_outbox(integer) to service_role;
grant execute on function public.complete_notification_outbox(text, boolean, text) to service_role;

-- Keep the application enum and database quota authority in lockstep.
create or replace function public.consume_api_rate_limit(p_action text, p_subject_hash text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  action_limit integer; window_seconds integer; effective_subject text;
  limit_record app_private.api_rate_limits%rowtype; v_now timestamptz := pg_catalog.now();
begin
  select configured.limit_value, configured.window_value into action_limit, window_seconds
  from (values
    ('auth_google',10,900),('auth_email',5,900),('interest_submit',5,3600),('interest_decision',30,60),
    ('grant_manage',30,60),('dashboard_save',30,300),('photo_upload',12,3600),('photo_mutation',30,300),
    ('horoscope_upload',6,3600),('horoscope_delete',10,300),('portfolio_publish',6,3600),
    ('portfolio_renew',6,3600),('portfolio_rotate',6,3600),('portfolio_unpublish',6,3600),
    ('horoscope_view',30,300),('location_search',120,60),('account_export',3,3600),
    ('account_delete',3,86400),('account_delete_reauth',3,3600),('session_manage',10,3600),
    ('identity_verification_invitation',5,3600),('identity_verification_start',5,3600),
    ('identity_verification_status',30,300),('identity_verification_retry',5,3600),
    ('pilot_access_submit',5,86400),('pilot_access_review',60,300),
    ('brokerdesk_bootstrap',60,60),('brokerdesk_workspace_create',3,3600),
    ('brokerdesk_onboarding_read',60,60),('brokerdesk_onboarding_write',30,300),
    ('brokerdesk_privileged_reauth',5,3600),('brokerdesk_mfa_complete',10,900),
    ('brokerdesk_team_read',60,60),('brokerdesk_team_invite',20,3600),
    ('brokerdesk_team_invitation_exchange',20,3600),('brokerdesk_team_invitation_accept',10,3600),
    ('brokerdesk_customer_read',60,60),('brokerdesk_customer_invite',100,3600),
    ('brokerdesk_customer_invitation_exchange',20,3600),('brokerdesk_customer_invitation_claim',10,3600),
    ('customer_broker_relationships_read',60,60)
  ) as configured(action_name,limit_value,window_value) where configured.action_name = p_action;
  if action_limit is null then raise exception 'unsupported rate limit action' using errcode = '22023'; end if;
  if auth.uid() is not null then effective_subject := 'user:' || auth.uid()::text;
  elsif p_subject_hash is not null and p_subject_hash ~ '^[a-f0-9]{64}$' then effective_subject := 'anonymous:' || p_subject_hash;
  else return '{"allowed":false,"retryAfter":60}'::jsonb; end if;
  insert into app_private.api_rate_limits(action,subject_key,window_started_at,request_count,updated_at)
  values(p_action,effective_subject,v_now,1,v_now)
  on conflict(action,subject_key) do update set
    window_started_at = case when app_private.api_rate_limits.window_started_at <= v_now-pg_catalog.make_interval(secs=>window_seconds) then v_now else app_private.api_rate_limits.window_started_at end,
    request_count = case when app_private.api_rate_limits.window_started_at <= v_now-pg_catalog.make_interval(secs=>window_seconds) then 1 else app_private.api_rate_limits.request_count+1 end,
    updated_at=v_now returning * into limit_record;
  return pg_catalog.jsonb_build_object('allowed',limit_record.request_count<=action_limit,'retryAfter',
    case when limit_record.request_count<=action_limit then 0 else greatest(1,pg_catalog.ceil(extract(epoch from(
      limit_record.window_started_at+pg_catalog.make_interval(secs=>window_seconds)-v_now)))::integer) end);
end; $$;
revoke all on function public.consume_api_rate_limit(text,text) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text,text) to anon, authenticated;

comment on table app_private.pilot_access_requests is
  'Private, verified-account applications for B2C pilot creator capability.';
comment on table app_private.pilot_administrators is
  'Separately provisioned platform operators; never inferred from BrokerDesk or profile metadata.';
comment on table app_private.notification_outbox is
  'Provider-neutral durable notifications; recipient email is resolved from Auth only at delivery time.';
