-- Resolve identity-bound Complete Portfolio email links without turning the
-- link itself into a bearer credential, and expose a relationship-only outbox
-- claim so pilot notifications cannot be consumed by the wrong worker.

create function public.resolve_complete_portfolio_access(p_grant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  grant_record public.reveal_grants%rowtype;
  portfolio_record public.portfolios%rowtype;
begin
  perform app_private.require_current_session();

  if auth.uid() is null then
    return '{"status":"signin_required"}'::jsonb;
  end if;

  select grant_row.* into grant_record
  from public.reveal_grants grant_row
  where grant_row.id = p_grant_id
    and grant_row.viewer_user_id = auth.uid();

  if grant_record.id is null then
    return '{"status":"unavailable"}'::jsonb;
  end if;
  if grant_record.revoked_at is not null then
    return '{"status":"revoked"}'::jsonb;
  end if;
  if grant_record.expires_at <= pg_catalog.now() then
    return '{"status":"expired"}'::jsonb;
  end if;

  select portfolio_row.* into portfolio_record
  from public.portfolios portfolio_row
  where portfolio_row.id = grant_record.portfolio_id
    and portfolio_row.is_published = true
    and portfolio_row.share_token is not null
    and (portfolio_row.expires_at is null or portfolio_row.expires_at > pg_catalog.now());

  if portfolio_record.id is null then
    return '{"status":"unavailable"}'::jsonb;
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'active',
    'shareToken', portfolio_record.share_token,
    'expiresAt', grant_record.expires_at
  );
end;
$$;

create function public.claim_relationship_notification_outbox(p_limit integer default 10)
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
    select outbox.id
    from app_private.notification_outbox outbox
    where outbox.notification_type in (
      'new_introduction','full_view_approved','introduction_declined',
      'full_view_renewed','full_view_revoked','full_view_expiring',
      'full_view_access_expiring'
    )
      and outbox.attempt_count < 5
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

revoke all on function public.resolve_complete_portfolio_access(uuid) from public, anon, authenticated;
revoke all on function public.claim_relationship_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.resolve_complete_portfolio_access(uuid) to authenticated;
grant execute on function public.claim_relationship_notification_outbox(integer) to service_role;

comment on function public.resolve_complete_portfolio_access(uuid) is
  'Resolves a Complete Portfolio email landing link only for its authenticated viewer; the URL alone grants nothing.';
