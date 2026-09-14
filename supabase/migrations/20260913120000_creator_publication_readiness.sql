-- Provider-neutral creator journey and publication gates. Payment providers may
-- only write through the service-role idempotent event command added below.

create table app_private.portfolio_publication_progress (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  last_editor_section text check (
    last_editor_section is null or last_editor_section in (
      'privacy', 'foundation', 'story', 'work', 'family', 'astrology',
      'lifestyle', 'preferences', 'future'
    )
  ),
  previewed_at timestamptz,
  selected_plan_code text check (
    selected_plan_code is null or selected_plan_code ~ '^[a-z0-9][a-z0-9_-]{2,79}$'
  ),
  plan_selected_at timestamptz,
  payment_status text not null default 'none' check (
    payment_status in ('none', 'pending', 'paid', 'failed', 'refunded', 'cancelled')
  ),
  payment_provider text check (
    payment_provider is null or payment_provider ~ '^[a-z0-9][a-z0-9_-]{1,39}$'
  ),
  payment_reference text check (
    payment_reference is null or pg_catalog.length(payment_reference) between 3 and 180
  ),
  payment_confirmed_at timestamptz,
  payment_expires_at timestamptz,
  disclosure_version text check (
    disclosure_version is null or disclosure_version ~ '^[A-Za-z0-9_.:-]{3,80}$'
  ),
  disclosure_fingerprint text check (
    disclosure_fingerprint is null or disclosure_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  disclosure_confirmed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (
    (selected_plan_code is null and plan_selected_at is null)
    or (selected_plan_code is not null and plan_selected_at is not null)
  ),
  check (
    payment_status <> 'paid'
    or (payment_confirmed_at is not null and payment_expires_at is not null)
  ),
  check (
    disclosure_confirmed_at is null
    or (disclosure_version is not null and disclosure_fingerprint is not null)
  )
);

create table app_private.portfolio_payment_events (
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  provider_event_id text not null check (pg_catalog.length(provider_event_id) between 3 and 180),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  payment_status text not null check (
    payment_status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')
  ),
  processed_at timestamptz not null default pg_catalog.now(),
  primary key (provider, provider_event_id)
);

alter table app_private.portfolio_publication_progress enable row level security;
alter table app_private.portfolio_payment_events enable row level security;
revoke all on table app_private.portfolio_publication_progress from public, anon, authenticated;
revoke all on table app_private.portfolio_payment_events from public, anon, authenticated;
grant select, insert, update, delete on table app_private.portfolio_publication_progress to service_role;
grant select, insert, update, delete on table app_private.portfolio_payment_events to service_role;

create function app_private.portfolio_draft_fingerprint(p_draft jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.encode(extensions.digest(coalesce(p_draft, '{}'::jsonb)::text, 'sha256'), 'hex')
$$;

create function app_private.portfolio_missing_required_details(
  p_portfolio_id uuid,
  p_draft jsonb
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  missing text[] := '{}'::text[];
begin
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{personal,first_name}', '')), '') is null then missing := missing || 'First name'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{personal,last_name}', '')), '') is null then missing := missing || 'Last name'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{personal,dob}', '')), '') is null then missing := missing || 'Date of birth'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{personal,current_location}', '')), '') is null then missing := missing || 'Current location'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{career,title}', '')), '') is null then missing := missing || 'Profession or role'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{personal,short_bio}', p_draft #>> '{personal,profile_summary}', '')), '') is null then missing := missing || 'Short introduction'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{astrology,time_of_birth}', '')), '') is null then missing := missing || 'Time of birth'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{personal,place_of_birth}', '')), '') is null then missing := missing || 'Place of birth'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{astrology,rashi}', '')), '') is null then missing := missing || 'Moon sign (Rashi)'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{astrology,nakshatra}', '')), '') is null then missing := missing || 'Birth star (Nakshatra)'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{astrology,pada}', '')), '') is null then missing := missing || 'Pada'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{vitals,gotra}', '')), '') is null then missing := missing || 'Gotra'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_draft #>> '{astrology,manglik_status}', '')), '') is null then missing := missing || 'Manglik status'; end if;
  if not exists (
    select 1 from public.portfolio_media media
    where media.portfolio_id = p_portfolio_id
      and media.media_type = 'hero'
      and media.visibility in ('public', 'blurred', 'interest_required', 'approved_only')
  ) then missing := missing || 'Shareable primary photo'; end if;
  return missing;
end;
$$;

