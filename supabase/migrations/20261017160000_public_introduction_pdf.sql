-- Public PDF is a dated snapshot; this separate bearer channel grants no private access.
create table app_private.portfolio_pdf_channels (
  code text primary key check (code ~ '^[A-Za-z0-9_-]{32}$'),
  portfolio_id uuid references public.portfolios(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  revoked_at timestamptz
);
create unique index portfolio_pdf_one_active on app_private.portfolio_pdf_channels(portfolio_id)
  where active and portfolio_id is not null;
alter table app_private.portfolio_pdf_channels enable row level security;
revoke all on app_private.portfolio_pdf_channels from public, anon, authenticated;

-- Retired opaque tokens remain reserved without retaining a customer association.
create table app_private.portfolio_web_token_reservations (token text primary key);
alter table app_private.portfolio_web_token_reservations enable row level security;
revoke all on app_private.portfolio_web_token_reservations from public, anon, authenticated;
insert into app_private.portfolio_web_token_reservations(token)
select share_token from public.portfolios where share_token is not null;

create function app_private.reserve_portfolio_web_token()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.share_token is not null and (tg_op = 'INSERT' or new.share_token is distinct from old.share_token) then
    insert into app_private.portfolio_web_token_reservations(token) values(new.share_token);
  end if;
  return new;
end;
$$;
create trigger reserve_portfolio_web_token before insert or update of share_token on public.portfolios
for each row execute function app_private.reserve_portfolio_web_token();

create function app_private.invalidate_portfolio_pdf_channels()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.share_token is distinct from old.share_token then
    update app_private.portfolio_pdf_channels set active=false, revoked_at=pg_catalog.now()
    where portfolio_id=old.id and active;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger invalidate_portfolio_pdf_channels before update of share_token or delete on public.portfolios
for each row execute function app_private.invalidate_portfolio_pdf_channels();
revoke all on function app_private.reserve_portfolio_web_token(), app_private.invalidate_portfolio_pdf_channels()
from public, anon, authenticated;

-- The row lock serializes creation with rotation, publication, and deletion.
create function public.prepare_portfolio_pdf()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.portfolios%rowtype;
  projection jsonb;
  channel text;
  quota app_private.api_rate_limits%rowtype;
begin
  perform app_private.require_current_session();
  select * into p from public.portfolios where user_id=auth.uid() for update;
  if p.id is null then return '{"status":"unavailable"}'::jsonb; end if;
  projection := public.resolve_public_portfolio(p.share_token);
  if projection is null then return '{"status":"unavailable"}'::jsonb; end if;

  insert into app_private.api_rate_limits(action,subject_key,window_started_at,request_count,updated_at)
  values('portfolio_pdf','user:'||auth.uid()::text,pg_catalog.now(),1,pg_catalog.now())
  on conflict(action,subject_key) do update set
    window_started_at=case when app_private.api_rate_limits.window_started_at<=pg_catalog.now()-interval '1 hour' then pg_catalog.now() else app_private.api_rate_limits.window_started_at end,
    request_count=case when app_private.api_rate_limits.window_started_at<=pg_catalog.now()-interval '1 hour' then 1 else app_private.api_rate_limits.request_count+1 end,
    updated_at=pg_catalog.now()
  returning * into quota;
  if quota.request_count>10 then return '{"status":"rate_limited"}'::jsonb; end if;

  select code into channel from app_private.portfolio_pdf_channels where portfolio_id=p.id and active;
  if channel is null then
    for attempt in 1..3 loop
      -- Two UUIDv4 values provide > 192 random bits; hash into 32 URL-safe symbols.
      channel := pg_catalog.substr(pg_catalog.translate(pg_catalog.encode(
        extensions.digest(pg_catalog.gen_random_uuid()::text||pg_catalog.gen_random_uuid()::text,'sha256'),
        'base64'),'+/','-_'),1,32);
      begin
        insert into app_private.portfolio_pdf_channels(code,portfolio_id) values(channel,p.id);
        exit;
      exception when unique_violation then
        channel := null;
      end;
    end loop;
    if channel is null then raise exception 'PDF channel unavailable'; end if;
  end if;
  return pg_catalog.jsonb_build_object('status','ready','code',channel,'shareToken',p.share_token,'projection',projection);
end;
$$;

create function public.validate_portfolio_pdf(p_code text, p_projection jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_projection jsonb;
begin
  perform app_private.require_current_session();
  select public.resolve_public_portfolio(p.share_token) into current_projection
  from app_private.portfolio_pdf_channels c join public.portfolios p on p.id=c.portfolio_id
  where c.code=p_code and c.active and p.user_id=auth.uid();
  return current_projection is not null and current_projection=p_projection;
end;
$$;

create function public.resolve_portfolio_pdf_link(p_code text)
returns text language sql stable security definer set search_path = '' as $$
  select p.share_token from app_private.portfolio_pdf_channels c
  join public.portfolios p on p.id=c.portfolio_id
  where p_code ~ '^[A-Za-z0-9_-]{32}$' and c.code=p_code and c.active
    and public.is_published_portfolio(p.id)
$$;
revoke all on function public.prepare_portfolio_pdf(), public.validate_portfolio_pdf(text,jsonb), public.resolve_portfolio_pdf_link(text)
from public, anon, authenticated;
grant execute on function public.prepare_portfolio_pdf(), public.validate_portfolio_pdf(text,jsonb) to authenticated;
grant execute on function public.resolve_portfolio_pdf_link(text) to anon, authenticated;

comment on table app_private.portfolio_pdf_channels is
'Separate public-only PDF references. Never delete retired codes. Deletion removes the portfolio association; no identity or profile content is retained here.';
