-- Extend newly approved and renewed Complete Portfolio grants from 7 to 15 days.
-- Existing active grants keep their current expiry until the owner renews them.

alter table public.reveal_grants
  alter column expires_at set default (pg_catalog.now() + interval '15 days');

create or replace function app_private.decide_interest_request(
  p_interest_request_id uuid,
  p_decision text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  interest_record public.interest_requests%rowtype;
  grant_record public.reveal_grants%rowtype;
  grant_expiry timestamptz := pg_catalog.now() + interval '15 days';
begin
  if auth.uid() is null then return 'unauthorized'; end if;
  if p_decision not in ('approved', 'rejected', 'reopened') then
    raise exception 'invalid interest decision' using errcode = '22023';
  end if;

  select request_record.* into interest_record
  from public.interest_requests request_record
  where request_record.id = p_interest_request_id
    and public.can_manage_portfolio(request_record.portfolio_id)
  for update;
  if interest_record.id is null then return 'not_found'; end if;

  if p_decision = 'reopened' then
    if interest_record.status in ('new', 'pending_review') then return 'already_open'; end if;
    if interest_record.status <> 'rejected' then return 'invalid_transition'; end if;
    update public.interest_requests
    set status = 'pending_review', decided_at = null, decided_by = null,
        updated_at = pg_catalog.now()
    where id = interest_record.id;
    insert into public.access_audit_events (
      portfolio_id, interest_request_id, actor_user_id, subject_user_id, event_type
    ) values (
      interest_record.portfolio_id, interest_record.id, auth.uid(),
      interest_record.requester_user_id, 'request_reopened'
    );
    return 'reopened';
  end if;

  if p_decision = 'approved' then
    if interest_record.requester_user_id is null then return 'signin_required'; end if;
    if interest_record.email_verified_at is null or interest_record.verification_channel <> 'email' then
      return 'verification_required';
    end if;
    if interest_record.status in ('approved', 'revealed') then return 'already_approved'; end if;
    if interest_record.status not in ('new', 'pending_review') then return 'invalid_transition'; end if;

    update public.interest_requests
    set status = 'approved', decided_at = pg_catalog.now(), decided_by = auth.uid(),
        updated_at = pg_catalog.now()
    where id = interest_record.id;

    insert into public.reveal_grants (
      interest_request_id, portfolio_id, viewer_user_id, access_level,
      granted_sections, granted_by, expires_at
    ) values (
      interest_record.id, interest_record.portfolio_id,
      interest_record.requester_user_id, 'full', array['full']::text[],
      auth.uid(), grant_expiry
    ) returning * into grant_record;

    insert into public.access_audit_events (
      portfolio_id, interest_request_id, grant_id, actor_user_id,
      subject_user_id, event_type, metadata
    ) values (
      interest_record.portfolio_id, interest_record.id, grant_record.id,
      auth.uid(), interest_record.requester_user_id, 'grant_created',
      pg_catalog.jsonb_build_object('expires_at', grant_record.expires_at, 'duration_days', 15)
    );
    return 'approved';
  end if;

  if interest_record.status = 'rejected' then return 'already_rejected'; end if;
  if interest_record.status not in ('new', 'pending_review', 'approved', 'revealed') then
    return 'invalid_transition';
  end if;
  update public.interest_requests
  set status = 'rejected', decided_at = pg_catalog.now(), decided_by = auth.uid(),
      updated_at = pg_catalog.now()
  where id = interest_record.id;

  for grant_record in
    update public.reveal_grants
    set revoked_at = pg_catalog.now(), revocation_reason = 'request_rejected'
    where interest_request_id = interest_record.id and revoked_at is null
    returning *
  loop
    insert into public.access_audit_events (
      portfolio_id, interest_request_id, grant_id, actor_user_id,
      subject_user_id, event_type, metadata
    ) values (
      interest_record.portfolio_id, interest_record.id, grant_record.id,
      auth.uid(), interest_record.requester_user_id, 'grant_revoked',
      '{"reason":"request_rejected"}'::jsonb
    );
  end loop;

  insert into public.access_audit_events (
    portfolio_id, interest_request_id, actor_user_id, subject_user_id, event_type
  ) values (
    interest_record.portfolio_id, interest_record.id, auth.uid(),
    interest_record.requester_user_id, 'request_rejected'
  );
  return 'rejected';
end;
$$;

create or replace function app_private.manage_reveal_grant(
  p_grant_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  grant_record public.reveal_grants%rowtype;
  new_expiry timestamptz;
begin
  if auth.uid() is null then return '{"status":"unauthorized"}'::jsonb; end if;
  if p_action not in ('renew', 'revoke') then
    raise exception 'invalid grant action' using errcode = '22023';
  end if;

  select grant_row.* into grant_record
  from public.reveal_grants grant_row
  where grant_row.id = p_grant_id
    and public.can_manage_portfolio(grant_row.portfolio_id)
  for update;
  if grant_record.id is null then return '{"status":"not_found"}'::jsonb; end if;

  if p_action = 'revoke' then
    if grant_record.revoked_at is not null then return '{"status":"already_revoked"}'::jsonb; end if;
    update public.reveal_grants
    set revoked_at = pg_catalog.now(), revocation_reason = 'owner_revoked'
    where id = grant_record.id;
    update public.interest_requests
    set status = 'rejected', decided_at = pg_catalog.now(), decided_by = auth.uid(),
        updated_at = pg_catalog.now()
    where id = grant_record.interest_request_id;
    insert into public.access_audit_events (
      portfolio_id, interest_request_id, grant_id, actor_user_id,
      subject_user_id, event_type, metadata
    ) values (
      grant_record.portfolio_id, grant_record.interest_request_id, grant_record.id,
      auth.uid(), grant_record.viewer_user_id, 'grant_revoked',
      '{"reason":"owner_revoked"}'::jsonb
    );
    return '{"status":"revoked"}'::jsonb;
  end if;

  if grant_record.revoked_at is not null then return '{"status":"revoked"}'::jsonb; end if;
  if not exists (
    select 1 from public.interest_requests request_record
    where request_record.id = grant_record.interest_request_id
      and request_record.status in ('approved', 'revealed')
      and request_record.email_verified_at is not null
  ) then
    return '{"status":"invalid_transition"}'::jsonb;
  end if;

  new_expiry := pg_catalog.now() + interval '15 days';
  update public.reveal_grants
  set expires_at = new_expiry, renewed_at = pg_catalog.now()
  where id = grant_record.id;
  insert into public.access_audit_events (
    portfolio_id, interest_request_id, grant_id, actor_user_id,
    subject_user_id, event_type, metadata
  ) values (
    grant_record.portfolio_id, grant_record.interest_request_id, grant_record.id,
    auth.uid(), grant_record.viewer_user_id, 'grant_renewed',
    pg_catalog.jsonb_build_object('expires_at', new_expiry, 'duration_days', 15)
  );
  return pg_catalog.jsonb_build_object('status', 'renewed', 'expiresAt', new_expiry);
end;
$$;

create or replace function app_private.enforce_full_view_lifetime()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start timestamptz := coalesce(new.renewed_at, new.created_at, pg_catalog.now());
begin
  if new.expires_at is null or new.expires_at > window_start + interval '15 days' then
    raise exception 'complete portfolio grants cannot exceed fifteen days' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function app_private.decide_interest_request(uuid, text) from public, anon, authenticated;
revoke all on function app_private.manage_reveal_grant(uuid, text) from public, anon, authenticated;
revoke all on function app_private.enforce_full_view_lifetime() from public, anon, authenticated;

comment on function public.decide_interest_request(uuid, text) is
  'Owner decision command. Approval requires a verified email and creates 15 days of Complete Portfolio access.';
comment on function public.manage_reveal_grant(uuid, text) is
  'Owner grant command. Renewal resets Complete Portfolio access to 15 days from the action time.';
comment on column public.reveal_grants.expires_at is
  'Required Complete Portfolio expiry. New approvals and owner renewals last 15 days.';