create function app_private.owner_publication_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  portfolio_record public.portfolios%rowtype;
  progress_record app_private.portfolio_publication_progress%rowtype;
  missing text[];
  verified boolean := false;
  payment_active boolean := false;
  disclosure_current boolean := false;
begin
  select portfolio.* into portfolio_record
  from public.portfolios portfolio where portfolio.user_id = auth.uid() limit 1;
  if portfolio_record.id is null then
    return '{"portfolioExists":false,"lastEditorSection":null,"previewedAt":null,"selectedPlanCode":null,"verificationStatus":"required","paymentStatus":"none","paymentExpiresAt":null,"paymentActive":false,"disclosureConfirmed":false,"published":false,"missingRequired":[]}'::jsonb;
  end if;
  select progress.* into progress_record
  from app_private.portfolio_publication_progress progress
  where progress.portfolio_id = portfolio_record.id;
  missing := app_private.portfolio_missing_required_details(portfolio_record.id, portfolio_record.draft_data);
  verified := exists (
    select 1 from app_private.current_identity_verification(portfolio_record.candidate_id)
  );
  payment_active := coalesce(
    progress_record.payment_status = 'paid'
      and progress_record.payment_expires_at > pg_catalog.now(),
    false
  );
  disclosure_current := progress_record.disclosure_confirmed_at is not null
    and progress_record.disclosure_fingerprint = app_private.portfolio_draft_fingerprint(portfolio_record.draft_data);
  return pg_catalog.jsonb_build_object(
    'portfolioExists', true,
    'lastEditorSection', progress_record.last_editor_section,
    'previewedAt', progress_record.previewed_at,
    'selectedPlanCode', progress_record.selected_plan_code,
    'verificationStatus', case when verified then 'verified' else 'required' end,
    'paymentStatus', coalesce(progress_record.payment_status, 'none'),
    'paymentExpiresAt', progress_record.payment_expires_at,
    'paymentActive', payment_active,
    'disclosureConfirmed', disclosure_current,
    'published', portfolio_record.is_published,
    'missingRequired', to_jsonb(missing)
  );
end;
$$;

create function public.get_portfolio_publication_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_current_session();
  return app_private.owner_publication_readiness();
end;
$$;

