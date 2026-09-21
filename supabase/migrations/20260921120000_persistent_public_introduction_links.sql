-- Public introductions are durable until their owner unpublishes them.
-- Approved Complete Portfolio grants keep their separate 15-day lifetime.

create or replace function app_private.publish_portfolio_transaction(
  p_portfolio_id uuid,
  p_draft_data jsonb,
  p_public_data jsonb,
  p_approved_data jsonb,
  p_share_token text,
  p_expires_at timestamptz,
  p_template_id integer,
  p_theme_color text,
  p_sun_sign text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  portfolio_record public.portfolios%rowtype;
  effective_token text;
  published_time timestamptz := pg_catalog.now();
  result_action text;
begin
  if actor_id is null then return '{"status":"unauthorized"}'::jsonb; end if;
  if not app_private.actor_can_create_portfolio(actor_id) then
    return '{"status":"creator_entitlement_required"}'::jsonb;
  end if;

  select portfolio.* into portfolio_record
  from public.portfolios portfolio
  where portfolio.id = p_portfolio_id
    and public.can_manage_portfolio(portfolio.id)
  for update;
  if portfolio_record.id is null then return '{"status":"not_found"}'::jsonb; end if;

  if not exists (select 1 from app_private.current_identity_verification(portfolio_record.candidate_id)) then
    return '{"status":"verification_required"}'::jsonb;
  end if;

  effective_token := coalesce(portfolio_record.share_token, p_share_token);
  if effective_token is null or pg_catalog.length(effective_token) <> 21 or effective_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid publication lifecycle values' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.portfolio_media media
    where media.portfolio_id = portfolio_record.id
      and media.media_type = 'hero'
      and media.visibility in ('public', 'blurred', 'interest_required', 'approved_only')
  ) then
    return '{"status":"not_ready"}'::jsonb;
  end if;

  result_action := case when portfolio_record.is_published then 'updated' else 'created' end;
  update public.portfolios
  set draft_data = p_draft_data, published_data = p_draft_data, is_published = true,
      published_at = published_time, sun_sign = p_sun_sign, theme_color = p_theme_color,
      template_id = p_template_id, share_token = effective_token, expires_at = null
  where id = portfolio_record.id;

  insert into public.public_portfolio_snapshots (
    portfolio_id, share_token, data, template_id, theme_color, sun_sign,
    expires_at, published_at, is_active
  ) values (
    portfolio_record.id, effective_token, p_public_data, p_template_id,
    p_theme_color, p_sun_sign, null, published_time, true
  ) on conflict (portfolio_id) do update set
    share_token = excluded.share_token, data = excluded.data,
    template_id = excluded.template_id, theme_color = excluded.theme_color,
    sun_sign = excluded.sun_sign, expires_at = null,
    published_at = excluded.published_at, is_active = true;

  insert into public.approved_portfolio_snapshots (
    portfolio_id, data, template_id, theme_color, sun_sign, published_at
  ) values (
    portfolio_record.id, p_approved_data, p_template_id, p_theme_color,
    p_sun_sign, published_time
  ) on conflict (portfolio_id) do update set
    data = excluded.data, template_id = excluded.template_id,
    theme_color = excluded.theme_color, sun_sign = excluded.sun_sign,
    published_at = excluded.published_at;

  update public.portfolio_horoscopes set published_at = published_time
  where portfolio_id = portfolio_record.id;

  return pg_catalog.jsonb_build_object(
    'status', 'ok', 'action', result_action, 'shareToken', effective_token,
    'expiresAt', null
  );
end;
$$;

create or replace function app_private.renew_portfolio_transaction(p_expires_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  portfolio_record public.portfolios%rowtype;
  affected_rows integer;
begin
  if auth.uid() is null then return '{"status":"unauthorized"}'::jsonb; end if;
  if not app_private.actor_can_create_portfolio(auth.uid()) then
    return '{"status":"creator_entitlement_required"}'::jsonb;
  end if;
  select portfolio.* into portfolio_record
  from public.portfolios portfolio
  where portfolio.user_id = auth.uid()
  for update;
  if portfolio_record.id is null or not portfolio_record.is_published then
    return '{"status":"not_published"}'::jsonb;
  end if;

  update public.portfolios
  set expires_at = null, last_renewed_at = pg_catalog.now()
  where id = portfolio_record.id;
  update public.public_portfolio_snapshots
  set expires_at = null, is_active = true
  where portfolio_id = portfolio_record.id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'public snapshot missing' using errcode = 'P0001'; end if;
  return pg_catalog.jsonb_build_object('status', 'renewed', 'expiresAt', null);
end;
$$;

-- Existing published introductions adopt the durable-link policy immediately.
update public.portfolios set expires_at = null where is_published = true;
update public.public_portfolio_snapshots snapshot
set expires_at = null
where exists (
  select 1 from public.portfolios portfolio
  where portfolio.id = snapshot.portfolio_id and portfolio.is_published = true
);

comment on function app_private.publish_portfolio_transaction(uuid, jsonb, jsonb, jsonb, text, timestamptz, integer, text, text)
is 'Publishes one durable public introduction. p_expires_at is retained for API compatibility and ignored.';
comment on function app_private.renew_portfolio_transaction(timestamptz)
is 'Reactivates a public introduction until its owner unpublishes it. p_expires_at is retained for API compatibility and ignored.';
