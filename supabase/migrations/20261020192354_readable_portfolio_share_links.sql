-- Human-readable public Introduction identifiers. These paths are identifiers,
-- not secrets; Complete access continues to use authenticated reveal grants.
-- Retain digest-only tombstones so issued paths cannot be reassigned, including
-- after account deletion. Digests of names are guessable, not anonymized data.
create table app_private.portfolio_share_path_reservations (
  path_hash bytea primary key check (pg_catalog.octet_length(path_hash) = 32)
);
alter table app_private.portfolio_share_path_reservations enable row level security;
revoke all on app_private.portfolio_share_path_reservations from public, anon, authenticated, service_role;

insert into app_private.portfolio_share_path_reservations(path_hash)
select extensions.digest(path, 'sha256') from (
  select share_token as path from public.portfolios where share_token is not null
  union select share_token from public.public_portfolio_snapshots where share_token is not null
) existing_paths on conflict do nothing;

create function app_private.reserve_portfolio_share_path(p_data jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  first_name text := coalesce(nullif(pg_catalog.btrim(p_data #>> '{personal,first_name}'), ''),
    pg_catalog.split_part(pg_catalog.btrim(p_data #>> '{personal,name}'), ' ', 1));
  last_name text := coalesce(nullif(pg_catalog.btrim(p_data #>> '{personal,last_name}'), ''),
    pg_catalog.substring(pg_catalog.btrim(p_data #>> '{personal,name}'), '\S+$'));
  base_path text;
  candidate_path text;
  inserted_rows integer;
begin
  -- Match canonical ASCII names, never derive a URL from other profile fields.
  if first_name is null or last_name is null
    or pg_catalog.length(first_name) not between 1 and 50
    or pg_catalog.length(last_name) not between 1 and 50
    or first_name !~ '^[A-Za-z ''-]+$' or last_name !~ '^[A-Za-z ''-]+$'
  then raise exception 'invalid portfolio link name' using errcode = '22023'; end if;
  first_name := pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.replace(first_name, '''', '')), '[^a-z]+', '-', 'g'), '-');
  last_name := pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.replace(last_name, '''', '')), '[^a-z]+', '-', 'g'), '-');
  if first_name = '' or last_name = '' then
    raise exception 'invalid portfolio link name' using errcode = '22023';
  end if;
  base_path := first_name || '-' || last_name;
  -- Unique INSERT arbitrates concurrent publications without a read/write race.
  -- A failed transaction rolls back its reservation. Bound collision work.
  for ordinal in 1..10000 loop
    candidate_path := base_path || case when ordinal = 1 then '' else '-' || ordinal::text end;
    insert into app_private.portfolio_share_path_reservations(path_hash)
    values (extensions.digest(candidate_path, 'sha256')) on conflict do nothing;
    get diagnostics inserted_rows = row_count;
    if inserted_rows = 1 then return candidate_path; end if;
  end loop;
  raise exception 'portfolio link name exhausted' using errcode = '54000';
end;
$$;
revoke all on function app_private.reserve_portfolio_share_path(jsonb) from public, anon, authenticated, service_role;

create or replace function app_private.publish_portfolio_transaction(
  p_portfolio_id uuid, p_draft_data jsonb, p_public_data jsonb,
  p_approved_data jsonb, p_share_token text, p_expires_at timestamptz,
  p_template_id integer, p_theme_color text, p_sun_sign text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  portfolio_record public.portfolios%rowtype;
  effective_token text;
  published_time timestamptz := pg_catalog.now();
  result_action text;
  reserved_rows integer;
begin
  if actor_id is null then return '{"status":"unauthorized"}'::jsonb; end if;
  if not app_private.actor_can_create_portfolio(actor_id) then
    return '{"status":"creator_entitlement_required"}'::jsonb;
  end if;
  select portfolio.* into portfolio_record from public.portfolios portfolio
  where portfolio.id = p_portfolio_id and public.can_manage_portfolio(portfolio.id)
  for update;
  if portfolio_record.id is null then return '{"status":"not_found"}'::jsonb; end if;
  if not app_private.personal_publication_verification_satisfied(portfolio_record.candidate_id) then
    return '{"status":"verification_required"}'::jsonb;
  end if;
  if not exists (
    select 1 from public.portfolio_media media
    where media.portfolio_id=portfolio_record.id and media.media_type='hero'
      and media.visibility in ('public','blurred','interest_required','approved_only')
  ) then return '{"status":"not_ready"}'::jsonb; end if;
  -- Existing URLs stay stable on ordinary publication and name edits.
  -- An empty argument opts the updated app into DB-owned naming. During a
  -- schema-first rollout the previous trusted server may still send Nano IDs.
  -- Browsers cannot invoke the service-only publication command.
  effective_token := portfolio_record.share_token;
  if effective_token is null then
    if coalesce(p_share_token, '') = '' then
      effective_token := app_private.reserve_portfolio_share_path(p_draft_data);
    else
      if pg_catalog.length(p_share_token) <> 21 or p_share_token !~ '^[A-Za-z0-9_-]+$' then
        raise exception 'invalid publication lifecycle values' using errcode = '22023';
      end if;
      insert into app_private.portfolio_share_path_reservations(path_hash)
      values (extensions.digest(p_share_token, 'sha256')) on conflict do nothing;
      get diagnostics reserved_rows = row_count;
      if reserved_rows = 0 then
        raise exception 'portfolio link already reserved' using errcode = '23505';
      end if;
      effective_token := p_share_token;
    end if;
  end if;
  if effective_token is null or pg_catalog.length(effective_token) not between 3 and 160 or effective_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid publication lifecycle values' using errcode='22023';
  end if;
  result_action := case when portfolio_record.is_published then 'updated' else 'created' end;
  update public.portfolios
  set draft_data=p_draft_data, published_data=p_draft_data, is_published=true,
      published_at=published_time, sun_sign=p_sun_sign, theme_color=p_theme_color,
      template_id=p_template_id, share_token=effective_token, expires_at=null
  where id=portfolio_record.id;
  insert into public.public_portfolio_snapshots (
    portfolio_id, share_token, data, template_id, theme_color, sun_sign,
    expires_at, published_at, is_active
  ) values (
    portfolio_record.id,effective_token,p_public_data,p_template_id,
    p_theme_color,p_sun_sign,null,published_time,true
  ) on conflict (portfolio_id) do update set
    share_token=excluded.share_token,data=excluded.data,template_id=excluded.template_id,
    theme_color=excluded.theme_color,sun_sign=excluded.sun_sign,expires_at=null,
    published_at=excluded.published_at,is_active=true;
  insert into public.approved_portfolio_snapshots (
    portfolio_id,data,template_id,theme_color,sun_sign,published_at
  ) values (
    portfolio_record.id,p_approved_data,p_template_id,p_theme_color,p_sun_sign,published_time
  ) on conflict (portfolio_id) do update set
    data=excluded.data,template_id=excluded.template_id,theme_color=excluded.theme_color,
    sun_sign=excluded.sun_sign,published_at=excluded.published_at;
  update public.portfolio_horoscopes set published_at=published_time
  where portfolio_id=portfolio_record.id;
  return pg_catalog.jsonb_build_object(
    'status','ok','action',result_action,'shareToken',effective_token,'expiresAt',null
  );
end;
$$;

create or replace function app_private.rotate_portfolio_transaction(p_share_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  portfolio_record public.portfolios%rowtype;
  grant_record public.reveal_grants%rowtype;
  affected_rows integer;
begin
  if auth.uid() is null then return '{"status":"unauthorized"}'::jsonb; end if;
  select portfolio.* into portfolio_record
  from public.portfolios portfolio
  where portfolio.user_id = auth.uid()
  for update;
  if portfolio_record.id is null or not portfolio_record.is_published then
    return '{"status":"not_published"}'::jsonb;
  end if;

  -- Never leak unreviewed private draft names through a replacement URL.
  p_share_token := app_private.reserve_portfolio_share_path(portfolio_record.published_data);
  update public.portfolios set share_token = p_share_token
  where id = portfolio_record.id;
  update public.public_portfolio_snapshots
  set share_token = p_share_token, is_active = true
  where portfolio_id = portfolio_record.id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'public snapshot missing' using errcode = 'P0001';
  end if;

  for grant_record in
    update public.reveal_grants
    set revoked_at = pg_catalog.now(), revocation_reason = 'portfolio_rotated'
    where portfolio_id = portfolio_record.id and revoked_at is null
    returning *
  loop
    insert into public.access_audit_events (
      portfolio_id, interest_request_id, grant_id, actor_user_id,
      subject_user_id, event_type, metadata
    ) values (
      portfolio_record.id, grant_record.interest_request_id, grant_record.id,
      auth.uid(), grant_record.viewer_user_id, 'grant_revoked',
      '{"reason":"portfolio_rotated"}'::jsonb
    );
  end loop;
  update public.interest_requests
  set status = 'closed', updated_at = pg_catalog.now()
  where portfolio_id = portfolio_record.id and status in ('approved', 'revealed');
  insert into public.access_audit_events (
    portfolio_id, actor_user_id, event_type
  ) values (portfolio_record.id, auth.uid(), 'portfolio_rotated');
  return pg_catalog.jsonb_build_object('status', 'rotated', 'shareToken', p_share_token);
end;
$$;

-- Retain the current resolver/quota implementations and ACLs; only their
-- path-length guard changes. An allowlisted catalog edit avoids duplicating
-- large privacy projections. Source/count checks fail on unexpected drift.
do $migration$
declare
  item record;
  definition text;
  updated_count integer := 0;
begin
  for item in
    select procedure.oid from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    where (namespace.nspname, procedure.proname) in (
      ('app_private', 'resolve_public_portfolio'),
      ('app_private', 'submit_public_interest'),
      ('public', 'resolve_public_portfolio_status'),
      ('public', 'resolve_public_portfolio_identity_verified')
    )
  loop
    definition := pg_catalog.pg_get_functiondef(item.oid);
    if pg_catalog.strpos(definition, 'between 8 and 160') = 0 then
      raise exception 'unexpected share-path validation in %', item.oid::regprocedure;
    end if;
    execute pg_catalog.replace(definition, 'between 8 and 160', 'between 3 and 160');
    updated_count := updated_count + 1;
  end loop;
  if updated_count <> 4 then raise exception 'unexpected share-path validator count: %', updated_count; end if;
end;
$migration$;

comment on table app_private.portfolio_share_path_reservations is
  'Permanent digest-only issued-path tombstones prevent URL reassignment; no owner/profile association. Digests of names remain guessable, not anonymized.';

-- Only guarded SECURITY DEFINER lifecycle commands may change a link. A direct
-- owner table write must not reactivate an issued/retired name outside allocation.
create function app_private.protect_portfolio_share_path()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('postgres', 'supabase_admin') and
    ((tg_op = 'INSERT' and new.share_token is not null)
      or (tg_op = 'UPDATE' and new.share_token is distinct from old.share_token)) then
    raise exception 'use the portfolio link lifecycle command' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_portfolio_share_path() from public, anon, authenticated, service_role;
create trigger protect_portfolio_share_path before insert or update of share_token on public.portfolios
for each row execute function app_private.protect_portfolio_share_path();