create function public.update_portfolio_onboarding_progress(
  p_action text,
  p_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  portfolio_record public.portfolios%rowtype;
  progress_record app_private.portfolio_publication_progress%rowtype;
begin
  perform app_private.require_current_session();
  select portfolio.* into portfolio_record
  from public.portfolios portfolio
  where portfolio.user_id = auth.uid()
  for update;
  if portfolio_record.id is null then return '{"status":"not_found"}'::jsonb; end if;
  insert into app_private.portfolio_publication_progress(portfolio_id)
  values (portfolio_record.id) on conflict (portfolio_id) do nothing;

  if p_action = 'editor_section' then
    if p_value not in ('privacy','foundation','story','work','family','astrology','lifestyle','preferences','future') then
      raise exception 'invalid editor section' using errcode = '22023';
    end if;
    update app_private.portfolio_publication_progress
    set last_editor_section = p_value, updated_at = pg_catalog.now()
    where portfolio_id = portfolio_record.id;
  elsif p_action = 'previewed' then
    update app_private.portfolio_publication_progress
    set previewed_at = coalesce(previewed_at, pg_catalog.now()), updated_at = pg_catalog.now()
    where portfolio_id = portfolio_record.id;
  elsif p_action = 'select_plan' then
    if p_value is null or p_value !~ '^[a-z0-9][a-z0-9_-]{2,79}$' then
      raise exception 'invalid plan code' using errcode = '22023';
    end if;
    update app_private.portfolio_publication_progress
    set selected_plan_code = p_value,
        plan_selected_at = pg_catalog.now(),
        payment_status = case when selected_plan_code is distinct from p_value then 'none' else payment_status end,
        payment_provider = case when selected_plan_code is distinct from p_value then null else payment_provider end,
        payment_reference = case when selected_plan_code is distinct from p_value then null else payment_reference end,
        payment_confirmed_at = case when selected_plan_code is distinct from p_value then null else payment_confirmed_at end,
        payment_expires_at = case when selected_plan_code is distinct from p_value then null else payment_expires_at end,
        disclosure_version = null, disclosure_fingerprint = null, disclosure_confirmed_at = null,
        updated_at = pg_catalog.now()
    where portfolio_id = portfolio_record.id;
  elsif p_action = 'confirm_disclosure' then
    if p_value <> 'publication-disclosure-v1' then
      raise exception 'invalid disclosure version' using errcode = '22023';
    end if;
    select progress.* into progress_record
    from app_private.portfolio_publication_progress progress
    where progress.portfolio_id = portfolio_record.id for update;
    if not exists (select 1 from app_private.current_identity_verification(portfolio_record.candidate_id)) then
      return '{"status":"verification_required"}'::jsonb;
    end if;
    if progress_record.payment_status is distinct from 'paid'
      or progress_record.payment_expires_at is null
      or progress_record.payment_expires_at <= pg_catalog.now() then
      return '{"status":"payment_required"}'::jsonb;
    end if;
    if pg_catalog.cardinality(app_private.portfolio_missing_required_details(portfolio_record.id, portfolio_record.draft_data)) > 0 then
      return '{"status":"content_required"}'::jsonb;
    end if;
    update app_private.portfolio_publication_progress
    set disclosure_version = p_value,
        disclosure_fingerprint = app_private.portfolio_draft_fingerprint(portfolio_record.draft_data),
        disclosure_confirmed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where portfolio_id = portfolio_record.id;
  else
    raise exception 'invalid onboarding action' using errcode = '22023';
  end if;
  return pg_catalog.jsonb_build_object('status', 'ok', 'readiness', app_private.owner_publication_readiness());
end;
$$;

create function public.record_portfolio_payment_event(
  p_portfolio_id uuid,
  p_provider text,
  p_provider_event_id text,
  p_payload_hash text,
  p_payment_status text,
  p_plan_code text,
  p_payment_reference text default null,
  p_payment_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event app_private.portfolio_payment_events%rowtype;
  portfolio_record public.portfolios%rowtype;
  progress_record app_private.portfolio_publication_progress%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'payment event unavailable' using errcode = '42501';
  end if;
  if p_provider !~ '^[a-z0-9][a-z0-9_-]{1,39}$'
    or pg_catalog.length(p_provider_event_id) not between 3 and 180
    or p_payload_hash !~ '^[a-f0-9]{64}$'
    or p_payment_status not in ('pending','paid','failed','refunded','cancelled')
    or p_plan_code !~ '^[a-z0-9][a-z0-9_-]{2,79}$' then
    raise exception 'invalid payment event' using errcode = '22023';
  end if;
  select event.* into existing_event
  from app_private.portfolio_payment_events event
  where event.provider = p_provider and event.provider_event_id = p_provider_event_id;
  if existing_event.provider_event_id is not null then
    if existing_event.payload_hash = p_payload_hash then return '{"status":"duplicate"}'::jsonb; end if;
    return '{"status":"conflict"}'::jsonb;
  end if;
  select portfolio.* into portfolio_record from public.portfolios portfolio
  where portfolio.id = p_portfolio_id for update;
  if portfolio_record.id is null then return '{"status":"not_found"}'::jsonb; end if;
  select progress.* into progress_record
  from app_private.portfolio_publication_progress progress
  where progress.portfolio_id = portfolio_record.id for update;
  if progress_record.portfolio_id is null or progress_record.selected_plan_code <> p_plan_code then
    return '{"status":"plan_mismatch"}'::jsonb;
  end if;
  if p_payment_status in ('pending','paid') and not exists (
    select 1 from app_private.current_identity_verification(portfolio_record.candidate_id)
  ) then return '{"status":"verification_required"}'::jsonb; end if;
  if p_payment_status = 'paid' and (p_payment_expires_at is null or p_payment_expires_at <= pg_catalog.now()) then
    return '{"status":"invalid_expiry"}'::jsonb;
  end if;

  insert into app_private.portfolio_payment_events(
    provider, provider_event_id, portfolio_id, payload_hash, payment_status
  ) values (p_provider, p_provider_event_id, p_portfolio_id, p_payload_hash, p_payment_status);
  update app_private.portfolio_publication_progress
  set payment_status = case
        when p_payment_status in ('refunded','cancelled') then p_payment_status
        when p_payment_status = 'paid' then 'paid'
        when payment_status = 'paid' then payment_status
        else p_payment_status end,
      payment_provider = p_provider,
      payment_reference = coalesce(p_payment_reference, payment_reference),
      payment_confirmed_at = case when p_payment_status = 'paid' then pg_catalog.now() else payment_confirmed_at end,
      payment_expires_at = case when p_payment_status = 'paid' then p_payment_expires_at else payment_expires_at end,
      disclosure_version = case when p_payment_status in ('refunded','cancelled') then null else disclosure_version end,
      disclosure_fingerprint = case when p_payment_status in ('refunded','cancelled') then null else disclosure_fingerprint end,
      disclosure_confirmed_at = case when p_payment_status in ('refunded','cancelled') then null else disclosure_confirmed_at end,
      updated_at = pg_catalog.now()
  where portfolio_id = p_portfolio_id;
  return '{"status":"processed"}'::jsonb;
end;
$$;

create function app_private.invalidate_publication_disclosure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_portfolio_id uuid;
begin
  target_portfolio_id := case
    when tg_table_name = 'portfolios' then new.id
    else coalesce(new.portfolio_id, old.portfolio_id)
  end;
  update app_private.portfolio_publication_progress
  set disclosure_version = null, disclosure_fingerprint = null,
      disclosure_confirmed_at = null, updated_at = pg_catalog.now()
  where portfolio_id = target_portfolio_id;
  return new;
end;
$$;

create trigger invalidate_disclosure_after_draft_change
after update of draft_data on public.portfolios
for each row when (old.draft_data is distinct from new.draft_data)
execute function app_private.invalidate_publication_disclosure();
create trigger invalidate_disclosure_after_media_change
after insert or delete or update of storage_path, media_type, visibility, sort_order on public.portfolio_media
for each row execute function app_private.invalidate_publication_disclosure();
create trigger invalidate_disclosure_after_horoscope_change
after insert or delete or update of storage_path on public.portfolio_horoscopes
for each row execute function app_private.invalidate_publication_disclosure();

create function app_private.enforce_paid_disclosed_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress_record app_private.portfolio_publication_progress%rowtype;
begin
  if new.is_published = true and (
    tg_op = 'INSERT' or old.is_published is distinct from true
    or old.published_data is distinct from new.published_data
  ) then
    if pg_catalog.cardinality(app_private.portfolio_missing_required_details(new.id, new.draft_data)) > 0 then
      raise exception 'publication_content_required' using errcode = '23514';
    end if;
    if not exists (select 1 from app_private.current_identity_verification(new.candidate_id)) then
      raise exception 'publication_verification_required' using errcode = '23514';
    end if;
    select progress.* into progress_record
    from app_private.portfolio_publication_progress progress
    where progress.portfolio_id = new.id;
    if progress_record.payment_status is distinct from 'paid'
      or progress_record.payment_expires_at is null
      or progress_record.payment_expires_at <= pg_catalog.now() then
      raise exception 'publication_payment_required' using errcode = '23514';
    end if;
    if progress_record.disclosure_confirmed_at is null
      or progress_record.disclosure_version <> 'publication-disclosure-v1'
      or progress_record.disclosure_fingerprint <> app_private.portfolio_draft_fingerprint(new.draft_data) then
      raise exception 'publication_disclosure_required' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_paid_disclosed_publication
before insert or update of is_published, published_data on public.portfolios
for each row execute function app_private.enforce_paid_disclosed_publication();

-- Extend the provider-neutral outbox to cover the complete introduction lifecycle.
alter table app_private.notification_outbox
  drop constraint if exists notification_outbox_notification_type_check;
alter table app_private.notification_outbox
  add column interest_request_id uuid references public.interest_requests(id) on delete set null,
  add column grant_id uuid references public.reveal_grants(id) on delete set null,
  add column payload jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(payload) = 'object'),
  add constraint notification_outbox_notification_type_check check (
    notification_type in (
      'pilot_access_approved','pilot_access_declined','pilot_access_revoked',
      'new_introduction','full_view_approved','introduction_declined',
      'full_view_renewed','full_view_revoked','full_view_expiring',
      'full_view_access_expiring'
    )
  );

create function app_private.enqueue_relationship_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  notification text;
begin
  if new.event_type = 'request_submitted' then
    select portfolio.user_id into recipient from public.portfolios portfolio where portfolio.id = new.portfolio_id;
    notification := 'new_introduction';
  elsif new.event_type = 'grant_created' then recipient := new.subject_user_id; notification := 'full_view_approved';
  elsif new.event_type = 'request_rejected' then recipient := new.subject_user_id; notification := 'introduction_declined';
  elsif new.event_type = 'grant_renewed' then recipient := new.subject_user_id; notification := 'full_view_renewed';
  elsif new.event_type = 'grant_revoked' and new.metadata ->> 'reason' = 'request_rejected' then return new;
  elsif new.event_type = 'grant_revoked' then recipient := new.subject_user_id; notification := 'full_view_revoked';
  else return new;
  end if;
  if recipient is not null then
    insert into app_private.notification_outbox(
      recipient_user_id, notification_type, interest_request_id, grant_id,
      deduplication_key, payload
    ) values (
      recipient, notification, new.interest_request_id, new.grant_id,
      'relationship:' || new.id::text || ':' || notification,
      pg_catalog.jsonb_build_object('portfolioId', new.portfolio_id, 'eventId', new.id)
    ) on conflict (deduplication_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger enqueue_relationship_notification
after insert on public.access_audit_events
for each row execute function app_private.enqueue_relationship_notification();

create function public.enqueue_due_full_view_expiry_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'notification scheduling unavailable' using errcode = '42501';
  end if;
  insert into app_private.notification_outbox(
    recipient_user_id, notification_type, interest_request_id, grant_id,
    deduplication_key, payload
  )
  select recipients.recipient_user_id, recipients.notification_type, recipients.interest_request_id,
    recipients.grant_id, recipients.deduplication_key, recipients.payload
  from (
  select grant_record.viewer_user_id as recipient_user_id,
    'full_view_expiring'::text as notification_type,
    grant_record.interest_request_id, grant_record.id as grant_id,
    'full-view-expiring:viewer:' || grant_record.id::text || ':' || grant_record.expires_at::date::text as deduplication_key,
    pg_catalog.jsonb_build_object('audience', 'viewer', 'expiresAt', grant_record.expires_at, 'portfolioId', grant_record.portfolio_id) as payload
  from public.reveal_grants grant_record
  where grant_record.revoked_at is null
    and grant_record.viewer_user_id is not null
    and grant_record.expires_at > pg_catalog.now()
    and grant_record.expires_at <= pg_catalog.now() + interval '24 hours'
  union all
  select portfolio_record.user_id, 'full_view_access_expiring'::text,
    grant_record.interest_request_id, grant_record.id,
    'full-view-expiring:owner:' || grant_record.id::text || ':' || grant_record.expires_at::date::text,
    pg_catalog.jsonb_build_object('audience', 'owner', 'expiresAt', grant_record.expires_at, 'portfolioId', grant_record.portfolio_id)
  from public.reveal_grants grant_record
  join public.portfolios portfolio_record on portfolio_record.id = grant_record.portfolio_id
  where grant_record.revoked_at is null
    and grant_record.expires_at > pg_catalog.now()
    and grant_record.expires_at <= pg_catalog.now() + interval '24 hours'
  ) recipients
  on conflict (deduplication_key) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- A versioned claim projection keeps the original pilot worker contract stable
-- while exposing relationship context to the production notification worker.
create function public.claim_notification_outbox_v2(p_limit integer default 10)
returns table (
  notification_ref text,
  recipient_user_id uuid,
  notification_type text,
  attempt_count integer,
  interest_request_id uuid,
  grant_id uuid,
  payload jsonb
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
      outbox.notification_type, outbox.attempt_count,
      outbox.interest_request_id, outbox.grant_id, outbox.payload
  )
  select * from claimed;
end;
$$;

revoke all on function app_private.portfolio_draft_fingerprint(jsonb) from public, anon, authenticated;
revoke all on function app_private.portfolio_missing_required_details(uuid, jsonb) from public, anon, authenticated;
revoke all on function app_private.owner_publication_readiness() from public, anon, authenticated;
revoke all on function app_private.invalidate_publication_disclosure() from public, anon, authenticated;
revoke all on function app_private.enforce_paid_disclosed_publication() from public, anon, authenticated;
revoke all on function app_private.enqueue_relationship_notification() from public, anon, authenticated;
revoke all on function public.get_portfolio_publication_readiness() from public, anon, authenticated;
revoke all on function public.update_portfolio_onboarding_progress(text, text) from public, anon, authenticated;
revoke all on function public.record_portfolio_payment_event(uuid, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.enqueue_due_full_view_expiry_reminders() from public, anon, authenticated;
revoke all on function public.claim_notification_outbox_v2(integer) from public, anon, authenticated;
grant execute on function public.get_portfolio_publication_readiness() to authenticated;
grant execute on function public.update_portfolio_onboarding_progress(text, text) to authenticated;
grant execute on function public.record_portfolio_payment_event(uuid, text, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.enqueue_due_full_view_expiry_reminders() to service_role;
grant execute on function public.claim_notification_outbox_v2(integer) to service_role;

comment on table app_private.portfolio_publication_progress is
  'Provider-neutral owner journey. Verification is derived; payment and disclosure are server-authoritative publication gates.';
comment on function public.record_portfolio_payment_event(uuid, text, text, text, text, text, text, timestamptz) is
  'Service-role payment webhook command with payload idempotency and verification-before-payment enforcement.';
